import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { 
  Video, 
  StitchingSegment, 
  StitchingTimeline, 
  StitchingResult,
  CameraAngleClassification,
  QualityMetrics 
} from '../types';
import { VideoRepository } from '../models/VideoRepository';
import { VideoQualityService } from './VideoQualityService';

export interface StitchingOptions {
  transitionDuration?: number; // seconds
  minSegmentDuration?: number; // seconds
  maxSegmentDuration?: number; // seconds
  enableSmartTransitions?: boolean;
  enableCameraAngleSwitching?: boolean;
  outputFormat?: string;
  outputResolution?: string;
  outputBitrate?: string;
}

export class VideoStitchingService {
  private videoRepository = new VideoRepository();
  private qualityService = new VideoQualityService();

  private readonly defaultOptions: Required<StitchingOptions> = {
    transitionDuration: 0.5,
    minSegmentDuration: 2.0,
    maxSegmentDuration: 10.0,
    enableSmartTransitions: true,
    enableCameraAngleSwitching: true,
    outputFormat: 'mp4',
    outputResolution: '1920x1080',
    outputBitrate: '4000k'
  };

  /**
   * Create intelligent video stitching from synchronized videos
   */
  async stitchVideos(
    projectId: string,
    options: StitchingOptions = {}
  ): Promise<StitchingResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    console.log(`Starting intelligent video stitching for project: ${projectId}`);

    // Get all synchronized videos for the project
    const videos = this.videoRepository.findByProjectId(projectId);
    
    if (videos.length === 0) {
      throw new Error('No videos found for stitching');
    }

    if (videos.length === 1) {
      // Single video - just convert to output format
      return await this.processSingleVideo(videos[0], projectId, opts);
    }

    // Filter videos that have sync offsets (synchronized videos)
    const synchronizedVideos = videos.filter(video => 
      video.syncOffset !== undefined && video.syncOffset !== null
    );

    if (synchronizedVideos.length < 2) {
      console.warn('Not enough synchronized videos, using all available videos');
      // Use all videos with default sync offset of 0
      synchronizedVideos.push(...videos.filter(video => 
        video.syncOffset === undefined || video.syncOffset === null
      ).map(video => ({ ...video, syncOffset: 0 })));
    }

    // Step 1: Generate timeline from synchronized videos
    const timeline = await this.generateTimeline(synchronizedVideos, opts);
    
    // Step 2: Classify camera angles for intelligent switching
    const cameraAngles = opts.enableCameraAngleSwitching 
      ? await this.classifyCameraAngles(synchronizedVideos)
      : [];

    // Step 3: Select segments based on quality rankings and camera angles
    const selectedSegments = await this.selectOptimalSegments(
      timeline, 
      synchronizedVideos, 
      cameraAngles, 
      opts
    );

    // Step 4: Generate smooth transitions between segments
    const finalTimeline = opts.enableSmartTransitions
      ? await this.generateSmartTransitions(selectedSegments, opts)
      : { ...timeline, segments: selectedSegments };

    // Step 5: Render final video with FFmpeg
    const outputPath = await this.renderFinalVideo(
      finalTimeline, 
      synchronizedVideos, 
      projectId, 
      opts
    );

    // Calculate result metrics
    const fileStats = fs.statSync(outputPath);
    const qualityMetrics = this.calculateStitchingQualityMetrics(finalTimeline);

