import { mkdirSync, rmSync } from 'fs';
import path from 'path';

import bcrypt from 'bcryptjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb, schema } from '../../core/database/index.js';
import { getPackageRoot } from '../../runtime-paths.js';
import { adminExists, getUserRole, resolveAdminPasswordState } from '../lib/admin.js';

const packageRoot = getPackageRoot();
const repoRoot = path.resolve(packageRoot, '..', '..');
const originalCwd = process.cwd();
const relativeDbPath = './data/admin-paths.test.db';
const absoluteDbPath = path.join(packageRoot, 'data', 'admin-paths.test.db');

describe('admin db path resolution', () => {
  beforeEach(() => {
    mkdirSync(path.dirname(absoluteDbPath), { recursive: true });
    cleanupDb();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupDb();
  });

  it('resolves relative db paths from packages/server instead of process cwd', async () => {
    const db = createDb(absoluteDbPath);
    const password = 'secret-pass';
    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(schema.users).values({
      id: 'admin-1',
      username: 'existing-admin',
      email: 'admin@example.com',
      passwordHash,
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
    });
    (db as { $client?: { close?: () => void } }).$client?.close?.();

    process.chdir(repoRoot);

    await expect(adminExists('existing-admin', relativeDbPath)).resolves.toBe(true);
    await expect(getUserRole('existing-admin', relativeDbPath)).resolves.toBe('admin');
    await expect(resolveAdminPasswordState('existing-admin', password, relativeDbPath)).resolves.toBe('match');
  });
});

function cleanupDb(): void {
  for (const suffix of ['', '-shm', '-wal']) {
    rmSync(`${absoluteDbPath}${suffix}`, { force: true });
  }
}
