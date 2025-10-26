import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { Video, ProcessingJob, QualityMetrics } from '../types';
import { VideoRepository } from '../models/VideoRepository';
import { SynchronizationService } from './SynchronizationService';
import { VideoQualityService } from './VideoQualityService';
import { VideoStitchingService } from './VideoStitchingService';
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
  private qualityService = new VideoQualityService();
  private stitchingService = new VideoStitchingService();

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
   * Process video (alias for processVideoForStandardization)
   */
  async processVideo(videoId: string): Promise<ProcessingJob> {
    return this.processVideoForStandardization(videoId);
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
   * Start quality analysis for all videos in a project
   */
  async startQualityAnalysis(projectId: string): Promise<ProcessingJob> {
    const videos = this.videoRepository.findByProjectId(projectId);
    
    if (videos.length === 0) {
      throw new Error(`No videos found for project: ${projectId}`);
    }

    // Add quality analysis job to queue
    const job = jobQueue.addJob(projectId, 'quality_analysis', 1);
    
    console.log(`Started quality analysis job for project ${projectId} with ${videos.length} videos`);
    
    return job;
  }

  /**
   * Get quality metrics for a specific video
   */
  async getVideoQualityMetrics(videoId: string): Promise<QualityMetrics | null> {
    const video = this.videoRepository.findById(videoId);
    if (!video) {
      return null;
    }

    const videoPath = path.join(process.cwd(), video.filePath);
    
    try {
      return await this.qualityService.assessVideoQuality(videoPath, videoId);
    } catch (error) {
      console.error(`Failed to get quality metrics for video ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Get quality rankings for all videos in a project
   */
  async getProjectQualityRankings(projectId: string): Promise<Array<{
    video: Video;
    qualityScore: number;
    rank: number;
  }>> {
    const videos = this.videoRepository.findByProjectId(projectId);
    
    // Filter videos that have quality scores
    const videosWithScores = videos
      .filter(video => video.qualityScore !== undefined && video.qualityScore !== null)
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

    return videosWithScores.map((video, index) => ({
      video,
      qualityScore: video.qualityScore || 0,
      rank: index + 1
    }));
  }

  /**
   * Start intelligent video stitching for a project
   */
  async startVideoStitching(projectId: string): Promise<ProcessingJob> {
    const videos = this.videoRepository.findByProjectId(projectId);
    
    if (videos.length === 0) {
      throw new Error(`No videos found for project: ${projectId}`);
    }

    // Check if videos are synchronized
    const synchronizedVideos = videos.filter(video => 
      video.syncOffset !== undefined && video.syncOffset !== null
    );

    if (synchronizedVideos.length === 0 && videos.length > 1) {
      throw new Error('Videos must be synchronized before stitching. Please run synchronization first.');
    }

    // Check if videos have quality scores
    const videosWithQuality = videos.filter(video => 
      video.qualityScore !== undefined && video.qualityScore !== null
    );

    if (videosWithQuality.length === 0) {
      throw new Error('Videos must have quality analysis before stitching. Please run quality analysis first.');
    }

    // Add stitching job to queue
    const job = jobQueue.addJob(projectId, 'stitching', 1);
    
    console.log(`Started intelligent video stitching job for project ${projectId} with ${videos.length} videos`);
    
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
    
    if (videos.length === 0) {
      throw new Error('No videos found for quality analysis');
    }

    jobQueue.updateJobProgress(job.id, 10);

    const qualityResults: QualityMetrics[] = [];

    // Analyze each video's quality
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoPath = path.join(process.cwd(), video.filePath);
      
      try {
        console.log(`Analyzing quality for video: ${video.filename}`);
        
        // Perform comprehensive quality analysis
        const qualityMetrics = await this.qualityService.assessVideoQuality(
          videoPath,
          video.id,
          {
            sampleFrameCount: 20, // Reduced for performance
            analysisInterval: 3,  // Every 3 seconds
            enableMotionAnalysis: true,
            enableLightingAnalysis: true,
            enableFramingAnalysis: true,
            enableClarityAnalysis: true
          }
        );

        qualityResults.push(qualityMetrics);

        // Update video with overall quality score
        this.videoRepository.update(video.id, { 
          qualityScore: qualityMetrics.scores.overall 
        });

        console.log(`Quality analysis completed for ${video.filename}:`, {
          overall: qualityMetrics.scores.overall,
          stability: qualityMetrics.scores.stability,
          lighting: qualityMetrics.scores.lighting,
          framing: qualityMetrics.scores.framing,
          clarity: qualityMetrics.scores.clarity
        });

      } catch (error) {
        console.error(`Quality analysis failed for video ${video.filename}:`, error);
        
        // Set a default quality score for failed analysis
        this.videoRepository.update(video.id, { qualityScore: 50 });
      }
      
      const progress = 10 + ((i + 1) / videos.length) * 90;
      jobQueue.updateJobProgress(job.id, Math.round(progress));
    }

    // Rank videos by quality
    const rankedVideos = await this.qualityService.rankVideosByQuality(qualityResults);
    
    // Log quality ranking results
    console.log('Video quality ranking:');
    rankedVideos.forEach((metrics, index) => {
      const video = videos.find(v => v.id === metrics.videoId);
      console.log(`${index + 1}. ${video?.filename} - Score: ${metrics.scores.overall}`);
    });

    return `Quality analysis completed for ${videos.length} videos. ` +
           `Top video: ${rankedVideos[0]?.scores.overall || 'N/A'} score`;
  }

  /**
   * Job handler for video stitching
   */
  private async handleStitchingJob(job: ProcessingJob): Promise<string> {
    console.log(`Starting intelligent video stitching job for project: ${job.projectId}`);
    
    const videos = this.videoRepository.findByProjectId(job.projectId);
    
    if (videos.length === 0) {
      throw new Error('No videos found for stitching');
    }

    jobQueue.updateJobProgress(job.id, 10);

    try {
      // Use the intelligent video stitching service
      const stitchingResult = await this.stitchingService.stitchVideos(job.projectId, {
        transitionDuration: 0.5,
        minSegmentDuration: 2.0,
        maxSegmentDuration: 10.0,
        enableSmartTransitions: true,
        enableCameraAngleSwitching: true,
        outputFormat: 'mp4',
        outputResolution: '1920x1080',
        outputBitrate: '4000k'
      });

      jobQueue.updateJobProgress(job.id, 100);

      const resultMessage = `Intelligent video stitching completed successfully!\n` +
        `Output: ${stitchingResult.outputPath}\n` +
        `Duration: ${Math.round(stitchingResult.duration)}s\n` +
        `File Size: ${Math.round(stitchingResult.fileSize / 1024 / 1024)}MB\n` +
        `Average Quality: ${stitchingResult.qualityMetrics.averageQuality}%\n` +
        `Transitions: ${stitchingResult.qualityMetrics.transitionCount}\n` +
        `Camera Switches: ${stitchingResult.qualityMetrics.cameraAngleSwitches}\n` +
        `Segments: ${stitchingResult.timeline.segments.length}`;

      console.log('Stitching completed:', resultMessage);
      return resultMessage;

    } catch (error) {
      console.error('Intelligent video stitching failed:', error);
      throw new Error(`Video stitching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}