import { io, Socket } from 'socket.io-client';
import { ProcessingJob } from '../types';

export interface ProcessingUpdate {
  type: 'upload' | 'processing' | 'complete' | 'error';
  data: any;
  timestamp: string;
}

export interface UploadProgress {
  filename: string;
  progress: number;
  timestamp: string;
}

export interface SystemNotification {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
}

export interface JobProgress {
  jobId: string;
  progress: number;
  status: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

class SocketService {
  private socket: Socket | null = null;
  private currentProjectId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket(): void {
    this.socket = io('http://localhost:5001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      // Rejoin project room if we were in one
      if (this.currentProjectId) {
        this.joinProject(this.currentProjectId);
      }
      
      this.emit('socketConnected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.emit('socketDisconnected', { reason });
      
      // Attempt to reconnect if disconnection was unexpected
      if (reason === 'io server disconnect') {
        this.handleReconnection();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.emit('socketError', { error: error.message });
      this.handleReconnection();
    });

    // Processing job events
    this.socket.on('jobAdded', (job: ProcessingJob) => {
      console.log('Job added:', job);
      this.emit('jobAdded', job);
    });

    this.socket.on('jobStarted', (job: ProcessingJob) => {
      console.log('Job started:', job);
      this.emit('jobStarted', job);
    });

    this.socket.on('jobProgress', (progress: JobProgress) => {
      console.log('Job progress:', progress);
      this.emit('jobProgress', progress);
    });

    this.socket.on('jobCompleted', (job: ProcessingJob) => {
      console.log('Job completed:', job);
      this.emit('jobCompleted', job);
    });

    this.socket.on('jobFailed', (job: ProcessingJob) => {
      console.log('Job failed:', job);
      this.emit('jobFailed', job);
    });

    // Processing update events
    this.socket.on('processingUpdate', (update: ProcessingUpdate) => {
      console.log('Processing update:', update);
      this.emit('processingUpdate', update);
    });

    // Upload progress events
    this.socket.on('uploadProgress', (progress: UploadProgress) => {
      console.log('Upload progress:', progress);
      this.emit('uploadProgress', progress);
    });

    // System notification events
    this.socket.on('systemNotification', (notification: SystemNotification) => {
      console.log('System notification:', notification);
      this.emit('systemNotification', notification);
    });

    // Project jobs status
    this.socket.on('projectJobs', (jobs: ProcessingJob[]) => {
      console.log('Project jobs:', jobs);
      this.emit('projectJobs', jobs);
    });

    // Queue statistics
    this.socket.on('queueStats', (stats: QueueStats) => {
      console.log('Queue stats:', stats);
      this.emit('queueStats', stats);
    });

    // Job status response
    this.socket.on('jobStatus', (job: ProcessingJob | null) => {
      console.log('Job status:', job);
      this.emit('jobStatus', job);
    });

    // Job retry events
    this.socket.on('jobRetried', (job: ProcessingJob) => {
      console.log('Job retried:', job);
      this.emit('jobRetried', job);
    });

    this.socket.on('retryJobFailed', (data: { jobId: string; error: string }) => {
      console.log('Job retry failed:', data);
      this.emit('retryJobFailed', data);
    });

    // Job cancel events
    this.socket.on('jobCancelled', (job: ProcessingJob) => {
      console.log('Job cancelled:', job);
      this.emit('jobCancelled', job);
    });

    this.socket.on('cancelJobFailed', (data: { jobId: string; error: string }) => {
      console.log('Job cancel failed:', data);
      this.emit('cancelJobFailed', data);
    });

    // Processing error with retry option
    this.socket.on('processingError', (data: { error: string; jobId?: string; retryable: boolean; timestamp: string }) => {
      console.log('Processing error:', data);
      this.emit('processingError', data);
    });

    // Connection status updates
    this.socket.on('connectionStatus', (data: { status: string; timestamp: string }) => {
      console.log('Connection status:', data);
      this.emit('connectionStatus', data);
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  // Public methods
  joinProject(projectId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot join project');
      return;
    }

    this.currentProjectId = projectId;
    this.socket.emit('joinProject', projectId);
    console.log(`Joined project: ${projectId}`);
  }

  leaveProject(projectId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('leaveProject', projectId);
    
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null;
    }
    
    console.log(`Left project: ${projectId}`);
  }

  getQueueStats(): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot get queue stats');
      return;
    }

    this.socket.emit('getQueueStats');
  }

  getJobStatus(jobId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot get job status');
      return;
    }

    this.socket.emit('getJobStatus', jobId);
  }

  retryJob(jobId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot retry job');
      return;
    }

    this.socket.emit('retryJob', jobId);
  }

  cancelJob(jobId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot cancel job');
      return;
    }

    this.socket.emit('cancelJob', jobId);
  }

  // Event listener management
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  // Cleanup
  disconnect(): void {
    if (this.currentProjectId) {
      this.leaveProject(this.currentProjectId);
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }
}

// Singleton instance
export const socketService = new SocketService();