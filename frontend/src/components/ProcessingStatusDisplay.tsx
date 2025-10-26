import React, { useState } from 'react';
import { ProcessingJob } from '../types';
import { ProcessingState, ProcessingActions } from '../hooks/useProcessingUpdates';

interface ProcessingStatusDisplayProps {
  processingState: ProcessingState;
  processingActions: ProcessingActions;
  showQueueStats?: boolean;
  compact?: boolean;
}

export const ProcessingStatusDisplay: React.FC<ProcessingStatusDisplayProps> = ({
  processingState,
  processingActions,
  showQueueStats = true,
  compact = false
}) => {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const toggleJobExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const getJobTypeIcon = (type: ProcessingJob['type']) => {
    switch (type) {
      case 'sync':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'quality_analysis':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'stitching':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'processing':
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatJobType = (type: ProcessingJob['type']) => {
    switch (type) {
      case 'sync':
        return 'Synchronization';
      case 'quality_analysis':
        return 'Quality Analysis';
      case 'stitching':
        return 'Video Stitching';
      default:
        return type;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${processingState.isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm font-medium">
              {processingState.activeJobs.length > 0 ? `${processingState.activeJobs.length} active jobs` : 'No active jobs'}
            </span>
          </div>
          {processingState.activeJobs.length > 0 && (
            <div className="text-sm text-gray-500">
              {Math.round(processingState.activeJobs.reduce((sum, job) => sum + job.progress, 0) / processingState.activeJobs.length)}% avg
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${processingState.isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <h3 className="text-lg font-medium text-gray-900">Processing Status</h3>
            {processingState.lastUpdate && (
              <span className="text-sm text-gray-500">
                Last update: {formatTimestamp(processingState.lastUpdate.toISOString())}
              </span>
            )}
          </div>
          <button
            onClick={processingActions.getQueueStats}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Queue Statistics */}
      {showQueueStats && processingState.queueStats && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{processingState.queueStats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{processingState.queueStats.processing}</div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{processingState.queueStats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{processingState.queueStats.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs */}
      {processingState.activeJobs.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Active Jobs</h4>
          <div className="space-y-3">
            {processingState.activeJobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="text-blue-600">{getJobTypeIcon(job.type)}</div>
                    <span className="font-medium">{formatJobType(job.type)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{job.progress}%</span>
                    {job.status === 'processing' && (
                      <button
                        onClick={() => processingActions.cancelJob(job.id)}
                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 focus:outline-none"
                        title="Cancel job"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Completed Jobs */}
      {processingState.completedJobs.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recently Completed</h4>
          <div className="space-y-2">
            {processingState.completedJobs.slice(-3).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <div className="text-green-600">{getJobTypeIcon(job.type)}</div>
                  <span className="text-sm">{formatJobType(job.type)}</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                    Completed
                  </span>
                </div>
                {job.completedAt && (
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(job.completedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Jobs */}
      {processingState.failedJobs.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Failed Jobs</h4>
          <div className="space-y-2">
            {processingState.failedJobs.map((job) => (
              <div key={job.id} className="border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="text-red-600">{getJobTypeIcon(job.type)}</div>
                    <span className="text-sm font-medium">{formatJobType(job.type)}</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                      Failed
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => processingActions.retryFailedJob(job.id)}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 focus:outline-none"
                      title="Retry job"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => toggleJobExpansion(job.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className={`w-4 h-4 transform ${expandedJobs.has(job.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                {expandedJobs.has(job.id) && job.error && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                    {job.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Jobs Message */}
      {processingState.jobs.length === 0 && (
        <div className="px-6 py-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Processing Jobs</h3>
          <p className="text-gray-500">Upload some videos to start processing.</p>
        </div>
      )}
    </div>
  );
};