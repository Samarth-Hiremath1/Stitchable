import React, { useState } from 'react';
import { FinalVideo } from '../types';

interface VideoDownloadProps {
  finalVideo: FinalVideo;
  className?: string;
}

export const VideoDownload: React.FC<VideoDownloadProps> = ({
  finalVideo,
  className = ''
}) => {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadVideo = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress(0);

    try {
      const videoUrl = `http://localhost:5001/uploads/processed/${finalVideo.filename}`;
      
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.open('GET', videoUrl, true);
      xhr.responseType = 'blob';

      // Track download progress
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setDownloadProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          // Create download link
          const blob = xhr.response;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalVideo.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          setDownloadProgress(100);
          setTimeout(() => {
            setIsDownloading(false);
            setDownloadProgress(0);
          }, 1000);
        } else {
          throw new Error('Download failed');
        }
      };

      xhr.onerror = () => {
        throw new Error('Network error during download');
      };

      xhr.send();

    } catch (error) {
      console.error('Download error:', error);
      setDownloadError('Failed to download video. Please try again.');
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Final Video</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Duration: {formatDuration(finalVideo.duration)}</div>
            <div>File Size: {formatFileSize(finalVideo.fileSize)}</div>
            <div>Created: {new Date(finalVideo.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      {downloadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{downloadError}</p>
          </div>
        </div>
      )}

      {isDownloading && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Downloading...</span>
            <span>{downloadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      <button
        onClick={downloadVideo}
        disabled={isDownloading}
        className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          isDownloading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }`}
      >
        {isDownloading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Downloading...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Video
          </>
        )}
      </button>
    </div>
  );
};