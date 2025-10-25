import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiService } from '../services/api';

interface VideoUploadProps {
  projectId: string;
  onUploadComplete: (video: any) => void;
  onUploadError: (error: string) => void;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

const ACCEPTED_VIDEO_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm'],
  'video/x-ms-wmv': ['.wmv']
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const VideoUpload: React.FC<VideoUploadProps> = ({
  projectId,
  onUploadComplete,
  onUploadError
}) => {
  const [uploaderName, setUploaderName] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Validate uploader name
    if (!uploaderName.trim()) {
      setUploadState(prev => ({ ...prev, error: 'Please enter your name before uploading' }));
      return;
    }

    // Reset error state
    setUploadState({
      isUploading: true,
      progress: 0,
      error: null
    });

    try {
      const result = await apiService.uploadVideo(
        projectId,
        file,
        uploaderName.trim(),
        (progress) => {
          setUploadState(prev => ({ ...prev, progress }));
        }
      );

      setUploadState({
        isUploading: false,
        progress: 100,
        error: null
      });

      onUploadComplete(result.video);
      
      // Reset form
      setUploaderName('');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadState({
        isUploading: false,
        progress: 0,
        error: errorMessage
      });
      onUploadError(errorMessage);
    }
  }, [projectId, uploaderName, onUploadComplete, onUploadError]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_VIDEO_TYPES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: uploadState.isUploading || !uploaderName.trim()
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Uploader Name Input */}
      <div className="mb-6">
        <label htmlFor="uploaderName" className="block text-sm font-medium text-gray-700 mb-2">
          Your Name *
        </label>
        <input
          type="text"
          id="uploaderName"
          value={uploaderName}
          onChange={(e) => setUploaderName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={uploadState.isUploading}
        />
      </div>

      {/* Upload Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : uploadState.isUploading || !uploaderName.trim()
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        {uploadState.isUploading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <div>
              <p className="text-lg font-medium text-gray-900">Uploading...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{uploadState.progress}% complete</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            
            {!uploaderName.trim() ? (
              <div>
                <p className="text-lg font-medium text-gray-500">Enter your name first</p>
                <p className="text-sm text-gray-400">Please provide your name before uploading a video</p>
              </div>
            ) : isDragActive ? (
              <div>
                <p className="text-lg font-medium text-blue-600">Drop your video here</p>
                <p className="text-sm text-gray-600">Release to upload</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drag & drop your video here, or click to select
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Supported formats: MP4, MOV, AVI, WebM, WMV
                </p>
                <p className="text-sm text-gray-500">
                  Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Messages */}
      {uploadState.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-800">{uploadState.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* File Rejection Messages */}
      {fileRejections.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-800 font-medium">File rejected:</p>
              {fileRejections.map(({ file, errors }) => (
                <div key={file.name} className="mt-1">
                  <p className="text-sm text-yellow-700">{file.name}</p>
                  <ul className="text-sm text-yellow-600 list-disc list-inside">
                    {errors.map((error) => (
                      <li key={error.code}>
                        {error.code === 'file-too-large' 
                          ? `File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`
                          : error.code === 'file-invalid-type'
                          ? 'Invalid file type. Please upload a video file.'
                          : error.message
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};