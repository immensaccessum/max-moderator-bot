import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrations.js';

const log = createLogger('db');

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database is not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): void {
  if (db) return;

  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  runMigrations(db);

  log.info('database ready', { path: config.dbPath });
}
