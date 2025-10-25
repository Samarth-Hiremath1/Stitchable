import { Request, Response } from 'express';
import { VideoService } from '../services/VideoService';
import { ProjectRepository } from '../models/ProjectRepository';

export class VideoController {
  private videoService = new VideoService();
  private projectRepository = new ProjectRepository();

  /**
   * Upload video to project
   */
  uploadVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { uploaderName } = req.body;

      // Validate required fields
      if (!uploaderName) {
        res.status(400).json({
          error: {
            code: 'MISSING_UPLOADER_NAME',
            message: 'Uploader name is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No video file was uploaded',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Verify project exists
      const project = this.projectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Save video with metadata extraction
      const video = await this.videoService.saveUploadedVideo(
        req.file,
        projectId,
        uploaderName
      );

      res.status(201).json({
        success: true,
        data: {
          video: {
            id: video.id,
            filename: video.filename,
            originalName: video.originalName,
            uploaderName: video.uploaderName,
            fileSize: video.fileSize,
            duration: video.duration,
            format: video.format,
            uploadedAt: video.uploadedAt
          }
        },
        message: 'Video uploaded successfully'
      });

    } catch (error: any) {
      console.error('Video upload error:', error);
      
      // Handle specific error types
      if (error.message.includes('Invalid video format')) {
        res.status(400).json({
          error: {
            code: 'INVALID_VIDEO_FORMAT',
            message: error.message,
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (error.message.includes('Failed to extract metadata')) {
        res.status(400).json({
          error: {
            code: 'METADATA_EXTRACTION_FAILED',
            message: 'Unable to process video file. Please ensure it is a valid video format.',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Generic server error
      res.status(500).json({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload video. Please try again.',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get video by ID
   */
  getVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;

      const video = await this.videoService.getVideoWithMetadata(videoId);
      if (!video) {
        res.status(404).json({
          error: {
            code: 'VIDEO_NOT_FOUND',
            message: 'Video not found',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: { video }
      });

    } catch (error: any) {
      console.error('Get video error:', error);
      res.status(500).json({
        error: {
          code: 'GET_VIDEO_FAILED',
          message: 'Failed to retrieve video',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get all videos for a project
   */
  getProjectVideos = async (req: Request, res: Response): Promise<void> => {
    try {
      // Use project loaded by middleware (works for both direct access and share link access)
      const project = req.project;
      
      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const videos = await this.videoService.getProjectVideosWithMetadata(project.id);

      res.json({
        success: true,
        data: {
          videos,
          count: videos.length
        }
      });

    } catch (error: any) {
      console.error('Get project videos error:', error);
      res.status(500).json({
        error: {
          code: 'GET_PROJECT_VIDEOS_FAILED',
          message: 'Failed to retrieve project videos',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Delete video
   */
  deleteVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;

      const success = await this.videoService.deleteVideo(videoId);
      if (!success) {
        res.status(404).json({
          error: {
            code: 'VIDEO_NOT_FOUND',
            message: 'Video not found or could not be deleted',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        success: true,
        message: 'Video deleted successfully'
      });

    } catch (error: any) {
      console.error('Delete video error:', error);
      res.status(500).json({
        error: {
          code: 'DELETE_VIDEO_FAILED',
          message: 'Failed to delete video',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };
}