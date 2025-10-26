import { Router } from 'express';
import { ProcessingController } from '../controllers/ProcessingController';

const router = Router();
const processingController = new ProcessingController();

// Start processing for a project
router.post('/projects/:projectId/process', processingController.startProcessing);

// Get processing status for a project
router.get('/projects/:projectId/processing-status', processingController.getProcessingStatus);

// Get specific job status
router.get('/jobs/:jobId', processingController.getJobStatus);

// Cancel a processing job
router.delete('/jobs/:jobId', processingController.cancelJob);

// Retry a failed job
router.post('/jobs/:jobId/retry', processingController.retryJob);

// Generate thumbnails for a video
router.post('/videos/:videoId/thumbnails', processingController.generateThumbnails);

// Get queue statistics
router.get('/queue/stats', processingController.getQueueStats);

// Get synchronization results for a project
router.get('/projects/:projectId/sync-results', processingController.getSyncResults);

// Validate synchronization for a project
router.get('/projects/:projectId/validate-sync', processingController.validateSync);

// Start intelligent video stitching for a project
router.post('/projects/:projectId/stitch', processingController.startStitching);

// Get quality rankings for a project
router.get('/projects/:projectId/quality-rankings', processingController.getQualityRankings);

// Check if project is ready for stitching
router.get('/projects/:projectId/stitching-readiness', processingController.checkStitchingReadiness);

export default router;