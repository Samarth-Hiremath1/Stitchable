import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { UploadedVideosList } from './UploadedVideosList';

interface VideoListProps {
  videos: Video[];
}

export const VideoList: React.FC<VideoListProps> = ({ videos: initialVideos }) => {
  const [videos, setVideos] = useState<Video[]>(initialVideos);

  // Update videos when prop changes
  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {videos.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Total size: {formatFileSize(videos.reduce((total, video) => total + video.fileSize, 0))}
          </div>
        </div>
      )}
      
      <UploadedVideosList videos={videos} />
    </div>
  );
};