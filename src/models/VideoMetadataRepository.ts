import { getDatabase } from '../utils/database';
import { VideoMetadata, VideoMetadataRow } from '../types';

export class VideoMetadataRepository {
  private db = getDatabase();

  private metadataRowToMetadata(row: VideoMetadataRow): VideoMetadata {
    return {
      videoId: row.video_id,
      width: row.width,
      height: row.height,
      frameRate: row.frame_rate,
      bitrate: row.bitrate,
      codec: row.codec,
      audioChannels: row.audio_channels,
      audioSampleRate: row.audio_sample_rate,
      recordingTimestamp: row.recording_timestamp ? new Date(row.recording_timestamp) : undefined
    };
  }

  private metadataToMetadataRow(metadata: VideoMetadata): VideoMetadataRow {
    return {
      video_id: metadata.videoId,
      width: metadata.width,
      height: metadata.height,
      frame_rate: metadata.frameRate,
      bitrate: metadata.bitrate,
      codec: metadata.codec,
      audio_channels: metadata.audioChannels,
      audio_sample_rate: metadata.audioSampleRate,
      recording_timestamp: metadata.recordingTimestamp?.toISOString()
    };
  }

  create(metadata: VideoMetadata): VideoMetadata {
    const row = this.metadataToMetadataRow(metadata);
    
    const stmt = this.db.prepare(`
      INSERT INTO video_metadata (video_id, width, height, frame_rate, bitrate, 
                                 codec, audio_channels, audio_sample_rate, recording_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      row.video_id,
      row.width,
      row.height,
      row.frame_rate,
      row.bitrate,
      row.codec,
      row.audio_channels,
      row.audio_sample_rate,
      row.recording_timestamp
    );

    return metadata;
  }

  findByVideoId(videoId: string): VideoMetadata | null {
    const stmt = this.db.prepare('SELECT * FROM video_metadata WHERE video_id = ?');
    const row = stmt.get(videoId) as VideoMetadataRow | undefined;
    
    return row ? this.metadataRowToMetadata(row) : null;
  }

  update(videoId: string, updates: Partial<Omit<VideoMetadata, 'videoId'>>): VideoMetadata | null {
    const existing = this.findByVideoId(videoId);
    if (!existing) return null;

    const updatedMetadata = {
      ...existing,
      ...updates
    };

    const row = this.metadataToMetadataRow(updatedMetadata);
    
    const stmt = this.db.prepare(`
      UPDATE video_metadata 
      SET width = ?, height = ?, frame_rate = ?, bitrate = ?, codec = ?,
          audio_channels = ?, audio_sample_rate = ?, recording_timestamp = ?
      WHERE video_id = ?
    `);

    stmt.run(
      row.width,
      row.height,
      row.frame_rate,
      row.bitrate,
      row.codec,
      row.audio_channels,
      row.audio_sample_rate,
      row.recording_timestamp,
      videoId
    );

    return updatedMetadata;
  }

  delete(videoId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM video_metadata WHERE video_id = ?');
    const result = stmt.run(videoId);
    
    return result.changes > 0;
  }

  findAll(): VideoMetadata[] {
    const stmt = this.db.prepare('SELECT * FROM video_metadata');
    const rows = stmt.all() as VideoMetadataRow[];
    
    return rows.map(row => this.metadataRowToMetadata(row));
  }
}