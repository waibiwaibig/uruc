import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseEnvFile: vi.fn(),
  getRuntimeStatus: vi.fn(),
  restartRuntime: vi.fn(),
  ensureFreshBuildIfNeeded: vi.fn(),
  prepareCityRuntime: vi.fn(),
  getPackageRoot: vi.fn(),
  getCityConfigPath: vi.fn(),
  getCityLockPath: vi.fn(),
  getPluginStoreDir: vi.fn(),
  resolveFromRuntimeHome: vi.fn(),
}));

vi.mock('../lib/env.js', () => ({
  parseEnvFile: mocks.parseEnvFile,
}));

vi.mock('../lib/runtime.js', () => ({
  getRuntimeStatus: mocks.getRuntimeStatus,
  restartRuntime: mocks.restartRuntime,
}));

vi.mock('../lib/city.js', () => ({
  prepareCityRuntime: mocks.prepareCityRuntime,
}));

vi.mock('../commands/build.js', () => ({
  ensureFreshBuildIfNeeded: mocks.ensureFreshBuildIfNeeded,
}));

vi.mock('../../runtime-paths.js', () => ({
  getPackageRoot: mocks.getPackageRoot,
  getCityConfigPath: mocks.getCityConfigPath,
  getCityLockPath: mocks.getCityLockPath,
  getPluginStoreDir: mocks.getPluginStoreDir,
  resolveFromRuntimeHome: mocks.resolveFromRuntimeHome,
}));

import { runRestartCommand } from '../commands/restart.js';

let tempRoot: string | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRuntimeStatus.mockResolvedValue({ mode: 'systemd' });
  mocks.restartRuntime.mockResolvedValue(undefined);
  mocks.ensureFreshBuildIfNeeded.mockResolvedValue(false);
  mocks.prepareCityRuntime.mockResolvedValue('synced');
  mocks.parseEnvFile.mockReturnValue({ CITY_CONFIG_PATH: './custom.city.json' });
});

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe('installed restart path resolution', () => {
  it('resolves relative city config paths from the runtime home instead of the package root', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-restart-installed-'));
    const runtimeHome = path.join(tempRoot, 'runtime-home');
    const packageRoot = path.join(tempRoot, 'package-root');
    const customCityPath = path.join(runtimeHome, 'custom.city.json');

    await mkdir(runtimeHome, { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await writeFile(customCityPath, '{}\n', 'utf8');

    mocks.getPackageRoot.mockReturnValue(packageRoot);
    mocks.getCityConfigPath.mockReturnValue(path.join(runtimeHome, 'uruc.city.json'));
    mocks.getCityLockPath.mockReturnValue(path.join(runtimeHome, 'uruc.city.lock.json'));
    mocks.getPluginStoreDir.mockReturnValue(path.join(runtimeHome, '.uruc', 'plugins'));
    mocks.resolveFromRuntimeHome.mockImplementation((targetPath: string) => path.resolve(runtimeHome, targetPath));

    await runRestartCommand({ args: [], json: false });

    expect(mocks.prepareCityRuntime).toHaveBeenCalledWith(expect.objectContaining({
      configPath: customCityPath,
      autoCreateDefault: false,
    }));
  });
});
