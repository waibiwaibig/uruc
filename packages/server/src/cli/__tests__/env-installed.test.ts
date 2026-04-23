import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefaultDbRelativePath: vi.fn(() => './data/uruc.local.db'),
  getPackageRoot: vi.fn(),
  isWorkspaceLayout: vi.fn(() => false),
  getRepoRoot: vi.fn(),
  getRootEnvPath: vi.fn(),
  getServerEnvPath: vi.fn(),
}));

vi.mock('../../runtime-paths.js', () => ({
  getDefaultDbRelativePath: mocks.getDefaultDbRelativePath,
  getPackageRoot: mocks.getPackageRoot,
  isWorkspaceLayout: mocks.isWorkspaceLayout,
}));

vi.mock('../lib/state.js', () => ({
  getRepoRoot: mocks.getRepoRoot,
  getRootEnvPath: mocks.getRootEnvPath,
  getServerEnvPath: mocks.getServerEnvPath,
}));

let tempRoot: string | null = null;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getDefaultDbRelativePath.mockReturnValue('./data/uruc.local.db');
  mocks.isWorkspaceLayout.mockReturnValue(false);
});

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe('installed env defaults', () => {
  it('replaces the workspace public dir placeholder with the packaged public directory', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-env-installed-'));
    const packageRoot = path.join(tempRoot, 'package-root');
    const serverEnvPath = path.join(tempRoot, '.env');
    const rootEnvPath = path.join(tempRoot, 'ignored-root.env');

    mocks.getPackageRoot.mockReturnValue(packageRoot);
    mocks.getRepoRoot.mockReturnValue(tempRoot);
    mocks.getRootEnvPath.mockReturnValue(rootEnvPath);
    mocks.getServerEnvPath.mockReturnValue(serverEnvPath);

    await writeFile(serverEnvPath, 'PUBLIC_DIR=../web/dist\n', 'utf8');

    const env = await import('../lib/env.js');
    const defaults = env.currentConfigureDefaults('local', 'test', '127.0.0.1', '3000', '3001', 'http');

    expect(defaults.publicDir).toBe(path.join(packageRoot, 'public'));
  });
});
