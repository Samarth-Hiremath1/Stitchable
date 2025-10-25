import { Request, Response, NextFunction } from 'express';
import { ProjectRepository } from '../models/ProjectRepository';

// Extend Request interface to include project data
declare global {
  namespace Express {
    interface Request {
      project?: any;
      isProjectOwner?: boolean;
    }
  }
}

export class ProjectOwnershipMiddleware {
  private projectRepository = new ProjectRepository();

  // Middleware to validate project ownership
  validateProjectOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.id || req.params.projectId;
      const ownerId = req.headers['x-owner-id'] as string || req.body.ownerId;

      if (!projectId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (!ownerId) {
        res.status(400).json({
          error: {
            code: 'MISSING_OWNER_ID',
            message: 'Owner ID is required in headers (x-owner-id) or request body',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const project = this.projectRepository.findById(projectId);

      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (project.ownerId !== ownerId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this project',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Add project and ownership info to request for use in controllers
      req.project = project;
      req.isProjectOwner = true;

      next();
    } catch (error) {
      console.error('Error validating project ownership:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate project ownership',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  // Middleware to load project data without ownership validation (for public access via share link)
  loadProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.id || req.params.projectId;
      const shareLink = req.params.shareLink;

      let project = null;

      if (projectId) {
        project = this.projectRepository.findById(projectId);
      } else if (shareLink) {
        project = this.projectRepository.findByShareLink(shareLink);
      }

      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Add project to request for use in controllers
      req.project = project;

      // Check if user is owner (optional for public access)
      const ownerId = req.headers['x-owner-id'] as string;
      req.isProjectOwner = ownerId === project.ownerId;

      next();
    } catch (error) {
      console.error('Error loading project:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load project',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  // Middleware to validate project access (either owner or valid share link)
  validateProjectAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.id || req.params.projectId;
      const shareLink = req.params.shareLink;
      const ownerId = req.headers['x-owner-id'] as string;

      if (!projectId && !shareLink) {
        res.status(400).json({
          error: {
            code: 'MISSING_PROJECT_IDENTIFIER',
            message: 'Project ID or share link is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      let project = null;

      if (projectId) {
        project = this.projectRepository.findById(projectId);
      } else if (shareLink) {
        project = this.projectRepository.findByShareLink(shareLink);
      }

      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Add project to request
      req.project = project;

      // Determine access level
      const isOwner = ownerId === project.ownerId;
      const hasShareLinkAccess = shareLink === project.shareLink;

      if (!isOwner && !hasShareLinkAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this project',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      req.isProjectOwner = isOwner;

      next();
    } catch (error) {
      console.error('Error validating project access:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate project access',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };
}