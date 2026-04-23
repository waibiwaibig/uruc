import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  DB_PATH: process.env.DB_PATH,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  URUC_PURPOSE: process.env.URUC_PURPOSE,
  URUC_HOME: process.env.URUC_HOME,
  XDG_DATA_HOME: process.env.XDG_DATA_HOME,
};

function restoreEnvValue(key: keyof typeof originalEnv): void {
  const value = originalEnv[key];
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

afterEach(() => {
  vi.resetModules();
  restoreEnvValue('DB_PATH');
  restoreEnvValue('LOCALAPPDATA');
  restoreEnvValue('URUC_PURPOSE');
  restoreEnvValue('URUC_HOME');
  restoreEnvValue('XDG_DATA_HOME');
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

describe('runtime home defaults', () => {
  it('uses URUC_HOME for runtime-managed files', async () => {
    process.env.URUC_HOME = '/tmp/uruc-home';
    delete process.env.DB_PATH;
    delete process.env.URUC_PURPOSE;

    const runtimePaths = await import('../runtime-paths.js');

    expect(runtimePaths.getRuntimeHome()).toBe('/tmp/uruc-home');
    expect(runtimePaths.getEnvPath()).toBe('/tmp/uruc-home/.env');
    expect(runtimePaths.getDbPath()).toBe('/tmp/uruc-home/data/uruc.local.db');
    expect(runtimePaths.getCityConfigPath()).toBe('/tmp/uruc-home/uruc.city.json');
    expect(runtimePaths.getCityLockPath()).toBe('/tmp/uruc-home/uruc.city.lock.json');
    expect(runtimePaths.getUploadsDir()).toBe('/tmp/uruc-home/uploads');
    expect(runtimePaths.getPluginStoreDir()).toBe('/tmp/uruc-home/.uruc/plugins');
  });

  it('defaults installed mode paths under the user data directory when no workspace layout is present', async () => {
    delete process.env.DB_PATH;
    delete process.env.LOCALAPPDATA;
    delete process.env.URUC_HOME;
    delete process.env.URUC_PURPOSE;
    process.env.XDG_DATA_HOME = '/tmp/xdg-data-home';

    const packageRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
    );
    const workspaceMarkerPaths = new Set([
      path.resolve(packageRoot, '..', 'web', 'package.json'),
      path.resolve(packageRoot, '..', 'plugin-sdk', 'package.json'),
      path.resolve(packageRoot, '..', '..', 'package.json'),
    ]);

    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        existsSync: vi.fn((targetPath: import('fs').PathLike) => {
          const normalized = typeof targetPath === 'string' ? path.resolve(targetPath) : String(targetPath);
          if (workspaceMarkerPaths.has(normalized)) {
            return false;
          }
          return actual.existsSync(targetPath);
        }),
      };
    });

    const runtimePaths = await import('../runtime-paths.js');

    expect(runtimePaths.isWorkspaceLayout()).toBe(false);
    const expectedRuntimeHome = process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'uruc')
      : '/tmp/xdg-data-home/uruc';

    expect(runtimePaths.getRuntimeHome()).toBe(expectedRuntimeHome);
    expect(runtimePaths.getEnvPath()).toBe(path.join(expectedRuntimeHome, '.env'));
    expect(runtimePaths.getDbPath()).toBe(path.join(expectedRuntimeHome, 'data', 'uruc.local.db'));
    expect(runtimePaths.getPublicDir()).toBe(path.join(runtimePaths.getPackageRoot(), 'public'));

    vi.doUnmock('fs');
  });
});
