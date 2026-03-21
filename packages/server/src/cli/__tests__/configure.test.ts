import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  adminExists: vi.fn(),
  createAdmin: vi.fn(),
  findUserByEmail: vi.fn(),
  resetAdminPassword: vi.fn(),
  resolveAdminPasswordState: vi.fn(),
  hasFlag: vi.fn((args: string[], ...flags: string[]) => args.some((arg) => flags.includes(arg))),
  readOption: vi.fn((args: string[], ...flags: string[]) => {
    for (let index = 0; index < args.length; index += 1) {
      if (flags.includes(args[index]!)) return args[index + 1];
    }
    return undefined;
  }),
  ensureCityConfig: vi.fn(),
  syncCityLock: vi.fn(),
  getBundledPluginPresetState: vi.fn((preset: string, current?: Record<string, boolean>) => {
    if (preset === 'empty-core') {
      return {
        'uruc.social': false,
      };
    }
    if (preset === 'custom') {
      return {
        'uruc.social': current?.['uruc.social'] ?? true,
      };
    }
    return {
      'uruc.social': true,
    };
  }),
  inferPluginPreset: vi.fn(() => 'custom'),
  detectBundledPluginState: vi.fn((config: any) => ({
    'uruc.social': config.plugins?.['uruc.social']?.enabled ?? false,
  })),
  rebaseCityConfigPaths: vi.fn((config: any) => config),
  parseEnvFile: vi.fn(() => ({})),
  ensureServerEnvFile: vi.fn(),
  getCurrentLanguage: vi.fn(() => 'en'),
  inferReachability: vi.fn(() => 'local'),
  inferSiteProtocol: vi.fn(() => 'http'),
  currentConfigureDefaults: vi.fn(),
  configureAnswersToEnv: vi.fn((answers: any) => ({ CITY_CONFIG_PATH: answers.cityConfigPath })),
  writeEnvFile: vi.fn(),
  buildBaseUrl: vi.fn((protocol: string, host: string, port: string) => `${protocol}://${host}:${port}`),
  defaultConfig: vi.fn((reachability: string, purpose: string, publicHost: string, httpPort: string, wsPort: string, siteProtocol: string) => ({
    mode: 'quickstart',
    section: 'all',
    bindHost: reachability === 'local' ? '127.0.0.1' : '0.0.0.0',
    siteProtocol,
    adminUsername: 'admin',
    adminPassword: '',
    adminEmail: 'admin@example.com',
    allowRegister: reachability !== 'local',
    noindex: purpose === 'test',
    sitePassword: '',
    dbPath: './data/uruc.local.db',
    cityConfigPath: './uruc.city.json',
    allowedOrigins: `http://${publicHost}:${httpPort}`,
    jwtSecret: 'secret',
    baseUrl: `${siteProtocol}://${publicHost}:${httpPort}`,
    publicDir: '../human-web/dist',
    uploadsDir: './uploads',
    resendApiKey: '',
    fromEmail: 'noreply@example.com',
    googleClientId: '',
    googleClientSecret: '',
    githubClientId: '',
    githubClientSecret: '',
    pluginPreset: 'social-only',
    pluginStoreDir: '.uruc/plugins',
    bundledPluginState: {
      'uruc.social': true,
    },
  })),
  defaultBindHost: vi.fn((reachability: string) => (reachability === 'local' ? '127.0.0.1' : '0.0.0.0')),
  rememberConfiguration: vi.fn(),
  getConfigureActions: vi.fn(() => ['write env', 'sync city', 'sync lock']),
  getConfigureSummaryLines: vi.fn(() => Array.from({ length: 16 }, (_, index) => `line-${index}`)),
  readCliMeta: vi.fn(() => ({ language: 'en' })),
  promptChoice: vi.fn(),
  promptConfirm: vi.fn(),
  promptInput: vi.fn(),
  printBanner: vi.fn(),
  printSection: vi.fn(),
  printStatus: vi.fn(),
  getCityLockPath: vi.fn(() => '/tmp/test-city.lock.json'),
  getPackageRoot: vi.fn(() => '/tmp/test-package-root'),
  buildPublicWsUrl: vi.fn((siteUrl: string, wsPort: string) => `${siteUrl.replace('http', 'ws')}:${wsPort}`),
  getRuntimeStatus: vi.fn(),
  isSystemdInstalled: vi.fn(),
  runStartCommand: vi.fn(),
  runRestartCommand: vi.fn(),
}));

