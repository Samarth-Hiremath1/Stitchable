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

export default router;