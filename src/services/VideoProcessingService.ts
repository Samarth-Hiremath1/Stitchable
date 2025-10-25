import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { Video, ProcessingJob } from '../types';
import { VideoRepository } from '../models/VideoRepository';
import { SynchronizationService } from './SynchronizationService';
import { jobQueue } from './JobQueue';

export interface ProcessingOptions {
  outputFormat?: string;
  resolution?: string;
  bitrate?: string;
  frameRate?: number;
  audioCodec?: string;
  videoCodec?: string;
}

export interface ThumbnailOptions {
  count?: number;
  size?: string;
  timestamps?: string[];
}

export class VideoProcessingService {
  private videoRepository = new VideoRepository();
  private synchronizationService = new SynchronizationService();

  constructor() {
    // Register job handlers
    jobQueue.registerHandler('sync', this.handleSyncJob.bind(this));
    jobQueue.registerHandler('quality_analysis', this.handleQualityAnalysisJob.bind(this));
    jobQueue.registerHandler('stitching', this.handleStitchingJob.bind(this));
  }

  /**
   * Convert video to standardized format
   */
  async convertVideo(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const {
        outputFormat = 'mp4',
        resolution = '1920x1080',
        bitrate = '2000k',
        frameRate = 30,
        audioCodec = 'aac',
        videoCodec = 'libx264'
      } = options;

      let command = ffmpeg(inputPath)
        .output(outputPath)
        .format(outputFormat)
        .videoCodec(videoCodec)
        .audioCodec(audioCodec)
        .videoBitrate(bitrate)
        .fps(frameRate)
        .size(resolution)
        .audioChannels(2)
        .audioFrequency(44100);

      // Add progress tracking
      if (onProgress) {
        command.on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          onProgress(percent);
        });
      }

      command
        .on('end', () => {
          console.log(`Video conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          console.error('Video conversion error:', err);
          reject(new Error(`Video conversion failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Generate video thumbnails
   */
  async generateThumbnails(
    videoPath: string,
    outputDir: string,
    options: ThumbnailOptions = {}
  ): Promise<string[]> {
    const {
      count = 3,
      size = '320x240',
      timestamps = []
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const thumbnailPaths: string[] = [];
    const baseFilename = path.basename(videoPath, path.extname(videoPath));

    if (timestamps.length > 0) {
      // Generate thumbnails at specific timestamps
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const filename = `${baseFilename}_thumb_${i + 1}.jpg`;
        const outputPath = path.join(outputDir, filename);
        thumbnailPaths.push(outputPath);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(timestamp)
            .output(outputPath)
            .outputOptions(['-vframes 1', `-s ${size}`])
            .on('end', () => resolve())
            .on('error', (err) => reject(new Error(`Thumbnail generation failed: ${err.message}`)))
            .run();
        });
      }
    } else {
      // Get video duration first
      const videoInfo = await this.getVideoInfo(videoPath);
      const duration = videoInfo.format.duration || 60;

      // Generate thumbnails at regular intervals
      for (let i = 0; i < count; i++) {
        const filename = `${baseFilename}_thumb_${i + 1}.jpg`;
        const outputPath = path.join(outputDir, filename);
        thumbnailPaths.push(outputPath);

        // Calculate timestamp as seconds
        const timestamp = Math.floor((i + 1) * duration / (count + 1));

        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(timestamp)
            .output(outputPath)
            .outputOptions(['-vframes 1', `-s ${size}`])
            .on('end', () => resolve())
            .on('error', (err) => reject(new Error(`Thumbnail generation failed: ${err.message}`)))
            .run();
        });
      }
    }

    console.log(`Generated ${thumbnailPaths.length} thumbnails`);
    return thumbnailPaths;
  }

  /**
   * Extract audio waveform data for synchronization
   */
  async extractAudioWaveform(videoPath: string): Promise<Buffer> {
    const tempAudioPath = path.join(
      path.dirname(videoPath),
      `temp_audio_${randomUUID()}.wav`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(tempAudioPath)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(44100)
        .noVideo()
        .on('end', () => {
          try {
            const audioData = fs.readFileSync(tempAudioPath);
            fs.unlinkSync(tempAudioPath); // Clean up temp file
            resolve(audioData);
          } catch (error) {
            reject(new Error(`Failed to read audio data: ${error}`));
          }
        })
        .on('error', (err) => {
          // Clean up temp file on error
          if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath);
          }
          reject(new Error(`Audio extraction failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Get video information including detailed metadata
   */
  async getVideoInfo(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video info: ${err.message}`));
          return;
        }
        resolve(metadata);
      });
    });
  }

  /**
   * Process video for standardization
   */
  async processVideoForStandardization(videoId: string): Promise<ProcessingJob> {
    const video = this.videoRepository.findById(videoId);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // Add processing job to queue
    const job = jobQueue.addJob(video.projectId, 'sync', 1);
    
    return job;
  }

  /**
   * Generate thumbnails for a video
   */
  async generateVideoThumbnails(videoId: string): Promise<string[]> {
    const video = this.videoRepository.findById(videoId);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const videoPath = path.join(process.cwd(), video.filePath);
    const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    
    const thumbnailPaths = await this.generateThumbnails(videoPath, thumbnailDir, {
      count: 3,
      size: '320x240'
    });

    // Convert absolute paths to relative paths for storage
    return thumbnailPaths.map(fullPath => 
      path.relative(process.cwd(), fullPath)
    );
  }

  /**
   * Job handler for sync processing
   */
  private async handleSyncJob(job: ProcessingJob): Promise<string> {
    console.log(`Starting AI synchronization job for project: ${job.projectId}`);
    
    // Get all videos for the project
    const videos = this.videoRepository.findByProjectId(job.projectId);
    
    if (videos.length < 2) {
      throw new Error('At least 2 videos are required for synchronization');
    }

    jobQueue.updateJobProgress(job.id, 10);

    // First, standardize all videos for consistent processing
    const processedVideos: string[] = [];
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const inputPath = path.join(process.cwd(), video.filePath);
      const outputPath = path.join(
        process.cwd(),
        'uploads',
        'processed',
        `standardized_${video.filename}`
      );

      // Ensure processed directory exists
      const processedDir = path.dirname(outputPath);
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }

      // Convert to standardized format
      await this.convertVideo(inputPath, outputPath, {
        outputFormat: 'mp4',
        resolution: '1920x1080',
        bitrate: '2000k',
        frameRate: 30
      }, (progress) => {
        const overallProgress = 10 + (i / videos.length) * 30 + (progress / videos.length) * 0.3;
        jobQueue.updateJobProgress(job.id, Math.round(overallProgress));
      });

      processedVideos.push(outputPath);
    }

    jobQueue.updateJobProgress(job.id, 50);

    // Perform AI-powered synchronization
    try {
      const syncResult = await this.synchronizationService.synchronizeVideos(job.projectId);
      
      jobQueue.updateJobProgress(job.id, 80);

      // Validate synchronization results
      const validation = this.synchronizationService.validateSyncResults(syncResult);
      
      if (!validation.isValid) {
        console.warn('Synchronization validation issues:', validation.issues);
        console.warn('Recommendations:', validation.recommendations);
      }

      // Generate thumbnails for all videos
      for (const video of videos) {
        try {
          await this.generateVideoThumbnails(video.id);
        } catch (error) {
          console.warn(`Failed to generate thumbnails for video ${video.id}:`, error);
        }
      }

      jobQueue.updateJobProgress(job.id, 100);

      const resultMessage = `AI synchronization completed for ${videos.length} videos. ` +
        `Confidence: ${syncResult.confidence.toFixed(1)}%, Method: ${syncResult.method}`;
      
      if (validation.issues.length > 0) {
        return resultMessage + `. Issues: ${validation.issues.join(', ')}`;
      }
      
      return resultMessage;
      
    } catch (error) {
      console.error('AI synchronization failed:', error);
      throw new Error(`Synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Job handler for quality analysis
   */
  private async handleQualityAnalysisJob(job: ProcessingJob): Promise<string> {
    console.log(`Starting quality analysis job for project: ${job.projectId}`);
    
    const videos = this.videoRepository.findByProjectId(job.projectId);
    
    jobQueue.updateJobProgress(job.id, 10);

    // Placeholder for quality analysis logic
    // In a real implementation, this would analyze video quality metrics
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      // Simulate quality analysis
      const qualityScore = Math.random() * 100; // Placeholder scoring
      
      // Update video with quality score
      this.videoRepository.update(video.id, { qualityScore });
      
      const progress = 10 + ((i + 1) / videos.length) * 90;
      jobQueue.updateJobProgress(job.id, Math.round(progress));
    }

    return `Analyzed quality for ${videos.length} videos`;
  }

  /**
   * Job handler for video stitching
   */
  private async handleStitchingJob(job: ProcessingJob): Promise<string> {
    console.log(`Starting stitching job for project: ${job.projectId}`);
    
    const videos = this.videoRepository.findByProjectId(job.projectId);
    
    if (videos.length === 0) {
      throw new Error('No videos found for stitching');
    }

    jobQueue.updateJobProgress(job.id, 10);

    // Placeholder for stitching logic
    // In a real implementation, this would stitch videos together
    const outputPath = path.join(
      process.cwd(),
      'uploads',
      'processed',
      `stitched_${job.projectId}_${Date.now()}.mp4`
    );

    // For now, just copy the first video as a placeholder
    const firstVideo = videos[0];
    const inputPath = path.join(process.cwd(), firstVideo.filePath);
    
    await this.convertVideo(inputPath, outputPath, {
      outputFormat: 'mp4'
    }, (progress) => {
      const overallProgress = 10 + progress * 0.9;
      jobQueue.updateJobProgress(job.id, Math.round(overallProgress));
    });

    return `Stitched video saved to: ${path.relative(process.cwd(), outputPath)}`;
  }
}