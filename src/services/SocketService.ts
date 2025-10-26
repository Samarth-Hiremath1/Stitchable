import { Server } from 'socket.io';
import { ProcessingJob } from '../types';
import { jobQueue } from './JobQueue';

export class SocketService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupJobEventListeners();
  }

  /**
   * Set up event listeners for job queue events
   */
  private setupJobEventListeners(): void {
    jobQueue.on('jobAdded', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobAdded', job);
    });

    jobQueue.on('jobStarted', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobStarted', job);
    });

    jobQueue.on('jobProgress', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobProgress', {
        jobId: job.id,
        progress: job.progress,
        status: job.status
      });
    });

    jobQueue.on('jobCompleted', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobCompleted', job);
    });

    jobQueue.on('jobFailed', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobFailed', {
        jobId: job.id,
        error: job.error,
        status: job.status
      });
    });

    jobQueue.on('jobRetried', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobRetried', job);
    });

    jobQueue.on('jobCancelled', (job: ProcessingJob) => {
      this.broadcastToProject(job.projectId, 'jobCancelled', job);
    });
  }

  /**
   * Broadcast message to all clients in a project room
   */
  private broadcastToProject(projectId: string, event: string, data: any): void {
    this.io.to(`project:${projectId}`).emit(event, data);
  }

  /**
   * Handle client connections
   */
  handleConnection(socket: any): void {
    console.log('Client connected:', socket.id);

    // Join project room
    socket.on('joinProject', (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`Client ${socket.id} joined project ${projectId}`);
      
      // Send current job status for the project
      const jobs = jobQueue.getProjectJobs(projectId);
      socket.emit('projectJobs', jobs);
    });

    // Leave project room
    socket.on('leaveProject', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`Client ${socket.id} left project ${projectId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Send queue statistics
    socket.on('getQueueStats', () => {
      const stats = jobQueue.getQueueStats();
      socket.emit('queueStats', stats);
    });

    // Manual job status request
    socket.on('getJobStatus', (jobId: string) => {
      const job = jobQueue.getJob(jobId);
      socket.emit('jobStatus', job);
    });

    // Retry failed job
    socket.on('retryJob', (jobId: string) => {
      const retriedJob = jobQueue.retryJob(jobId);
      if (retriedJob) {
        socket.emit('jobRetried', retriedJob);
        this.broadcastSystemNotification(
          retriedJob.projectId,
          `Job ${retriedJob.type} has been retried`,
          'info'
        );
      } else {
        socket.emit('retryJobFailed', { jobId, error: 'Job cannot be retried' });
      }
    });

    // Cancel job
    socket.on('cancelJob', (jobId: string) => {
      const cancelledJob = jobQueue.cancelJob(jobId);
      if (cancelledJob) {
        socket.emit('jobCancelled', cancelledJob);
        this.broadcastSystemNotification(
          cancelledJob.projectId,
          `Job ${cancelledJob.type} has been cancelled`,
          'warning'
        );
      } else {
        socket.emit('cancelJobFailed', { jobId, error: 'Job cannot be cancelled' });
      }
    });
  }

  /**
   * Broadcast processing update to specific project
   */
  broadcastProcessingUpdate(
    projectId: string,
    type: 'upload' | 'processing' | 'complete' | 'error',
    data: any
  ): void {
    this.broadcastToProject(projectId, 'processingUpdate', {
      type,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast upload progress
   */
  broadcastUploadProgress(
    projectId: string,
    filename: string,
    progress: number
  ): void {
    this.broadcastToProject(projectId, 'uploadProgress', {
      filename,
      progress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast system notification
   */
  broadcastSystemNotification(
    projectId: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ): void {
    this.broadcastToProject(projectId, 'systemNotification', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast error with retry option
   */
  broadcastErrorWithRetry(
    projectId: string,
    error: string,
    jobId?: string,
    retryable: boolean = true
  ): void {
    this.broadcastToProject(projectId, 'processingError', {
      error,
      jobId,
      retryable,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast connection status
   */
  broadcastConnectionStatus(
    projectId: string,
    status: 'connected' | 'disconnected' | 'reconnecting'
  ): void {
    this.broadcastToProject(projectId, 'connectionStatus', {
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected clients count for a project
   */
  getProjectClientCount(projectId: string): number {
    const room = this.io.sockets.adapter.rooms.get(`project:${projectId}`);
    return room ? room.size : 0;
  }

  /**
   * Get total connected clients
   */
  getTotalClientCount(): number {
    return this.io.sockets.sockets.size;
  }
}