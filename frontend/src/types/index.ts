// Frontend type definitions
export interface Project {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  shareLink: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'processing' | 'completed';
  videos: Video[];
  finalVideo?: FinalVideo;
}

export interface Video {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  uploaderName: string;
  fileSize: number;
  duration: number;
  format: string;
  uploadedAt: string;
  filePath: string;
  metadata: VideoMetadata;
  qualityScore?: number;
  syncOffset?: number;
}

export interface VideoMetadata {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  codec: string;
  audioChannels: number;
  audioSampleRate: number;
  recordingTimestamp?: string;
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  type: 'sync' | 'quality_analysis' | 'stitching';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: any;
}

export interface FinalVideo {
  id: string;
  projectId: string;
  filename: string;
  filePath: string;
  duration: number;
  fileSize: number;
  createdAt: string;
}