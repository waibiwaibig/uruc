/**
 * Core Database — SQLite initialization.
 *
 * This repo currently treats test deployments as clean-db rebuilds:
 * we create the current schema shape and do not apply in-place migrations for older files.
 * Plugin tables are created by each plugin in its init().
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schema.js';
import { getDbPath } from '../../runtime-paths.js';

export function createDb(dbPath: string = getDbPath()) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  // === Core tables ===

  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    email TEXT UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0,
    verification_code TEXT, verification_code_expires_at INTEGER,
    role TEXT NOT NULL DEFAULT 'user',
    banned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL, provider_id TEXT NOT NULL,
    email TEXT NOT NULL, created_at INTEGER NOT NULL,
    UNIQUE(provider, provider_id)
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
    is_shadow INTEGER NOT NULL DEFAULT 0,
    trust_mode TEXT NOT NULL DEFAULT 'confirm',
    allowed_locations TEXT NOT NULL DEFAULT '[]',
    is_online INTEGER NOT NULL DEFAULT 0,
    description TEXT, avatar_path TEXT,
    frozen INTEGER NOT NULL DEFAULT 0, searchable INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS action_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, agent_id TEXT NOT NULL,
    location_id TEXT, action_type TEXT NOT NULL, payload TEXT,
    result TEXT NOT NULL, detail TEXT, created_at INTEGER NOT NULL
  )`);

  // Core indexes
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS agents_shadow_unique ON agents(user_id) WHERE is_shadow = 1`);

  return db;
}

export type UrucDb = ReturnType<typeof createDb>;
export { schema };
