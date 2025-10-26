import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

/**
 * Global error handling middleware
 */
export class ErrorHandler {
  /**
   * Global error handler middleware
   */
  static handle = (error: any, req: Request, res: Response, next: NextFunction): void => {
    // Log error for debugging
    console.error('Error occurred:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Handle specific error types
    if (error instanceof MulterError) {
      ErrorHandler.handleMulterError(error, req, res);
      return;
    }

    if (error.name === 'ValidationError') {
      ErrorHandler.handleValidationError(error, req, res);
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      ErrorHandler.handleJWTError(error, req, res);
      return;
    }

    if (error.name === 'TokenExpiredError') {
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

    if (error.code === 'ENOENT') {
      res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Requested file not found',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (error.code === 'EACCES') {
      res.status(403).json({
        error: {
          code: 'FILE_ACCESS_DENIED',
          message: 'Access denied to requested file',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Handle security-related errors
    if (error.message.includes('directory traversal') || 
        error.message.includes('path traversal') ||
        error.message.includes('Invalid destination path')) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILE_PATH',
          message: 'Invalid file path provided',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (error.message.includes('Invalid video file signature')) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILE_SIGNATURE',
          message: 'File does not appear to be a valid video file',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Default error response
    const statusCode = error.statusCode || error.status || 500;
    const message = statusCode === 500 ? 'Internal server error' : error.message;

    res.status(statusCode).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  };

  /**
   * Handle Multer-specific errors
   */
  private static handleMulterError(error: MulterError, req: Request, res: Response): void {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds the maximum allowed limit',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        break;

      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: {
            code: 'TOO_MANY_FILES',
            message: 'Too many files uploaded',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        break;

      case 'LIMIT_FIELD_KEY':
        res.status(400).json({
          error: {
            code: 'FIELD_NAME_TOO_LONG',
            message: 'Field name is too long',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        break;

      case 'LIMIT_FIELD_VALUE':
        res.status(400).json({
          error: {
            code: 'FIELD_VALUE_TOO_LONG',
            message: 'Field value is too long',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        break;

      case 'LIMIT_FIELD_COUNT':
        res.status(400).json({
          error: {
            code: 'TOO_MANY_FIELDS',
            message: 'Too many fields in the request',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        break;

      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: {
            code: 'UNEXPECTED_FILE',
            message: 'Unexpected file field in the request',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        break;

      default:
        res.status(400).json({
          error: {
            code: 'UPLOAD_ERROR',
            message: error.message || 'File upload error',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
    }
  }

  /**
   * Handle validation errors
   */
  private static handleValidationError(error: any, req: Request, res: Response): void {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: error.details || error.message,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }

  /**
   * Handle JWT errors
   */
  private static handleJWTError(error: any, req: Request, res: Response): void {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or malformed access token',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }

  /**
   * Handle 404 errors for undefined routes
   */
  static notFound = (req: Request, res: Response): void => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  };

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
}