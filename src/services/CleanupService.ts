import fs from 'fs';
import path from 'path';
import { ProjectRepository } from '../models/ProjectRepository';
import { VideoRepository } from '../models/VideoRepository';
import { ProcessingJobRepository } from '../models/ProcessingJobRepository';

export interface CleanupStats {
  tempFilesRemoved: number;
  oldProjectsRemoved: number;
  diskSpaceFreed: number; // in bytes
  errors: string[];
}

export interface CleanupOptions {
  tempFileMaxAge?: number; // in hours, default 24
  projectMaxAge?: number; // in days, default 30
  dryRun?: boolean; // if true, only report what would be cleaned
}

export class CleanupService {
  private projectRepo: ProjectRepository;
  private videoRepo: VideoRepository;
  private jobRepo: ProcessingJobRepository;

  constructor() {
    this.projectRepo = new ProjectRepository();
    this.videoRepo = new VideoRepository();
    this.jobRepo = new ProcessingJobRepository();
  }

  /**
   * Perform comprehensive cleanup of temporary files and old projects
   */
  async performCleanup(options: CleanupOptions = {}): Promise<CleanupStats> {
    const {
      tempFileMaxAge = 24, // 24 hours
      projectMaxAge = 30, // 30 days
      dryRun = false
    } = options;

    const stats: CleanupStats = {
      tempFilesRemoved: 0,
      oldProjectsRemoved: 0,
      diskSpaceFreed: 0,
      errors: []
    };

    try {
      // Clean temporary files
      const tempStats = await this.cleanTempFiles(tempFileMaxAge, dryRun);
      stats.tempFilesRemoved = tempStats.filesRemoved;
      stats.diskSpaceFreed += tempStats.spaceFreed;
      stats.errors.push(...tempStats.errors);

      // Clean old projects
      const projectStats = await this.cleanOldProjects(projectMaxAge, dryRun);
      stats.oldProjectsRemoved = projectStats.projectsRemoved;
      stats.diskSpaceFreed += projectStats.spaceFreed;
      stats.errors.push(...projectStats.errors);

      // Clean orphaned video files
      const orphanStats = await this.cleanOrphanedFiles(dryRun);
      stats.diskSpaceFreed += orphanStats.spaceFreed;
      stats.errors.push(...orphanStats.errors);

      console.log(`Cleanup completed:`, stats);
      return stats;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown cleanup error';
      stats.errors.push(errorMessage);
      console.error('Cleanup failed:', error);
      return stats;
    }
  }

  /**
   * Clean temporary files older than specified age
   */
  private async cleanTempFiles(maxAgeHours: number, dryRun: boolean): Promise<{
    filesRemoved: number;
    spaceFreed: number;
    errors: string[];
  }> {
    const stats = { filesRemoved: 0, spaceFreed: 0, errors: [] as string[] };
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const maxAge = Date.now() - (maxAgeHours * 60 * 60 * 1000);

    try {
      if (!fs.existsSync(tempDir)) {
        return stats;
      }

      const files = fs.readdirSync(tempDir);
      
      for (const file of files) {
        if (file === '.gitkeep') continue;
        
        const filePath = path.join(tempDir, file);
        
        try {
          const fileStat = fs.statSync(filePath);
          
          if (fileStat.mtime.getTime() < maxAge) {
            if (!dryRun) {
              fs.unlinkSync(filePath);
            }
            stats.filesRemoved++;
            stats.spaceFreed += fileStat.size;
          }
        } catch (error) {
          stats.errors.push(`Failed to process temp file ${file}: ${error}`);
        }
      }

    } catch (error) {
      stats.errors.push(`Failed to clean temp directory: ${error}`);
    }

    return stats;
  }

  /**
   * Clean old projects and their associated files
   */
  private async cleanOldProjects(maxAgeDays: number, dryRun: boolean): Promise<{
    projectsRemoved: number;
    spaceFreed: number;
    errors: string[];
  }> {
    const stats = { projectsRemoved: 0, spaceFreed: 0, errors: [] as string[] };
    const maxAge = new Date(Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000));

    try {
      // Find old projects
      const oldProjects = await this.projectRepo.findOlderThan(maxAge);
      
      for (const project of oldProjects) {
        try {
          // Calculate space used by project
          const projectVideos = await this.videoRepo.findByProjectId(project.id);
          let projectSpaceUsed = 0;

          // Remove video files
          for (const video of projectVideos) {
            const videoPath = path.join(process.cwd(), 'uploads', 'videos', `${video.id}.mp4`);
            const processedPath = path.join(process.cwd(), 'uploads', 'processed', `standardized_${video.id}.mp4`);
            
            try {
              if (fs.existsSync(videoPath)) {
                const stat = fs.statSync(videoPath);
                projectSpaceUsed += stat.size;
                if (!dryRun) {
                  fs.unlinkSync(videoPath);
                }
              }

              if (fs.existsSync(processedPath)) {
                const stat = fs.statSync(processedPath);
                projectSpaceUsed += stat.size;
                if (!dryRun) {
                  fs.unlinkSync(processedPath);
                }
              }

              // Remove thumbnails
              const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
              const thumbnailPattern = `${video.id}_thumb_`;
              
              if (fs.existsSync(thumbnailDir)) {
                const thumbnails = fs.readdirSync(thumbnailDir)
                  .filter(file => file.startsWith(thumbnailPattern));
                
                for (const thumbnail of thumbnails) {
                  const thumbPath = path.join(thumbnailDir, thumbnail);
                  const stat = fs.statSync(thumbPath);
                  projectSpaceUsed += stat.size;
                  if (!dryRun) {
                    fs.unlinkSync(thumbPath);
                  }
                }
              }

            } catch (error) {
              stats.errors.push(`Failed to remove files for video ${video.id}: ${error}`);
            }
          }

          // Remove final video if exists
          if (project.finalVideoPath) {
            const finalVideoPath = path.join(process.cwd(), project.finalVideoPath);
            try {
              if (fs.existsSync(finalVideoPath)) {
                const stat = fs.statSync(finalVideoPath);
                projectSpaceUsed += stat.size;
                if (!dryRun) {
                  fs.unlinkSync(finalVideoPath);
                }
              }
            } catch (error) {
              stats.errors.push(`Failed to remove final video for project ${project.id}: ${error}`);
            }
          }

          if (!dryRun) {
            // Remove database records
            await this.jobRepo.deleteByProjectId(project.id);
            await this.videoRepo.deleteByProjectId(project.id);
            await this.projectRepo.delete(project.id);
          }

          stats.projectsRemoved++;
          stats.spaceFreed += projectSpaceUsed;

        } catch (error) {
          stats.errors.push(`Failed to clean project ${project.id}: ${error}`);
        }
      }

    } catch (error) {
      stats.errors.push(`Failed to query old projects: ${error}`);
    }

