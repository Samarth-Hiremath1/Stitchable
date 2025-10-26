import { EventEmitter } from 'events';
import { ProcessingJob } from '../types';
import { ProcessingJobRepository } from '../models/ProcessingJobRepository';

export interface JobHandler {
  (job: ProcessingJob): Promise<string | void>;
}

export class JobQueue extends EventEmitter {
  private jobRepository = new ProcessingJobRepository();
  private handlers = new Map<string, JobHandler>();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Register a job handler for a specific job type
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  /**
   * Add a new job to the queue
   */
  addJob(
    projectId: string,
    type: ProcessingJob['type'],
    priority: number = 0
  ): ProcessingJob {
    const job = this.jobRepository.create({
      projectId,
      type,
      status: 'pending',
      progress: 0
    });

    this.emit('jobAdded', job);
    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ProcessingJob | null {
    return this.jobRepository.findById(jobId);
  }

  /**
   * Get all jobs for a project
   */
  getProjectJobs(projectId: string): ProcessingJob[] {
    return this.jobRepository.findByProjectId(projectId);
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, progress: number): void {
    const job = this.jobRepository.updateProgress(jobId, progress);
    if (job) {
      this.emit('jobProgress', job);
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, result?: string): void {
    const job = this.jobRepository.markAsCompleted(jobId, result);
    if (job) {
      this.emit('jobCompleted', job);
    }
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): void {
    const job = this.jobRepository.markAsFailed(jobId, error);
    if (job) {
      this.emit('jobFailed', job);
    }
  }

  /**
   * Retry a failed job
   */
  retryJob(jobId: string): ProcessingJob | null {
    const job = this.jobRepository.findById(jobId);
    if (!job || job.status !== 'failed') {
      return null;
    }

    // Reset job status to pending
    const retriedJob = this.jobRepository.update(jobId, {
      status: 'pending',
      progress: 0,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined
    });

    if (retriedJob) {
      this.emit('jobRetried', retriedJob);
    }

    return retriedJob;
  }

  /**
   * Cancel a pending or processing job
   */
  cancelJob(jobId: string): ProcessingJob | null {
    const job = this.jobRepository.findById(jobId);
    if (!job || (job.status !== 'pending' && job.status !== 'processing')) {
      return null;
    }

    const cancelledJob = this.jobRepository.update(jobId, {
      status: 'failed',
      error: 'Job cancelled by user',
      completedAt: new Date()
    });

    if (cancelledJob) {
      this.emit('jobCancelled', cancelledJob);
    }

    return cancelledJob;
  }

  /**
   * Start the job processing loop
   */
  private startProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) return;

      await this.processNextJob();
    }, 1000); // Check for new jobs every second
  }

  /**
   * Stop the job processing loop
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process the next pending job
   */
  private async processNextJob(): Promise<void> {
    const pendingJobs = this.jobRepository.findByStatus('pending');
    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0]; // Process jobs in FIFO order
    const handler = this.handlers.get(job.type);

    if (!handler) {
      console.warn(`No handler registered for job type: ${job.type}`);
      this.failJob(job.id, `No handler registered for job type: ${job.type}`);
      return;
    }

    this.isProcessing = true;

    try {
      // Mark job as started
      this.jobRepository.markAsStarted(job.id);
      this.emit('jobStarted', job);

      console.log(`Processing job ${job.id} of type ${job.type}`);

      // Execute the job handler
      const result = await handler(job);

      // Mark job as completed
      this.completeJob(job.id, result || undefined);
      console.log(`Job ${job.id} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Job ${job.id} failed:`, errorMessage);
      this.failJob(job.id, errorMessage);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const allJobs = this.jobRepository.findAll();
    
    return {
      pending: allJobs.filter(job => job.status === 'pending').length,
      processing: allJobs.filter(job => job.status === 'processing').length,
      completed: allJobs.filter(job => job.status === 'completed').length,
      failed: allJobs.filter(job => job.status === 'failed').length
    };
  }
}

// Singleton instance
export const jobQueue = new JobQueue();