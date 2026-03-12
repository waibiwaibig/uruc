import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  getPackageRoot: vi.fn(() => '/tmp/package-root'),
  getPluginConfigPath: vi.fn(() => '/tmp/package-root/plugins.dev.json'),
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
  loadConfig: vi.fn(),
  discoverPlugins: vi.fn(),
  getStaleConfiguredPlugins: vi.fn(),
  getConfigPath: vi.fn(),
  isEnabled: vi.fn(),
  shouldAutoLoad: vi.fn(),
  loadPluginInstance: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
}));

vi.mock('../../runtime-paths.js', () => ({
  getPackageRoot: mocks.getPackageRoot,
  getPluginConfigPath: mocks.getPluginConfigPath,
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

vi.mock('../../core/plugin-system/discovery.js', () => ({
  PluginDiscovery: class {
    loadConfig = mocks.loadConfig;
    discoverPlugins = mocks.discoverPlugins;
    getStaleConfiguredPlugins = mocks.getStaleConfiguredPlugins;
    getConfigPath = mocks.getConfigPath;
    isEnabled = mocks.isEnabled;
    shouldAutoLoad = mocks.shouldAutoLoad;
    loadPluginInstance = mocks.loadPluginInstance;
  },
}));

import { runDoctorCommand } from '../commands/doctor.js';

describe('runDoctorCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseEnvFile.mockReturnValue({
      ADMIN_USERNAME: 'waibiwaibi',
      ADMIN_PASSWORD: 'secret',
      DB_PATH: './data/uruc.local.db',
      PLUGIN_CONFIG_PATH: './plugins.dev.json',
    });
    mocks.rootEnvExists.mockReturnValue(false);
    mocks.serverEnvExists.mockReturnValue(true);
    mocks.getBuildFreshness.mockReturnValue({
      stale: false,
      reason: 'build artifacts are current',
    });
    mocks.getRuntimeStatus.mockResolvedValue({
      dbPath: '/tmp/package-root/data.db',
      pluginConfigPath: '/tmp/package-root/plugins.dev.json',
      publicDir: '/tmp/package-root/public',
      siteUrl: 'http://127.0.0.1:3000',
      healthUrl: 'http://127.0.0.1:3000/api/health',
      wsUrl: 'ws://127.0.0.1:3001',
      mode: 'stopped',
      health: { ok: false, url: 'http://127.0.0.1:3000/api/health', error: 'fetch failed' },
    });
    mocks.adminExists.mockResolvedValue(true);
    mocks.resolveAdminPasswordState.mockResolvedValue('match');
    mocks.loadConfig.mockResolvedValue(undefined);
    mocks.discoverPlugins.mockResolvedValue(new Map([
      ['chess', { name: 'chess', version: '0.1.0', main: './index.js', absolutePath: '/tmp/package-root/plugins/chess' }],
    ]));
    mocks.getStaleConfiguredPlugins.mockReturnValue([]);
    mocks.getConfigPath.mockReturnValue('/tmp/package-root/plugins.dev.json');
    mocks.isEnabled.mockReturnValue(true);
    mocks.shouldAutoLoad.mockReturnValue(true);
    mocks.isSystemdActive.mockReturnValue(false);
    mocks.isSystemdInstalled.mockReturnValue(false);
  });

  it('reports plugin entrypoint load failures even when the runtime is offline', async () => {
    mocks.loadPluginInstance.mockRejectedValue(new Error('Cannot find module service.js'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDoctorCommand({ args: [], json: false });

    expect(mocks.printStatus).toHaveBeenCalledWith(
      'fail',
      expect.stringContaining('plugin-load: Failed to load enabled plugins: chess (Cannot find module service.js)'),
    );
    log.mockRestore();
  });

  it('surfaces runtime plugin diagnostics when health is available', async () => {
    mocks.loadPluginInstance.mockResolvedValue({ name: 'chess', version: '0.1.0', init: async () => undefined });
    mocks.getRuntimeStatus.mockResolvedValue({
      dbPath: '/tmp/package-root/data.db',
      pluginConfigPath: '/tmp/package-root/plugins.dev.json',
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
            { name: 'chess', state: 'failed', reason: 'init failed: boom' },
          ],
        },
      },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDoctorCommand({ args: [], json: false });

    expect(mocks.printStatus).toHaveBeenCalledWith(
      'fail',
      expect.stringContaining('plugin-runtime: Runtime plugin failures: chess (init failed: boom)'),
    );
    log.mockRestore();
  });
});
