// Core data models
export interface Project {
  id: string;
  title: string;
  description: string;
  eventDate: Date;
  shareLink: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'processing' | 'completed' | 'error' | 'cancelled';
  finalVideo?: FinalVideo;
  finalVideoPath?: string;
  videos?: Video[];
}

export interface Video {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  uploaderName: string;
  fileSize?: number;
  duration?: number;
  format: string;
  uploadedAt: Date;
  filePath: string;
  qualityScore?: number;
  syncOffset?: number;
  syncConfidence?: number;
}

export interface VideoMetadata {
  videoId: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  codec: string;
  audioChannels: number;
  audioSampleRate: number;
  recordingTimestamp?: Date;
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  type: 'sync' | 'quality_analysis' | 'stitching';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: string;
}

export interface FinalVideo {
  id: string;
  projectId: string;
  filename: string;
  filePath: string;
  duration: number;
  fileSize: number;
  createdAt: Date;
}

// AI Synchronization Types
export interface SyncPoint {
  videoId: string;
  timestamp: number;
  confidence: number;
  method: 'audio' | 'visual';
  referencePoint: number;
  offset: number;
}

export interface AudioWaveform {
  videoId: string;
  sampleRate: number;
  samples: Float32Array;
  duration: number;
}

export interface VisualFeature {
  videoId: string;
  timestamp: number;
  features: number[];
  keypoints: Array<{x: number, y: number}>;
}

export interface SyncResult {
  projectId: string;
  syncPoints: SyncPoint[];
  confidence: number;
  method: 'audio' | 'visual' | 'hybrid';
  alignedVideos: Array<{
    videoId: string;
    offsetSeconds: number;
    confidence: number;
  }>;
}

// Video Quality Assessment Types
export interface QualityScore {
  overall: number;
  stability: number;
  lighting: number;
  framing: number;
  clarity: number;
  audioQuality: number;
}

export interface QualityMetrics {
  videoId: string;
  scores: QualityScore;
  analysisTimestamp: Date;
  frameAnalysis: FrameQualityData[];
  motionData: MotionAnalysis;
  lightingData: LightingAnalysis;
  framingData: FramingAnalysis;
  clarityData: ClarityAnalysis;
}

export interface FrameQualityData {
  timestamp: number;
  stabilityScore: number;
  lightingScore: number;
  framingScore: number;
  clarityScore: number;
}

export interface MotionAnalysis {
  averageMotion: number;
  motionVariance: number;
  stabilityScore: number;
  shakeDetected: boolean;
  motionVectors: Array<{
    timestamp: number;
    magnitude: number;
    direction: number;
  }>;
}

export interface LightingAnalysis {
  averageBrightness: number;
  brightnessVariance: number;
  contrastScore: number;
  exposureScore: number;
  colorBalance: {
    red: number;
    green: number;
    blue: number;
  };
}

export interface FramingAnalysis {
  compositionScore: number;
  ruleOfThirdsScore: number;
  centeringScore: number;
  aspectRatioScore: number;
  subjectDetection: {
    detected: boolean;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export interface ClarityAnalysis {
  sharpnessScore: number;
  focusScore: number;
  noiseLevel: number;
  edgeStrength: number;
  blurDetection: {
    motionBlur: number;
    focusBlur: number;
  };
}

// Database Row Types (for SQLite storage)
export interface ProjectRow {
  id: string;
  title: string;
  description: string;
  event_date: string;
  share_link: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  status: string;
}

export interface VideoRow {
  id: string;
  project_id: string;
  filename: string;
  original_name: string;
  uploader_name: string;
  file_size: number;
  duration: number;
  format: string;
  uploaded_at: string;
  file_path: string;
  quality_score?: number;
  sync_offset?: number;
}

export interface VideoMetadataRow {
  video_id: string;
  width: number;
  height: number;
  frame_rate: number;
  bitrate: number;
  codec: string;
  audio_channels: number;
  audio_sample_rate: number;
  recording_timestamp?: string;
}

export interface ProcessingJobRow {
  id: string;
  project_id: string;
  type: string;
  status: string;
  progress: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: string;
}

// Video Stitching Types
export interface StitchingSegment {
  videoId: string;
  startTime: number;
  endTime: number;
  qualityScore: number;
  transitionType: 'cut' | 'fade' | 'crossfade';
  cameraAngle: 'wide' | 'medium' | 'close' | 'unknown';
}

export interface StitchingTimeline {
  projectId: string;
  segments: StitchingSegment[];
  totalDuration: number;
  transitionDuration: number;
  createdAt: Date;
}

export interface CameraAngleClassification {
  videoId: string;
  angle: 'wide' | 'medium' | 'close' | 'unknown';
  confidence: number;
  frameAnalysis: Array<{
    timestamp: number;
    angle: 'wide' | 'medium' | 'close' | 'unknown';
    confidence: number;
  }>;
}

export interface StitchingResult {
  projectId: string;
  outputPath: string;
  timeline: StitchingTimeline;
  duration: number;
  fileSize: number;
  qualityMetrics: {
    averageQuality: number;
    transitionCount: number;
    cameraAngleSwitches: number;
  };
  createdAt: Date;
}