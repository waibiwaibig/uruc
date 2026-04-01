import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rootEnvExists: vi.fn(() => false),
  serverEnvExists: vi.fn(() => true),
  parseEnvFile: vi.fn(),
  prepareCityRuntime: vi.fn(),
  ensureFreshBuildIfNeeded: vi.fn(),
  assertConfiguredPortsAvailable: vi.fn(),
  getRuntimeStatus: vi.fn(),
  startBackground: vi.fn(),
  startForeground: vi.fn(),
  hasFlag: vi.fn((args: string[], ...flags: string[]) => args.some((arg) => flags.includes(arg))),
  runConfigureCommand: vi.fn(),
  getPackageRoot: vi.fn(),
  getCityConfigPath: vi.fn(),
  getCityLockPath: vi.fn(),
  getPluginStoreDir: vi.fn(),
  resolveFromRuntimeHome: vi.fn(),
  getRootEnvPath: vi.fn(),
  getServerEnvPath: vi.fn(),
}));

vi.mock('../lib/env.js', () => ({
  rootEnvExists: mocks.rootEnvExists,
  serverEnvExists: mocks.serverEnvExists,
  parseEnvFile: mocks.parseEnvFile,
}));

vi.mock('../lib/city.js', () => ({
  prepareCityRuntime: mocks.prepareCityRuntime,
}));

vi.mock('../lib/runtime.js', () => ({
  assertConfiguredPortsAvailable: mocks.assertConfiguredPortsAvailable,
  getRuntimeStatus: mocks.getRuntimeStatus,
  startBackground: mocks.startBackground,
  startForeground: mocks.startForeground,
}));

vi.mock('../commands/build.js', () => ({
  ensureFreshBuildIfNeeded: mocks.ensureFreshBuildIfNeeded,
}));

vi.mock('../commands/configure.js', () => ({
  runConfigureCommand: mocks.runConfigureCommand,
}));

vi.mock('../lib/argv.js', () => ({
  hasFlag: mocks.hasFlag,
}));

vi.mock('../../runtime-paths.js', () => ({
  getPackageRoot: mocks.getPackageRoot,
  getCityConfigPath: mocks.getCityConfigPath,
  getCityLockPath: mocks.getCityLockPath,
  getPluginStoreDir: mocks.getPluginStoreDir,
  resolveFromRuntimeHome: mocks.resolveFromRuntimeHome,
}));

vi.mock('../lib/state.js', () => ({
  getRootEnvPath: mocks.getRootEnvPath,
  getServerEnvPath: mocks.getServerEnvPath,
}));

import { runStartCommand } from '../commands/start.js';

let tempRoot: string | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseEnvFile.mockReturnValue({
    CITY_CONFIG_PATH: './custom.city.json',
    CITY_LOCK_PATH: './custom.city.lock.json',
    PLUGIN_STORE_DIR: './custom-plugins',
  });
  mocks.prepareCityRuntime.mockResolvedValue('synced');
  mocks.ensureFreshBuildIfNeeded.mockResolvedValue(false);
  mocks.assertConfiguredPortsAvailable.mockResolvedValue(undefined);
  mocks.getRuntimeStatus.mockResolvedValue({ mode: 'stopped' });
  mocks.startBackground.mockResolvedValue('background');
  mocks.startForeground.mockResolvedValue(undefined);
});

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe('installed start path resolution', () => {
  it('resolves relative lock and plugin store paths from the runtime home', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-start-installed-'));
    const runtimeHome = path.join(tempRoot, 'runtime-home');
    const packageRoot = path.join(tempRoot, 'package-root');
    const customCityPath = path.join(runtimeHome, 'custom.city.json');
    const customLockPath = path.join(runtimeHome, 'custom.city.lock.json');
    const customPluginStoreDir = path.join(runtimeHome, 'custom-plugins');

    await mkdir(runtimeHome, { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await writeFile(customCityPath, '{}\n', 'utf8');

    mocks.getPackageRoot.mockReturnValue(packageRoot);
    mocks.getCityConfigPath.mockReturnValue(path.join(runtimeHome, 'uruc.city.json'));
    mocks.getCityLockPath.mockReturnValue(path.join(runtimeHome, 'uruc.city.lock.json'));
    mocks.getPluginStoreDir.mockReturnValue(path.join(runtimeHome, '.uruc', 'plugins'));
    mocks.resolveFromRuntimeHome.mockImplementation((targetPath: string) => path.resolve(runtimeHome, targetPath));

    await runStartCommand({ args: [], json: false });

    expect(mocks.prepareCityRuntime).toHaveBeenCalledWith(expect.objectContaining({
      configPath: customCityPath,
      lockPath: customLockPath,
      pluginStoreDir: customPluginStoreDir,
      autoCreateDefault: false,
    }));
  });
});
