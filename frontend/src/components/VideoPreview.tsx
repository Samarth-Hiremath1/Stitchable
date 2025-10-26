import React, { useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoDownload } from './VideoDownload';
import { Video, FinalVideo, VideoMetadata } from '../types';

interface VideoPreviewProps {
  video?: Video;
  finalVideo?: FinalVideo;
  title?: string;
  className?: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  video,
  finalVideo,
  title,
  className = ''
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [extractedMetadata, setExtractedMetadata] = useState<VideoMetadata | null>(null);

  // Determine video URL and metadata
  const videoUrl = video 
    ? `http://localhost:5001/api/videos/${video.id}/stream`
    : finalVideo 
    ? `http://localhost:5001/uploads/processed/${finalVideo.filename}`
    : '';

  const videoMetadata = video?.metadata || extractedMetadata || undefined;

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleLoadedMetadata = (metadata: VideoMetadata) => {
    if (!video?.metadata) {
      setExtractedMetadata(metadata);
    }
  };

  if (!video && !finalVideo) {
    return (
      <div className={`bg-gray-50 rounded-lg p-8 text-center ${className}`}>
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600">No video available for preview</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {title && (
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <VideoPlayer
              videoUrl={videoUrl}
              videoMetadata={videoMetadata}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full"
            />
            
            {/* Playback Information */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>Current Time: {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                {video && (
                  <span>Duration: {Math.floor(video.duration / 60)}:{Math.floor(video.duration % 60).toString().padStart(2, '0')}</span>
                )}
                {finalVideo && (
                  <span>Duration: {Math.floor(finalVideo.duration / 60)}:{Math.floor(finalVideo.duration % 60).toString().padStart(2, '0')}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {finalVideo ? 'Final Video' : 'Source Video'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Video Information and Download */}
        <div className="space-y-6">
          {/* Video Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Video Details</h3>
            <div className="space-y-3 text-sm">
              {video && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Name:</span>
                    <span className="text-gray-900 font-medium">{video.originalName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Uploader:</span>
                    <span className="text-gray-900">{video.uploaderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Size:</span>
                    <span className="text-gray-900">{(video.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="text-gray-900">{video.format}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Uploaded:</span>
                    <span className="text-gray-900">{new Date(video.uploadedAt).toLocaleDateString()}</span>
                  </div>
                  {video.qualityScore && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quality Score:</span>
                      <span className="text-gray-900">{(video.qualityScore * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </>
              )}
              
              {videoMetadata && (
                <>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <h4 className="font-medium text-gray-900 mb-2">Technical Details</h4>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resolution:</span>
                    <span className="text-gray-900">{videoMetadata.width}x{videoMetadata.height}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frame Rate:</span>
                    <span className="text-gray-900">{videoMetadata.frameRate} fps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Codec:</span>
                    <span className="text-gray-900">{videoMetadata.codec}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Audio:</span>
                    <span className="text-gray-900">{videoMetadata.audioChannels} channels</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Download Section */}
          {finalVideo && (
            <VideoDownload finalVideo={finalVideo} />
          )}

          {/* Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Share Video
              </button>
              
              {!finalVideo && (
                <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Original
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};