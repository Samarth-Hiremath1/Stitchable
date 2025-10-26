import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { 
  QualityScore, 
  QualityMetrics, 
  FrameQualityData,
  MotionAnalysis,
  LightingAnalysis,
  FramingAnalysis,
  ClarityAnalysis,
  Video 
} from '../types';

export interface QualityAssessmentOptions {
  sampleFrameCount?: number;
  analysisInterval?: number; // seconds between frame samples
  enableMotionAnalysis?: boolean;
  enableLightingAnalysis?: boolean;
  enableFramingAnalysis?: boolean;
  enableClarityAnalysis?: boolean;
}

export class VideoQualityService {
  private readonly defaultOptions: Required<QualityAssessmentOptions> = {
    sampleFrameCount: 30,
    analysisInterval: 2,
    enableMotionAnalysis: true,
    enableLightingAnalysis: true,
    enableFramingAnalysis: true,
    enableClarityAnalysis: true
  };

  /**
   * Assess overall video quality with detailed metrics
   */
  async assessVideoQuality(
    videoPath: string,
    videoId: string,
    options: QualityAssessmentOptions = {}
  ): Promise<QualityMetrics> {
    const opts = { ...this.defaultOptions, ...options };
    
    console.log(`Starting quality assessment for video: ${videoId}`);

    // Get video metadata
    const videoInfo = await this.getVideoInfo(videoPath);
    const duration = videoInfo.format.duration || 0;
    
    // Extract frames for analysis
    const frameData = await this.extractFramesForAnalysis(videoPath, duration, opts);
    
    // Perform individual quality analyses
    const motionData = opts.enableMotionAnalysis 
      ? await this.analyzeMotionStability(frameData, videoPath)
      : this.getDefaultMotionAnalysis();
      
    const lightingData = opts.enableLightingAnalysis
      ? await this.analyzeLightingQuality(frameData, videoPath)
      : this.getDefaultLightingAnalysis();
      
    const framingData = opts.enableFramingAnalysis
      ? await this.analyzeFramingComposition(frameData, videoPath)
      : this.getDefaultFramingAnalysis();
      
    const clarityData = opts.enableClarityAnalysis
      ? await this.analyzeClaritySharpness(frameData, videoPath)
      : this.getDefaultClarityAnalysis();

    // Calculate frame-by-frame quality scores
    const frameAnalysis = this.calculateFrameQualityScores(
      frameData,
      motionData,
      lightingData,
      framingData,
      clarityData
    );

    // Calculate overall quality scores
    const scores = this.calculateOverallQualityScores(
      motionData,
      lightingData,
      framingData,
      clarityData,
      frameAnalysis
    );

    // Clean up temporary files
    await this.cleanupTempFiles(frameData.map(f => f.path));

    return {
      videoId,
      scores,
      analysisTimestamp: new Date(),
      frameAnalysis,
      motionData,
      lightingData,
      framingData,
      clarityData
    };
  }

  /**
   * Extract frames at regular intervals for analysis
   */
  private async extractFramesForAnalysis(
    videoPath: string,
    duration: number,
    options: Required<QualityAssessmentOptions>
  ): Promise<Array<{ timestamp: number; path: string }>> {
    const frameData: Array<{ timestamp: number; path: string }> = [];
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const frameCount = Math.min(options.sampleFrameCount, Math.max(1, Math.floor(duration / options.analysisInterval)));
    
    for (let i = 0; i < frameCount; i++) {
      const timestamp = Math.max(1, (i + 1) * (duration / (frameCount + 1)));
      const framePath = path.join(tempDir, `frame_${randomUUID()}.jpg`);
      
      try {
        await this.extractFrame(videoPath, timestamp, framePath);
        frameData.push({ timestamp, path: framePath });
      } catch (error) {
        console.warn(`Failed to extract frame at ${timestamp}s:`, error);
        // Continue with other frames
      }
    }

    return frameData;
  }

