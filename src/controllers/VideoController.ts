import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { VideoService } from '../services/VideoService';
import { ProjectRepository } from '../models/ProjectRepository';
import { SecurityUtils } from '../utils/security';

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
   * Stream video with range request support
   */
  streamVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;
      const range = req.headers.range;

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

      const videoPath = video.filePath;
      const uploadsDir = path.join(process.cwd(), 'uploads');

      // Validate file path security
      if (!SecurityUtils.validateFileAccess(videoPath, uploadsDir)) {
        res.status(404).json({
          error: {
            code: 'VIDEO_FILE_NOT_FOUND',
            message: 'Video file not found or access denied',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        // Create read stream for the requested range
        const file = fs.createReadStream(videoPath, { start, end });

        // Set appropriate headers for partial content
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=3600'
        });

        file.pipe(res);
      } else {
        // No range requested, send entire file
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        });

        fs.createReadStream(videoPath).pipe(res);
      }

    } catch (error: any) {
      console.error('Stream video error:', error);
      res.status(500).json({
        error: {
          code: 'STREAM_VIDEO_FAILED',
          message: 'Failed to stream video',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Download final video
   */
  downloadFinalVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      const project = await this.projectRepository.findById(projectId);
      if (!project || !project.finalVideo) {
        res.status(404).json({
          error: {
            code: 'FINAL_VIDEO_NOT_FOUND',
            message: 'Final video not found for this project',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const finalVideo = project.finalVideo;
      const uploadsDir = path.join(process.cwd(), 'uploads');

      // Validate file path security
      if (!SecurityUtils.validateFileAccess(finalVideo.filePath, uploadsDir)) {
        res.status(404).json({
          error: {
            code: 'FINAL_VIDEO_FILE_NOT_FOUND',
            message: 'Final video file not found or access denied',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const stat = fs.statSync(finalVideo.filePath);
      const fileSize = stat.size;

      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${finalVideo.filename}"`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');

      // Handle range requests for download progress
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize,
        });

        fs.createReadStream(finalVideo.filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200);
        fs.createReadStream(finalVideo.filePath).pipe(res);
      }

    } catch (error: any) {
      console.error('Download final video error:', error);
      res.status(500).json({
        error: {
          code: 'DOWNLOAD_FINAL_VIDEO_FAILED',
          message: 'Failed to download final video',
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