import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';
import { ProjectOwnershipMiddleware } from '../middleware/projectOwnership';
import { SecurityMiddleware } from '../middleware/security';

const router = Router();
const projectController = new ProjectController();
const ownershipMiddleware = new ProjectOwnershipMiddleware();

// Project management routes

// Create new project
router.post('/', 
  SecurityMiddleware.validateInput(SecurityMiddleware.validateProjectCreation),
  projectController.createProject
);

// Get project by ID (requires ownership)
router.get('/:id', 
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('id')),
  ownershipMiddleware.validateProjectOwnership, 
  projectController.getProject
);

// Get project by share link (public access)
router.get('/share/:shareLink', 
  SecurityMiddleware.validateInput(SecurityMiddleware.validateShareLink),
  ownershipMiddleware.loadProject, 
  projectController.getProjectByShareLink
);

// Get projects by owner ID
router.get('/owner/:ownerId', 
  projectController.getProjectsByOwner
);

// Update project (requires ownership)
router.put('/:id', 
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('id')),
  ownershipMiddleware.validateProjectOwnership, 
  projectController.updateProject
);

// Alternative route for updating project with explicit ownership validation
router.patch('/:id', 
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('id')),
  ownershipMiddleware.validateProjectOwnership, 
  projectController.updateProject
);

// Generate access tokens for project
router.post('/:id/tokens',
  SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('id')),
  projectController.generateAccessToken
);

export default router;