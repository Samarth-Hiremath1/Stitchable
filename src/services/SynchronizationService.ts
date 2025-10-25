import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { Video, SyncPoint, AudioWaveform, VisualFeature, SyncResult } from '../types';
import { VideoRepository } from '../models/VideoRepository';

export class SynchronizationService {
  private videoRepository = new VideoRepository();

  /**
   * Extract audio waveform data from video using FFmpeg
   */
  async extractAudioWaveform(videoPath: string, videoId: string): Promise<AudioWaveform> {
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
        .on('end', async () => {
          try {
            const audioBuffer = fs.readFileSync(tempAudioPath);
            
            // Skip WAV header (44 bytes) and convert to Float32Array
            const headerSize = 44;
            const audioData = audioBuffer.slice(headerSize);
            const samples = new Float32Array(audioData.length / 2);
            
            // Convert 16-bit PCM to float32 (-1.0 to 1.0)
            for (let i = 0; i < samples.length; i++) {
              const sample = audioData.readInt16LE(i * 2);
              samples[i] = sample / 32768.0;
            }

            // Get video duration for metadata
            const videoInfo = await this.getVideoInfo(videoPath);
            const duration = videoInfo.format.duration || 0;

            const waveform: AudioWaveform = {
              videoId,
              sampleRate: 44100,
              samples,
              duration
            };

            // Clean up temp file
            fs.unlinkSync(tempAudioPath);
            resolve(waveform);
          } catch (error) {
            // Clean up temp file on error
            if (fs.existsSync(tempAudioPath)) {
              fs.unlinkSync(tempAudioPath);
            }
            reject(new Error(`Failed to process audio data: ${error}`));
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
   * Perform cross-correlation between two audio waveforms to find sync points
   */
  private crossCorrelateAudio(waveform1: AudioWaveform, waveform2: AudioWaveform): SyncPoint[] {
    const samples1 = waveform1.samples;
    const samples2 = waveform2.samples;
    
    // Use shorter waveform length for correlation window
    const minLength = Math.min(samples1.length, samples2.length);
    const correlationWindow = Math.min(minLength, 44100 * 30); // Max 30 seconds
    
    const correlations: Array<{offset: number, correlation: number}> = [];
    const maxOffset = Math.min(44100 * 10, minLength - correlationWindow); // Max 10 second offset
    
    // Perform correlation at different offsets
    for (let offset = 0; offset < maxOffset; offset += 1024) { // Step by ~23ms
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < correlationWindow; i += 64) { // Sample every ~1.5ms
        if (offset + i < samples1.length && i < samples2.length) {
          correlation += samples1[offset + i] * samples2[i];
          count++;
        }
      }
      
      if (count > 0) {
        correlations.push({
          offset: offset / waveform1.sampleRate, // Convert to seconds
          correlation: correlation / count
        });
      }
    }
    
    // Find peaks in correlation
    const syncPoints: SyncPoint[] = [];
    const threshold = 0.1; // Minimum correlation threshold
    
    for (let i = 1; i < correlations.length - 1; i++) {
      const current = correlations[i];
      const prev = correlations[i - 1];
      const next = correlations[i + 1];
      
      // Check if this is a local maximum above threshold
      if (current.correlation > threshold &&
          current.correlation > prev.correlation &&
          current.correlation > next.correlation) {
        
        syncPoints.push({
          videoId: waveform2.videoId,
          timestamp: 0, // Reference point in second video
          confidence: Math.min(current.correlation * 100, 100),
          method: 'audio',
          referencePoint: current.offset // Offset in first video
        });
      }
    }
    
    // Sort by confidence and return top candidates
    return syncPoints
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 sync points
  }

  /**
   * Extract visual features from video frames using basic computer vision
   */
  async extractVisualFeatures(videoPath: string, videoId: string): Promise<VisualFeature[]> {
    const features: VisualFeature[] = [];
    const tempFrameDir = path.join(
      path.dirname(videoPath),
      `temp_frames_${randomUUID()}`
    );

    try {
      // Create temp directory for frames
      if (!fs.existsSync(tempFrameDir)) {
        fs.mkdirSync(tempFrameDir, { recursive: true });
      }

      // Extract frames at 1 second intervals
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .output(path.join(tempFrameDir, 'frame_%03d.jpg'))
          .outputOptions([
            '-vf fps=1', // 1 frame per second
            '-q:v 2'     // High quality
          ])
          .on('end', () => resolve())
          .on('error', (err) => reject(new Error(`Frame extraction failed: ${err.message}`)))
          .run();
      });

      // Process extracted frames
      const frameFiles = fs.readdirSync(tempFrameDir)
        .filter(file => file.endsWith('.jpg'))
        .sort();

      for (let i = 0; i < frameFiles.length; i++) {
        const framePath = path.join(tempFrameDir, frameFiles[i]);
        const timestamp = i; // 1 second intervals
        
        // Extract basic visual features (simplified)
        const frameFeatures = await this.extractFrameFeatures(framePath);
        
        features.push({
          videoId,
          timestamp,
          features: frameFeatures.features,
          keypoints: frameFeatures.keypoints
        });
      }

      return features;
    } finally {
      // Clean up temp directory
      if (fs.existsSync(tempFrameDir)) {
        const files = fs.readdirSync(tempFrameDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempFrameDir, file));
        }
        fs.rmdirSync(tempFrameDir);
      }
    }
  }

  /**
   * Extract basic visual features from a single frame
   * This is a simplified implementation - in production, you'd use OpenCV or similar
   */
  private async extractFrameFeatures(framePath: string): Promise<{features: number[], keypoints: Array<{x: number, y: number}>}> {
    // This is a placeholder implementation
    // In a real system, you would use OpenCV to extract:
    // - SIFT/SURF keypoints
    // - Color histograms
    // - Edge features
    // - Texture features
    
    // For now, return mock features based on file stats
    const stats = fs.statSync(framePath);
    const mockFeatures = [
      stats.size / 1000, // Normalized file size
      Math.random() * 100, // Mock brightness
      Math.random() * 100, // Mock contrast
      Math.random() * 100, // Mock saturation
    ];
    
    const mockKeypoints = [
      { x: Math.random() * 1920, y: Math.random() * 1080 },
      { x: Math.random() * 1920, y: Math.random() * 1080 },
      { x: Math.random() * 1920, y: Math.random() * 1080 },
    ];
    
    return {
      features: mockFeatures,
      keypoints: mockKeypoints
    };
  }

  /**
   * Compare visual features between two videos to find sync points
   */
  private compareVisualFeatures(features1: VisualFeature[], features2: VisualFeature[]): SyncPoint[] {
    const syncPoints: SyncPoint[] = [];
    const threshold = 0.7; // Similarity threshold
    
    for (const feature1 of features1) {
      for (const feature2 of features2) {
        // Calculate feature similarity (simplified cosine similarity)
        const similarity = this.calculateFeatureSimilarity(feature1.features, feature2.features);
        
        if (similarity > threshold) {
          syncPoints.push({
            videoId: features2[0].videoId,
            timestamp: feature2.timestamp,
            confidence: similarity * 100,
            method: 'visual',
            referencePoint: feature1.timestamp
          });
        }
      }
    }
    
    // Sort by confidence and return top candidates
    return syncPoints
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Return top 3 visual sync points
  }

  /**
   * Calculate similarity between two feature vectors
   */
  private calculateFeatureSimilarity(features1: number[], features2: number[]): number {
    if (features1.length !== features2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < features1.length; i++) {
      dotProduct += features1[i] * features2[i];
      norm1 += features1[i] * features1[i];
      norm2 += features2[i] * features2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Synchronize multiple videos using audio correlation as primary method
   */
  async synchronizeVideos(projectId: string): Promise<SyncResult> {
    const videos = this.videoRepository.findByProjectId(projectId);
    
    if (videos.length < 2) {
      throw new Error('At least 2 videos are required for synchronization');
    }

    console.log(`Starting synchronization for ${videos.length} videos`);
    
    // Extract audio waveforms for all videos
    const waveforms: AudioWaveform[] = [];
    for (const video of videos) {
      const videoPath = path.join(process.cwd(), video.filePath);
      const waveform = await this.extractAudioWaveform(videoPath, video.id);
      waveforms.push(waveform);
    }

    // Use first video as reference
    const referenceWaveform = waveforms[0];
    const allSyncPoints: SyncPoint[] = [];
    
    // Find sync points between reference and each other video
    for (let i = 1; i < waveforms.length; i++) {
      const syncPoints = this.crossCorrelateAudio(referenceWaveform, waveforms[i]);
      allSyncPoints.push(...syncPoints);
    }

    // If audio sync confidence is low, try visual synchronization as fallback
    const avgAudioConfidence = allSyncPoints.length > 0 
      ? allSyncPoints.reduce((sum, point) => sum + point.confidence, 0) / allSyncPoints.length
      : 0;

    let visualSyncPoints: SyncPoint[] = [];
    if (avgAudioConfidence < 50) { // Low audio confidence threshold
      console.log('Audio confidence low, attempting visual synchronization...');
      
      try {
        // Extract visual features for reference video and one other
        const referenceVideo = videos[0];
        const compareVideo = videos[1];
        
        const referenceFeatures = await this.extractVisualFeatures(
          path.join(process.cwd(), referenceVideo.filePath),
          referenceVideo.id
        );
        
        const compareFeatures = await this.extractVisualFeatures(
          path.join(process.cwd(), compareVideo.filePath),
          compareVideo.id
        );
        
        visualSyncPoints = this.compareVisualFeatures(referenceFeatures, compareFeatures);
      } catch (error) {
        console.warn('Visual synchronization failed:', error);
      }
    }

    // Combine and validate sync points
    const combinedSyncPoints = [...allSyncPoints, ...visualSyncPoints];
    const finalConfidence = this.calculateOverallConfidence(combinedSyncPoints);
    
    // Determine primary synchronization method
    const method = avgAudioConfidence > 50 ? 'audio' : 
                  visualSyncPoints.length > 0 ? 'visual' : 'hybrid';

    // Create aligned video results
    const alignedVideos = videos.map((video, index) => {
      if (index === 0) {
        // Reference video has no offset
        return {
          videoId: video.id,
          offsetSeconds: 0,
          confidence: 100
        };
      }
      
      // Find best sync point for this video
      const videoSyncPoints = combinedSyncPoints.filter(point => point.videoId === video.id);
      const bestSyncPoint = videoSyncPoints.length > 0 
        ? videoSyncPoints.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
          )
        : null;
      
      return {
        videoId: video.id,
        offsetSeconds: bestSyncPoint ? bestSyncPoint.referencePoint : 0,
        confidence: bestSyncPoint ? bestSyncPoint.confidence : 0
      };
    });

    // Update video records with sync offsets
    for (const aligned of alignedVideos) {
      this.videoRepository.update(aligned.videoId, {
        syncOffset: aligned.offsetSeconds
      });
    }

    const result: SyncResult = {
      projectId,
      syncPoints: combinedSyncPoints,
      confidence: finalConfidence,
      method,
      alignedVideos
    };

    console.log(`Synchronization completed with ${finalConfidence.toFixed(1)}% confidence using ${method} method`);
    return result;
  }

  /**
   * Calculate overall confidence score for synchronization
   */
  private calculateOverallConfidence(syncPoints: SyncPoint[]): number {
    if (syncPoints.length === 0) return 0;
    
    const avgConfidence = syncPoints.reduce((sum, point) => sum + point.confidence, 0) / syncPoints.length;
    
    // Boost confidence if we have multiple consistent sync points
    const consistencyBonus = syncPoints.length > 1 ? Math.min(syncPoints.length * 5, 20) : 0;
    
    return Math.min(avgConfidence + consistencyBonus, 100);
  }

  /**
   * Validate sync results and provide quality metrics
   */
  validateSyncResults(syncResult: SyncResult): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check overall confidence
    if (syncResult.confidence < 30) {
      issues.push('Very low synchronization confidence');
      recommendations.push('Consider manual alignment or higher quality audio');
    } else if (syncResult.confidence < 60) {
      issues.push('Moderate synchronization confidence');
      recommendations.push('Review sync points manually before final processing');
    }
    
    // Check for videos with no sync points
    const unalignedVideos = syncResult.alignedVideos.filter(video => video.confidence < 20);
    if (unalignedVideos.length > 0) {
      issues.push(`${unalignedVideos.length} videos could not be reliably synchronized`);
      recommendations.push('Check audio quality and ensure overlapping content');
    }
    
    // Check method reliability
    if (syncResult.method === 'visual') {
      recommendations.push('Visual synchronization used - verify results manually');
    }
    
    const isValid = syncResult.confidence >= 30 && unalignedVideos.length < syncResult.alignedVideos.length / 2;
    
    return {
      isValid,
      issues,
      recommendations
    };
  }

  /**
   * Get video information using FFmpeg
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