    return stats;
  }

  /**
   * Clean orphaned files that don't have corresponding database records
   */
  private async cleanOrphanedFiles(dryRun: boolean): Promise<{
    spaceFreed: number;
    errors: string[];
  }> {
    const stats = { spaceFreed: 0, errors: [] as string[] };

    try {
      // Get all video IDs from database
      const allVideos = await this.videoRepo.findAll();
      const videoIds = new Set(allVideos.map(v => v.id));

      // Check video files
      const videoDir = path.join(process.cwd(), 'uploads', 'videos');
      if (fs.existsSync(videoDir)) {
        const videoFiles = fs.readdirSync(videoDir);
        
        for (const file of videoFiles) {
          if (file === '.gitkeep') continue;
          
          const videoId = path.parse(file).name;
          if (!videoIds.has(videoId)) {
            const filePath = path.join(videoDir, file);
            try {
              const stat = fs.statSync(filePath);
              stats.spaceFreed += stat.size;
              if (!dryRun) {
                fs.unlinkSync(filePath);
              }
            } catch (error) {
              stats.errors.push(`Failed to remove orphaned video file ${file}: ${error}`);
            }
          }
        }
      }

      // Check processed files
      const processedDir = path.join(process.cwd(), 'uploads', 'processed');
      if (fs.existsSync(processedDir)) {
        const processedFiles = fs.readdirSync(processedDir);
        
        for (const file of processedFiles) {
          if (file === '.gitkeep') continue;
          
          // Extract video ID from standardized filename
          const match = file.match(/standardized_([a-f0-9-]+)\.mp4$/);
          if (match && !videoIds.has(match[1])) {
            const filePath = path.join(processedDir, file);
            try {
              const stat = fs.statSync(filePath);
              stats.spaceFreed += stat.size;
              if (!dryRun) {
                fs.unlinkSync(filePath);
              }
            } catch (error) {
              stats.errors.push(`Failed to remove orphaned processed file ${file}: ${error}`);
            }
          }
        }
      }

      // Check thumbnail files
      const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
      if (fs.existsSync(thumbnailDir)) {
        const thumbnailFiles = fs.readdirSync(thumbnailDir);
        
        for (const file of thumbnailFiles) {
          if (file === '.gitkeep') continue;
          
          // Extract video ID from thumbnail filename
          const match = file.match(/^([a-f0-9-]+)_thumb_\d+\.jpg$/);
          if (match && !videoIds.has(match[1])) {
            const filePath = path.join(thumbnailDir, file);
            try {
              const stat = fs.statSync(filePath);
              stats.spaceFreed += stat.size;
              if (!dryRun) {
                fs.unlinkSync(filePath);
              }
            } catch (error) {
              stats.errors.push(`Failed to remove orphaned thumbnail ${file}: ${error}`);
            }
          }
        }
      }

    } catch (error) {
      stats.errors.push(`Failed to clean orphaned files: ${error}`);
    }

    return stats;
  }

  /**
   * Get disk usage statistics
   */
  async getDiskUsageStats(): Promise<{
    totalSize: number;
    videoFiles: number;
    processedFiles: number;
    thumbnails: number;
    tempFiles: number;
    finalVideos: number;
  }> {
    const stats = {
      totalSize: 0,
      videoFiles: 0,
      processedFiles: 0,
      thumbnails: 0,
      tempFiles: 0,
      finalVideos: 0
    };

    const directories = [
      { path: 'uploads/videos', key: 'videoFiles' },
      { path: 'uploads/processed', key: 'processedFiles' },
      { path: 'uploads/thumbnails', key: 'thumbnails' },
      { path: 'uploads/temp', key: 'tempFiles' }
    ];

    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir.path);
      if (fs.existsSync(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            if (file === '.gitkeep') continue;
            
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            stats[dir.key as keyof typeof stats] += stat.size;
            stats.totalSize += stat.size;
          }
        } catch (error) {
          console.error(`Failed to calculate size for ${dir.path}:`, error);
        }
      }
    }

    return stats;
  }

  /**
   * Schedule automatic cleanup
   */
  scheduleCleanup(intervalHours: number = 24, options: CleanupOptions = {}): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    return setInterval(async () => {
      try {
        console.log('Starting scheduled cleanup...');
        const stats = await this.performCleanup(options);
        console.log('Scheduled cleanup completed:', stats);
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, intervalMs);
  }
}