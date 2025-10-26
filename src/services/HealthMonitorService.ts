import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectRepository } from '../models/ProjectRepository';
import { VideoRepository } from '../models/VideoRepository';
import { ProcessingJobRepository } from '../models/ProcessingJobRepository';
import { jobQueue } from './JobQueue';

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
    usage: number; // percentage
  };
  disk: {
    used: number;
    free: number;
    total: number;
    usage: number; // percentage
  };
  database: {
    connected: boolean;
    responseTime: number;
  };
  queue: {
    pending: number;
    processing: number;
    failed: number;
  };
  services: {
    ffmpeg: boolean;
    uploads: boolean;
  };
  errors: string[];
}

export interface Analytics {
  projects: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
  };
  videos: {
    total: number;
    totalSize: number;
    averageSize: number;
    uploadedToday: number;
    uploadedThisWeek: number;
    uploadedThisMonth: number;
  };
  processing: {
    totalJobs: number;
    successRate: number;
    averageProcessingTime: number;
    failureReasons: { [key: string]: number };
  };
  performance: {
    averageUploadTime: number;
    averageSyncTime: number;
    averageStitchingTime: number;
  };
}

export class HealthMonitorService {
  private projectRepo: ProjectRepository;
  private videoRepo: VideoRepository;
  private jobRepo: ProcessingJobRepository;
  private healthHistory: SystemHealth[] = [];
  private maxHistorySize = 100;

  constructor() {
    this.projectRepo = new ProjectRepository();
    this.videoRepo = new VideoRepository();
    this.jobRepo = new ProcessingJobRepository();
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: this.getMemoryStats(),
      disk: await this.getDiskStats(),
      database: await this.getDatabaseHealth(),
      queue: await this.getQueueStats(),
      services: await this.getServiceHealth(),
      errors: []
    };

    // Determine overall health status
    health.status = this.calculateHealthStatus(health);

