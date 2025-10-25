import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';
import { ProjectOwnershipMiddleware } from '../middleware/projectOwnership';

const router = Router();
const projectController = new ProjectController();
const ownershipMiddleware = new ProjectOwnershipMiddleware();

// Project management routes

// Create new project
router.post('/', projectController.createProject);

// Get project by ID (requires ownership)
router.get('/:id', ownershipMiddleware.validateProjectOwnership, projectController.getProject);

// Get project by share link (public access)
router.get('/share/:shareLink', ownershipMiddleware.loadProject, projectController.getProjectByShareLink);

// Get projects by owner ID
router.get('/owner/:ownerId', projectController.getProjectsByOwner);

// Update project (requires ownership)
router.put('/:id', ownershipMiddleware.validateProjectOwnership, projectController.updateProject);

// Alternative route for updating project with explicit ownership validation
router.patch('/:id', ownershipMiddleware.validateProjectOwnership, projectController.updateProject);

export default router;