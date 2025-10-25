import { Request, Response } from 'express';
import { VideoProcessingService } from '../services/VideoProcessingService';
import { jobQueue } from '../services/JobQueue';
import { ProcessingJobRepository } from '../models/ProcessingJobRepository';
import { VideoRepository } from '../models/VideoRepository';

export class ProcessingController {
  private processingService = new VideoProcessingService();
  private jobRepository = new ProcessingJobRepository();
  private videoRepository = new VideoRepository();

  /**
   * Start video processing for a project
   */
  startProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { type = 'sync' } = req.body;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Validate processing type
      const validTypes = ['sync', 'quality_analysis', 'stitching'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ 
          error: 'Invalid processing type. Must be one of: sync, quality_analysis, stitching' 
        });
        return;
      }

      // Check if there are videos to process
      const videos = this.videoRepository.findByProjectId(projectId);
      if (videos.length === 0) {
        res.status(400).json({ error: 'No videos found for processing' });
        return;
      }

      // Check if there's already a processing job running for this project and type
      const existingJobs = this.jobRepository.findByProjectIdAndType(projectId, type);
      const runningJob = existingJobs.find(job => 
        job.status === 'pending' || job.status === 'processing'
      );

      if (runningJob) {
        res.status(409).json({ 
          error: 'Processing job already running for this project',
          job: runningJob
        });
        return;
      }

      // Add job to queue
      const job = jobQueue.addJob(projectId, type as any);

      res.status(201).json({
        message: 'Processing job started',
        job
      });

    } catch (error) {
      console.error('Error starting processing:', error);
      res.status(500).json({ 
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get processing status for a project
   */
  getProcessingStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const jobs = this.jobRepository.findByProjectId(projectId);
      const queueStats = jobQueue.getQueueStats();

      res.json({
        projectJobs: jobs,
        queueStats
      });

    } catch (error) {
      console.error('Error getting processing status:', error);
      res.status(500).json({ 
        error: 'Failed to get processing status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get specific job status
   */
  getJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({ error: 'Job ID is required' });
        return;
      }

      const job = this.jobRepository.findById(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json({ job });

    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({ 
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Cancel a processing job
   */
  cancelJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({ error: 'Job ID is required' });
        return;
      }

      const job = this.jobRepository.findById(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (job.status === 'completed' || job.status === 'failed') {
        res.status(400).json({ error: 'Cannot cancel completed or failed job' });
        return;
      }

      // Mark job as failed with cancellation message
      const cancelledJob = this.jobRepository.markAsFailed(jobId, 'Job cancelled by user');

      res.json({
        message: 'Job cancelled successfully',
        job: cancelledJob
      });

    } catch (error) {
      console.error('Error cancelling job:', error);
      res.status(500).json({ 
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Generate thumbnails for a video
   */
  generateThumbnails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;

      if (!videoId) {
        res.status(400).json({ error: 'Video ID is required' });
        return;
      }

      const video = this.videoRepository.findById(videoId);
      if (!video) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }

      const thumbnailPaths = await this.processingService.generateVideoThumbnails(videoId);

      res.json({
        message: 'Thumbnails generated successfully',
        thumbnails: thumbnailPaths
      });

    } catch (error) {
      console.error('Error generating thumbnails:', error);
      res.status(500).json({ 
        error: 'Failed to generate thumbnails',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get queue statistics
   */
  getQueueStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = jobQueue.getQueueStats();
      res.json({ stats });

    } catch (error) {
      console.error('Error getting queue stats:', error);
      res.status(500).json({ 
        error: 'Failed to get queue statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Retry a failed job
   */
  retryJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({ error: 'Job ID is required' });
        return;
      }

      const job = this.jobRepository.findById(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (job.status !== 'failed') {
        res.status(400).json({ error: 'Only failed jobs can be retried' });
        return;
      }

      // Create a new job with the same parameters
      const newJob = jobQueue.addJob(job.projectId, job.type);

      res.json({
        message: 'Job retry initiated',
        originalJob: job,
        newJob
      });

    } catch (error) {
      console.error('Error retrying job:', error);
      res.status(500).json({ 
        error: 'Failed to retry job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}