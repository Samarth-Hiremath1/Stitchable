import React, { useState } from 'react';

interface ProjectCreationFormProps {
  onSubmit: (projectData: CreateProjectData) => Promise<void>;
  isLoading?: boolean;
}

interface CreateProjectData {
  title: string;
  description: string;
  eventDate: string;
  ownerId: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  eventDate?: string;
  ownerId?: string;
}

export const ProjectCreationForm: React.FC<ProjectCreationFormProps> = ({
  onSubmit,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<CreateProjectData>({
    title: '',
    description: '',
    eventDate: '',
    ownerId: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (!formData.ownerId.trim()) {
      newErrors.ownerId = 'Owner name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        title: '',
        description: '',
        eventDate: '',
        ownerId: ''
      });
      setErrors({});
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateProjectData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Project Title *
          </label>
          <input
            type="text"
            id="title"
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
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            id="description"
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
          <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-2">
            Event Date *
          </label>
          <input
            type="datetime-local"
            id="eventDate"
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
          <label htmlFor="ownerId" className="block text-sm font-medium text-gray-700 mb-2">
            Your Name *
          </label>
          <input
            type="text"
            id="ownerId"
            value={formData.ownerId}
            onChange={(e) => handleInputChange('ownerId', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.ownerId ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your name"
            disabled={isSubmitting || isLoading}
          />
          {errors.ownerId && (
            <p className="mt-1 text-sm text-red-600">{errors.ownerId}</p>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => {
              setFormData({ title: '', description: '', eventDate: '', ownerId: '' });
              setErrors({});
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            disabled={isSubmitting || isLoading}
          >
            Clear
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
};