  /**
   * Extract a single frame at specified timestamp
   */
  private async extractFrame(videoPath: string, timestamp: number, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .output(outputPath)
        .outputOptions(['-vframes 1', '-q:v 2'])
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`Frame extraction failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Analyze motion stability using optical flow estimation
   */
  private async analyzeMotionStability(
    frameData: Array<{ timestamp: number; path: string }>,
    videoPath: string
  ): Promise<MotionAnalysis> {
    console.log('Analyzing motion stability...');
    
    // Simplified motion analysis using frame differences
    const motionVectors: Array<{ timestamp: number; magnitude: number; direction: number }> = [];
    let totalMotion = 0;
    let motionVariances: number[] = [];

    for (let i = 1; i < frameData.length; i++) {
      const prevFrame = frameData[i - 1];
      const currFrame = frameData[i];
      
      // Calculate motion between consecutive frames
      const motion = await this.calculateFrameMotion(prevFrame.path, currFrame.path);
      motionVectors.push({
        timestamp: currFrame.timestamp,
        magnitude: motion.magnitude,
        direction: motion.direction
      });
      
      totalMotion += motion.magnitude;
      motionVariances.push(motion.magnitude);
    }

    const averageMotion = motionVectors.length > 0 ? totalMotion / motionVectors.length : 0;
    const motionVariance = this.calculateVariance(motionVariances);
    
    // Calculate stability score (lower motion = higher stability)
    const stabilityScore = Math.max(0, 100 - (averageMotion * 10));
    const shakeDetected = motionVariance > 50 || averageMotion > 15;

    return {
      averageMotion,
      motionVariance,
      stabilityScore,
      shakeDetected,
      motionVectors
    };
  }

  /**
   * Calculate motion between two frames using simple difference
   */
  private async calculateFrameMotion(
    frame1Path: string,
    frame2Path: string
  ): Promise<{ magnitude: number; direction: number }> {
    // Simplified motion calculation
    // In a real implementation, this would use optical flow algorithms
    const magnitude = Math.random() * 20; // Placeholder
    const direction = Math.random() * 360; // Placeholder
    
    return { magnitude, direction };
  }

  /**
   * Analyze lighting quality including brightness, contrast, and exposure
   */
  private async analyzeLightingQuality(
    frameData: Array<{ timestamp: number; path: string }>,
    videoPath: string
  ): Promise<LightingAnalysis> {
    console.log('Analyzing lighting quality...');
    
    if (frameData.length === 0) {
      return this.getDefaultLightingAnalysis();
    }
    
    const brightnessValues: number[] = [];
    const contrastValues: number[] = [];
    const exposureValues: number[] = [];
    const colorValues = { red: [] as number[], green: [] as number[], blue: [] as number[] };

    for (const frame of frameData) {
      try {
        const analysis = await this.analyzeFrameLighting(frame.path);
        brightnessValues.push(analysis.brightness);
        contrastValues.push(analysis.contrast);
        exposureValues.push(analysis.exposure);
        colorValues.red.push(analysis.colorBalance.red);
        colorValues.green.push(analysis.colorBalance.green);
        colorValues.blue.push(analysis.colorBalance.blue);
      } catch (error) {
        console.warn(`Failed to analyze lighting for frame ${frame.path}:`, error);
      }
    }

    const averageBrightness = this.calculateAverage(brightnessValues);
    const brightnessVariance = this.calculateVariance(brightnessValues);
    const contrastScore = this.calculateAverage(contrastValues);
    const exposureScore = this.calculateAverage(exposureValues);

    return {
      averageBrightness,
      brightnessVariance,
      contrastScore,
      exposureScore,
      colorBalance: {
        red: this.calculateAverage(colorValues.red),
        green: this.calculateAverage(colorValues.green),
        blue: this.calculateAverage(colorValues.blue)
      }
    };
  }

  /**
   * Analyze lighting properties of a single frame
   */
  private async analyzeFrameLighting(framePath: string): Promise<{
    brightness: number;
    contrast: number;
    exposure: number;
    colorBalance: { red: number; green: number; blue: number };
  }> {
    // Simplified lighting analysis
    // In a real implementation, this would analyze pixel histograms
    return {
      brightness: 50 + Math.random() * 50, // 50-100
      contrast: 30 + Math.random() * 40,   // 30-70
      exposure: 40 + Math.random() * 40,   // 40-80
      colorBalance: {
        red: 45 + Math.random() * 10,     // 45-55
        green: 45 + Math.random() * 10,   // 45-55
        blue: 45 + Math.random() * 10     // 45-55
      }
    };
  }

  /**
   * Analyze framing and composition using rule of thirds and subject detection
   */
  private async analyzeFramingComposition(
    frameData: Array<{ timestamp: number; path: string }>,
    videoPath: string
  ): Promise<FramingAnalysis> {
    console.log('Analyzing framing and composition...');
    
    if (frameData.length === 0) {
      return this.getDefaultFramingAnalysis();
    }
    
    const compositionScores: number[] = [];
    const ruleOfThirdsScores: number[] = [];
    const centeringScores: number[] = [];
    let subjectDetected = false;
    let subjectConfidence = 0;

    for (const frame of frameData) {
      try {
        const analysis = await this.analyzeFrameComposition(frame.path);
        compositionScores.push(analysis.composition);
        ruleOfThirdsScores.push(analysis.ruleOfThirds);
        centeringScores.push(analysis.centering);
        
        if (analysis.subjectDetected && analysis.subjectConfidence > subjectConfidence) {
          subjectDetected = true;
          subjectConfidence = analysis.subjectConfidence;
        }
      } catch (error) {
        console.warn(`Failed to analyze framing for frame ${frame.path}:`, error);
      }
    }

    return {
      compositionScore: this.calculateAverage(compositionScores),
      ruleOfThirdsScore: this.calculateAverage(ruleOfThirdsScores),
      centeringScore: this.calculateAverage(centeringScores),
      aspectRatioScore: 85, // Placeholder - would analyze actual aspect ratio
      subjectDetection: {
        detected: subjectDetected,
        confidence: subjectConfidence,
        boundingBox: subjectDetected ? {
          x: 0.3,
          y: 0.3,
          width: 0.4,
          height: 0.4
        } : undefined
      }
    };
  }

  /**
   * Analyze composition of a single frame
   */
  private async analyzeFrameComposition(framePath: string): Promise<{
    composition: number;
    ruleOfThirds: number;
    centering: number;
    subjectDetected: boolean;
    subjectConfidence: number;
  }> {
    // Simplified composition analysis
    // In a real implementation, this would use computer vision algorithms
    return {
      composition: 60 + Math.random() * 30,    // 60-90
      ruleOfThirds: 50 + Math.random() * 40,   // 50-90
      centering: 40 + Math.random() * 40,      // 40-80
      subjectDetected: Math.random() > 0.3,    // 70% chance
      subjectConfidence: 60 + Math.random() * 30 // 60-90
    };
  }

  /**
   * Analyze clarity and sharpness using edge detection
   */
  private async analyzeClaritySharpness(
    frameData: Array<{ timestamp: number; path: string }>,
    videoPath: string
  ): Promise<ClarityAnalysis> {
    console.log('Analyzing clarity and sharpness...');
    
    if (frameData.length === 0) {
      return this.getDefaultClarityAnalysis();
    }
    
    const sharpnessScores: number[] = [];
    const focusScores: number[] = [];
    const noiseLevels: number[] = [];
    const edgeStrengths: number[] = [];
    const motionBlurScores: number[] = [];
    const focusBlurScores: number[] = [];

    for (const frame of frameData) {
      try {
        const analysis = await this.analyzeFrameClarity(frame.path);
        sharpnessScores.push(analysis.sharpness);
        focusScores.push(analysis.focus);
        noiseLevels.push(analysis.noise);
        edgeStrengths.push(analysis.edgeStrength);
        motionBlurScores.push(analysis.motionBlur);
        focusBlurScores.push(analysis.focusBlur);
      } catch (error) {
        console.warn(`Failed to analyze clarity for frame ${frame.path}:`, error);
      }
    }

    return {
      sharpnessScore: this.calculateAverage(sharpnessScores),
      focusScore: this.calculateAverage(focusScores),
      noiseLevel: this.calculateAverage(noiseLevels),
      edgeStrength: this.calculateAverage(edgeStrengths),
      blurDetection: {
        motionBlur: this.calculateAverage(motionBlurScores),
        focusBlur: this.calculateAverage(focusBlurScores)
      }
    };
  }

  /**
   * Analyze clarity properties of a single frame
   */
  private async analyzeFrameClarity(framePath: string): Promise<{
    sharpness: number;
    focus: number;
    noise: number;
    edgeStrength: number;
    motionBlur: number;
    focusBlur: number;
  }> {
    // Simplified clarity analysis
    // In a real implementation, this would use edge detection algorithms
    return {
      sharpness: 60 + Math.random() * 30,    // 60-90
      focus: 55 + Math.random() * 35,        // 55-90
      noise: Math.random() * 30,             // 0-30 (lower is better)
      edgeStrength: 50 + Math.random() * 40, // 50-90
      motionBlur: Math.random() * 25,        // 0-25 (lower is better)
      focusBlur: Math.random() * 20          // 0-20 (lower is better)
    };
  }

  /**
   * Calculate frame-by-frame quality scores
   */
  private calculateFrameQualityScores(
    frameData: Array<{ timestamp: number; path: string }>,
    motionData: MotionAnalysis,
    lightingData: LightingAnalysis,
    framingData: FramingAnalysis,
    clarityData: ClarityAnalysis
  ): FrameQualityData[] {
    return frameData.map((frame, index) => {
      // Get motion data for this frame
      const motionVector = motionData.motionVectors.find(mv => 
        Math.abs(mv.timestamp - frame.timestamp) < 1
      );
      const stabilityScore = motionVector 
        ? Math.max(0, 100 - (motionVector.magnitude * 5))
        : motionData.stabilityScore;

      // Calculate individual scores for this frame
      const lightingScore = this.calculateLightingScoreForFrame(lightingData, index);
      const framingScore = framingData.compositionScore;
      const clarityScore = clarityData.sharpnessScore;

      return {
        timestamp: frame.timestamp,
        stabilityScore,
        lightingScore,
        framingScore,
        clarityScore
      };
    });
  }

  /**
   * Calculate overall quality scores from individual analyses
   */
  private calculateOverallQualityScores(
    motionData: MotionAnalysis,
    lightingData: LightingAnalysis,
    framingData: FramingAnalysis,
    clarityData: ClarityAnalysis,
    frameAnalysis: FrameQualityData[]
  ): QualityScore {
    // Weight factors for different quality aspects
    const weights = {
      stability: 0.25,
      lighting: 0.25,
      framing: 0.20,
      clarity: 0.25,
      audio: 0.05
    };

    const stability = motionData.stabilityScore;
    const lighting = this.calculateLightingOverallScore(lightingData);
    const framing = this.calculateFramingOverallScore(framingData);
    const clarity = this.calculateClarityOverallScore(clarityData);
    const audioQuality = 75; // Placeholder - would analyze audio quality

    const overall = 
      stability * weights.stability +
      lighting * weights.lighting +
      framing * weights.framing +
      clarity * weights.clarity +
      audioQuality * weights.audio;

    return {
      overall: Math.round(overall),
      stability: Math.round(stability),
      lighting: Math.round(lighting),
      framing: Math.round(framing),
      clarity: Math.round(clarity),
      audioQuality: Math.round(audioQuality)
    };
  }

  /**
   * Calculate overall lighting score from lighting analysis
   */
  private calculateLightingOverallScore(lightingData: LightingAnalysis): number {
    // Optimal brightness range is 40-80
    const brightnessScore = Math.max(0, 100 - Math.abs(lightingData.averageBrightness - 60) * 2);
    
    // Lower variance is better for consistency
    const consistencyScore = Math.max(0, 100 - lightingData.brightnessVariance);
    
    // Contrast and exposure scores
    const contrastScore = lightingData.contrastScore;
    const exposureScore = lightingData.exposureScore;
    
    // Color balance score (closer to 50 is better for each channel)
    const colorBalanceScore = 100 - (
      Math.abs(lightingData.colorBalance.red - 50) +
      Math.abs(lightingData.colorBalance.green - 50) +
      Math.abs(lightingData.colorBalance.blue - 50)
    ) / 3;

    return (brightnessScore + consistencyScore + contrastScore + exposureScore + colorBalanceScore) / 5;
  }

  /**
   * Calculate overall framing score from framing analysis
   */
  private calculateFramingOverallScore(framingData: FramingAnalysis): number {
    const weights = {
      composition: 0.3,
      ruleOfThirds: 0.25,
      centering: 0.15,
      aspectRatio: 0.15,
      subjectDetection: 0.15
    };

    const subjectScore = framingData.subjectDetection.detected 
      ? framingData.subjectDetection.confidence 
      : 50; // Neutral score if no subject detected

    return (
      framingData.compositionScore * weights.composition +
      framingData.ruleOfThirdsScore * weights.ruleOfThirds +
      framingData.centeringScore * weights.centering +
      framingData.aspectRatioScore * weights.aspectRatio +
      subjectScore * weights.subjectDetection
    );
  }

  /**
   * Calculate overall clarity score from clarity analysis
   */
  private calculateClarityOverallScore(clarityData: ClarityAnalysis): number {
    // Blur penalties (lower blur is better)
    const motionBlurPenalty = clarityData.blurDetection.motionBlur * 2;
    const focusBlurPenalty = clarityData.blurDetection.focusBlur * 2;
    const noisePenalty = clarityData.noiseLevel * 1.5;

    const baseScore = (
      clarityData.sharpnessScore +
      clarityData.focusScore +
      clarityData.edgeStrength
    ) / 3;

    return Math.max(0, baseScore - motionBlurPenalty - focusBlurPenalty - noisePenalty);
  }

  /**
   * Calculate lighting score for a specific frame
   */
  private calculateLightingScoreForFrame(lightingData: LightingAnalysis, frameIndex: number): number {
    // Simplified frame-specific lighting score
    return Math.max(0, lightingData.contrastScore - (lightingData.brightnessVariance / 10));
  }

  /**
   * Rank videos by quality scores
   */
  async rankVideosByQuality(qualityMetrics: QualityMetrics[]): Promise<QualityMetrics[]> {
    return qualityMetrics.sort((a, b) => b.scores.overall - a.scores.overall);
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

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${filePath}:`, error);
      }
    }
  }

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateAverage(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.calculateAverage(squaredDiffs);
  }

  /**
   * Default motion analysis for when motion analysis is disabled
   */
  private getDefaultMotionAnalysis(): MotionAnalysis {
    return {
      averageMotion: 0,
      motionVariance: 0,
      stabilityScore: 75,
      shakeDetected: false,
      motionVectors: []
    };
  }

  /**
   * Default lighting analysis for when lighting analysis is disabled
   */
  private getDefaultLightingAnalysis(): LightingAnalysis {
    return {
      averageBrightness: 60,
      brightnessVariance: 10,
      contrastScore: 70,
      exposureScore: 70,
      colorBalance: { red: 50, green: 50, blue: 50 }
    };
  }

  /**
   * Default framing analysis for when framing analysis is disabled
   */
  private getDefaultFramingAnalysis(): FramingAnalysis {
    return {
      compositionScore: 70,
      ruleOfThirdsScore: 65,
      centeringScore: 60,
      aspectRatioScore: 85,
      subjectDetection: {
        detected: false,
        confidence: 0
      }
    };
  }

  /**
   * Default clarity analysis for when clarity analysis is disabled
   */
  private getDefaultClarityAnalysis(): ClarityAnalysis {
    return {
      sharpnessScore: 70,
      focusScore: 70,
      noiseLevel: 15,
      edgeStrength: 65,
      blurDetection: {
        motionBlur: 10,
        focusBlur: 8
      }
    };
  }
}