import React, { useState } from 'react';
import { Project } from '../types';
import { ProjectCreationForm } from '../components/ProjectCreationForm';
import { apiService } from '../services/api';

interface CreateProjectPageProps {
  ownerId: string;
  onProjectCreated: (project: Project) => void;
  onCancel: () => void;
}

export const CreateProjectPage: React.FC<CreateProjectPageProps> = ({
  ownerId,
  onProjectCreated,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (projectData: {
    title: string;
    description: string;
    eventDate: string;
    ownerId: string;
  }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newProject = await apiService.createProject({
        ...projectData,
        ownerId
      });
      
      onProjectCreated(newProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      throw err; // Re-throw to let the form handle it
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-800 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
            <p className="text-gray-600 mt-2">Set up a new video stitching project</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error creating project</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <ProjectCreationForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
};