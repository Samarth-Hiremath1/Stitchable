import React from 'react';
import { Video } from '../types';

interface VideoListProps {
  videos: Video[];
}

export const VideoList: React.FC<VideoListProps> = ({ videos }) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No videos uploaded yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Share your project link with contributors to start collecting videos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Uploaded Videos ({videos.length})
        </h3>
        <div className="text-sm text-gray-500">
          Total size: {formatFileSize(videos.reduce((total, video) => total + video.fileSize, 0))}
        </div>
      </div>

      <div className="grid gap-4">
        {videos.map((video) => (
          <div key={video.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {video.originalName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Uploaded by <span className="font-medium">{video.uploaderName}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <span className="ml-1 font-medium">{formatDuration(video.duration)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-1 font-medium">{formatFileSize(video.fileSize)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Format:</span>
                    <span className="ml-1 font-medium uppercase">{video.format}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Uploaded:</span>
                    <span className="ml-1 font-medium">{formatDate(video.uploadedAt)}</span>
                  </div>
                </div>

                {video.metadata && (
                  <div className="mt-2 text-xs text-gray-500">
                    {video.metadata.width}×{video.metadata.height} • {video.metadata.frameRate}fps
                    {video.qualityScore && (
                      <span className="ml-2">
                        Quality: <span className="font-medium">{(video.qualityScore * 100).toFixed(0)}%</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 ml-4">
                <button className="text-gray-400 hover:text-gray-600 focus:outline-none">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};