vi.mock('../lib/admin.js', () => ({
  getUserRole: mocks.getUserRole,
  adminExists: mocks.adminExists,
  createAdmin: mocks.createAdmin,
  findUserByEmail: mocks.findUserByEmail,
  resetAdminPassword: mocks.resetAdminPassword,
  resolveAdminPasswordState: mocks.resolveAdminPasswordState,
}));

vi.mock('../lib/argv.js', () => ({
  hasFlag: mocks.hasFlag,
  readOption: mocks.readOption,
}));

vi.mock('../lib/city.js', () => ({
  DEFAULT_PLUGIN_PRESET: 'social-only',
  DEFAULT_PLUGIN_STORE_DIR: '.uruc/plugins',
  ensureCityConfig: mocks.ensureCityConfig,
  syncCityLock: mocks.syncCityLock,
  getBundledPluginPresetState: mocks.getBundledPluginPresetState,
  inferPluginPreset: mocks.inferPluginPreset,
  detectBundledPluginState: mocks.detectBundledPluginState,
  rebaseCityConfigPaths: mocks.rebaseCityConfigPaths,
}));

vi.mock('../lib/env.js', () => ({
  parseEnvFile: mocks.parseEnvFile,
  ensureServerEnvFile: mocks.ensureServerEnvFile,
  getCurrentLanguage: mocks.getCurrentLanguage,
  inferReachability: mocks.inferReachability,
  inferSiteProtocol: mocks.inferSiteProtocol,
  currentConfigureDefaults: mocks.currentConfigureDefaults,
  configureAnswersToEnv: mocks.configureAnswersToEnv,
  writeEnvFile: mocks.writeEnvFile,
  buildBaseUrl: mocks.buildBaseUrl,
  defaultConfig: mocks.defaultConfig,
  defaultBindHost: mocks.defaultBindHost,
  rootEnvExists: vi.fn(() => false),
}));

vi.mock('../lib/configure.js', () => ({
  rememberConfiguration: mocks.rememberConfiguration,
  getConfigureActions: mocks.getConfigureActions,
  getConfigureSummaryLines: mocks.getConfigureSummaryLines,
}));

vi.mock('../lib/state.js', () => ({
  readCliMeta: mocks.readCliMeta,
}));

vi.mock('../lib/ui.js', () => ({
  promptChoice: mocks.promptChoice,
  promptConfirm: mocks.promptConfirm,
  promptInput: mocks.promptInput,
  printBanner: mocks.printBanner,
  printSection: mocks.printSection,
  printStatus: mocks.printStatus,
}));

vi.mock('../../runtime-paths.js', () => ({
  getCityLockPath: mocks.getCityLockPath,
  getPackageRoot: mocks.getPackageRoot,
}));

vi.mock('../lib/network.js', () => ({
  buildPublicWsUrl: mocks.buildPublicWsUrl,
}));

vi.mock('../lib/runtime.js', () => ({
  getRuntimeStatus: mocks.getRuntimeStatus,
  isSystemdInstalled: mocks.isSystemdInstalled,
}));

vi.mock('../commands/start.js', () => ({
  runStartCommand: mocks.runStartCommand,
}));

vi.mock('../commands/restart.js', () => ({
  runRestartCommand: mocks.runRestartCommand,
}));

const tempDirs: string[] = [];

