import { useState, useEffect, useCallback } from 'react';
import { socketService, ProcessingUpdate, SystemNotification, JobProgress, QueueStats } from '../services/socketService';
import { ProcessingJob } from '../types';

export interface ProcessingState {
  jobs: ProcessingJob[];
  activeJobs: ProcessingJob[];
  completedJobs: ProcessingJob[];
  failedJobs: ProcessingJob[];
  queueStats: QueueStats | null;
  isConnected: boolean;
  notifications: SystemNotification[];
  lastUpdate: Date | null;
}

export interface ProcessingActions {
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  getQueueStats: () => void;
  getJobStatus: (jobId: string) => void;
  clearNotifications: () => void;
  dismissNotification: (index: number) => void;
  retryFailedJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => void;
}

export const useProcessingUpdates = (projectId?: string): [ProcessingState, ProcessingActions] => {
  const [state, setState] = useState<ProcessingState>({
    jobs: [],
    activeJobs: [],
    completedJobs: [],
    failedJobs: [],
    queueStats: null,
    isConnected: false,
    notifications: [],
    lastUpdate: null
  });

  // Update derived state when jobs change
  const updateDerivedState = useCallback((jobs: ProcessingJob[]) => {
    const activeJobs = jobs.filter(job => job.status === 'processing' || job.status === 'pending');
    const completedJobs = jobs.filter(job => job.status === 'completed');
    const failedJobs = jobs.filter(job => job.status === 'failed');

    setState(prev => ({
      ...prev,
      jobs,
      activeJobs,
      completedJobs,
      failedJobs,
      lastUpdate: new Date()
    }));
  }, []);

  // Socket event handlers
  useEffect(() => {
    const handleSocketConnected = () => {
      setState(prev => ({ ...prev, isConnected: true }));
    };

    const handleSocketDisconnected = () => {
      setState(prev => ({ ...prev, isConnected: false }));
    };

    const handleSocketError = (data: { error: string }) => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        notifications: [...prev.notifications, {
          message: `Connection error: ${data.error}`,
          type: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
    };

    const handleJobAdded = (job: ProcessingJob) => {
      setState(prev => {
        const updatedJobs = [...prev.jobs, job];
        updateDerivedState(updatedJobs);
        return {
          ...prev,
          notifications: [...prev.notifications, {
            message: `New ${job.type} job started`,
            type: 'info',
            timestamp: new Date().toISOString()
          }]
        };
      });
    };

    const handleJobStarted = (job: ProcessingJob) => {
      setState(prev => {
        const updatedJobs = prev.jobs.map(j => j.id === job.id ? job : j);
        updateDerivedState(updatedJobs);
        return prev;
      });
    };

    const handleJobProgress = (progress: JobProgress) => {
      setState(prev => {
        const updatedJobs = prev.jobs.map(job => 
          job.id === progress.jobId 
            ? { ...job, progress: progress.progress, status: progress.status as ProcessingJob['status'] }
            : job
        );
        updateDerivedState(updatedJobs);
        return prev;
      });
    };

    const handleJobCompleted = (job: ProcessingJob) => {
      setState(prev => {
        const updatedJobs = prev.jobs.map(j => j.id === job.id ? job : j);
        updateDerivedState(updatedJobs);
        return {
          ...prev,
          notifications: [...prev.notifications, {
            message: `${job.type} job completed successfully`,
            type: 'success',
            timestamp: new Date().toISOString()
          }]
        };
      });
    };

    const handleJobFailed = (job: ProcessingJob) => {
      setState(prev => {
        const updatedJobs = prev.jobs.map(j => j.id === job.id ? job : j);
        updateDerivedState(updatedJobs);
        return {
          ...prev,
          notifications: [...prev.notifications, {
            message: `${job.type} job failed: ${job.error || 'Unknown error'}`,
            type: 'error',
            timestamp: new Date().toISOString()
          }]
        };
      });
    };

    const handleProcessingUpdate = (update: ProcessingUpdate) => {
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, {
          message: `Processing update: ${update.type}`,
          type: update.type === 'error' ? 'error' : 'info',
          timestamp: update.timestamp
        }]
      }));
    };

    const handleSystemNotification = (notification: SystemNotification) => {
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, notification]
      }));
    };

    const handleProjectJobs = (jobs: ProcessingJob[]) => {
      updateDerivedState(jobs);
    };

    const handleQueueStats = (stats: QueueStats) => {
      setState(prev => ({ ...prev, queueStats: stats }));
    };

    const handleJobRetried = (job: ProcessingJob) => {
      setState(prev => {
        const updatedJobs = prev.jobs.map(j => j.id === job.id ? job : j);
        updateDerivedState(updatedJobs);
        return {
          ...prev,
          notifications: [...prev.notifications, {
            message: `${job.type} job has been retried`,
            type: 'info',
            timestamp: new Date().toISOString()
          }]
        };
      });
    };

    const handleJobCancelled = (job: ProcessingJob) => {
      setState(prev => {
        const updatedJobs = prev.jobs.map(j => j.id === job.id ? job : j);
        updateDerivedState(updatedJobs);
        return {
          ...prev,
          notifications: [...prev.notifications, {
            message: `${job.type} job has been cancelled`,
            type: 'warning',
            timestamp: new Date().toISOString()
          }]
        };
      });
    };

    const handleRetryJobFailed = (data: { jobId: string; error: string }) => {
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, {
          message: `Failed to retry job: ${data.error}`,
          type: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
    };

    const handleCancelJobFailed = (data: { jobId: string; error: string }) => {
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, {
          message: `Failed to cancel job: ${data.error}`,
          type: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
    };

    const handleProcessingError = (data: { error: string; jobId?: string; retryable: boolean; timestamp: string }) => {
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, {
          message: `Processing error: ${data.error}${data.retryable ? ' (Retryable)' : ''}`,
          type: 'error',
          timestamp: data.timestamp
        }]
      }));
    };

    const handleConnectionStatus = (data: { status: string; timestamp: string }) => {
      setState(prev => ({
        ...prev,
        isConnected: data.status === 'connected',
        notifications: [...prev.notifications, {
          message: `Connection ${data.status}`,
          type: data.status === 'connected' ? 'success' : 'warning',
          timestamp: data.timestamp
        }]
      }));
    };

    // Register event listeners
    socketService.on('socketConnected', handleSocketConnected);
    socketService.on('socketDisconnected', handleSocketDisconnected);
    socketService.on('socketError', handleSocketError);
    socketService.on('jobAdded', handleJobAdded);
    socketService.on('jobStarted', handleJobStarted);
    socketService.on('jobProgress', handleJobProgress);
    socketService.on('jobCompleted', handleJobCompleted);
    socketService.on('jobFailed', handleJobFailed);
    socketService.on('processingUpdate', handleProcessingUpdate);
    socketService.on('systemNotification', handleSystemNotification);
    socketService.on('projectJobs', handleProjectJobs);
    socketService.on('queueStats', handleQueueStats);
    socketService.on('jobRetried', handleJobRetried);
    socketService.on('jobCancelled', handleJobCancelled);
    socketService.on('retryJobFailed', handleRetryJobFailed);
    socketService.on('cancelJobFailed', handleCancelJobFailed);
    socketService.on('processingError', handleProcessingError);
    socketService.on('connectionStatus', handleConnectionStatus);

    // Set initial connection state
    setState(prev => ({ ...prev, isConnected: socketService.isConnected() }));

    // Cleanup
    return () => {
      socketService.off('socketConnected', handleSocketConnected);
      socketService.off('socketDisconnected', handleSocketDisconnected);
      socketService.off('socketError', handleSocketError);
      socketService.off('jobAdded', handleJobAdded);
      socketService.off('jobStarted', handleJobStarted);
      socketService.off('jobProgress', handleJobProgress);
      socketService.off('jobCompleted', handleJobCompleted);
      socketService.off('jobFailed', handleJobFailed);
      socketService.off('processingUpdate', handleProcessingUpdate);
      socketService.off('systemNotification', handleSystemNotification);
      socketService.off('projectJobs', handleProjectJobs);
      socketService.off('queueStats', handleQueueStats);
      socketService.off('jobRetried', handleJobRetried);
      socketService.off('jobCancelled', handleJobCancelled);
      socketService.off('retryJobFailed', handleRetryJobFailed);
      socketService.off('cancelJobFailed', handleCancelJobFailed);
      socketService.off('processingError', handleProcessingError);
      socketService.off('connectionStatus', handleConnectionStatus);
    };
  }, [updateDerivedState]);

  // Auto-join project when projectId changes
  useEffect(() => {
    if (projectId && socketService.isConnected()) {
      socketService.joinProject(projectId);
    }

    return () => {
      if (projectId) {
        socketService.leaveProject(projectId);
      }
    };
  }, [projectId]);

  // Actions
  const actions: ProcessingActions = {
    joinProject: (projectId: string) => {
      socketService.joinProject(projectId);
    },

    leaveProject: (projectId: string) => {
      socketService.leaveProject(projectId);
    },

    getQueueStats: () => {
      socketService.getQueueStats();
    },

    getJobStatus: (jobId: string) => {
      socketService.getJobStatus(jobId);
    },

    clearNotifications: () => {
      setState(prev => ({ ...prev, notifications: [] }));
    },

    dismissNotification: (index: number) => {
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter((_, i) => i !== index)
      }));
    },

    retryFailedJob: async (jobId: string) => {
      socketService.retryJob(jobId);
    },

    cancelJob: (jobId: string) => {
      socketService.cancelJob(jobId);
    }
  };

  return [state, actions];
};