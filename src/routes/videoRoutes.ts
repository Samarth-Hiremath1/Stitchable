import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { VideoController } from '../controllers/VideoController';
import { ProjectOwnershipMiddleware } from '../middleware/projectOwnership';
import { SecurityMiddleware } from '../middleware/security';

const router = Router();
const videoController = new VideoController();
const ownershipMiddleware = new ProjectOwnershipMiddleware();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate temporary filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${extension}`);
  }
});

// File filter for video uploads
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow video files
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    // Check file extension as fallback
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.webm', '.wmv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
};

// Configure upload middleware with enhanced security
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 1, // Only one file at a time
    fieldSize: 1024 * 1024, // 1MB field size limit
    fieldNameSize: 100, // 100 bytes field name limit
    fields: 10 // Maximum 10 fields
  }
});

// Video upload routes

// Upload video to project (public access via share link) - with rate limiting
router.post(
  '/projects/:projectId/upload',
  SecurityMiddleware.uploadRateLimit, // Apply upload rate limiting
  SecurityMiddleware.validateInput(SecurityMiddleware.validateVideoUpload),
  ownershipMiddleware.loadProject, // Load project to verify it exists
  upload.single('video'),
  SecurityMiddleware.validateFileUpload,
  videoController.uploadVideo
);

// Get video by ID (requires project ownership or share link access)
router.get(
  '/videos/:videoId',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('videoId')),
  videoController.getVideo
);

// Get all videos for a project (requires ownership)
router.get(
  '/projects/:projectId/videos',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('projectId')),
  ownershipMiddleware.validateProjectOwnership,
  videoController.getProjectVideos
);

// Get all videos for a project via share link (public access)
router.get(
  '/projects/share/:shareLink/videos',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateShareLink),
  ownershipMiddleware.loadProjectByShareLink,
  videoController.getProjectVideos
);

// Stream video with range request support
router.get(
  '/videos/:videoId/stream',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('videoId')),
  SecurityMiddleware.secureFileHeaders,
  videoController.streamVideo
);

// Download final video
router.get(
  '/projects/:projectId/final-video/download',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('projectId')),
  ownershipMiddleware.validateProjectOwnership,
  SecurityMiddleware.secureFileHeaders,
  videoController.downloadFinalVideo
);

// Delete video (requires project ownership)
router.delete(
  '/videos/:videoId',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('videoId')),
  // Note: We'll need to add middleware to check if user owns the project that contains this video
  videoController.deleteVideo
);

// Error handling middleware for multer errors
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 500MB limit',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Only one file can be uploaded at a time',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }

  if (error.message === 'Only video files are allowed') {
    return res.status(400).json({
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Only video files are allowed. Supported formats: MP4, MOV, AVI, WebM, WMV',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }

  next(error);
});

export default router;