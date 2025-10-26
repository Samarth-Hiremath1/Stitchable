import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface ProcessingControlsProps {
  projectId: string;
  videoCount: number;
  onProcessingStarted?: (type: string, job: any) => void;
}

interface ProcessingReadiness {
  ready: boolean;
  requirements: {
    hasVideos: boolean;
    hasSyncData: boolean;
    hasQualityData: boolean;
  };
  recommendations: string[];
}

export const ProcessingControls: React.FC<ProcessingControlsProps> = ({
  projectId,
  videoCount,
  onProcessingStarted
}) => {
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [readiness, setReadiness] = useState<ProcessingReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStitchingReadiness();
  }, [projectId]);

  const checkStitchingReadiness = async () => {
    try {
      const result = await apiService.checkStitchingReadiness(projectId);
      setReadiness(result);
    } catch (err) {
      console.error('Failed to check stitching readiness:', err);
    }
  };

  const startProcessing = async (type: 'sync' | 'quality_analysis' | 'stitching') => {
    setIsLoading(prev => ({ ...prev, [type]: true }));
    setError(null);

    try {
      const result = await apiService.startProcessing(projectId, type);
      
      if (onProcessingStarted) {
        onProcessingStarted(type, result.job);
      }

      // Refresh readiness after starting processing
      if (type === 'sync' || type === 'quality_analysis') {
        setTimeout(checkStitchingReadiness, 1000);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    } finally {
      setIsLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const getProcessingSteps = () => {
    const steps = [
      {
        id: 'sync',
        title: 'Synchronization',
        description: 'Align videos using AI audio/visual analysis',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        enabled: videoCount >= 2,
        completed: readiness?.requirements.hasSyncData || false,
        disabledReason: videoCount < 2 ? 'Need at least 2 videos' : null
      },
      {
        id: 'quality_analysis',
        title: 'Quality Analysis',
        description: 'Analyze video quality metrics for intelligent switching',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        enabled: videoCount > 0,
        completed: readiness?.requirements.hasQualityData || false,
        disabledReason: videoCount === 0 ? 'Need at least 1 video' : null
      },
      {
        id: 'stitching',
        title: 'Video Stitching',
        description: 'Create final video with intelligent camera switching',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ),
        enabled: readiness?.ready || false,
        completed: false, // Stitching is the final step
        disabledReason: readiness?.ready ? null : 'Complete sync and quality analysis first'
      }
    ];

    return steps;
  };

  const steps = getProcessingSteps();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Processing Pipeline</h3>
        <button
          onClick={checkStitchingReadiness}
          className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`
              border rounded-lg p-4 transition-all duration-200
              ${step.completed ? 'border-green-200 bg-green-50' : 
                step.enabled ? 'border-gray-200 bg-white hover:border-blue-200' : 
                'border-gray-200 bg-gray-50'}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`
                  p-2 rounded-lg
                  ${step.completed ? 'bg-green-100 text-green-600' :
                    step.enabled ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-400'}
                `}>
                  {step.completed ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.icon
                  )}
                </div>
                
                <div>
                  <h4 className={`font-medium ${
                    step.completed ? 'text-green-900' :
                    step.enabled ? 'text-gray-900' :
                    'text-gray-500'
                  }`}>
                    {step.title}
                  </h4>
                  <p className={`text-sm ${
                    step.completed ? 'text-green-700' :
                    step.enabled ? 'text-gray-600' :
                    'text-gray-400'
                  }`}>
                    {step.description}
                  </p>
                  {step.disabledReason && (
                    <p className="text-xs text-red-600 mt-1">{step.disabledReason}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {step.completed && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Completed
                  </span>
                )}
                
                {!step.completed && (
                  <button
                    onClick={() => startProcessing(step.id as any)}
                    disabled={!step.enabled || isLoading[step.id]}
                    className={`
                      px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${step.enabled
                        ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }
                      ${isLoading[step.id] ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isLoading[step.id] ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Starting...</span>
                      </div>
                    ) : (
                      'Start'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {readiness && readiness.recommendations.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Recommendations:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {readiness.recommendations.map((rec, index) => (
              <li key={index} className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};