function makeCurrentDefaults(cityConfigPath: string) {
  return {
    lang: 'en',
    mode: 'quickstart',
    section: 'all',
    reachability: 'local',
    purpose: 'test',
    bindHost: '127.0.0.1',
    publicHost: '127.0.0.1',
    siteProtocol: 'http',
    httpPort: '3000',
    wsPort: '3001',
    adminUsername: 'admin',
    adminPassword: '',
    adminEmail: 'admin@example.com',
    allowRegister: false,
    noindex: true,
    sitePassword: '',
    dbPath: './data/uruc.local.db',
    cityConfigPath,
    allowedOrigins: 'http://127.0.0.1:3000',
    jwtSecret: 'secret',
    baseUrl: 'http://127.0.0.1:3000',
    publicDir: '../human-web/dist',
    uploadsDir: './uploads',
    resendApiKey: '',
    fromEmail: 'noreply@example.com',
    googleClientId: '',
    googleClientSecret: '',
    githubClientId: '',
    githubClientSecret: '',
    pluginPreset: 'social-only',
    pluginStoreDir: '.uruc/plugins',
    bundledPluginState: {
      'uruc.social': true,
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getUserRole.mockResolvedValue(null);
  mocks.adminExists.mockResolvedValue(false);
  mocks.createAdmin.mockResolvedValue({ created: true });
  mocks.findUserByEmail.mockResolvedValue(null);
  mocks.resolveAdminPasswordState.mockResolvedValue('match');
  mocks.promptConfirm.mockResolvedValue(false);
  mocks.ensureCityConfig.mockResolvedValue(undefined);
  mocks.syncCityLock.mockResolvedValue(undefined);
  mocks.getRuntimeStatus.mockResolvedValue({ mode: 'stopped' });
  mocks.isSystemdInstalled.mockReturnValue(false);
  mocks.runStartCommand.mockResolvedValue(undefined);
  mocks.runRestartCommand.mockResolvedValue(undefined);
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('configure command', () => {
  it('quickstart writes env and prepares city config plus lock in one pass', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('quickstart')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('social-only')
      .mockResolvedValueOnce('save');
    mocks.promptInput
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('secret')
      .mockResolvedValueOnce('admin@example.com');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: [], json: false });

    expect(mocks.writeEnvFile).toHaveBeenCalledTimes(1);
    expect(mocks.ensureCityConfig).toHaveBeenCalledWith(expect.objectContaining({
      configPath: cityConfigPath,
      preset: 'social-only',
      pluginStoreDir: '.uruc/plugins',
      createIfMissing: true,
      mutateExisting: true,
    }));
    expect(mocks.syncCityLock).toHaveBeenCalledWith(expect.objectContaining({
      configPath: cityConfigPath,
      lockPath: '/tmp/test-city.lock.json',
    }));
  });

  it('advanced runtime section keeps existing bundled plugin state intact', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    await mkdir(path.dirname(cityConfigPath), { recursive: true });
    await writeFile(cityConfigPath, JSON.stringify({
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      pluginStoreDir: '.uruc/plugins',
      sources: [],
      plugins: {
        'uruc.social': { pluginId: 'uruc.social', enabled: true, devOverridePath: '../plugins/social' },
      },
    }, null, 2), 'utf8');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('save');
    mocks.promptInput
      .mockResolvedValueOnce('3000')
      .mockResolvedValueOnce('3001')
      .mockResolvedValueOnce('../human-web/dist')
      .mockResolvedValueOnce('./uploads');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--advanced', '--section', 'runtime'], json: false });

    expect(mocks.ensureCityConfig).toHaveBeenCalledWith(expect.objectContaining({
      configPath: cityConfigPath,
      pluginState: {
        'uruc.social': true,
      },
    }));
  });

  it('quickstart preserves existing path customizations for env and city storage', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'custom.city.json');
    const customDbPath = '/tmp/custom-uruc.db';
    const customPublicDir = '/tmp/custom-public';
    const customUploadsDir = '/tmp/custom-uploads';
    await mkdir(path.dirname(cityConfigPath), { recursive: true });
    await writeFile(cityConfigPath, JSON.stringify({
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      pluginStoreDir: '/tmp/custom-plugin-store',
      sources: [],
      plugins: {},
    }, null, 2), 'utf8');

    mocks.currentConfigureDefaults.mockReturnValue({
      ...makeCurrentDefaults(cityConfigPath),
      adminPassword: 'secret',
      dbPath: customDbPath,
      publicDir: customPublicDir,
      uploadsDir: customUploadsDir,
    });
    mocks.configureAnswersToEnv.mockImplementation((answers: any) => ({
      DB_PATH: answers.dbPath,
      CITY_CONFIG_PATH: answers.cityConfigPath,
      PUBLIC_DIR: answers.publicDir,
      UPLOADS_DIR: answers.uploadsDir,
    }));
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('social-only')
      .mockResolvedValueOnce('save');
    mocks.promptInput
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--quickstart'], json: false });

    expect(mocks.writeEnvFile).toHaveBeenCalledWith(expect.objectContaining({
      DB_PATH: customDbPath,
      CITY_CONFIG_PATH: cityConfigPath,
      PUBLIC_DIR: customPublicDir,
      UPLOADS_DIR: customUploadsDir,
    }));
    expect(mocks.ensureCityConfig).toHaveBeenCalledWith(expect.objectContaining({
      configPath: cityConfigPath,
      pluginStoreDir: '/tmp/custom-plugin-store',
    }));
  });

  it('preserves an existing reverse-proxied https base url during quickstart reconfiguration', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.parseEnvFile.mockReturnValue({
      BASE_URL: 'https://app.uruk.life',
      PORT: '3000',
      WS_PORT: '3001',
      URUC_CITY_REACHABILITY: 'server',
      URUC_PURPOSE: 'production',
    });
    mocks.inferReachability.mockReturnValue('server');
    mocks.currentConfigureDefaults.mockReturnValue({
      ...makeCurrentDefaults(cityConfigPath),
      reachability: 'server',
      purpose: 'production',
      bindHost: '0.0.0.0',
      publicHost: 'app.uruk.life',
      siteProtocol: 'https',
      baseUrl: 'https://app.uruk.life',
      adminPassword: 'secret-password',
      allowRegister: true,
      noindex: false,
    });

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--quickstart', '--accept-defaults'], json: false });

    expect(mocks.configureAnswersToEnv).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: 'https://app.uruk.life',
      publicHost: 'app.uruk.life',
      httpPort: '3000',
      siteProtocol: 'https',
    }));
  });


  it('quickstart asks for a new admin email when the current one is already owned by another user', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    mocks.findUserByEmail
      .mockResolvedValueOnce({ id: 'user-1', username: 'existing-user', role: 'user' })
      .mockResolvedValueOnce(null);
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('quickstart')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('social-only')
      .mockResolvedValueOnce('save');
    mocks.promptInput
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('secret')
      .mockResolvedValueOnce('admin@example.com')
      .mockResolvedValueOnce('admin+fresh@example.com');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: [], json: false });

    expect(mocks.findUserByEmail).toHaveBeenNthCalledWith(1, 'admin@example.com', './data/uruc.local.db');
    expect(mocks.findUserByEmail).toHaveBeenNthCalledWith(2, 'admin+fresh@example.com', './data/uruc.local.db');
    expect(mocks.createAdmin).toHaveBeenCalledWith(
      'admin',
      'secret',
      'admin+fresh@example.com',
      './data/uruc.local.db',
    );
  });

  it('offers service-aware actions when a systemd service is installed', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    mocks.isSystemdInstalled.mockReturnValue(true);
    mocks.getRuntimeStatus.mockResolvedValue({ mode: 'stopped' });
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('quickstart')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('social-only')
      .mockResolvedValueOnce('start-managed');
    mocks.promptInput
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('secret-password')
      .mockResolvedValueOnce('admin@example.com');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: [], json: false });

    const applyPromptCall = mocks.promptChoice.mock.calls.find(
      ([prompt]) => prompt === 'What should Uruc do next?',
    );
    expect(applyPromptCall?.[1]).toEqual([
      { value: 'start-managed', label: 'Save and start service' },
      { value: 'save', label: 'Save config only' },
      { value: 'edit', label: 'Go back and edit' },
    ]);
    expect(mocks.runStartCommand).toHaveBeenCalledWith(expect.objectContaining({
      args: ['--background'],
    }));
    expect(mocks.runRestartCommand).not.toHaveBeenCalled();
  });

  it('restarts the managed service after configure when systemd is already active', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    mocks.isSystemdInstalled.mockReturnValue(true);
    mocks.getRuntimeStatus
      .mockResolvedValueOnce({ mode: 'systemd' })
      .mockResolvedValueOnce({ mode: 'systemd' });
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('quickstart')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('social-only')
      .mockResolvedValueOnce('start-managed');
    mocks.promptInput
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('secret-password')
      .mockResolvedValueOnce('admin@example.com');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: [], json: false });

    expect(mocks.runRestartCommand).toHaveBeenCalledWith(expect.objectContaining({ args: [] }));
    expect(mocks.runStartCommand).not.toHaveBeenCalled();
  });

  it('marks the site password prompt as clearable in advanced access mode', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue({
      ...makeCurrentDefaults(cityConfigPath),
      sitePassword: 'existing-site-password',
    });
    mocks.promptChoice
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('save');
    mocks.promptConfirm
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mocks.promptInput
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('secret-password')
      .mockResolvedValueOnce('admin@example.com')
      .mockResolvedValueOnce('-');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--advanced', '--section', 'access'], json: false });

    expect(mocks.promptInput).toHaveBeenNthCalledWith(
      4,
      'Site access password (optional)',
      'existing-site-password',
      expect.objectContaining({
        secret: true,
        clearHint: 'type - to clear',
        clearTokens: ['-'],
      }),
    );
  });
});
