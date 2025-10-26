import { Router } from 'express';
import { QualityController } from '../controllers/QualityController';

const router = Router();
const qualityController = new QualityController();

// Start quality analysis for all videos in a project
router.post('/projects/:projectId/quality/analyze', qualityController.startProjectQualityAnalysis);

// Get quality rankings for a project
router.get('/projects/:projectId/quality/rankings', qualityController.getProjectQualityRankings);

// Get quality comparison for a project
router.get('/projects/:projectId/quality/comparison', qualityController.getQualityComparison);

// Get detailed quality metrics for a specific video
router.get('/videos/:videoId/quality/metrics', qualityController.getVideoQualityMetrics);

// Analyze quality for a single video
router.post('/videos/:videoId/quality/analyze', qualityController.analyzeVideoQuality);

export default router;