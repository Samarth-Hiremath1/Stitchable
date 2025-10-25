import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { VideoRepository } from '../models/VideoRepository';
import { VideoMetadataRepository } from '../models/VideoMetadataRepository';
import { Video, VideoMetadata } from '../types';
import { randomUUID } from 'crypto';

export class VideoService {
  private videoRepository = new VideoRepository();
  private metadataRepository = new VideoMetadataRepository();

  /**
   * Extract video metadata using FFmpeg
   */
  async extractVideoMetadata(filePath: string): Promise<Omit<VideoMetadata, 'videoId'>> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to extract metadata: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found in file'));
          return;
        }

        const extractedMetadata: Omit<VideoMetadata, 'videoId'> = {
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          frameRate: this.parseFrameRate(videoStream.r_frame_rate || videoStream.avg_frame_rate || '0/1'),
          bitrate: parseInt(String(videoStream.bit_rate || '0')),
          codec: videoStream.codec_name || 'unknown',
          audioChannels: audioStream?.channels || 0,
          audioSampleRate: parseInt(String(audioStream?.sample_rate || '0')),
          recordingTimestamp: metadata.format.tags?.creation_time 
            ? new Date(metadata.format.tags.creation_time)
            : undefined
        };

        resolve(extractedMetadata);
      });
    });
  }

  /**
   * Parse frame rate from FFmpeg format (e.g., "30/1" -> 30)
   */
  private parseFrameRate(frameRateStr: string): number {
    const parts = frameRateStr.split('/');
    if (parts.length === 2) {
      const numerator = parseInt(parts[0]);
      const denominator = parseInt(parts[1]);
      return denominator > 0 ? numerator / denominator : 0;
    }
    return parseFloat(frameRateStr) || 0;
  }

  /**
   * Get video duration using FFmpeg
   */
  async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get duration: ${err.message}`));
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Validate video file format
   */
  isValidVideoFormat(mimetype: string, filename: string): boolean {
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime', // .mov files
      'video/x-msvideo', // .avi files
      'video/webm',
      'video/x-ms-wmv' // .wmv files
    ];

    const allowedExtensions = ['.mp4', '.mov', '.avi', '.webm', '.wmv'];
    const fileExtension = path.extname(filename).toLowerCase();

    return allowedMimeTypes.includes(mimetype) || allowedExtensions.includes(fileExtension);
  }

  /**
   * Save uploaded video with metadata extraction
   */
  async saveUploadedVideo(
    file: Express.Multer.File,
    projectId: string,
    uploaderName: string
  ): Promise<Video> {
    try {
      // Validate file format
      if (!this.isValidVideoFormat(file.mimetype, file.originalname)) {
        throw new Error('Invalid video format. Supported formats: MP4, MOV, AVI, WebM, WMV');
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${randomUUID()}${fileExtension}`;
      const filePath = path.join('uploads', 'videos', uniqueFilename);
      const fullPath = path.join(process.cwd(), filePath);

      // Move file to permanent location
      fs.renameSync(file.path, fullPath);

      // Extract video duration and metadata
      const [duration, metadata] = await Promise.all([
        this.getVideoDuration(fullPath),
        this.extractVideoMetadata(fullPath)
      ]);

      // Create video record
      const video = this.videoRepository.create({
        projectId,
        filename: uniqueFilename,
        originalName: file.originalname,
        uploaderName,
        fileSize: file.size,
        duration,
        format: fileExtension.substring(1), // Remove the dot
        filePath
      });

      // Save metadata
      await this.metadataRepository.create({
        videoId: video.id,
        ...metadata
      });

      return video;
    } catch (error) {
      // Clean up file if it exists
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * Get video by ID with metadata
   */
  async getVideoWithMetadata(videoId: string): Promise<(Video & { metadata?: VideoMetadata }) | null> {
    const video = this.videoRepository.findById(videoId);
    if (!video) return null;

    const metadata = this.metadataRepository.findByVideoId(videoId);
    return {
      ...video,
      metadata: metadata || undefined
    };
  }

  /**
   * Get all videos for a project with metadata
   */
  async getProjectVideosWithMetadata(projectId: string): Promise<(Video & { metadata?: VideoMetadata })[]> {
    const videos = this.videoRepository.findByProjectId(projectId);
    
    const videosWithMetadata = await Promise.all(
      videos.map(async (video) => {
        const metadata = this.metadataRepository.findByVideoId(video.id);
        return {
          ...video,
          metadata: metadata || undefined
        };
      })
    );

    return videosWithMetadata;
  }

  /**
   * Delete video and its metadata
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    const video = this.videoRepository.findById(videoId);
    if (!video) return false;

    try {
      // Delete physical file
      const fullPath = path.join(process.cwd(), video.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Delete metadata
      this.metadataRepository.delete(videoId);

      // Delete video record
      return this.videoRepository.delete(videoId);
    } catch (error) {
      console.error('Error deleting video:', error);
      return false;
    }
  }
}