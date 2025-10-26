import { getDatabase } from '../utils/database';
import { Project, ProjectRow } from '../types';
import { randomUUID } from 'crypto';

export class ProjectRepository {
  private db = getDatabase();

  private projectRowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      eventDate: new Date(row.event_date),
      shareLink: row.share_link,
      ownerId: row.owner_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as 'active' | 'processing' | 'completed'
    };
  }

  private projectToProjectRow(project: Partial<Project>): Partial<ProjectRow> {
    const row: Partial<ProjectRow> = {};
    
    if (project.id) row.id = project.id;
    if (project.title) row.title = project.title;
    if (project.description) row.description = project.description;
    if (project.eventDate) row.event_date = project.eventDate.toISOString();
    if (project.shareLink) row.share_link = project.shareLink;
    if (project.ownerId) row.owner_id = project.ownerId;
    if (project.createdAt) row.created_at = project.createdAt.toISOString();
    if (project.updatedAt) row.updated_at = project.updatedAt.toISOString();
    if (project.status) row.status = project.status;
    
    return row;
  }

  create(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const now = new Date();
    const project: Project = {
      id: randomUUID(),
      ...projectData,
      createdAt: now,
      updatedAt: now
    };

    const row = this.projectToProjectRow(project);
    
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, title, description, event_date, share_link, owner_id, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      row.id,
      row.title,
      row.description,
      row.event_date,
      row.share_link,
      row.owner_id,
      row.created_at,
      row.updated_at,
      row.status
    );

    return project;
  }

  findById(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as ProjectRow | undefined;
    
    return row ? this.projectRowToProject(row) : null;
  }

  findByShareLink(shareLink: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE share_link = ?');
    const row = stmt.get(shareLink) as ProjectRow | undefined;
    
    return row ? this.projectRowToProject(row) : null;
  }

  findByOwnerId(ownerId: string): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(ownerId) as ProjectRow[];
    
    return rows.map(row => this.projectRowToProject(row));
  }

  update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedProject = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    const row = this.projectToProjectRow(updatedProject);
    
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET title = ?, description = ?, event_date = ?, share_link = ?, 
          owner_id = ?, updated_at = ?, status = ?
      WHERE id = ?
    `);

    stmt.run(
      row.title,
      row.description,
      row.event_date,
      row.share_link,
      row.owner_id,
      row.updated_at,
      row.status,
      id
    );

    return updatedProject;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);
    
    return result.changes > 0;
  }

  findAll(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const rows = stmt.all() as ProjectRow[];
    
    return rows.map(row => this.projectRowToProject(row));
  }

  findOlderThan(date: Date): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE created_at < ? ORDER BY created_at DESC');
    const rows = stmt.all(date.toISOString()) as ProjectRow[];
    
    return rows.map(row => this.projectRowToProject(row));
  }
}