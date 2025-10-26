import { SocketService } from './SocketService';
import { VideoProcessingService } from './VideoProcessingService';
import { SynchronizationService } from './SynchronizationService';
import { VideoQualityService } from './VideoQualityService';
import { VideoStitchingService } from './VideoStitchingService';
import { ProjectRepository } from '../models/ProjectRepository';
import { VideoRepository } from '../models/VideoRepository';
import { ProcessingJobRepository } from '../models/ProcessingJobRepository';
import { jobQueue } from './JobQueue';
import { Project, Video, ProcessingJob } from '../types';

export interface WorkflowProgress {
  stage: 'upload' | 'processing' | 'sync' | 'quality' | 'stitching' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface WorkflowResult {
  success: boolean;
  finalVideoPath?: string;
  error?: string;
  processingTime: number;
  stages: {
    upload: boolean;
    processing: boolean;
    sync: boolean;
    quality: boolean;
    stitching: boolean;
  };
}

export class WorkflowOrchestrator {
  private projectRepo: ProjectRepository;
  private videoRepo: VideoRepository;
  private jobRepo: ProcessingJobRepository;
  private videoProcessingService: VideoProcessingService;
  private syncService: SynchronizationService;
  private qualityService: VideoQualityService;
  private stitchingService: VideoStitchingService;
  private socketService: SocketService;

  constructor(socketService: SocketService) {
    this.projectRepo = new ProjectRepository();
    this.videoRepo = new VideoRepository();
    this.jobRepo = new ProcessingJobRepository();
    this.videoProcessingService = new VideoProcessingService();
    this.syncService = new SynchronizationService();
    this.qualityService = new VideoQualityService();
    this.stitchingService = new VideoStitchingService();
    this.socketService = socketService;
  }

  /**
   * Execute complete end-to-end workflow for a project
   */
  async executeCompleteWorkflow(projectId: string): Promise<WorkflowResult> {
    const startTime = Date.now();
    const result: WorkflowResult = {
      success: false,
      processingTime: 0,
      stages: {
        upload: false,
        processing: false,
        sync: false,
        quality: false,
        stitching: false
      }
    };

    try {
      // Validate project exists and has videos
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const videos = await this.videoRepo.findByProjectId(projectId);
      if (videos.length === 0) {
        throw new Error('No videos found for project');
      }

      this.emitProgress(projectId, {
        stage: 'upload',
        progress: 10,
        message: `Found ${videos.length} videos to process`
      });

      result.stages.upload = true;

      // Stage 1: Process all videos
      await this.processAllVideos(projectId, videos);
      result.stages.processing = true;

      this.emitProgress(projectId, {
        stage: 'processing',
        progress: 30,
        message: 'Video processing complete'
      });

      // Stage 2: Synchronize videos
      if (videos.length > 1) {
        await this.synchronizeVideos(projectId, videos);
        result.stages.sync = true;

        this.emitProgress(projectId, {
          stage: 'sync',
          progress: 50,
          message: 'Video synchronization complete'
        });
      } else {
        result.stages.sync = true; // Single video doesn't need sync
      }

      // Stage 3: Assess video quality
      await this.assessVideoQuality(projectId, videos);
      result.stages.quality = true;

      this.emitProgress(projectId, {
        stage: 'quality',
        progress: 70,
        message: 'Quality assessment complete'
      });

      // Stage 4: Stitch videos
      const finalVideoPath = await this.stitchVideos(projectId, videos);
      result.stages.stitching = true;
      result.finalVideoPath = finalVideoPath;

      this.emitProgress(projectId, {
        stage: 'stitching',
        progress: 90,
        message: 'Video stitching complete'
      });

      // Update project status
      await this.projectRepo.update(projectId, {
        status: 'completed',
        finalVideoPath: finalVideoPath,
        updatedAt: new Date()
      });

      this.emitProgress(projectId, {
        stage: 'complete',
        progress: 100,
        message: 'Workflow complete! Video ready for download.'
      });

      result.success = true;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      this.emitProgress(projectId, {
        stage: 'error',
        progress: 0,
        message: 'Workflow failed',
        error: errorMessage
      });

      // Update project status to error
      await this.projectRepo.update(projectId, {
        status: 'error',
        updatedAt: new Date()
      });

      result.error = errorMessage;
      result.processingTime = Date.now() - startTime;

      return result;
    }
  }

