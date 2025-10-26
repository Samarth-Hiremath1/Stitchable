import { Router } from 'express';
import { WorkflowController } from '../controllers/WorkflowController';
import { SocketService } from '../services/SocketService';
import { SecurityMiddleware } from '../middleware/security';
import { ProjectOwnershipMiddleware } from '../middleware/projectOwnership';

export const createWorkflowRoutes = (socketService: SocketService) => {
  const router = Router();
  const workflowController = new WorkflowController(socketService);
  const ownershipMiddleware = new ProjectOwnershipMiddleware();

  // Workflow execution routes
  router.post(
    '/projects/:projectId/workflow/execute',
    SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('projectId')),
    ownershipMiddleware.validateProjectOwnership,
    workflowController.executeWorkflow
  );

  router.get(
    '/projects/:projectId/workflow/status',
    SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('projectId')),
    ownershipMiddleware.validateProjectOwnership,
    workflowController.getWorkflowStatus
  );

  router.post(
    '/projects/:projectId/workflow/retry',
    SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('projectId')),
    ownershipMiddleware.validateProjectOwnership,
    workflowController.retryWorkflow
  );

  router.delete(
    '/projects/:projectId/workflow/cancel',
    SecurityMiddleware.validateInput(SecurityMiddleware.validateUUIDParam('projectId')),
    ownershipMiddleware.validateProjectOwnership,
    workflowController.cancelWorkflow
  );

  // System monitoring routes
  router.get('/system/health', workflowController.getSystemHealth);
  router.get('/system/analytics', workflowController.getAnalytics);
  router.get('/system/disk-usage', workflowController.getDiskUsage);

  // System maintenance routes
  router.post('/system/cleanup', workflowController.performCleanup);

  // Error management routes
  router.get('/system/errors', workflowController.getErrorReports);
  router.get('/system/errors/stats', workflowController.getErrorStats);
  router.patch('/system/errors/:errorId/resolve', workflowController.resolveError);

  return router;
};