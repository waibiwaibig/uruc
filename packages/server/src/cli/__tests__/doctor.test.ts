import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  getPackageRoot: vi.fn(() => '/tmp/package-root'),
  getCityConfigPath: vi.fn(() => '/tmp/package-root/uruc.city.json'),
  getCityLockPath: vi.fn(() => '/tmp/package-root/uruc.city.lock.json'),
  adminExists: vi.fn(),
  resolveAdminPasswordState: vi.fn(),
  getBuildFreshness: vi.fn(),
  loadServerEnv: vi.fn(),
  parseEnvFile: vi.fn(),
  rootEnvExists: vi.fn(),
  serverEnvExists: vi.fn(),
  isSystemdActive: vi.fn(),
  isSystemdInstalled: vi.fn(),
  getRuntimeStatus: vi.fn(),
  getRootEnvPath: vi.fn(() => '/tmp/root/.env'),
  getServerEnvPath: vi.fn(() => '/tmp/package-root/.env'),
  printStatus: vi.fn(),
  readCityConfig: vi.fn(),
  readCityLock: vi.fn(),
  inspectConfiguredPlugins: vi.fn(),
  summarizePluginChecks: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
}));

vi.mock('../../runtime-paths.js', () => ({
  getPackageRoot: mocks.getPackageRoot,
  getCityConfigPath: mocks.getCityConfigPath,
  getCityLockPath: mocks.getCityLockPath,
}));

vi.mock('../lib/admin.js', () => ({
  adminExists: mocks.adminExists,
  resolveAdminPasswordState: mocks.resolveAdminPasswordState,
}));

vi.mock('../lib/build.js', () => ({
  getBuildFreshness: mocks.getBuildFreshness,
}));

vi.mock('../lib/env.js', () => ({
  loadServerEnv: mocks.loadServerEnv,
  parseEnvFile: mocks.parseEnvFile,
  rootEnvExists: mocks.rootEnvExists,
  serverEnvExists: mocks.serverEnvExists,
}));

vi.mock('../lib/runtime.js', () => ({
  isSystemdActive: mocks.isSystemdActive,
  isSystemdInstalled: mocks.isSystemdInstalled,
  getRuntimeStatus: mocks.getRuntimeStatus,
}));

vi.mock('../lib/state.js', () => ({
  getRootEnvPath: mocks.getRootEnvPath,
  getServerEnvPath: mocks.getServerEnvPath,
}));

vi.mock('../lib/ui.js', () => ({
  printStatus: mocks.printStatus,
}));

vi.mock('../../core/plugin-platform/config.js', () => ({
  readCityConfig: mocks.readCityConfig,
  readCityLock: mocks.readCityLock,
}));

vi.mock('../../core/plugin-platform/inspection.js', () => ({
  inspectConfiguredPlugins: mocks.inspectConfiguredPlugins,
  summarizePluginChecks: mocks.summarizePluginChecks,
  aggregatePluginCheckLevel: (levels: Array<'ok' | 'warn' | 'fail'>) => (
    levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'ok'
  ),
}));

import { runDoctorCommand } from '../commands/doctor.js';

describe('runDoctorCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseEnvFile.mockReturnValue({
      ADMIN_USERNAME: 'waibiwaibi',
      ADMIN_PASSWORD: 'secret',
      DB_PATH: './data/uruc.local.db',
      CITY_CONFIG_PATH: './uruc.city.json',
    });
    mocks.rootEnvExists.mockReturnValue(false);
    mocks.serverEnvExists.mockReturnValue(true);
    mocks.getBuildFreshness.mockReturnValue({
      stale: false,
      reason: 'build artifacts are current',
    });
    mocks.getRuntimeStatus.mockResolvedValue({
      dbPath: '/tmp/package-root/data.db',
      cityConfigPath: '/tmp/package-root/uruc.city.json',
      publicDir: '/tmp/package-root/public',
      siteUrl: 'http://127.0.0.1:3000',
      healthUrl: 'http://127.0.0.1:3000/api/health',
      wsUrl: 'ws://127.0.0.1:3001',
      mode: 'stopped',
      health: { ok: false, url: 'http://127.0.0.1:3000/api/health', error: 'fetch failed' },
    });
    mocks.adminExists.mockResolvedValue(true);
    mocks.resolveAdminPasswordState.mockResolvedValue('match');
    mocks.readCityConfig.mockResolvedValue({
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      sources: [],
      plugins: {
        'uruc.chess': {
          pluginId: 'uruc.chess',
          devOverridePath: '../plugins/chess',
          enabled: true,
        },
      },
    });
    mocks.readCityLock.mockResolvedValue({
      apiVersion: 2,
      generatedAt: new Date().toISOString(),
      plugins: {},
    });
    mocks.inspectConfiguredPlugins.mockResolvedValue([
      {
        pluginId: 'uruc.chess',
        enabled: true,
        sourceType: 'package',
        packageName: '@uruc/plugin-chess',
        version: '0.1.0',
        status: 'fail',
        configStatus: 'fail',
        configDetail: 'Source local does not provide uruc.chess@0.1.0',
        lockStatus: 'warn',
        lockDetail: 'No lock entry is present for this plugin',
      },
    ]);
    mocks.summarizePluginChecks.mockReturnValue('1 plugin(s): 0 ok, 0 warn, 1 fail');
    mocks.isSystemdActive.mockReturnValue(false);
    mocks.isSystemdInstalled.mockReturnValue(false);
  });

  it('includes stable pluginChecks in JSON output', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDoctorCommand({ args: [], json: true });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('"pluginChecks"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"configDetail": "Source local does not provide uruc.chess@0.1.0"'));
    log.mockRestore();
  });

  it('surfaces runtime plugin diagnostics when health is available', async () => {
    mocks.getRuntimeStatus.mockResolvedValue({
      dbPath: '/tmp/package-root/data.db',
      cityConfigPath: '/tmp/package-root/uruc.city.json',
      publicDir: '/tmp/package-root/public',
      siteUrl: 'http://127.0.0.1:3000',
      healthUrl: 'http://127.0.0.1:3000/api/health',
      wsUrl: 'ws://127.0.0.1:3001',
      mode: 'background',
      health: {
        ok: true,
        url: 'http://127.0.0.1:3000/api/health',
        statusCode: 200,
        body: {
          pluginDiagnostics: [
            { pluginId: 'uruc.chess', state: 'failed', lastError: 'init failed: boom' },
          ],
        },
      },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDoctorCommand({ args: [], json: false });

    expect(mocks.printStatus).toHaveBeenCalledWith(
      'fail',
      expect.stringContaining('plugin-runtime: Runtime plugin failures: uruc.chess (init failed: boom)'),
    );
    log.mockRestore();
  });
});
