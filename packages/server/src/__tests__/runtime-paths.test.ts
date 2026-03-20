import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  DB_PATH: process.env.DB_PATH,
  URUC_PURPOSE: process.env.URUC_PURPOSE,
};

afterEach(() => {
  vi.resetModules();
  process.env.DB_PATH = originalEnv.DB_PATH;
  process.env.URUC_PURPOSE = originalEnv.URUC_PURPOSE;
});

describe('runtime DB defaults', () => {
  it('defaults to the local database path when no DB_PATH is configured', async () => {
    delete process.env.DB_PATH;
    delete process.env.URUC_PURPOSE;

    const runtimePaths = await import('../runtime-paths.js');

    expect(runtimePaths.getDbPath()).toBe(path.join(runtimePaths.getPackageRoot(), 'data', 'uruc.local.db'));
  });

  it('defaults to the production database path when URUC_PURPOSE=production', async () => {
    delete process.env.DB_PATH;
    process.env.URUC_PURPOSE = 'production';

    const runtimePaths = await import('../runtime-paths.js');

    expect(runtimePaths.getDbPath()).toBe(path.join(runtimePaths.getPackageRoot(), 'data', 'uruc.prod.db'));
  });
});
