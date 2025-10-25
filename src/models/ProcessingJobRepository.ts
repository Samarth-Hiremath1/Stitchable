import { getDatabase } from '../utils/database';
import { ProcessingJob, ProcessingJobRow } from '../types';
import { randomUUID } from 'crypto';

export class ProcessingJobRepository {
  private db = getDatabase();

  private jobRowToJob(row: ProcessingJobRow): ProcessingJob {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type as 'sync' | 'quality_analysis' | 'stitching',
      status: row.status as 'pending' | 'processing' | 'completed' | 'failed',
      progress: row.progress,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error,
      result: row.result
    };
  }

  private jobToJobRow(job: Partial<ProcessingJob>): Partial<ProcessingJobRow> {
    const row: Partial<ProcessingJobRow> = {};
    
    if (job.id) row.id = job.id;
    if (job.projectId) row.project_id = job.projectId;
    if (job.type) row.type = job.type;
    if (job.status) row.status = job.status;
    if (job.progress !== undefined) row.progress = job.progress;
    if (job.startedAt) row.started_at = job.startedAt.toISOString();
    if (job.completedAt) row.completed_at = job.completedAt.toISOString();
    if (job.error) row.error = job.error;
    if (job.result) row.result = job.result;
    
    return row;
  }

  create(jobData: Omit<ProcessingJob, 'id'>): ProcessingJob {
    const job: ProcessingJob = {
      id: randomUUID(),
      ...jobData
    };

    const row = this.jobToJobRow(job);
    
    const stmt = this.db.prepare(`
      INSERT INTO processing_jobs (id, project_id, type, status, progress, 
                                  started_at, completed_at, error, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      row.id,
      row.project_id,
      row.type,
      row.status,
      row.progress,
      row.started_at,
      row.completed_at,
      row.error,
      row.result
    );

    return job;
  }

  findById(id: string): ProcessingJob | null {
    const stmt = this.db.prepare('SELECT * FROM processing_jobs WHERE id = ?');
    const row = stmt.get(id) as ProcessingJobRow | undefined;
    
    return row ? this.jobRowToJob(row) : null;
  }

  findByProjectId(projectId: string): ProcessingJob[] {
    const stmt = this.db.prepare('SELECT * FROM processing_jobs WHERE project_id = ? ORDER BY started_at DESC');
    const rows = stmt.all(projectId) as ProcessingJobRow[];
    
    return rows.map(row => this.jobRowToJob(row));
  }

  findByStatus(status: ProcessingJob['status']): ProcessingJob[] {
    const stmt = this.db.prepare('SELECT * FROM processing_jobs WHERE status = ? ORDER BY started_at ASC');
    const rows = stmt.all(status) as ProcessingJobRow[];
    
    return rows.map(row => this.jobRowToJob(row));
  }

  findByProjectIdAndType(projectId: string, type: ProcessingJob['type']): ProcessingJob[] {
    const stmt = this.db.prepare('SELECT * FROM processing_jobs WHERE project_id = ? AND type = ? ORDER BY started_at DESC');
    const rows = stmt.all(projectId, type) as ProcessingJobRow[];
    
    return rows.map(row => this.jobRowToJob(row));
  }

  update(id: string, updates: Partial<Omit<ProcessingJob, 'id'>>): ProcessingJob | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedJob = {
      ...existing,
      ...updates
    };

    const row = this.jobToJobRow(updatedJob);
    
    const stmt = this.db.prepare(`
      UPDATE processing_jobs 
      SET project_id = ?, type = ?, status = ?, progress = ?,
          started_at = ?, completed_at = ?, error = ?, result = ?
      WHERE id = ?
    `);

    stmt.run(
      row.project_id,
      row.type,
      row.status,
      row.progress,
      row.started_at,
      row.completed_at,
      row.error,
      row.result,
      id
    );

    return updatedJob;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM processing_jobs WHERE id = ?');
    const result = stmt.run(id);
    
    return result.changes > 0;
  }

  deleteByProjectId(projectId: string): number {
    const stmt = this.db.prepare('DELETE FROM processing_jobs WHERE project_id = ?');
    const result = stmt.run(projectId);
    
    return result.changes;
  }

  findAll(): ProcessingJob[] {
    const stmt = this.db.prepare('SELECT * FROM processing_jobs ORDER BY started_at DESC');
    const rows = stmt.all() as ProcessingJobRow[];
    
    return rows.map(row => this.jobRowToJob(row));
  }

  // Utility methods for job management
  markAsStarted(id: string): ProcessingJob | null {
    return this.update(id, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0
    });
  }

  markAsCompleted(id: string, result?: string): ProcessingJob | null {
    return this.update(id, {
      status: 'completed',
      completedAt: new Date(),
      progress: 100,
      result
    });
  }

  markAsFailed(id: string, error: string): ProcessingJob | null {
    return this.update(id, {
      status: 'failed',
      completedAt: new Date(),
      error
    });
  }

  updateProgress(id: string, progress: number): ProcessingJob | null {
    return this.update(id, { progress });
  }
}