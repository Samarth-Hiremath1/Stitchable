import { Request, Response } from 'express';
import { WorkflowOrchestrator } from '../services/WorkflowOrchestrator';
import { CleanupService } from '../services/CleanupService';
import { HealthMonitorService } from '../services/HealthMonitorService';
import { ErrorHandlingService } from '../services/ErrorHandlingService';
import { SocketService } from '../services/SocketService';

export class WorkflowController {
  private orchestrator: WorkflowOrchestrator;
  private cleanupService: CleanupService;
  private healthService: HealthMonitorService;
  private errorService: ErrorHandlingService;

  constructor(socketService: SocketService) {
    this.orchestrator = new WorkflowOrchestrator(socketService);
    this.cleanupService = new CleanupService();
    this.healthService = new HealthMonitorService();
    this.errorService = new ErrorHandlingService(socketService);
  }

  /**
   * Execute complete workflow for a project
   */
  executeWorkflow = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Check system readiness
      const systemReady = await this.healthService.isSystemReady();
      if (!systemReady.ready) {
        res.status(503).json({
          error: {
            code: 'SYSTEM_NOT_READY',
            message: systemReady.reason,
            timestamp: new Date(),
            requestId
          }
        });
        return;
      }

      // Start workflow execution
      const result = await this.orchestrator.executeCompleteWorkflow(projectId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Workflow completed successfully',
          data: {
            finalVideoPath: result.finalVideoPath,
            processingTime: result.processingTime,
            stages: result.stages
          },
          timestamp: new Date(),
          requestId
        });
      } else {
        res.status(500).json({
          error: {
            code: 'WORKFLOW_FAILED',
            message: result.error || 'Workflow execution failed',
            timestamp: new Date(),
            requestId
          }
        });
      }

    } catch (error) {
      this.errorService.handleError(error as Error, {
        projectId,
        operation: 'execute-workflow',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'WORKFLOW_ERROR',
          message: 'Failed to execute workflow',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Get workflow status
   */
  getWorkflowStatus = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    try {
      const status = await this.orchestrator.getWorkflowStatus(projectId);
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      this.errorService.handleError(error as Error, {
        projectId,
        operation: 'get-workflow-status',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to get workflow status',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Retry failed workflow
   */
  retryWorkflow = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    try {
      const result = await this.orchestrator.retryWorkflow(projectId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Workflow retry started successfully',
          data: {
            processingTime: result.processingTime,
            stages: result.stages
          },
          timestamp: new Date(),
          requestId
        });
      } else {
        res.status(500).json({
          error: {
            code: 'RETRY_FAILED',
            message: result.error || 'Workflow retry failed',
            timestamp: new Date(),
            requestId
          }
        });
      }

    } catch (error) {
      this.errorService.handleError(error as Error, {
        projectId,
        operation: 'retry-workflow',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'RETRY_ERROR',
          message: 'Failed to retry workflow',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Cancel ongoing workflow
   */
  cancelWorkflow = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    try {
      await this.orchestrator.cancelWorkflow(projectId);

      res.json({
        success: true,
        message: 'Workflow cancelled successfully',
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      this.errorService.handleError(error as Error, {
        projectId,
        operation: 'cancel-workflow',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'CANCEL_ERROR',
          message: 'Failed to cancel workflow',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Get system health status
   */
  getSystemHealth = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const health = await this.healthService.getSystemHealth();
      
      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      this.errorService.handleError(error as Error, {
        operation: 'get-system-health',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'HEALTH_ERROR',
          message: 'Failed to get system health',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Get system analytics
   */
  getAnalytics = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const analytics = await this.healthService.getAnalytics();
      
      res.json({
        success: true,
        data: analytics,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      this.errorService.handleError(error as Error, {
        operation: 'get-analytics',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to get analytics',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Perform system cleanup
   */
  performCleanup = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string;
    const { dryRun = false, tempFileMaxAge = 24, projectMaxAge = 30 } = req.body;

    try {
      const stats = await this.cleanupService.performCleanup({
        dryRun,
        tempFileMaxAge,
        projectMaxAge
      });

      res.json({
        success: true,
        message: dryRun ? 'Cleanup simulation completed' : 'Cleanup completed successfully',
        data: stats,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      this.errorService.handleError(error as Error, {
        operation: 'perform-cleanup',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'CLEANUP_ERROR',
          message: 'Failed to perform cleanup',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Get disk usage statistics
   */
  getDiskUsage = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const usage = await this.cleanupService.getDiskUsageStats();
      
      res.json({
        success: true,
        data: usage,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      this.errorService.handleError(error as Error, {
        operation: 'get-disk-usage',
        requestId,
        timestamp: new Date()
      });

      res.status(500).json({
        error: {
          code: 'DISK_USAGE_ERROR',
          message: 'Failed to get disk usage',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Get error reports
   */
  getErrorReports = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string;
    const { level, projectId, operation, resolved, limit } = req.query;

    try {
      const reports = this.errorService.getErrorReports({
        level: level as string,
        projectId: projectId as string,
        operation: operation as string,
        resolved: resolved === 'true',
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        success: true,
        data: reports,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      res.status(500).json({
        error: {
          code: 'ERROR_REPORTS_ERROR',
          message: 'Failed to get error reports',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Get error statistics
   */
  getErrorStats = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const stats = this.errorService.getErrorStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
        requestId
      });

    } catch (error) {
      res.status(500).json({
        error: {
          code: 'ERROR_STATS_ERROR',
          message: 'Failed to get error statistics',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };

  /**
   * Resolve error report
   */
  resolveError = async (req: Request, res: Response): Promise<void> => {
    const { errorId } = req.params;
    const { resolvedBy } = req.body;
    const requestId = req.headers['x-request-id'] as string;

    try {
      const resolved = this.errorService.resolveError(errorId, resolvedBy);
      
      if (resolved) {
        res.json({
          success: true,
          message: 'Error resolved successfully',
          timestamp: new Date(),
          requestId
        });
      } else {
        res.status(404).json({
          error: {
            code: 'ERROR_NOT_FOUND',
            message: 'Error report not found',
            timestamp: new Date(),
            requestId
          }
        });
      }

    } catch (error) {
      res.status(500).json({
        error: {
          code: 'RESOLVE_ERROR',
          message: 'Failed to resolve error',
          timestamp: new Date(),
          requestId
        }
      });
    }
  };
}