import React, { useState, useEffect } from 'react';
import { Project, Video } from '../types';
import { apiService } from '../services/api';
import { VideoUpload } from '../components/VideoUpload';
import { UploadedVideosList } from '../components/UploadedVideosList';

interface ContributorUploadPageProps {
  shareLink: string;
}

export const ContributorUploadPage: React.FC<ContributorUploadPageProps> = ({
  shareLink
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load project and videos
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load project by share link
        const projectData = await apiService.getProjectByShareLink(shareLink);
        setProject(projectData);

        // Load existing videos
        const videosData = await apiService.getProjectVideosByShareLink(shareLink);
        setVideos(videosData.videos);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load project';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectData();
  }, [shareLink]);

  const handleUploadComplete = (video: any) => {
    // Add the new video to the list
    setVideos(prev => [...prev, video]);
    setSuccessMessage('Video uploaded successfully! Thank you for your contribution.');
    
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    // Clear error message after 10 seconds
    setTimeout(() => setError(null), 10000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Project Not Found</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <p className="mt-2 text-sm text-gray-500">
              Please check the link and try again, or contact the project owner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Contribute to: {project.title}
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
              {project.description}
            </p>
            <div className="mt-2 text-sm text-gray-500">
              Event Date: {new Date(project.eventDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </header>

      <main className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Upload Your Video
              </h2>
              <VideoUpload
                projectId={project.id}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>

            {/* Videos List Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <UploadedVideosList videos={videos} />
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-3">
              Upload Instructions
            </h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Enter your name before uploading so we know who contributed the video
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Upload videos in MP4, MOV, AVI, WebM, or WMV format (max 500MB)
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                For best results, record the entire event from your perspective
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                The AI will automatically sync and stitch all videos together
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};