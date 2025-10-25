import { getDatabase } from './database';

interface Migration {
  version: number;
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_initial_tables',
    up: `
      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        event_date TEXT NOT NULL,
        share_link TEXT UNIQUE NOT NULL,
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'processing', 'completed'))
      );

      -- Videos table
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        uploader_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        duration REAL NOT NULL,
        format TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        file_path TEXT NOT NULL,
        quality_score REAL,
        sync_offset REAL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );

      -- Video metadata table
      CREATE TABLE IF NOT EXISTS video_metadata (
        video_id TEXT PRIMARY KEY,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        frame_rate REAL NOT NULL,
        bitrate INTEGER NOT NULL,
        codec TEXT NOT NULL,
        audio_channels INTEGER NOT NULL,
        audio_sample_rate INTEGER NOT NULL,
        recording_timestamp TEXT,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
      );

      -- Processing jobs table
      CREATE TABLE IF NOT EXISTS processing_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('sync', 'quality_analysis', 'stitching')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        progress INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        error TEXT,
        result TEXT,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_videos_project_id ON videos (project_id);
      CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON processing_jobs (project_id);
      CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs (status);
      CREATE INDEX IF NOT EXISTS idx_projects_share_link ON projects (share_link);
    `
  }
];

export function runMigrations(): void {
  const db = getDatabase();
  
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Get current migration version
  const currentVersion = db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null };
  const currentVersionNumber = currentVersion?.version || 0;

  console.log(`Current database version: ${currentVersionNumber}`);

  // Run pending migrations
  const pendingMigrations = migrations.filter(m => m.version > currentVersionNumber);
  
  if (pendingMigrations.length === 0) {
    console.log('No pending migrations');
    return;
  }

  console.log(`Running ${pendingMigrations.length} pending migrations...`);

  const insertMigration = db.prepare(`
    INSERT INTO migrations (version, name, applied_at) 
    VALUES (?, ?, ?)
  `);

  for (const migration of pendingMigrations) {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    
    try {
      db.exec(migration.up);
      insertMigration.run(migration.version, migration.name, new Date().toISOString());
      console.log(`✓ Migration ${migration.version} applied successfully`);
    } catch (error) {
      console.error(`✗ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  console.log('All migrations completed successfully');
}