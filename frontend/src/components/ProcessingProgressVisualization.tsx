import React from 'react';
import { ProcessingJob } from '../types';

interface ProcessingProgressVisualizationProps {
  jobs: ProcessingJob[];
  showDetails?: boolean;
  orientation?: 'horizontal' | 'vertical';
  onRetryJob?: (jobId: string) => void;
  onCancelJob?: (jobId: string) => void;
}

export const ProcessingProgressVisualization: React.FC<ProcessingProgressVisualizationProps> = ({
  jobs,
  showDetails = true,
  orientation = 'horizontal',
  onRetryJob,
  onCancelJob
}) => {
  const getJobStageInfo = (type: ProcessingJob['type']) => {
    switch (type) {
      case 'sync':
        return {
          name: 'Synchronization',
          description: 'Aligning videos using AI audio/visual analysis',
          stages: ['Audio Analysis', 'Visual Features', 'Sync Calculation', 'Validation'],
          color: 'blue'
        };
      case 'quality_analysis':
        return {
          name: 'Quality Analysis',
          description: 'Analyzing video quality metrics',
          stages: ['Stability Check', 'Lighting Analysis', 'Framing Assessment', 'Clarity Evaluation'],
          color: 'green'
        };
      case 'stitching':
        return {
          name: 'Video Stitching',
          description: 'Creating final video with intelligent switching',
          stages: ['Timeline Generation', 'Segment Selection', 'Transition Creation', 'Final Rendering'],
          color: 'purple'
        };
      default:
        return {
          name: 'Processing',
          description: 'Processing video data',
          stages: ['Initialization', 'Processing', 'Validation', 'Completion'],
          color: 'gray'
        };
    }
  };

  const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border') => {
    const colorMap = {
      blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200' },
      green: { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-200' },
      purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-200' },
      gray: { bg: 'bg-gray-500', text: 'text-gray-600', border: 'border-gray-200' }
    };
    return colorMap[color as keyof typeof colorMap]?.[variant] || colorMap.gray[variant];
  };

  const getCurrentStage = (progress: number, totalStages: number) => {
    if (progress === 0) return 0;
    if (progress === 100) return totalStages - 1;
    return Math.floor((progress / 100) * totalStages);
  };

  const getStageProgress = (progress: number, stageIndex: number, totalStages: number) => {
    const stageSize = 100 / totalStages;
    const stageStart = stageIndex * stageSize;
    const stageEnd = (stageIndex + 1) * stageSize;
    
    if (progress <= stageStart) return 0;
    if (progress >= stageEnd) return 100;
    
    return ((progress - stageStart) / stageSize) * 100;
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return null;
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const durationSec = Math.floor(durationMs / 1000);
    
    if (durationSec < 60) return `${durationSec}s`;
    
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Processing Jobs</h3>
        <p className="text-gray-500">Processing jobs will appear here when they start.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {jobs.map((job) => {
        const jobInfo = getJobStageInfo(job.type);
        const currentStage = getCurrentStage(job.progress, jobInfo.stages.length);
        const isActive = job.status === 'processing';
        const isCompleted = job.status === 'completed';
        const isFailed = job.status === 'failed';

        return (
          <div
            key={job.id}
            className={`
              border rounded-lg p-6 transition-all duration-300
              ${isActive ? `${getColorClasses(jobInfo.color, 'border')} bg-white shadow-md` : 'border-gray-200 bg-gray-50'}
              ${isFailed ? 'border-red-200 bg-red-50' : ''}
            `}
          >
            {/* Job Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${isActive ? getColorClasses(jobInfo.color, 'text') : 'text-gray-700'}`}>
                  {jobInfo.name}
                </h3>
                <p className="text-sm text-gray-600">{jobInfo.description}</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className={`text-2xl font-bold ${isActive ? getColorClasses(jobInfo.color, 'text') : 'text-gray-600'}`}>
                    {job.progress}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {job.status === 'processing' && job.startedAt && (
                      <span>Running for {formatDuration(job.startedAt)}</span>
                    )}
                    {job.status === 'completed' && job.startedAt && job.completedAt && (
                      <span>Completed in {formatDuration(job.startedAt, job.completedAt)}</span>
                    )}
                    {job.status === 'failed' && (
                      <span className="text-red-600">Failed</span>
                    )}
                    {job.status === 'pending' && (
                      <span>Waiting to start</span>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col space-y-1">
                  {isFailed && onRetryJob && (
                    <button
                      onClick={() => onRetryJob(job.id)}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 focus:outline-none"
                    >
                      Retry
                    </button>
                  )}
                  {isActive && onCancelJob && (
                    <button
                      onClick={() => onCancelJob(job.id)}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 focus:outline-none"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`
                    h-3 rounded-full transition-all duration-500 ease-out
                    ${isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : getColorClasses(jobInfo.color, 'bg')}
                  `}
                  style={{ width: `${job.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Stage Details */}
            {showDetails && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Processing Stages</h4>
                <div className={orientation === 'horizontal' ? 'grid grid-cols-2 md:grid-cols-4 gap-3' : 'space-y-3'}>
                  {jobInfo.stages.map((stage, index) => {
                    const stageProgress = getStageProgress(job.progress, index, jobInfo.stages.length);
                    const isCurrentStage = index === currentStage && isActive;
                    const isStageCompleted = index < currentStage || isCompleted;
                    const isStageFailed = isFailed && index === currentStage;

                    return (
                      <div
                        key={index}
                        className={`
                          p-3 rounded-lg border transition-all duration-300
                          ${isCurrentStage ? `${getColorClasses(jobInfo.color, 'border')} bg-white shadow-sm` : 'border-gray-200'}
                          ${isStageCompleted ? 'bg-green-50 border-green-200' : ''}
                          ${isStageFailed ? 'bg-red-50 border-red-200' : ''}
                        `}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${
                            isCurrentStage ? getColorClasses(jobInfo.color, 'text') :
                            isStageCompleted ? 'text-green-600' :
                            isStageFailed ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {stage}
                          </span>
                          <div className="flex items-center">
                            {isStageCompleted && (
                              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {isStageFailed && (
                              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            {isCurrentStage && (
                              <div className="w-4 h-4">
                                <div className={`w-2 h-2 ${getColorClasses(jobInfo.color, 'bg')} rounded-full animate-pulse`}></div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Stage Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className={`
                              h-1 rounded-full transition-all duration-300
                              ${isStageFailed ? 'bg-red-500' : 
                                isStageCompleted ? 'bg-green-500' : 
                                getColorClasses(jobInfo.color, 'bg')}
                            `}
                            style={{ width: `${Math.max(stageProgress, isStageCompleted ? 100 : 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error Details */}
            {isFailed && job.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-1">Error Details</h4>
                <p className="text-sm text-red-700">{job.error}</p>
              </div>
            )}

            {/* Result Details */}
            {isCompleted && job.result && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-1">Result</h4>
                <p className="text-sm text-green-700">{job.result}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};