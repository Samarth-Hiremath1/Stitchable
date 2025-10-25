import React from 'react';
import { Video } from '../types';

interface UploadedVideosListProps {
  videos: Video[];
  isLoading?: boolean;
}

export const UploadedVideosList: React.FC<UploadedVideosListProps> = ({
  videos,
  isLoading = false
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Uploaded Videos</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-20"></div>
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No videos uploaded yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload your first video to get started with this project.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Uploaded Videos ({videos.length})
        </h3>
      </div>
      
      <div className="space-y-3">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  {/* Video Icon */}
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  
                  {/* Video Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {video.originalName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Uploaded by <span className="font-medium">{video.uploaderName}</span>
                    </p>
                  </div>
                </div>
                
                {/* Video Metadata */}
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Duration:</span> {formatDuration(video.duration)}
                  </div>
                  <div>
                    <span className="font-medium">Size:</span> {formatFileSize(video.fileSize)}
                  </div>
                  <div>
                    <span className="font-medium">Format:</span> {video.format.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium">Resolution:</span> {video.metadata.width}x{video.metadata.height}
                  </div>
                </div>
                
                {/* Upload Time */}
                <div className="mt-2 text-xs text-gray-500">
                  Uploaded on {formatDate(video.uploadedAt)}
                </div>
                
                {/* Quality Score (if available) */}
                {video.qualityScore !== undefined && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-600">Quality Score:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            video.qualityScore >= 0.8
                              ? 'bg-green-500'
                              : video.qualityScore >= 0.6
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${video.qualityScore * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">
                        {Math.round(video.qualityScore * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Status Indicator */}
              <div className="flex-shrink-0 ml-4">
                <div className="flex items-center">
                  <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                  <span className="ml-2 text-xs text-gray-500">Ready</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};