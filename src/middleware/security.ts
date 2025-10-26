import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, param, query, validationResult } from 'express-validator';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ProjectRepository } from '../models/ProjectRepository';
import { getSecurityConfig } from '../config/security';

const securityConfig = getSecurityConfig();

// Extend Request interface to include security context
declare global {
  namespace Express {
    interface Request {
      accessToken?: string;
      tokenPayload?: any;
      rateLimitInfo?: {
        limit: number;
        remaining: number;
        reset: Date;
      };
    }
  }
}

export class SecurityMiddleware {
  private projectRepository = new ProjectRepository();

  /**
   * Helmet security headers middleware
   */
  static securityHeaders = helmet({
    contentSecurityPolicy: {
      directives: securityConfig.csp.directives,
    },
    crossOriginEmbedderPolicy: false, // Allow video streaming
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests for API
  });

  /**
   * Rate limiting for upload endpoints
   */
  static uploadRateLimit = rateLimit({
    windowMs: securityConfig.rateLimit.upload.windowMs,
    max: securityConfig.rateLimit.upload.max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many upload attempts. Please try again later.',
        timestamp: new Date(),
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many upload attempts. Please try again later.',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    },
    skip: (req: Request) => {
      // Log rate limit exceeded
      if (securityConfig.logging.logRateLimitExceeded) {
        console.warn(`Upload rate limit exceeded for IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
      }
      return false; // Don't skip, apply rate limiting
    }
  });

  /**
   * Rate limiting for API endpoints
   */
  static apiRateLimit = rateLimit({
    windowMs: securityConfig.rateLimit.api.windowMs,
    max: securityConfig.rateLimit.api.max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        timestamp: new Date(),
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    },
    skip: (req: Request) => {
      // Log rate limit exceeded
      if (securityConfig.logging.logRateLimitExceeded) {
        console.warn(`API rate limit exceeded for IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
      }
      return false; // Don't skip, apply rate limiting
    }
  });

  /**
   * Generate project access token
   */
  static generateAccessToken(projectId: string, ownerId: string, expiresIn: string = '7d'): string {
    const payload = {
      projectId,
      ownerId,
      type: 'project_access',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, securityConfig.jwt.secret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Generate share link access token
   */
  static generateShareLinkToken(projectId: string, shareLink: string, expiresIn: string = '30d'): string {
    const payload = {
      projectId,
      shareLink,
      type: 'share_link_access',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, securityConfig.jwt.secret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Validate project access token
   */
  validateAccessToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || 
                   req.query.token as string ||
                   req.headers['x-access-token'] as string;

      if (!token) {
        res.status(401).json({
          error: {
            code: 'MISSING_ACCESS_TOKEN',
            message: 'Access token is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      try {
        const decoded = jwt.verify(token, securityConfig.jwt.secret) as any;
        
        // Validate token type and required fields
        if (!decoded.type || !decoded.projectId) {
          res.status(401).json({
            error: {
              code: 'INVALID_ACCESS_TOKEN',
              message: 'Invalid access token format',
              timestamp: new Date(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        // Verify project exists
        const project = this.projectRepository.findById(decoded.projectId);
        if (!project) {
          res.status(404).json({
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project associated with token not found',
              timestamp: new Date(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        // Validate token type specific requirements
        if (decoded.type === 'project_access' && decoded.ownerId !== project.ownerId) {
          res.status(403).json({
            error: {
              code: 'INVALID_PROJECT_ACCESS',
              message: 'Token does not grant access to this project',
              timestamp: new Date(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        if (decoded.type === 'share_link_access' && decoded.shareLink !== project.shareLink) {
          res.status(403).json({
            error: {
              code: 'INVALID_SHARE_LINK_ACCESS',
              message: 'Token does not grant access via share link',
              timestamp: new Date(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        // Add token info to request
        req.accessToken = token;
        req.tokenPayload = decoded;
        req.project = project;
        req.isProjectOwner = decoded.type === 'project_access';

        next();
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          res.status(401).json({
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Access token has expired',
              timestamp: new Date(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        res.status(401).json({
          error: {
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Invalid access token',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }
    } catch (error) {
      console.error('Error validating access token:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate access token',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Input validation middleware
   */
  static validateInput = (validations: any[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: errors.array().map(err => ({
              field: err.type === 'field' ? (err as any).path : 'unknown',
              message: err.msg,
              value: err.type === 'field' ? (err as any).value : undefined
            })),
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Sanitize and validate project creation input
   */
  static validateProjectCreation = [
    body('title')
      .trim()
      .isLength({ min: 1, max: securityConfig.validation.maxTitleLength })
      .withMessage(`Title must be between 1 and ${securityConfig.validation.maxTitleLength} characters`)
      .escape(),
    body('description')
      .trim()
      .isLength({ min: 1, max: securityConfig.validation.maxDescriptionLength })
      .withMessage(`Description must be between 1 and ${securityConfig.validation.maxDescriptionLength} characters`)
      .escape(),
    body('eventDate')
      .isISO8601()
      .withMessage('Event date must be a valid ISO 8601 date')
      .toDate(),
    body('ownerId')
      .trim()
      .isLength({ min: 1, max: securityConfig.validation.maxOwnerIdLength })
      .withMessage(`Owner ID must be between 1 and ${securityConfig.validation.maxOwnerIdLength} characters`)
      .matches(securityConfig.validation.allowedOwnerIdChars)
      .withMessage('Owner ID can only contain alphanumeric characters, underscores, and hyphens')
      .escape()
  ];

  /**
   * Sanitize and validate video upload input
   */
  static validateVideoUpload = [
    param('projectId')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('uploaderName')
      .trim()
      .isLength({ min: 1, max: securityConfig.validation.maxUploaderNameLength })
      .withMessage(`Uploader name must be between 1 and ${securityConfig.validation.maxUploaderNameLength} characters`)
      .matches(securityConfig.validation.allowedNameChars)
      .withMessage('Uploader name can only contain alphanumeric characters, spaces, underscores, and hyphens')
      .escape()
  ];

  /**
   * Validate UUID parameters
   */
  static validateUUIDParam = (paramName: string) => [
    param(paramName)
      .isUUID()
      .withMessage(`${paramName} must be a valid UUID`)
  ];

  /**
   * Validate share link parameters
   */
  static validateShareLink = [
    param('shareLink')
      .isLength({ min: securityConfig.validation.shareLinkLength, max: securityConfig.validation.shareLinkLength })
      .withMessage(`Share link must be exactly ${securityConfig.validation.shareLinkLength} characters`)
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage('Share link can only contain alphanumeric characters')
  ];

  /**
   * File upload security validation
   */
  static validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No file was uploaded',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const file = req.file;

    // Validate file size
    if (file.size > securityConfig.upload.maxFileSize) {
      res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 500MB limit',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Validate file type
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (!securityConfig.upload.allowedMimeTypes.includes(file.mimetype as any) && 
        !securityConfig.upload.allowedExtensions.includes(fileExtension as any)) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only video files are allowed. Supported formats: MP4, MOV, AVI, WebM, WMV',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Sanitize filename
    const sanitizedFilename = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, securityConfig.fileValidation.maxFilenameLength);
    
    file.originalname = sanitizedFilename;

    next();
  };

  /**
   * Request ID middleware for tracking
   */
  static addRequestId = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
    next();
  };

  /**
   * CORS configuration for secure file serving
   */
  static secureFileHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Set security headers for file serving
    res.setHeader('X-Content-Type-Options', securityConfig.headers.xContentTypeOptions);
    res.setHeader('X-Frame-Options', securityConfig.headers.xFrameOptions);
    res.setHeader('X-XSS-Protection', securityConfig.headers.xXSSProtection);
    res.setHeader('Referrer-Policy', securityConfig.headers.referrerPolicy);
    
    // Cache control for video files
    if (req.path.includes('/videos/') || req.path.includes('/uploads/')) {
      res.setHeader('Cache-Control', securityConfig.headers.cacheControl);
    }

    next();
  };

  /**
   * Hash sensitive data (for future use with user passwords)
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, securityConfig.bcrypt.saltRounds);
  }

  /**
   * Verify hashed password
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}