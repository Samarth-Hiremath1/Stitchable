import { SocketService } from './SocketService';

export interface ErrorContext {
  projectId?: string;
  videoId?: string;
  jobId?: string;
  userId?: string;
  operation: string;
  timestamp: Date;
  requestId?: string;
}

export interface ErrorReport {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  context: ErrorContext;
  stack?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class ErrorHandlingService {
  private errorReports: Map<string, ErrorReport> = new Map();
  private socketService?: SocketService;
  private maxReports = 1000;

  constructor(socketService?: SocketService) {
    this.socketService = socketService;
  }

  /**
   * Handle and log errors with context
   */
  handleError(error: Error | string, context: ErrorContext, level: 'info' | 'warning' | 'error' | 'critical' = 'error'): string {
    const errorId = this.generateErrorId();
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;

    const report: ErrorReport = {
      id: errorId,
      level,
      message: errorMessage,
      context: {
        ...context,
        timestamp: new Date()
      },
      stack,
      resolved: false
    };

    // Store error report
    this.errorReports.set(errorId, report);

    // Cleanup old reports if needed
    if (this.errorReports.size > this.maxReports) {
      const oldestKey = this.errorReports.keys().next().value;
      if (oldestKey) {
        this.errorReports.delete(oldestKey);
      }
    }

    // Log to console
    this.logError(report);

    // Emit to relevant clients
    this.emitError(report);

    // Handle critical errors
    if (level === 'critical') {
      this.handleCriticalError(report);
    }

    return errorId;
  }

  /**
   * Log error to console with formatting
   */
  private logError(report: ErrorReport): void {
    const timestamp = report.context.timestamp.toISOString();
    const contextStr = JSON.stringify(report.context, null, 2);
    
    switch (report.level) {
      case 'critical':
        console.error(`🚨 CRITICAL [${timestamp}] ${report.message}`);
        console.error(`Context: ${contextStr}`);
        if (report.stack) console.error(`Stack: ${report.stack}`);
        break;
      case 'error':
        console.error(`❌ ERROR [${timestamp}] ${report.message}`);
        console.error(`Context: ${contextStr}`);
        break;
      case 'warning':
        console.warn(`⚠️  WARNING [${timestamp}] ${report.message}`);
        console.warn(`Context: ${contextStr}`);
        break;
      case 'info':
        console.info(`ℹ️  INFO [${timestamp}] ${report.message}`);
        break;
    }
  }

  /**
   * Emit error to relevant clients via socket
   */
  private emitError(report: ErrorReport): void {
    if (!this.socketService) return;

    const errorData = {
      id: report.id,
      level: report.level,
      message: report.message,
      operation: report.context.operation,
      timestamp: report.context.timestamp
    };

    // Emit to project-specific room if projectId exists
    if (report.context.projectId) {
      this.socketService.emitToProject(report.context.projectId, 'error', errorData);
    }

    // Emit critical errors to all connected clients
    if (report.level === 'critical') {
      this.socketService.emitToAll('critical-error', errorData);
    }
  }

  /**
   * Handle critical errors that require immediate attention
   */
  private handleCriticalError(report: ErrorReport): void {
    // Log to a separate critical error log
    console.error('CRITICAL ERROR DETECTED:', report);

    // Could implement additional critical error handling:
    // - Send email notifications
    // - Create incident tickets
    // - Trigger alerts
    // - Graceful service degradation
  }

  /**
   * Get error reports with filtering
   */
  getErrorReports(filters?: {
    level?: string;
    projectId?: string;
    operation?: string;
    resolved?: boolean;
    limit?: number;
  }): ErrorReport[] {
    let reports = Array.from(this.errorReports.values());

    if (filters) {
      if (filters.level) {
        reports = reports.filter(r => r.level === filters.level);
      }
      if (filters.projectId) {
        reports = reports.filter(r => r.context.projectId === filters.projectId);
      }
      if (filters.operation) {
        reports = reports.filter(r => r.context.operation === filters.operation);
      }
      if (filters.resolved !== undefined) {
        reports = reports.filter(r => r.resolved === filters.resolved);
      }
      if (filters.limit) {
        reports = reports.slice(0, filters.limit);
      }
    }

    return reports.sort((a, b) => 
      b.context.timestamp.getTime() - a.context.timestamp.getTime()
    );
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string, resolvedBy?: string): boolean {
    const report = this.errorReports.get(errorId);
    if (!report) return false;

    report.resolved = true;
    report.resolvedAt = new Date();
    report.resolvedBy = resolvedBy;

    return true;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byLevel: { [key: string]: number };
    byOperation: { [key: string]: number };
    resolved: number;
    unresolved: number;
  } {
    const reports = Array.from(this.errorReports.values());
    
    const byLevel: { [key: string]: number } = {};
    const byOperation: { [key: string]: number } = {};
    let resolved = 0;

    reports.forEach(report => {
      byLevel[report.level] = (byLevel[report.level] || 0) + 1;
      byOperation[report.context.operation] = (byOperation[report.context.operation] || 0) + 1;
      if (report.resolved) resolved++;
    });

    return {
      total: reports.length,
      byLevel,
      byOperation,
      resolved,
      unresolved: reports.length - resolved
    };
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create error handling middleware for Express
   */
  createExpressMiddleware() {
    return (error: any, req: any, res: any, next: any) => {
      const context: ErrorContext = {
        operation: `${req.method} ${req.path}`,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown',
        projectId: req.params.projectId || req.params.id,
        videoId: req.params.videoId
      };

      const errorId = this.handleError(error, context, 'error');

      // Send error response
      res.status(error.status || 500).json({
        error: {
          id: errorId,
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'An unexpected error occurred',
          timestamp: new Date(),
          requestId: context.requestId
        }
      });
    };
  }

  /**
   * Wrap async functions with error handling
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    operation: string,
    getContext?: (...args: T) => Partial<ErrorContext>
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const context: ErrorContext = {
          operation,
          timestamp: new Date(),
          ...(getContext ? getContext(...args) : {})
        };

        this.handleError(error as Error, context);
        throw error;
      }
    };
  }

  /**
   * Clear old resolved errors
   */
  clearResolvedErrors(olderThanDays: number = 7): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, report] of this.errorReports.entries()) {
      if (report.resolved && report.resolvedAt && report.resolvedAt < cutoffDate) {
        this.errorReports.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}