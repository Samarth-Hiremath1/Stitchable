import { Request, Response } from 'express';
import { VideoProcessingService } from '../services/VideoProcessingService';
import { SynchronizationService } from '../services/SynchronizationService';
import { jobQueue } from '../services/JobQueue';
import { ProcessingJobRepository } from '../models/ProcessingJobRepository';
import { VideoRepository } from '../models/VideoRepository';
import { SocketService } from '../services/SocketService';

export class ProcessingController {
  private processingService = new VideoProcessingService();
  private synchronizationService = new SynchronizationService();
  private jobRepository = new ProcessingJobRepository();
  private videoRepository = new VideoRepository();
  private socketService: SocketService;

  constructor(socketService: SocketService) {
    this.socketService = socketService;
  }

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

      // Broadcast notification
      this.socketService.broadcastSystemNotification(
        projectId,
        `${type.replace('_', ' ')} processing started`,
        'info'
      );

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

      // Broadcast notification
      if (cancelledJob) {
        this.socketService.broadcastSystemNotification(
          cancelledJob.projectId,
          `${cancelledJob.type.replace('_', ' ')} job cancelled`,
          'warning'
        );
      }

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

      // Broadcast notification
      this.socketService.broadcastSystemNotification(
        job.projectId,
        `${job.type.replace('_', ' ')} job retried`,
        'info'
      );

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

  /**
   * Get synchronization results for a project
   */
  getSyncResults = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Check if there are videos to sync
      const videos = this.videoRepository.findByProjectId(projectId);
      if (videos.length < 2) {
        res.status(400).json({ error: 'At least 2 videos are required for synchronization' });
        return;
      }

      // Get videos with sync offsets
      const syncedVideos = videos.map(video => ({
        id: video.id,
        filename: video.filename,
        uploaderName: video.uploaderName,
        duration: video.duration,
        syncOffset: video.syncOffset || 0,
        qualityScore: video.qualityScore
      }));

      // Check if synchronization has been performed
      const hasSyncData = videos.some(video => video.syncOffset !== null && video.syncOffset !== undefined);

      res.json({
        projectId,
        videos: syncedVideos,
        synchronized: hasSyncData,
        message: hasSyncData 
          ? 'Synchronization data available' 
          : 'No synchronization data found. Run sync processing first.'
      });

    } catch (error) {
      console.error('Error getting sync results:', error);
      res.status(500).json({ 
        error: 'Failed to get synchronization results',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Validate synchronization for a project
   */
  validateSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Get videos with sync data
      const videos = this.videoRepository.findByProjectId(projectId);
      if (videos.length < 2) {
        res.status(400).json({ error: 'At least 2 videos are required for synchronization' });
        return;
      }

      // Check if sync data exists
      const hasSyncData = videos.some(video => video.syncOffset !== null && video.syncOffset !== undefined);
      if (!hasSyncData) {
        res.status(400).json({ error: 'No synchronization data found. Run sync processing first.' });
        return;
      }

      // Create a mock sync result for validation
      const mockSyncResult = {
        projectId,
        syncPoints: [],
        confidence: 75, // Mock confidence based on existing data
        method: 'audio' as const,
        alignedVideos: videos.map(video => ({
          videoId: video.id,
          offsetSeconds: video.syncOffset || 0,
          confidence: video.qualityScore || 50
        }))
      };

      const validation = this.synchronizationService.validateSyncResults(mockSyncResult);

      res.json({
        projectId,
        validation,
        syncData: {
          confidence: mockSyncResult.confidence,
          method: mockSyncResult.method,
          alignedVideos: mockSyncResult.alignedVideos
        }
      });

    } catch (error) {
      console.error('Error validating sync:', error);
      res.status(500).json({ 
        error: 'Failed to validate synchronization',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Start intelligent video stitching for a project
   */
  startStitching = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Check if there are videos to stitch
      const videos = this.videoRepository.findByProjectId(projectId);
      if (videos.length === 0) {
        res.status(400).json({ error: 'No videos found for stitching' });
        return;
      }

      // Check if there's already a stitching job running
      const existingJobs = this.jobRepository.findByProjectIdAndType(projectId, 'stitching');
      const runningJob = existingJobs.find(job => 
        job.status === 'pending' || job.status === 'processing'
      );

      if (runningJob) {
        res.status(409).json({ 
          error: 'Stitching job already running for this project',
          job: runningJob
        });
        return;
      }

      // Start stitching job
      const job = await this.processingService.startVideoStitching(projectId);

      res.status(201).json({
        message: 'Intelligent video stitching started',
        job,
        info: {
          videoCount: videos.length,
          estimatedDuration: 'Processing time depends on video length and complexity'
        }
      });

    } catch (error) {
      console.error('Error starting stitching:', error);
      res.status(500).json({ 
        error: 'Failed to start video stitching',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get quality rankings for a project
   */
  getQualityRankings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const rankings = await this.processingService.getProjectQualityRankings(projectId);

      if (rankings.length === 0) {
        res.status(404).json({ 
          error: 'No quality data found. Run quality analysis first.',
          projectId
        });
        return;
      }

      res.json({
        projectId,
        rankings,
        summary: {
          totalVideos: rankings.length,
          averageQuality: Math.round(
            rankings.reduce((sum, r) => sum + r.qualityScore, 0) / rankings.length
          ),
          topVideo: rankings[0]
        }
      });

    } catch (error) {
      console.error('Error getting quality rankings:', error);
      res.status(500).json({ 
        error: 'Failed to get quality rankings',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Check if project is ready for stitching
   */
  checkStitchingReadiness = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const videos = this.videoRepository.findByProjectId(projectId);
      
      if (videos.length === 0) {
        res.json({
          ready: false,
          reason: 'No videos found',
          requirements: {
            hasVideos: false,
            hasSyncData: false,
            hasQualityData: false
          }
        });
        return;
      }

      const hasSyncData = videos.length === 1 || videos.some(video => 
        video.syncOffset !== null && video.syncOffset !== undefined
      );

      const hasQualityData = videos.some(video => 
        video.qualityScore !== null && video.qualityScore !== undefined
      );

      const ready = hasSyncData && hasQualityData;

      res.json({
        ready,
        reason: ready ? 'Project ready for stitching' : 'Missing required data',
        requirements: {
          hasVideos: videos.length > 0,
          hasSyncData,
          hasQualityData
        },
        videoCount: videos.length,
        recommendations: ready ? [] : [
          !hasSyncData ? 'Run synchronization analysis' : null,
          !hasQualityData ? 'Run quality analysis' : null
        ].filter(Boolean)
      });

    } catch (error) {
      console.error('Error checking stitching readiness:', error);
      res.status(500).json({ 
        error: 'Failed to check stitching readiness',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}