  /**
   * Process all videos in a project
   */
  private async processAllVideos(projectId: string, videos: Video[]): Promise<void> {
    const processingPromises = videos.map(async (video, index) => {
      try {
        await this.videoProcessingService.processVideo(video.id);
        
        // Update progress for each video processed
        const progress = 10 + (20 * (index + 1) / videos.length);
        this.emitProgress(projectId, {
          stage: 'processing',
          progress,
          message: `Processed video ${index + 1} of ${videos.length}`
        });
      } catch (error) {
        console.error(`Failed to process video ${video.id}:`, error);
        throw new Error(`Video processing failed for ${video.filename}`);
      }
    });

    await Promise.all(processingPromises);
  }

  /**
   * Synchronize all videos in a project
   */
  private async synchronizeVideos(projectId: string, videos: Video[]): Promise<void> {
    try {
      const syncResult = await this.syncService.synchronizeVideos(projectId);
      
      // Update videos with sync offsets
      for (const video of videos) {
        const syncData = syncResult.syncPoints.find(sp => sp.videoId === video.id);
        if (syncData) {
          await this.videoRepo.update(video.id, {
            syncOffset: syncData.offset,
            syncConfidence: syncData.confidence
          });
        }
      }
    } catch (error) {
      console.error('Synchronization failed:', error);
      throw new Error('Video synchronization failed');
    }
  }

  /**
   * Assess quality of all videos in a project
   */
  private async assessVideoQuality(projectId: string, videos: Video[]): Promise<void> {
    const qualityPromises = videos.map(async (video) => {
      try {
        const qualityScore = await this.qualityService.assessVideoQuality(video.filePath, video.id);
        await this.videoRepo.update(video.id, {
          qualityScore: qualityScore.scores.overall
        });
      } catch (error) {
        console.error(`Quality assessment failed for video ${video.id}:`, error);
        // Don't fail the entire workflow for quality assessment issues
        await this.videoRepo.update(video.id, {
          qualityScore: 0.5 // Default score
        });
      }
    });

    await Promise.all(qualityPromises);
  }

  /**
   * Stitch all videos in a project
   */
  private async stitchVideos(projectId: string, videos: Video[]): Promise<string> {
    try {
      // Get updated videos with sync and quality data
      const updatedVideos = await this.videoRepo.findByProjectId(projectId);
      
      const stitchResult = await this.stitchingService.stitchVideos(projectId);

      return stitchResult.outputPath;
    } catch (error) {
      console.error('Stitching failed:', error);
      throw new Error('Video stitching failed');
    }
  }

  /**
   * Emit progress updates via socket
   */
  private emitProgress(projectId: string, progress: WorkflowProgress): void {
    this.socketService.emitToProject(projectId, 'workflow-progress', progress);
  }

  /**
   * Get workflow status for a project
   */
  async getWorkflowStatus(projectId: string): Promise<{
    status: string;
    progress: number;
    currentStage?: string;
    error?: string;
  }> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const jobs = await this.jobRepo.findByProjectId(projectId);
    const activeJob = jobs.find(job => job.status === 'processing');

    if (activeJob) {
      return {
        status: 'processing',
        progress: activeJob.progress || 0,
        currentStage: activeJob.type
      };
    }

    const failedJob = jobs.find(job => job.status === 'failed');
    if (failedJob) {
      return {
        status: 'error',
        progress: 0,
        error: failedJob.error
      };
    }

    return {
      status: project.status || 'pending',
      progress: project.status === 'completed' ? 100 : 0
    };
  }

  /**
   * Retry failed workflow
   */
  async retryWorkflow(projectId: string): Promise<WorkflowResult> {
    // Reset project status
    await this.projectRepo.update(projectId, {
      status: 'processing',
      updatedAt: new Date()
    });

    // Cancel any existing jobs
    const existingJobs = await this.jobRepo.findByProjectId(projectId);
    for (const job of existingJobs) {
      if (job.status === 'processing') {
        await this.jobRepo.update(job.id, {
          status: 'cancelled',
          completedAt: new Date()
        });
      }
    }

    // Execute workflow again
    return this.executeCompleteWorkflow(projectId);
  }

  /**
   * Cancel ongoing workflow
   */
  async cancelWorkflow(projectId: string): Promise<void> {
    // Update project status
    await this.projectRepo.update(projectId, {
      status: 'cancelled',
      updatedAt: new Date()
    });

    // Cancel all processing jobs
    const jobs = await this.jobRepo.findByProjectId(projectId);
    for (const job of jobs) {
      if (job.status === 'processing') {
        await this.jobRepo.update(job.id, {
          status: 'cancelled',
          completedAt: new Date()
        });
      }
    }

    this.emitProgress(projectId, {
      stage: 'error',
      progress: 0,
      message: 'Workflow cancelled by user'
    });
  }
}