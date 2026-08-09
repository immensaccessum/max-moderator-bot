import type Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db');

type Migration = {
  version: number;
  sql: string;
};

const MIGRATIONS: Migration[] = [
  { version: 1, sql: `ALTER TABLE silence_settings ADD COLUMN open_suffix TEXT` },
  { version: 2, sql: `ALTER TABLE silence_settings ADD COLUMN closed_suffix TEXT` },
  { version: 3, sql: `ALTER TABLE silence_settings ADD COLUMN duration_presets TEXT` },
  { version: 4, sql: `ALTER TABLE silence_settings ADD COLUMN schedule_enabled INTEGER NOT NULL DEFAULT 0` },
  { version: 5, sql: `ALTER TABLE silence_settings ADD COLUMN schedule_start_minutes INTEGER NOT NULL DEFAULT 1260` },
  { version: 6, sql: `ALTER TABLE silence_settings ADD COLUMN schedule_end_minutes INTEGER NOT NULL DEFAULT 540` },
  { version: 7, sql: `ALTER TABLE silence_settings ADD COLUMN schedule_timezone TEXT` },
  { version: 8, sql: `ALTER TABLE silence_settings ADD COLUMN schedule_last_in_window INTEGER` },
  { version: 9, sql: `ALTER TABLE silence_settings ADD COLUMN status_message_id TEXT` },
  { version: 10, sql: `ALTER TABLE silence_settings ADD COLUMN schedule_weekends_enabled INTEGER NOT NULL DEFAULT 0` },
  {
    version: 11,
    sql: `CREATE TABLE IF NOT EXISTS triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      key_phrase TEXT NOT NULL,
      response_text TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'contains',
      case_sensitive INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
    )`,
  },
  { version: 12, sql: `CREATE INDEX IF NOT EXISTS idx_triggers_chat_id ON triggers(chat_id)` },
  {
    version: 13,
    sql: `CREATE TABLE IF NOT EXISTS autopost_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      title TEXT,
      message_text TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      weekday INTEGER,
      hour INTEGER,
      minute INTEGER,
      interval_minutes INTEGER,
      timezone TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_posted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
    )`,
  },
  { version: 14, sql: `CREATE INDEX IF NOT EXISTS idx_autopost_chat_id ON autopost_schedules(chat_id)` },
  {
    version: 15,
    sql: `CREATE TABLE IF NOT EXISTS deletion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      message_id TEXT,
      user_id INTEGER,
      user_label TEXT,
      message_text TEXT,
      source TEXT NOT NULL,
      source_detail TEXT,
      event_type TEXT NOT NULL DEFAULT 'message_created',
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      deleted_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
    )`,
  },
  { version: 16, sql: `CREATE INDEX IF NOT EXISTS idx_deletion_logs_chat_deleted ON deletion_logs(chat_id, deleted_at)` },
  { version: 17, sql: `ALTER TABLE triggers ADD COLUMN action TEXT NOT NULL DEFAULT 'reply'` },
  { version: 18, sql: `ALTER TABLE triggers ADD COLUMN auto_delete_reply INTEGER NOT NULL DEFAULT 0` },
  {
    version: 19,
    sql: `CREATE TABLE IF NOT EXISTS scheduled_deletions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      message_id TEXT NOT NULL,
      message_text TEXT,
      source TEXT NOT NULL,
      source_detail TEXT,
      due_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
    )`,
  },
  { version: 20, sql: `CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_due ON scheduled_deletions(due_at)` },
];

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);
}

function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db.prepare(`SELECT version FROM schema_migrations`).all() as { version: number }[];
  return new Set(rows.map((row) => row.version));
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return Boolean(row);
}

function bootstrapExistingDatabase(db: Database.Database): void {
  const applied = getAppliedVersions(db);
  if (applied.size > 0) return;
  if (!tableExists(db, 'chats')) return;

  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
  );

  const hasScheduledDeletions = tableExists(db, 'scheduled_deletions');
  const targetVersion = hasScheduledDeletions ? LATEST_VERSION : 18;

  const tx = db.transaction(() => {
    for (let version = 1; version <= targetVersion; version += 1) {
      insert.run(version, now);
    }
  });
  tx();

  log.info('legacy schema bootstrapped', { targetVersion });
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);
  bootstrapExistingDatabase(db);

  const applied = getAppliedVersions(db);
  let migrated = 0;

  const markApplied = db.prepare(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    const apply = db.transaction(() => {
      db.exec(migration.sql);
      markApplied.run(migration.version, Date.now());
    });

    try {
      apply();
      migrated += 1;
      log.info('migration applied', { version: migration.version });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate column')) {
        markApplied.run(migration.version, Date.now());
        log.warn('migration skipped as already present', { version: migration.version });
        continue;
      }
      log.error('migration failed', { err, version: migration.version });
      throw err;
    }
  }

  log.info('migrations complete', {
    migrated,
    latest: LATEST_VERSION,
    applied: getAppliedVersions(db).size,
  });
}