    // Store in history
    this.healthHistory.push(health);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }

    return health;
  }

  /**
   * Get memory usage statistics
   */
  private getMemoryStats() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      used: usedMem,
      free: freeMem,
      total: totalMem,
      usage: (usedMem / totalMem) * 100
    };
  }

  /**
   * Get disk usage statistics
   */
  private async getDiskStats() {
    const uploadsPath = path.join(process.cwd(), 'uploads');
    let totalSize = 0;

    try {
      if (fs.existsSync(uploadsPath)) {
        totalSize = await this.calculateDirectorySize(uploadsPath);
      }
    } catch (error) {
      console.error('Failed to calculate disk usage:', error);
    }

    // Get system disk stats (simplified)
    const stats = fs.statSync(process.cwd());
    const diskTotal = 100 * 1024 * 1024 * 1024; // Assume 100GB for demo
    const diskUsed = totalSize;
    const diskFree = diskTotal - diskUsed;

    return {
      used: diskUsed,
      free: diskFree,
      total: diskTotal,
      usage: (diskUsed / diskTotal) * 100
    };
  }

  /**
   * Calculate directory size recursively
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          totalSize += await this.calculateDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`Failed to calculate size for ${dirPath}:`, error);
    }

    return totalSize;
  }

  /**
   * Check database health
   */
  private async getDatabaseHealth(): Promise<{ connected: boolean; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      // Simple database health check
      await this.projectRepo.findAll();
      const responseTime = Date.now() - startTime;
      
      return {
        connected: true,
        responseTime
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get job queue statistics
   */
  private async getQueueStats(): Promise<{ pending: number; processing: number; failed: number }> {
    try {
      const allJobs = await this.jobRepo.findAll();
      
      return {
        pending: allJobs.filter(job => job.status === 'pending').length,
        processing: allJobs.filter(job => job.status === 'processing').length,
        failed: allJobs.filter(job => job.status === 'failed').length
      };
    } catch (error) {
      return { pending: 0, processing: 0, failed: 0 };
    }
  }

  /**
   * Check service health
   */
  private async getServiceHealth(): Promise<{ ffmpeg: boolean; uploads: boolean }> {
    const services = {
      ffmpeg: false,
      uploads: false
    };

    // Check FFmpeg availability
    try {
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('ffmpeg -version', (error: any) => {
          if (error) reject(error);
          else resolve(true);
        });
      });
      services.ffmpeg = true;
    } catch (error) {
      services.ffmpeg = false;
    }

    // Check uploads directory
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      services.uploads = fs.existsSync(uploadsDir) && fs.statSync(uploadsDir).isDirectory();
    } catch (error) {
      services.uploads = false;
    }

    return services;
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(health: SystemHealth): 'healthy' | 'warning' | 'critical' {
    const issues = [];

    // Memory usage check
    if (health.memory.usage > 90) {
      issues.push('High memory usage');
    } else if (health.memory.usage > 75) {
      health.errors.push('Memory usage above 75%');
    }

    // Disk usage check
    if (health.disk.usage > 95) {
      issues.push('Critical disk usage');
    } else if (health.disk.usage > 80) {
      health.errors.push('Disk usage above 80%');
    }

    // Database check
    if (!health.database.connected) {
      issues.push('Database connection failed');
    } else if (health.database.responseTime > 5000) {
      health.errors.push('Slow database response time');
    }

    // Service checks
    if (!health.services.ffmpeg) {
      issues.push('FFmpeg not available');
    }
    if (!health.services.uploads) {
      issues.push('Uploads directory not accessible');
    }

    // Queue checks
    if (health.queue.failed > 10) {
      health.errors.push('High number of failed jobs');
    }

    if (issues.length > 0) {
      health.errors.push(...issues);
      return issues.some(issue => 
        issue.includes('Critical') || 
        issue.includes('Database') || 
        issue.includes('FFmpeg')
      ) ? 'critical' : 'warning';
    }

    return 'healthy';
  }

  /**
   * Get system analytics
   */
  async getAnalytics(): Promise<Analytics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Project analytics
      const allProjects = await this.projectRepo.findAll();
      const projectAnalytics = {
        total: allProjects.length,
        active: allProjects.filter(p => p.status === 'active').length,
        completed: allProjects.filter(p => p.status === 'completed').length,
        failed: allProjects.filter(p => p.status === 'error').length,
        createdToday: allProjects.filter(p => p.createdAt >= today).length,
        createdThisWeek: allProjects.filter(p => p.createdAt >= weekAgo).length,
        createdThisMonth: allProjects.filter(p => p.createdAt >= monthAgo).length
      };

      // Video analytics
      const allVideos = await this.videoRepo.findAll();
      const totalVideoSize = allVideos.reduce((sum, video) => sum + (video.fileSize || 0), 0);
      const videoAnalytics = {
        total: allVideos.length,
        totalSize: totalVideoSize,
        averageSize: allVideos.length > 0 ? totalVideoSize / allVideos.length : 0,
        uploadedToday: allVideos.filter(v => v.uploadedAt >= today).length,
        uploadedThisWeek: allVideos.filter(v => v.uploadedAt >= weekAgo).length,
        uploadedThisMonth: allVideos.filter(v => v.uploadedAt >= monthAgo).length
      };

      // Processing analytics
      const allJobs = await this.jobRepo.findAll();
      const completedJobs = allJobs.filter(j => j.status === 'completed');
      const failedJobs = allJobs.filter(j => j.status === 'failed');
      
      const successRate = allJobs.length > 0 ? 
        (completedJobs.length / allJobs.length) * 100 : 0;

      const avgProcessingTime = completedJobs.length > 0 ?
        completedJobs.reduce((sum, job) => {
          if (job.startedAt && job.completedAt) {
            return sum + (job.completedAt.getTime() - job.startedAt.getTime());
          }
          return sum;
        }, 0) / completedJobs.length : 0;

      const failureReasons: { [key: string]: number } = {};
      failedJobs.forEach(job => {
        const reason = job.error || 'Unknown error';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });

      const processingAnalytics = {
        totalJobs: allJobs.length,
        successRate,
        averageProcessingTime: avgProcessingTime,
        failureReasons
      };

      // Performance analytics (simplified)
      const performanceAnalytics = {
        averageUploadTime: 5000, // ms - would need to track this
        averageSyncTime: avgProcessingTime * 0.3, // estimate
        averageStitchingTime: avgProcessingTime * 0.5 // estimate
      };

      return {
        projects: projectAnalytics,
        videos: videoAnalytics,
        processing: processingAnalytics,
        performance: performanceAnalytics
      };

    } catch (error) {
      console.error('Failed to generate analytics:', error);
      
      // Return empty analytics on error
      return {
        projects: {
          total: 0, active: 0, completed: 0, failed: 0,
          createdToday: 0, createdThisWeek: 0, createdThisMonth: 0
        },
        videos: {
          total: 0, totalSize: 0, averageSize: 0,
          uploadedToday: 0, uploadedThisWeek: 0, uploadedThisMonth: 0
        },
        processing: {
          totalJobs: 0, successRate: 0, averageProcessingTime: 0,
          failureReasons: {}
        },
        performance: {
          averageUploadTime: 0, averageSyncTime: 0, averageStitchingTime: 0
        }
      };
    }
  }

  /**
   * Get health history
   */
  getHealthHistory(): SystemHealth[] {
    return [...this.healthHistory];
  }

  /**
   * Start health monitoring with periodic checks
   */
  startMonitoring(intervalMinutes: number = 5): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    return setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Log warnings and critical issues
        if (health.status !== 'healthy') {
          console.warn(`System health: ${health.status}`, health.errors);
        }
        
        // Could emit to socket for real-time monitoring
        // this.socketService?.emitToAll('system-health', health);
        
      } catch (error) {
        console.error('Health monitoring failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Check if system is ready to accept new work
   */
  async isSystemReady(): Promise<{ ready: boolean; reason?: string }> {
    const health = await this.getSystemHealth();
    
    if (health.status === 'critical') {
      return {
        ready: false,
        reason: 'System is in critical state: ' + health.errors.join(', ')
      };
    }

    if (!health.services.ffmpeg) {
      return {
        ready: false,
        reason: 'FFmpeg is not available'
      };
    }

    if (!health.services.uploads) {
      return {
        ready: false,
        reason: 'Upload directory is not accessible'
      };
    }

    if (health.memory.usage > 95) {
      return {
        ready: false,
        reason: 'Memory usage is critically high'
      };
    }

    if (health.disk.usage > 98) {
      return {
        ready: false,
        reason: 'Disk space is critically low'
      };
    }

    return { ready: true };
  }
}