    return {
      projectId,
      outputPath: path.relative(process.cwd(), outputPath),
      timeline: finalTimeline,
      duration: finalTimeline.totalDuration,
      fileSize: fileStats.size,
      qualityMetrics,
      createdAt: new Date()
    };
  }

  /**
   * Generate timeline from synchronized videos
   */
  private async generateTimeline(
    videos: Video[],
    options: Required<StitchingOptions>
  ): Promise<StitchingTimeline> {
    console.log('Generating timeline from synchronized videos...');

    // Calculate the overall timeline duration
    const maxEndTime = Math.max(...videos.map(video => 
      (video.syncOffset || 0) + video.duration
    ));

    // Create time segments for analysis
    const segmentDuration = options.minSegmentDuration;
    const segments: StitchingSegment[] = [];

    for (let time = 0; time < maxEndTime; time += segmentDuration) {
      const segmentEnd = Math.min(time + segmentDuration, maxEndTime);
      
      // Find videos that are active during this time segment
      const activeVideos = videos.filter(video => {
        const videoStart = video.syncOffset || 0;
        const videoEnd = videoStart + video.duration;
        return videoStart < segmentEnd && videoEnd > time;
      });

      if (activeVideos.length > 0) {
        // Select the best quality video for this segment
        const bestVideo = activeVideos.reduce((best, current) => 
          (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
        );

        segments.push({
          videoId: bestVideo.id,
          startTime: time,
          endTime: segmentEnd,
          qualityScore: bestVideo.qualityScore || 0,
          transitionType: 'cut', // Will be updated in transition generation
          cameraAngle: 'unknown' // Will be updated in camera angle classification
        });
      }
    }

    return {
      projectId: videos[0].projectId,
      segments,
      totalDuration: maxEndTime,
      transitionDuration: options.transitionDuration,
      createdAt: new Date()
    };
  }

  /**
   * Classify camera angles for intelligent switching
   */
  private async classifyCameraAngles(videos: Video[]): Promise<CameraAngleClassification[]> {
    console.log('Classifying camera angles for intelligent switching...');
    
    const classifications: CameraAngleClassification[] = [];

    for (const video of videos) {
      try {
        const videoPath = path.join(process.cwd(), video.filePath);
        const classification = await this.analyzeVideoForCameraAngle(videoPath, video.id);
        classifications.push(classification);
      } catch (error) {
        console.warn(`Failed to classify camera angle for video ${video.id}:`, error);
        
        // Default classification
        classifications.push({
          videoId: video.id,
          angle: 'unknown',
          confidence: 0,
          frameAnalysis: []
        });
      }
    }

    return classifications;
  }

  /**
   * Analyze video for camera angle classification
   */
  private async analyzeVideoForCameraAngle(
    videoPath: string, 
    videoId: string
  ): Promise<CameraAngleClassification> {
    // Extract frames for analysis
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const frameDir = path.join(tempDir, `frames_${randomUUID()}`);
    
    if (!fs.existsSync(frameDir)) {
      fs.mkdirSync(frameDir, { recursive: true });
    }

    try {
      // Extract frames at 5-second intervals
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .output(path.join(frameDir, 'frame_%03d.jpg'))
          .outputOptions([
            '-vf fps=1/5', // 1 frame every 5 seconds
            '-q:v 2'
          ])
          .on('end', () => resolve())
          .on('error', (err) => reject(new Error(`Frame extraction failed: ${err.message}`)))
          .run();
      });

      // Analyze extracted frames
      const frameFiles = fs.readdirSync(frameDir)
        .filter(file => file.endsWith('.jpg'))
        .sort();

      const frameAnalysis: Array<{
        timestamp: number;
        angle: 'wide' | 'medium' | 'close' | 'unknown';
        confidence: number;
      }> = [];

      for (let i = 0; i < frameFiles.length; i++) {
        const framePath = path.join(frameDir, frameFiles[i]);
        const timestamp = i * 5; // 5-second intervals
        
        const angleData = await this.classifyFrameCameraAngle(framePath);
        frameAnalysis.push({
          timestamp,
          angle: angleData.angle,
          confidence: angleData.confidence
        });
      }

      // Determine overall camera angle for the video
      const angleCounts = {
        wide: frameAnalysis.filter(f => f.angle === 'wide').length,
        medium: frameAnalysis.filter(f => f.angle === 'medium').length,
        close: frameAnalysis.filter(f => f.angle === 'close').length,
        unknown: frameAnalysis.filter(f => f.angle === 'unknown').length
      };

      const dominantAngle = Object.entries(angleCounts).reduce((a, b) => 
        angleCounts[a[0] as keyof typeof angleCounts] > angleCounts[b[0] as keyof typeof angleCounts] ? a : b
      )[0] as 'wide' | 'medium' | 'close' | 'unknown';

      const confidence = frameAnalysis.length > 0 
        ? frameAnalysis.reduce((sum, f) => sum + f.confidence, 0) / frameAnalysis.length
        : 0;

      return {
        videoId,
        angle: dominantAngle,
        confidence,
        frameAnalysis
      };

    } finally {
      // Clean up temp files
      if (fs.existsSync(frameDir)) {
        const files = fs.readdirSync(frameDir);
        for (const file of files) {
          fs.unlinkSync(path.join(frameDir, file));
        }
        fs.rmdirSync(frameDir);
      }
    }
  }

  /**
   * Classify camera angle for a single frame
   */
  private async classifyFrameCameraAngle(framePath: string): Promise<{
    angle: 'wide' | 'medium' | 'close' | 'unknown';
    confidence: number;
  }> {
    // Simplified camera angle classification
    // In a real implementation, this would use computer vision to analyze:
    // - Subject size relative to frame
    // - Background visibility
    // - Depth of field
    // - Facial feature detection size
    
    // For now, return mock classification based on random distribution
    const angles: ('wide' | 'medium' | 'close')[] = ['wide', 'medium', 'close'];
    const randomAngle = angles[Math.floor(Math.random() * angles.length)];
    const confidence = 60 + Math.random() * 30; // 60-90% confidence
    
    return {
      angle: randomAngle,
      confidence
    };
  }

  /**
   * Select optimal segments based on quality rankings and camera angles
   */
  private async selectOptimalSegments(
    timeline: StitchingTimeline,
    videos: Video[],
    cameraAngles: CameraAngleClassification[],
    options: Required<StitchingOptions>
  ): Promise<StitchingSegment[]> {
    console.log('Selecting optimal segments based on quality and camera angles...');

    const optimizedSegments: StitchingSegment[] = [];
    let lastCameraAngle: 'wide' | 'medium' | 'close' | 'unknown' = 'unknown';

    for (let i = 0; i < timeline.segments.length; i++) {
      const segment = timeline.segments[i];
      
      // Find all videos available for this time segment
      const availableVideos = videos.filter(video => {
        const videoStart = video.syncOffset || 0;
        const videoEnd = videoStart + video.duration;
        return videoStart <= segment.startTime && videoEnd >= segment.endTime;
      });

      if (availableVideos.length === 0) {
        continue; // Skip if no videos available
      }

      let selectedVideo = availableVideos[0];
      let selectedAngle: 'wide' | 'medium' | 'close' | 'unknown' = 'unknown';

      if (options.enableCameraAngleSwitching && availableVideos.length > 1) {
        // Intelligent camera angle switching
        const videoWithAngles = availableVideos.map(video => {
          const angleData = cameraAngles.find(ca => ca.videoId === video.id);
          return {
            video,
            angle: angleData?.angle || 'unknown',
            confidence: angleData?.confidence || 0
          };
        });

        // Prefer different camera angle from the last segment for variety
        const differentAngleVideos = videoWithAngles.filter(va => 
          va.angle !== lastCameraAngle && va.angle !== 'unknown'
        );

        if (differentAngleVideos.length > 0) {
          // Select best quality video with different angle
          const bestDifferentAngle = differentAngleVideos.reduce((best, current) => 
            (current.video.qualityScore || 0) > (best.video.qualityScore || 0) ? current : best
          );
          
          selectedVideo = bestDifferentAngle.video;
          selectedAngle = bestDifferentAngle.angle;
        } else {
          // No different angles available, select best quality
          selectedVideo = availableVideos.reduce((best, current) => 
            (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
          );
          
          const angleData = cameraAngles.find(ca => ca.videoId === selectedVideo.id);
          selectedAngle = angleData?.angle || 'unknown';
        }
      } else {
        // Simple quality-based selection
        selectedVideo = availableVideos.reduce((best, current) => 
          (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
        );
        
        const angleData = cameraAngles.find(ca => ca.videoId === selectedVideo.id);
        selectedAngle = angleData?.angle || 'unknown';
      }

      optimizedSegments.push({
        ...segment,
        videoId: selectedVideo.id,
        qualityScore: selectedVideo.qualityScore || 0,
        cameraAngle: selectedAngle
      });

      lastCameraAngle = selectedAngle;
    }

    return optimizedSegments;
  }

  /**
   * Generate smart transitions between segments
   */
  private async generateSmartTransitions(
    segments: StitchingSegment[],
    options: Required<StitchingOptions>
  ): Promise<StitchingTimeline> {
    console.log('Generating smart transitions between segments...');

    const transitionSegments: StitchingSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const currentSegment = segments[i];
      const nextSegment = segments[i + 1];

      // Determine transition type based on context
      let transitionType: 'cut' | 'fade' | 'crossfade' = 'cut';

      if (nextSegment) {
        // Different video sources - use crossfade for smooth transition
        if (currentSegment.videoId !== nextSegment.videoId) {
          transitionType = 'crossfade';
        }
        // Same video but different camera angles - use fade
        else if (currentSegment.cameraAngle !== nextSegment.cameraAngle) {
          transitionType = 'fade';
        }
        // Same video, same angle - use cut
        else {
          transitionType = 'cut';
        }
      }

      transitionSegments.push({
        ...currentSegment,
        transitionType
      });
    }

    return {
      projectId: segments[0]?.videoId ? segments[0].videoId.split('-')[0] : 'unknown',
      segments: transitionSegments,
      totalDuration: segments.length > 0 
        ? Math.max(...segments.map(s => s.endTime))
        : 0,
      transitionDuration: options.transitionDuration,
      createdAt: new Date()
    };
  }

  /**
   * Render final video using FFmpeg with intelligent stitching
   */
  private async renderFinalVideo(
    timeline: StitchingTimeline,
    videos: Video[],
    projectId: string,
    options: Required<StitchingOptions>
  ): Promise<string> {
    console.log('Rendering final stitched video with FFmpeg...');

    const outputPath = path.join(
      process.cwd(),
      'uploads',
      'processed',
      `stitched_${projectId}_${Date.now()}.${options.outputFormat}`
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create FFmpeg filter complex for stitching
    const filterComplex = await this.buildFFmpegFilterComplex(timeline, videos, options);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      // Add all input videos
      const videoMap = new Map<string, number>();
      let inputIndex = 0;

      for (const video of videos) {
        const videoPath = path.join(process.cwd(), video.filePath);
        command = command.input(videoPath);
        videoMap.set(video.id, inputIndex);
        inputIndex++;
      }

      // Apply filter complex and output settings
      command
        .complexFilter(filterComplex.filters, filterComplex.outputs)
        .output(outputPath)
        .format(options.outputFormat)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate(options.outputBitrate)
        .size(options.outputResolution)
        .fps(30)
        .audioChannels(2)
        .audioFrequency(44100)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Stitching progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          console.log(`Video stitching completed: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Video stitching error:', err);
          reject(new Error(`Video stitching failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Build FFmpeg filter complex for intelligent stitching
   */
  private async buildFFmpegFilterComplex(
    timeline: StitchingTimeline,
    videos: Video[],
    options: Required<StitchingOptions>
  ): Promise<{ filters: string[], outputs: string[] }> {
    const filters: string[] = [];
    const videoMap = new Map<string, number>();
    
    // Create video index mapping
    videos.forEach((video, index) => {
      videoMap.set(video.id, index);
    });

    // Generate filters for each segment
    const segmentOutputs: string[] = [];

    for (let i = 0; i < timeline.segments.length; i++) {
      const segment = timeline.segments[i];
      const videoIndex = videoMap.get(segment.videoId);
      
      if (videoIndex === undefined) {
        continue;
      }

      const video = videos.find(v => v.id === segment.videoId);
      if (!video) continue;

      // Calculate timing offsets
      const videoStartOffset = video.syncOffset || 0;
      const segmentStartInVideo = segment.startTime - videoStartOffset;
      const segmentDuration = segment.endTime - segment.startTime;

      // Create segment filter
      const segmentLabel = `segment_${i}`;
      
      // Extract segment with proper timing
      filters.push(
        `[${videoIndex}:v]trim=start=${segmentStartInVideo}:duration=${segmentDuration},setpts=PTS-STARTPTS[${segmentLabel}_v]`
      );
      filters.push(
        `[${videoIndex}:a]atrim=start=${segmentStartInVideo}:duration=${segmentDuration},asetpts=PTS-STARTPTS[${segmentLabel}_a]`
      );

      // Apply transitions if needed
      if (segment.transitionType === 'fade' && i > 0) {
        const fadeLabel = `${segmentLabel}_fade`;
        filters.push(
          `[${segmentLabel}_v]fade=t=in:st=0:d=${options.transitionDuration}[${fadeLabel}_v]`
        );
        filters.push(
          `[${segmentLabel}_a]afade=t=in:st=0:d=${options.transitionDuration}[${fadeLabel}_a]`
        );
        segmentOutputs.push(`${fadeLabel}_v`, `${fadeLabel}_a`);
      } else {
        segmentOutputs.push(`${segmentLabel}_v`, `${segmentLabel}_a`);
      }
    }

    // Concatenate all segments
    if (segmentOutputs.length > 0) {
      const videoInputs = segmentOutputs.filter((_, index) => index % 2 === 0).join('');
      const audioInputs = segmentOutputs.filter((_, index) => index % 2 === 1).join('');
      
      filters.push(
        `${videoInputs}concat=n=${timeline.segments.length}:v=1:a=0[final_v]`
      );
      filters.push(
        `${audioInputs}concat=n=${timeline.segments.length}:v=0:a=1[final_a]`
      );
    }

    return {
      filters,
      outputs: ['final_v', 'final_a']
    };
  }

  /**
   * Process single video (when only one video is available)
   */
  private async processSingleVideo(
    video: Video,
    projectId: string,
    options: Required<StitchingOptions>
  ): Promise<StitchingResult> {
    console.log('Processing single video for stitching...');

    const inputPath = path.join(process.cwd(), video.filePath);
    const outputPath = path.join(
      process.cwd(),
      'uploads',
      'processed',
      `stitched_${projectId}_${Date.now()}.${options.outputFormat}`
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Convert single video to output format
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .format(options.outputFormat)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate(options.outputBitrate)
        .size(options.outputResolution)
        .fps(30)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`Single video processing failed: ${err.message}`)))
        .run();
    });

    // Create simple timeline
    const timeline: StitchingTimeline = {
      projectId,
      segments: [{
        videoId: video.id,
        startTime: 0,
        endTime: video.duration,
        qualityScore: video.qualityScore || 0,
        transitionType: 'cut',
        cameraAngle: 'unknown'
      }],
      totalDuration: video.duration,
      transitionDuration: 0,
      createdAt: new Date()
    };

    const fileStats = fs.statSync(outputPath);

    return {
      projectId,
      outputPath: path.relative(process.cwd(), outputPath),
      timeline,
      duration: video.duration,
      fileSize: fileStats.size,
      qualityMetrics: {
        averageQuality: video.qualityScore || 0,
        transitionCount: 0,
        cameraAngleSwitches: 0
      },
      createdAt: new Date()
    };
  }

  /**
   * Calculate quality metrics for the stitching result
   */
  private calculateStitchingQualityMetrics(timeline: StitchingTimeline): {
    averageQuality: number;
    transitionCount: number;
    cameraAngleSwitches: number;
  } {
    const segments = timeline.segments;
    
    if (segments.length === 0) {
      return {
        averageQuality: 0,
        transitionCount: 0,
        cameraAngleSwitches: 0
      };
    }

    // Calculate average quality
    const averageQuality = segments.reduce((sum, segment) => 
      sum + segment.qualityScore, 0
    ) / segments.length;

    // Count transitions
    const transitionCount = segments.filter(segment => 
      segment.transitionType !== 'cut'
    ).length;

    // Count camera angle switches
    let cameraAngleSwitches = 0;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].cameraAngle !== segments[i - 1].cameraAngle) {
        cameraAngleSwitches++;
      }
    }

    return {
      averageQuality: Math.round(averageQuality),
      transitionCount,
      cameraAngleSwitches
    };
  }

  /**
   * Get video information using FFprobe
   */
  private async getVideoInfo(videoPath: string): Promise<any> {
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
}