import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { VideoMetadata } from '../types';

interface VideoPlayerProps {
  videoUrl: string;
  videoMetadata?: VideoMetadata;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (metadata: VideoMetadata) => void;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoMetadata,
  onTimeUpdate,
  onLoadedMetadata,
  className = ''
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-default-skin');
      videoRef.current.appendChild(videoElement);

      const player = videojs(videoElement, {
        controls: true,
        responsive: true,
        fluid: true,
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        preload: 'metadata',
        sources: [{
          src: videoUrl,
          type: 'video/mp4'
        }]
      });

      playerRef.current = player;

      // Event listeners
      player.ready(() => {
        setIsLoading(false);
      });

      player.on('error', () => {
        setError('Failed to load video. Please try again.');
        setIsLoading(false);
      });

      player.on('timeupdate', () => {
        if (onTimeUpdate) {
          const currentTime = player.currentTime();
          if (typeof currentTime === 'number') {
            onTimeUpdate(currentTime);
          }
        }
      });

      player.on('loadedmetadata', () => {
        if (onLoadedMetadata && !videoMetadata) {
          // Extract metadata from video element if not provided
          const videoEl = player.el().querySelector('video');
          if (videoEl) {
            const extractedMetadata: VideoMetadata = {
              width: videoEl.videoWidth,
              height: videoEl.videoHeight,
              frameRate: 30, // Default, can't extract from HTML5 video
              bitrate: 0, // Not available from HTML5 video
              codec: 'unknown',
              audioChannels: 2, // Default
              audioSampleRate: 44100 // Default
            };
            onLoadedMetadata(extractedMetadata);
          }
        }
      });
    }

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoUrl, onTimeUpdate, onLoadedMetadata, videoMetadata]);

  if (error) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <div className="text-red-600 mb-2">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading video...</p>
          </div>
        </div>
      )}
      <div ref={videoRef} className="w-full" />
      
      {/* Video Quality Information */}
      {videoMetadata && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
          <h4 className="font-medium text-gray-900 mb-2">Video Information</h4>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <div>Resolution: {videoMetadata.width}x{videoMetadata.height}</div>
            <div>Frame Rate: {videoMetadata.frameRate} fps</div>
            <div>Codec: {videoMetadata.codec}</div>
            <div>Audio: {videoMetadata.audioChannels} channels</div>
          </div>
        </div>
      )}
    </div>
  );
};