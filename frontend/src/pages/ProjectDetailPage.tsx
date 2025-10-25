import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { ProjectDashboard } from '../components/ProjectDashboard';
import { apiService } from '../services/api';

interface ProjectDetailPageProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  projectId,
  onBack
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const projectData = await apiService.getProject(projectId);
      setProject(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const updatedProject = await apiService.updateProject(projectId, updates);
      setProject(updatedProject);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update project');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="p-6">
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Project Details</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading project</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={loadProject}
                className="mt-2 text-sm text-red-800 underline hover:text-red-900"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Project not found</h3>
          <p className="mt-1 text-gray-500">The project you're looking for doesn't exist.</p>
          <button
            onClick={onBack}
            className="mt-4 text-blue-600 hover:text-blue-800 underline"
          >
            Go back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center space-x-4 mb-8">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-800 focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Project Details</h1>
      </div>

      <ProjectDashboard
        project={project}
        onUpdateProject={handleUpdateProject}
        onRefresh={loadProject}
        isLoading={isLoading}
      />
    </div>
  );
};