import { Project } from '../types';

const API_BASE_URL = 'http://localhost:5001/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        throw new Error(error.error.message || 'An error occurred');
      }

      return (data as ApiResponse<T>).data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // Project management methods
  async createProject(projectData: {
    title: string;
    description: string;
    eventDate: string;
    ownerId: string;
  }): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`);
  }

  async getProjectByShareLink(shareLink: string): Promise<Project> {
    return this.request<Project>(`/projects/share/${shareLink}`);
  }

  async getProjectsByOwner(ownerId: string): Promise<Project[]> {
    return this.request<Project[]>(`/projects/owner/${ownerId}`);
  }

  async updateProject(
    projectId: string,
    updates: Partial<Project>
  ): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
}

export const apiService = new ApiService();