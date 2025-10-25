import { getDatabase } from '../utils/database';
import { Video, VideoRow } from '../types';
import { randomUUID } from 'crypto';

export class VideoRepository {
  private db = getDatabase();

  private videoRowToVideo(row: VideoRow): Video {
    return {
      id: row.id,
      projectId: row.project_id,
      filename: row.filename,
      originalName: row.original_name,
      uploaderName: row.uploader_name,
      fileSize: row.file_size,
      duration: row.duration,
      format: row.format,
      uploadedAt: new Date(row.uploaded_at),
      filePath: row.file_path,
      qualityScore: row.quality_score,
      syncOffset: row.sync_offset
    };
  }

  private videoToVideoRow(video: Partial<Video>): Partial<VideoRow> {
    const row: Partial<VideoRow> = {};
    
    if (video.id) row.id = video.id;
    if (video.projectId) row.project_id = video.projectId;
    if (video.filename) row.filename = video.filename;
    if (video.originalName) row.original_name = video.originalName;
    if (video.uploaderName) row.uploader_name = video.uploaderName;
    if (video.fileSize !== undefined) row.file_size = video.fileSize;
    if (video.duration !== undefined) row.duration = video.duration;
    if (video.format) row.format = video.format;
    if (video.uploadedAt) row.uploaded_at = video.uploadedAt.toISOString();
    if (video.filePath) row.file_path = video.filePath;
    if (video.qualityScore !== undefined) row.quality_score = video.qualityScore;
    if (video.syncOffset !== undefined) row.sync_offset = video.syncOffset;
    
    return row;
  }

  create(videoData: Omit<Video, 'id' | 'uploadedAt'>): Video {
    const video: Video = {
      id: randomUUID(),
      ...videoData,
      uploadedAt: new Date()
    };

    const row = this.videoToVideoRow(video);
    
    const stmt = this.db.prepare(`
      INSERT INTO videos (id, project_id, filename, original_name, uploader_name, 
                         file_size, duration, format, uploaded_at, file_path, 
                         quality_score, sync_offset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      row.id,
      row.project_id,
      row.filename,
      row.original_name,
      row.uploader_name,
      row.file_size,
      row.duration,
      row.format,
      row.uploaded_at,
      row.file_path,
      row.quality_score,
      row.sync_offset
    );

    return video;
  }

  findById(id: string): Video | null {
    const stmt = this.db.prepare('SELECT * FROM videos WHERE id = ?');
    const row = stmt.get(id) as VideoRow | undefined;
    
    return row ? this.videoRowToVideo(row) : null;
  }

  findByProjectId(projectId: string): Video[] {
    const stmt = this.db.prepare('SELECT * FROM videos WHERE project_id = ? ORDER BY uploaded_at ASC');
    const rows = stmt.all(projectId) as VideoRow[];
    
    return rows.map(row => this.videoRowToVideo(row));
  }

  update(id: string, updates: Partial<Omit<Video, 'id' | 'uploadedAt'>>): Video | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedVideo = {
      ...existing,
      ...updates
    };

    const row = this.videoToVideoRow(updatedVideo);
    
    const stmt = this.db.prepare(`
      UPDATE videos 
      SET project_id = ?, filename = ?, original_name = ?, uploader_name = ?,
          file_size = ?, duration = ?, format = ?, file_path = ?,
          quality_score = ?, sync_offset = ?
      WHERE id = ?
    `);

    stmt.run(
      row.project_id,
      row.filename,
      row.original_name,
      row.uploader_name,
      row.file_size,
      row.duration,
      row.format,
      row.file_path,
      row.quality_score,
      row.sync_offset,
      id
    );

    return updatedVideo;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM videos WHERE id = ?');
    const result = stmt.run(id);
    
    return result.changes > 0;
  }

  deleteByProjectId(projectId: string): number {
    const stmt = this.db.prepare('DELETE FROM videos WHERE project_id = ?');
    const result = stmt.run(projectId);
    
    return result.changes;
  }

  findAll(): Video[] {
    const stmt = this.db.prepare('SELECT * FROM videos ORDER BY uploaded_at DESC');
    const rows = stmt.all() as VideoRow[];
    
    return rows.map(row => this.videoRowToVideo(row));
  }
}