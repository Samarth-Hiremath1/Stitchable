import React, { useState } from 'react';
import { Project } from '../types';

interface ProjectSettingsProps {
  project: Project;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  isLoading?: boolean;
}

interface FormData {
  title: string;
  description: string;
  eventDate: string;
  status: 'active' | 'processing' | 'completed';
}

interface FormErrors {
  title?: string;
  description?: string;
  eventDate?: string;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  project,
  onUpdateProject,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<FormData>({
    title: project.title,
    description: project.description,
    eventDate: new Date(project.eventDate).toISOString().slice(0, 16),
    status: project.status
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }

    if (!formData.eventDate) {
      newErrors.eventDate = 'Event date is required';
    } else {
      const eventDate = new Date(formData.eventDate);
      if (isNaN(eventDate.getTime())) {
        newErrors.eventDate = 'Please enter a valid date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Check if there are changes
    const originalData = {
      title: project.title,
      description: project.description,
      eventDate: new Date(project.eventDate).toISOString().slice(0, 16),
      status: project.status
    };
    
    const hasChanges = Object.keys(newFormData).some(
      key => newFormData[key as keyof FormData] !== originalData[key as keyof FormData]
    );
    setHasChanges(hasChanges);

    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: Partial<Project> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        eventDate: formData.eventDate,
        status: formData.status
      };

      await onUpdateProject(project.id, updates);
      setHasChanges(false);
    } catch (error) {
      console.error('Error updating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: project.title,
      description: project.description,
      eventDate: new Date(project.eventDate).toISOString().slice(0, 16),
      status: project.status
    });
    setErrors({});
    setHasChanges(false);
  };

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Project Settings</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="settings-title" className="block text-sm font-medium text-gray-700 mb-2">
            Project Title *
          </label>
          <input
            type="text"
            id="settings-title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter project title"
            maxLength={200}
            disabled={isSubmitting || isLoading}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        <div>
          <label htmlFor="settings-description" className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            id="settings-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Describe your project and the event you're recording"
            maxLength={1000}
            disabled={isSubmitting || isLoading}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            {formData.description.length}/1000 characters
          </p>
        </div>

        <div>
          <label htmlFor="settings-eventDate" className="block text-sm font-medium text-gray-700 mb-2">
            Event Date *
          </label>
          <input
            type="datetime-local"
            id="settings-eventDate"
            value={formData.eventDate}
            onChange={(e) => handleInputChange('eventDate', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.eventDate ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting || isLoading}
          />
          {errors.eventDate && (
            <p className="mt-1 text-sm text-red-600">{errors.eventDate}</p>
          )}
        </div>

        <div>
          <label htmlFor="settings-status" className="block text-sm font-medium text-gray-700 mb-2">
            Project Status
          </label>
          <select
            id="settings-status"
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting || isLoading}
          >
            <option value="active">Active</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Change status to control project visibility and functionality
          </p>
        </div>

        {hasChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  You have unsaved changes. Don't forget to save your updates.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            disabled={isSubmitting || isLoading || !hasChanges}
          >
            Reset
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isLoading || !hasChanges}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Project Information */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-4">Project Information</h4>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Project ID</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{project.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Share Link</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{project.shareLink}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(project.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(project.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};