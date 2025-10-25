import { Request, Response } from 'express';
import { ProjectRepository } from '../models/ProjectRepository';
import { randomUUID } from 'crypto';

export class ProjectController {
  private projectRepository = new ProjectRepository();

  // Generate unique share link
  private generateShareLink(): string {
    return randomUUID().replace(/-/g, '').substring(0, 16);
  }

  // Validate project creation data
  private validateProjectData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('Title is required and must be a non-empty string');
    }

    if (data.title && data.title.length > 200) {
      errors.push('Title must be less than 200 characters');
    }

    if (!data.description || typeof data.description !== 'string') {
      errors.push('Description is required and must be a string');
    }

    if (data.description && data.description.length > 1000) {
      errors.push('Description must be less than 1000 characters');
    }

    if (!data.eventDate) {
      errors.push('Event date is required');
    } else {
      const eventDate = new Date(data.eventDate);
      if (isNaN(eventDate.getTime())) {
        errors.push('Event date must be a valid date');
      }
    }

    if (!data.ownerId || typeof data.ownerId !== 'string' || data.ownerId.trim().length === 0) {
      errors.push('Owner ID is required and must be a non-empty string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Create new project
  createProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = this.validateProjectData(req.body);
      
      if (!validation.isValid) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project data',
            details: validation.errors,
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const { title, description, eventDate, ownerId } = req.body;
      
      const projectData = {
        title: title.trim(),
        description: description.trim(),
        eventDate: new Date(eventDate),
        shareLink: this.generateShareLink(),
        ownerId: ownerId.trim(),
        status: 'active' as const
      };

      const project = this.projectRepository.create(projectData);

      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create project',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  // Get project by ID
  getProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_PROJECT_ID',
            message: 'Project ID is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const project = this.projectRepository.findById(id);

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

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error retrieving project:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve project',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  // Get project by share link
  getProjectByShareLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareLink } = req.params;

      if (!shareLink || typeof shareLink !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_SHARE_LINK',
            message: 'Share link is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const project = this.projectRepository.findByShareLink(shareLink);

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

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error retrieving project by share link:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve project',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  // Get projects by owner ID
  getProjectsByOwner = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ownerId } = req.params;

      if (!ownerId || typeof ownerId !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_OWNER_ID',
            message: 'Owner ID is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const projects = this.projectRepository.findByOwnerId(ownerId);

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('Error retrieving projects by owner:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve projects',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  // Update project
  updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_PROJECT_ID',
            message: 'Project ID is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate update data (only validate provided fields)
      const errors: string[] = [];

      if (updates.title !== undefined) {
        if (typeof updates.title !== 'string' || updates.title.trim().length === 0) {
          errors.push('Title must be a non-empty string');
        } else if (updates.title.length > 200) {
          errors.push('Title must be less than 200 characters');
        }
      }

      if (updates.description !== undefined) {
        if (typeof updates.description !== 'string') {
          errors.push('Description must be a string');
        } else if (updates.description.length > 1000) {
          errors.push('Description must be less than 1000 characters');
        }
      }

      if (updates.eventDate !== undefined) {
        const eventDate = new Date(updates.eventDate);
        if (isNaN(eventDate.getTime())) {
          errors.push('Event date must be a valid date');
        }
      }

      if (updates.status !== undefined) {
        if (!['active', 'processing', 'completed'].includes(updates.status)) {
          errors.push('Status must be one of: active, processing, completed');
        }
      }

      if (errors.length > 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data',
            details: errors,
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Prepare update data
      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.eventDate !== undefined) updateData.eventDate = new Date(updates.eventDate);
      if (updates.status !== undefined) updateData.status = updates.status;

      const updatedProject = this.projectRepository.update(id, updateData);

      if (!updatedProject) {
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

      res.json({
        success: true,
        data: updatedProject
      });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update project',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };
}