import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

interface WorkflowProgress {
  stage: 'upload' | 'processing' | 'sync' | 'quality' | 'stitching' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

interface WorkflowStatus {
  status: string;
  progress: number;
  currentStage?: string;
  error?: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  memory: { usage: number };
  disk: { usage: number };
  database: { connected: boolean };
  services: { ffmpeg: boolean; uploads: boolean };
}

interface WorkflowDashboardProps {
  projectId: string;
  onWorkflowComplete?: (finalVideoPath: string) => void;
}

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  projectId,
  onWorkflowComplete
}) => {
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socket = useSocket();

  useEffect(() => {
    if (socket) {
      // Listen for workflow progress updates
      socket.on('workflow-progress', (progress: WorkflowProgress) => {
        setWorkflowProgress(progress);
        
        if (progress.stage === 'complete') {
          setIsExecuting(false);
          if (onWorkflowComplete) {
            // Extract final video path from progress message or make API call
            fetchWorkflowStatus();
          }
        } else if (progress.stage === 'error') {
          setIsExecuting(false);
          setError(progress.error || 'Workflow failed');
        }
      });

      // Listen for system health updates
      socket.on('system-health', (health: SystemHealth) => {
        setSystemHealth(health);
      });

      return () => {
        socket.off('workflow-progress');
        socket.off('system-health');
      };
    }
  }, [socket, onWorkflowComplete]);

  useEffect(() => {
    fetchWorkflowStatus();
    fetchSystemHealth();
  }, [projectId]);

  const fetchWorkflowStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/status`);
      if (response.ok) {
        const data = await response.json();
        setWorkflowStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch workflow status:', error);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/system/health');
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };

  const executeWorkflow = async () => {
    setIsExecuting(true);
    setError(null);
    setWorkflowProgress(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to start workflow');
      }

      const data = await response.json();
      if (data.success && data.data.finalVideoPath) {
        onWorkflowComplete?.(data.data.finalVideoPath);
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to execute workflow');
      setIsExecuting(false);
    }
  };

  const retryWorkflow = async () => {
    setIsExecuting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/retry`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to retry workflow');
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to retry workflow');
      setIsExecuting(false);
    }
  };

  const cancelWorkflow = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/cancel`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setIsExecuting(false);
        setWorkflowProgress(null);
      }
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'upload': return '📤';
      case 'processing': return '⚙️';
      case 'sync': return '🔄';
      case 'quality': return '🎯';
      case 'stitching': return '🎬';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const isSystemReady = systemHealth?.status !== 'critical' && 
                       systemHealth?.services.ffmpeg && 
                       systemHealth?.services.uploads;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Workflow Dashboard</h2>
        
        {/* System Health Indicator */}
        {systemHealth && (
          <div className={`flex items-center space-x-2 ${getHealthStatusColor(systemHealth.status)}`}>
            <div className={`w-3 h-3 rounded-full ${
              systemHealth.status === 'healthy' ? 'bg-green-500' :
              systemHealth.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">
              System {systemHealth.status}
            </span>
          </div>
        )}
      </div>

      {/* System Health Details */}
      {systemHealth && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-gray-600">Memory</div>
            <div className={`font-semibold ${systemHealth.memory.usage > 80 ? 'text-red-600' : 'text-green-600'}`}>
              {systemHealth.memory.usage.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Disk</div>
            <div className={`font-semibold ${systemHealth.disk.usage > 80 ? 'text-red-600' : 'text-green-600'}`}>
              {systemHealth.disk.usage.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Database</div>
            <div className={`font-semibold ${systemHealth.database.connected ? 'text-green-600' : 'text-red-600'}`}>
              {systemHealth.database.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">FFmpeg</div>
            <div className={`font-semibold ${systemHealth.services.ffmpeg ? 'text-green-600' : 'text-red-600'}`}>
              {systemHealth.services.ffmpeg ? 'Available' : 'Unavailable'}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Progress */}
      {workflowProgress && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getStageIcon(workflowProgress.stage)}</span>
              <span className="font-semibold text-gray-900 capitalize">
                {workflowProgress.stage}
              </span>
            </div>
            <span className="text-sm text-gray-600">
              {workflowProgress.progress}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                workflowProgress.stage === 'error' ? 'bg-red-500' :
                workflowProgress.stage === 'complete' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${workflowProgress.progress}%` }}
            ></div>
          </div>
          
          <p className="text-sm text-gray-600">{workflowProgress.message}</p>
          
          {workflowProgress.error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{workflowProgress.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Current Status */}
      {workflowStatus && !workflowProgress && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">Current Status:</span>
              <span className="ml-2 font-semibold capitalize">{workflowStatus.status}</span>
            </div>
            {workflowStatus.progress > 0 && (
              <span className="text-sm text-gray-600">{workflowStatus.progress}%</span>
            )}
          </div>
          
          {workflowStatus.currentStage && (
            <div className="mt-2">
              <span className="text-sm text-gray-600">Stage:</span>
              <span className="ml-2 text-sm font-medium capitalize">{workflowStatus.currentStage}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        {!isExecuting && workflowStatus?.status !== 'processing' && (
          <button
            onClick={executeWorkflow}
            disabled={!isSystemReady}
            className={`px-6 py-2 rounded-md font-medium ${
              isSystemReady
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {workflowStatus?.status === 'completed' ? 'Re-run Workflow' : 'Start Workflow'}
          </button>
        )}

        {workflowStatus?.status === 'error' && !isExecuting && (
          <button
            onClick={retryWorkflow}
            disabled={!isSystemReady}
            className={`px-6 py-2 rounded-md font-medium ${
              isSystemReady
                ? 'bg-yellow-600 text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Retry Workflow
          </button>
        )}

        {isExecuting && (
          <button
            onClick={cancelWorkflow}
            className="px-6 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Cancel Workflow
          </button>
        )}
      </div>

      {!isSystemReady && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            System is not ready for workflow execution. Please check system health status above.
          </p>
        </div>
      )}
    </div>
  );
};