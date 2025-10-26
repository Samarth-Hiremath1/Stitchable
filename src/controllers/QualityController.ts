import { Request, Response } from 'express';
import { VideoProcessingService } from '../services/VideoProcessingService';
import { VideoQualityService } from '../services/VideoQualityService';
import { VideoRepository } from '../models/VideoRepository';
import { ProjectRepository } from '../models/ProjectRepository';
import path from 'path';

export class QualityController {
  private videoProcessingService = new VideoProcessingService();
  private qualityService = new VideoQualityService();
  private videoRepository = new VideoRepository();
  private projectRepository = new ProjectRepository();

  /**
   * Start quality analysis for all videos in a project
   */
  startProjectQualityAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      // Verify project exists
      const project = this.projectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Start quality analysis job
      const job = await this.videoProcessingService.startQualityAnalysis(projectId);

      res.json({
        message: 'Quality analysis started',
        jobId: job.id,
        projectId,
        status: job.status
      });
    } catch (error) {
      console.error('Failed to start quality analysis:', error);
      res.status(500).json({ 
        error: 'Failed to start quality analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get quality analysis results for a project
   */
  getProjectQualityRankings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      // Verify project exists
      const project = this.projectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Get quality rankings
      const rankings = await this.videoProcessingService.getProjectQualityRankings(projectId);

      res.json({
        projectId,
        totalVideos: rankings.length,
        rankings: rankings.map(ranking => ({
          videoId: ranking.video.id,
          filename: ranking.video.filename,
          uploaderName: ranking.video.uploaderName,
          qualityScore: ranking.qualityScore,
          rank: ranking.rank,
          uploadedAt: ranking.video.uploadedAt
        }))
      });
    } catch (error) {
      console.error('Failed to get quality rankings:', error);
      res.status(500).json({ 
        error: 'Failed to get quality rankings',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get detailed quality metrics for a specific video
   */
  getVideoQualityMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;

      // Verify video exists
      const video = this.videoRepository.findById(videoId);
      if (!video) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }

      // Get detailed quality metrics
      const metrics = await this.videoProcessingService.getVideoQualityMetrics(videoId);

      if (!metrics) {
        res.status(500).json({ error: 'Failed to analyze video quality' });
        return;
      }

      res.json({
        videoId,
        filename: video.filename,
        uploaderName: video.uploaderName,
        qualityMetrics: {
          scores: metrics.scores,
          analysisTimestamp: metrics.analysisTimestamp,
          frameAnalysis: {
            totalFrames: metrics.frameAnalysis.length,
            averageStability: this.calculateAverage(metrics.frameAnalysis.map(f => f.stabilityScore)),
            averageLighting: this.calculateAverage(metrics.frameAnalysis.map(f => f.lightingScore)),
            averageFraming: this.calculateAverage(metrics.frameAnalysis.map(f => f.framingScore)),
            averageClarity: this.calculateAverage(metrics.frameAnalysis.map(f => f.clarityScore))
          },
          motionAnalysis: {
            averageMotion: metrics.motionData.averageMotion,
            stabilityScore: metrics.motionData.stabilityScore,
            shakeDetected: metrics.motionData.shakeDetected,
            motionVectorCount: metrics.motionData.motionVectors.length
          },
          lightingAnalysis: {
            averageBrightness: metrics.lightingData.averageBrightness,
            contrastScore: metrics.lightingData.contrastScore,
            exposureScore: metrics.lightingData.exposureScore,
            colorBalance: metrics.lightingData.colorBalance
          },
          framingAnalysis: {
            compositionScore: metrics.framingData.compositionScore,
            ruleOfThirdsScore: metrics.framingData.ruleOfThirdsScore,
            subjectDetected: metrics.framingData.subjectDetection.detected,
            subjectConfidence: metrics.framingData.subjectDetection.confidence
          },
          clarityAnalysis: {
            sharpnessScore: metrics.clarityData.sharpnessScore,
            focusScore: metrics.clarityData.focusScore,
            noiseLevel: metrics.clarityData.noiseLevel,
            blurDetection: metrics.clarityData.blurDetection
          }
        }
      });
    } catch (error) {
      console.error('Failed to get video quality metrics:', error);
      res.status(500).json({ 
        error: 'Failed to get video quality metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Analyze quality for a single video
   */
  analyzeVideoQuality = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;
      const options = req.body || {};

      // Verify video exists
      const video = this.videoRepository.findById(videoId);
      if (!video) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }

      const videoPath = path.join(process.cwd(), video.filePath);

      // Perform quality analysis
      const metrics = await this.qualityService.assessVideoQuality(
        videoPath,
        videoId,
        {
          sampleFrameCount: options.sampleFrameCount || 20,
          analysisInterval: options.analysisInterval || 3,
          enableMotionAnalysis: options.enableMotionAnalysis !== false,
          enableLightingAnalysis: options.enableLightingAnalysis !== false,
          enableFramingAnalysis: options.enableFramingAnalysis !== false,
          enableClarityAnalysis: options.enableClarityAnalysis !== false
        }
      );

      // Update video with quality score
      this.videoRepository.update(videoId, { 
        qualityScore: metrics.scores.overall 
      });

      res.json({
        message: 'Quality analysis completed',
        videoId,
        filename: video.filename,
        qualityScore: metrics.scores.overall,
        detailedScores: metrics.scores,
        analysisTimestamp: metrics.analysisTimestamp
      });
    } catch (error) {
      console.error('Failed to analyze video quality:', error);
      res.status(500).json({ 
        error: 'Failed to analyze video quality',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get quality comparison between videos in a project
   */
  getQualityComparison = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      // Verify project exists
      const project = this.projectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const rankings = await this.videoProcessingService.getProjectQualityRankings(projectId);

      if (rankings.length === 0) {
        res.json({
          projectId,
          message: 'No videos with quality scores found',
          comparison: []
        });
        return;
      }

      // Calculate statistics
      const scores = rankings.map(r => r.qualityScore);
      const avgScore = this.calculateAverage(scores);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);

      res.json({
        projectId,
        statistics: {
          totalVideos: rankings.length,
          averageScore: Math.round(avgScore),
          highestScore: maxScore,
          lowestScore: minScore,
          scoreRange: maxScore - minScore
        },
        comparison: rankings.map(ranking => ({
          videoId: ranking.video.id,
          filename: ranking.video.filename,
          uploaderName: ranking.video.uploaderName,
          rank: ranking.rank,
          qualityScore: ranking.qualityScore,
          scoreCategory: this.getScoreCategory(ranking.qualityScore),
          relativeToBest: Math.round(((ranking.qualityScore / maxScore) * 100)),
          relativeToAverage: Math.round(((ranking.qualityScore / avgScore) * 100))
        }))
      });
    } catch (error) {
      console.error('Failed to get quality comparison:', error);
      res.status(500).json({ 
        error: 'Failed to get quality comparison',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get quality score category
   */
  private getScoreCategory(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 50) return 'Poor';
    return 'Very Poor';
  }
}