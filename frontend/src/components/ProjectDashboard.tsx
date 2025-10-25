import React, { useState } from 'react';
import { Project } from '../types';
import { ShareLinkDisplay } from './ShareLinkDisplay';
import { VideoList } from './VideoList';
import { ProjectSettings } from './ProjectSettings';

interface ProjectDashboardProps {
  project: Project;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onRefresh: () => void;
  isLoading?: boolean;
}

type TabType = 'overview' | 'videos' | 'settings';

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  project,
  onUpdateProject,
  onRefresh,
  isLoading = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'videos', label: 'Videos', count: project.videos?.length || 0 },
    { id: 'settings', label: 'Settings', count: null }
  ];

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md">
      {/* Project Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.title}</h1>
            <p className="text-gray-600 mb-4">{project.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Event: {formatDate(project.eventDate)}</span>
              <span>Created: {formatDate(project.createdAt)}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </span>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none"
            disabled={isLoading}
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <ShareLinkDisplay shareLink={project.shareLink} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Videos Uploaded</h3>
                <p className="text-3xl font-bold text-blue-600">{project.videos?.length || 0}</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Total Duration</h3>
                <p className="text-3xl font-bold text-green-600">
                  {project.videos?.reduce((total, video) => total + (video.duration || 0), 0).toFixed(1)}s
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Project Status</h3>
                <p className={`text-lg font-semibold ${
                  project.status === 'active' ? 'text-green-600' :
                  project.status === 'processing' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </p>
              </div>
            </div>

            {project.finalVideo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Final Video Ready</h3>
                <p className="text-blue-700 mb-3">Your stitched video has been generated and is ready for download.</p>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Download Final Video
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <VideoList videos={project.videos || []} />
        )}

        {activeTab === 'settings' && (
          <ProjectSettings 
            project={project} 
            onUpdateProject={onUpdateProject}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};