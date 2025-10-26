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

  // Video upload methods
  async uploadVideo(
    projectId: string,
    file: File,
    uploaderName: string,
    onProgress?: (progress: number) => void
  ): Promise<{ video: any }> {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('uploaderName', uploaderName);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.data);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error.message || 'Upload failed'));
          } catch (error) {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.open('POST', `${API_BASE_URL}/videos/projects/${projectId}/upload`);
      xhr.send(formData);
    });
  }

  async getProjectVideos(projectId: string): Promise<{ videos: any[]; count: number }> {
    return this.request<{ videos: any[]; count: number }>(`/videos/projects/${projectId}/videos`);
  }

  async getProjectVideosByShareLink(shareLink: string): Promise<{ videos: any[]; count: number }> {
    return this.request<{ videos: any[]; count: number }>(`/videos/projects/share/${shareLink}/videos`);
  }

  // Video streaming and download methods
  getVideoStreamUrl(videoId: string): string {
    return `${API_BASE_URL}/videos/${videoId}/stream`;
  }

  getFinalVideoDownloadUrl(projectId: string): string {
    return `${API_BASE_URL}/projects/${projectId}/final-video/download`;
  }

  async downloadFinalVideo(projectId: string): Promise<Blob> {
    const url = this.getFinalVideoDownloadUrl(projectId);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to download video');
    }
    
    return response.blob();
  }

  // Processing methods
  async startProcessing(projectId: string, type: 'sync' | 'quality_analysis' | 'stitching'): Promise<{ job: any }> {
    return this.request<{ job: any }>(`/projects/${projectId}/process`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }

  async getProcessingStatus(projectId: string): Promise<{ projectJobs: any[]; queueStats: any }> {
    return this.request<{ projectJobs: any[]; queueStats: any }>(`/projects/${projectId}/processing-status`);
  }

  async getJobStatus(jobId: string): Promise<{ job: any }> {
    return this.request<{ job: any }>(`/jobs/${jobId}`);
  }

  async cancelJob(jobId: string): Promise<{ job: any }> {
    return this.request<{ job: any }>(`/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  async retryJob(jobId: string): Promise<{ originalJob: any; newJob: any }> {
    return this.request<{ originalJob: any; newJob: any }>(`/jobs/${jobId}/retry`, {
      method: 'POST',
    });
  }

  async getQueueStats(): Promise<{ stats: any }> {
    return this.request<{ stats: any }>('/queue/stats');
  }

  async getSyncResults(projectId: string): Promise<{ videos: any[]; synchronized: boolean }> {
    return this.request<{ videos: any[]; synchronized: boolean }>(`/projects/${projectId}/sync-results`);
  }

  async validateSync(projectId: string): Promise<{ validation: any; syncData: any }> {
    return this.request<{ validation: any; syncData: any }>(`/projects/${projectId}/validate-sync`);
  }

  async startStitching(projectId: string): Promise<{ job: any }> {
    return this.request<{ job: any }>(`/projects/${projectId}/stitch`, {
      method: 'POST',
    });
  }

  async getQualityRankings(projectId: string): Promise<{ rankings: any[]; summary: any }> {
    return this.request<{ rankings: any[]; summary: any }>(`/projects/${projectId}/quality-rankings`);
  }

  async checkStitchingReadiness(projectId: string): Promise<{ ready: boolean; requirements: any; recommendations: string[] }> {
    return this.request<{ ready: boolean; requirements: any; recommendations: string[] }>(`/projects/${projectId}/stitching-readiness`);
  }
}

export const apiService = new ApiService();