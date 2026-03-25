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
  linkWorkspacePluginsToConfig: vi.fn((configPath: string, packageRoot: string, config: any, pluginIds?: string[]) => ({
    ...config,
    pluginStoreDir: config.pluginStoreDir ?? '.uruc/plugins',
    plugins: {
      ...(config.plugins ?? {}),
      ...Object.fromEntries((pluginIds ?? []).map((pluginId) => [
        pluginId,
        {
          pluginId,
          enabled: true,
          devOverridePath: `../plugins/${pluginId.split('.').pop()}`,
        },
      ])),
    },
  })),
  getBundledPluginPresetState: vi.fn((preset: string, current?: Record<string, boolean>) => {
    const defaultState = {
      'uruc.arcade': current?.['uruc.arcade'] ?? true,
      'uruc.article-library': current?.['uruc.article-library'] ?? true,
      'uruc.battlesnake': current?.['uruc.battlesnake'] ?? true,
      'uruc.chess': current?.['uruc.chess'] ?? true,
      'uruc.example': current?.['uruc.example'] ?? true,
      'uruc.marketplace': current?.['uruc.marketplace'] ?? true,
      'uruc.silent-hunt': current?.['uruc.silent-hunt'] ?? true,
      'uruc.social': current?.['uruc.social'] ?? true,
    };
    if (preset === 'empty-core') {
      return Object.fromEntries(Object.keys(defaultState).map((pluginId) => [pluginId, false]));
    }
    if (preset === 'custom') {
      return defaultState;
    }
    return defaultState;
  }),
  inferPluginPreset: vi.fn(() => 'custom'),
  detectBundledPluginState: vi.fn((config: any) => ({
    'uruc.arcade': config.plugins?.['uruc.arcade']?.enabled ?? false,
    'uruc.article-library': config.plugins?.['uruc.article-library']?.enabled ?? false,
    'uruc.battlesnake': config.plugins?.['uruc.battlesnake']?.enabled ?? false,
    'uruc.chess': config.plugins?.['uruc.chess']?.enabled ?? false,
    'uruc.example': config.plugins?.['uruc.example']?.enabled ?? false,
    'uruc.marketplace': config.plugins?.['uruc.marketplace']?.enabled ?? false,
    'uruc.silent-hunt': config.plugins?.['uruc.silent-hunt']?.enabled ?? false,
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
    pluginStoreDir: '.uruc/plugins',
  })),
  defaultBindHost: vi.fn((reachability: string) => (reachability === 'local' ? '127.0.0.1' : '0.0.0.0')),
  rememberConfiguration: vi.fn(),
  getConfigureActions: vi.fn(() => ['write env', 'sync city', 'sync lock']),
  getConfigureSummaryLines: vi.fn(() => Array.from({ length: 16 }, (_, index) => `line-${index}`)),
  readCliMeta: vi.fn(() => ({ language: 'en' })),
  promptChoice: vi.fn(),
  promptConfirm: vi.fn(),
  promptInput: vi.fn(),
  runMenuLoop: vi.fn(),
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
  listConfiguredPlugins: vi.fn(),
  installSourcePlugin: vi.fn(),
  linkLocalPlugin: vi.fn(),
  setConfiguredPluginEnabled: vi.fn(),
  removeConfiguredPlugin: vi.fn(),
  unlinkConfiguredPlugin: vi.fn(),
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
  BUNDLED_PLUGINS: [
    { pluginId: 'uruc.arcade', packageName: '@uruc/plugin-arcade', packageDir: 'arcade', label: 'Arcade' },
    { pluginId: 'uruc.article-library', packageName: '@uruc/plugin-article-library', packageDir: 'article-library', label: 'Article Library' },
    { pluginId: 'uruc.battlesnake', packageName: '@uruc/plugin-battlesnake', packageDir: 'battlesnake', label: 'Battlesnake' },
    { pluginId: 'uruc.chess', packageName: '@uruc/plugin-chess', packageDir: 'chess', label: 'Chess' },
    { pluginId: 'uruc.example', packageName: '@uruc/plugin-example-venue', packageDir: 'example-venue', label: 'Example Venue' },
    { pluginId: 'uruc.marketplace', packageName: '@uruc/plugin-marketplace', packageDir: 'marketplace', label: 'Marketplace' },
    { pluginId: 'uruc.silent-hunt', packageName: '@uruc/plugin-silent-hunt', packageDir: 'silent-hunt', label: 'Silent Hunt' },
    { pluginId: 'uruc.social', packageName: '@uruc/plugin-social', packageDir: 'social', label: 'Social' },
  ],
  DEFAULT_PLUGIN_PRESET: 'custom',
  DEFAULT_PLUGIN_STORE_DIR: '.uruc/plugins',
  ensureCityConfig: mocks.ensureCityConfig,
  syncCityLock: mocks.syncCityLock,
  linkWorkspacePluginsToConfig: mocks.linkWorkspacePluginsToConfig,
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
  runMenuLoop: mocks.runMenuLoop,
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

vi.mock('../lib/plugin-actions.js', () => ({
  listConfiguredPlugins: mocks.listConfiguredPlugins,
  installSourcePlugin: mocks.installSourcePlugin,
  linkLocalPlugin: mocks.linkLocalPlugin,
  setConfiguredPluginEnabled: mocks.setConfiguredPluginEnabled,
  removeConfiguredPlugin: mocks.removeConfiguredPlugin,
  unlinkConfiguredPlugin: mocks.unlinkConfiguredPlugin,
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
    pluginStoreDir: '.uruc/plugins',
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
  mocks.runMenuLoop.mockImplementation(async ({ prompt, getOptions, defaultValue, lang, onSelect }: any) => {
    let currentDefault = defaultValue;
    while (true) {
      const options = await getOptions();
      const selection = await mocks.promptChoice(prompt, options, currentDefault, lang);
      currentDefault = selection;
      const outcome = await onSelect(selection);
      if (outcome === 'break') {
        return;
      }
    }
  });
  mocks.ensureCityConfig.mockResolvedValue(undefined);
  mocks.syncCityLock.mockResolvedValue(undefined);
  mocks.getRuntimeStatus.mockResolvedValue({ mode: 'stopped' });
  mocks.isSystemdInstalled.mockReturnValue(false);
  mocks.runStartCommand.mockResolvedValue(undefined);
  mocks.runRestartCommand.mockResolvedValue(undefined);
  mocks.listConfiguredPlugins.mockResolvedValue([
    {
      pluginId: 'uruc.social',
      packageName: '@uruc/plugin-social',
      enabled: false,
      installOrigin: 'linked-path',
      linkedPath: '../plugins/social',
      configuredVersion: undefined,
      revision: 'rev-social',
      runtimeStorePath: '/tmp/test-package-root/.uruc/plugins/uruc.social/rev-social',
    },
  ]);
  mocks.installSourcePlugin.mockResolvedValue({ pluginId: 'uruc.marketplace', sourceId: 'official', version: '1.0.0' });
  mocks.linkLocalPlugin.mockResolvedValue({ pluginId: 'uruc.social', resolvedPath: '/tmp/test-package-root/../plugins/social' });
  mocks.setConfiguredPluginEnabled.mockResolvedValue(undefined);
  mocks.removeConfiguredPlugin.mockResolvedValue(undefined);
  mocks.unlinkConfiguredPlugin.mockResolvedValue(undefined);
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
      pluginStoreDir: '.uruc/plugins',
      createIfMissing: true,
      mutateExisting: false,
    }));
    expect(mocks.syncCityLock).toHaveBeenCalledWith(expect.objectContaining({
      configPath: cityConfigPath,
      lockPath: '/tmp/test-city.lock.json',
    }));
  });

  it('advanced runtime section keeps existing installed plugin config intact', async () => {
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
      mutateExisting: false,
      baseConfig: expect.objectContaining({
        plugins: expect.objectContaining({
          'uruc.social': expect.objectContaining({
            enabled: true,
            devOverridePath: '../plugins/social',
          }),
        }),
      }),
    }));
  });

  it('advanced mode loops through a persistent main menu and exposes review plus finish entries', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    let sectionVisits = 0;
    mocks.promptChoice.mockImplementation(async (prompt: string, options: Array<{ value: string }>) => {
      if (prompt === 'Choose language / 选择语言 / 언어 선택') return 'en';
      if (prompt === 'How should we configure this city?') return 'advanced';
      if (prompt === 'Which section do you want to change?') {
        sectionVisits += 1;
        return sectionVisits === 1 ? 'runtime' : 'finish';
      }
      if (prompt === 'Where should this city be reachable?') return 'local';
      if (prompt === 'What is this instance for?') return 'test';
      if (prompt === 'What should Uruc do next?') return 'save';
      return options[0]?.value;
    });
    mocks.promptInput
      .mockResolvedValueOnce('3000')
      .mockResolvedValueOnce('3001')
      .mockResolvedValueOnce('../human-web/dist')
      .mockResolvedValueOnce('./uploads');

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--advanced'], json: false });

    const sectionPromptCalls = mocks.promptChoice.mock.calls.filter(
      ([prompt]) => prompt === 'Which section do you want to change?',
    );
    expect(sectionPromptCalls.length).toBeGreaterThanOrEqual(2);
    expect(sectionPromptCalls[0]?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'review-summary' }),
      expect.objectContaining({ value: 'finish' }),
    ]));
    expect(mocks.writeEnvFile).toHaveBeenCalled();
  });

  it('advanced plugins section groups installed actions and returns to the submenu after enabling a plugin', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    let sectionVisits = 0;
    let pluginMenuVisits = 0;
    let installedMenuVisits = 0;
    mocks.promptChoice.mockImplementation(async (prompt: string, options: Array<{ value: string }>) => {
      if (prompt === 'Choose language / 选择语言 / 언어 선택') return 'en';
      if (prompt === 'How should we configure this city?') return 'advanced';
      if (prompt === 'Which section do you want to change?') {
        sectionVisits += 1;
        return sectionVisits === 1 ? 'plugins' : 'finish';
      }
      if (options.some((option) => option.value === 'manage-installed') && options.some((option) => option.value === 'add-plugin')) {
        pluginMenuVisits += 1;
        return pluginMenuVisits === 1 ? 'manage-installed' : 'back';
      }
      if (options.some((option) => option.value === 'enable') && options.some((option) => option.value === 'remove')) {
        installedMenuVisits += 1;
        return installedMenuVisits === 1 ? 'enable' : 'back';
      }
      if (prompt === 'Select an installed plugin') return 'uruc.social';
      if (prompt === 'What should Uruc do next?') return 'save';
      return options[0]?.value;
    });

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--advanced'], json: false });

    const pluginMenuCalls = mocks.promptChoice.mock.calls.filter(([, options]) => Array.isArray(options)
      && options.some((option: any) => option.value === 'manage-installed')
      && options.some((option: any) => option.value === 'add-plugin'));
    expect(pluginMenuCalls.length).toBeGreaterThanOrEqual(2);
    const installedMenuCalls = mocks.promptChoice.mock.calls.filter(([, options]) => Array.isArray(options)
      && options.some((option: any) => option.value === 'enable')
      && options.some((option: any) => option.value === 'remove'));
    expect(installedMenuCalls.length).toBeGreaterThanOrEqual(2);
    expect(mocks.setConfiguredPluginEnabled).toHaveBeenCalledWith('uruc.social', true, expect.any(Object));
  });

  it('lets the operator back out of installed-plugin selection without mutating plugins', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-configure-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    mocks.currentConfigureDefaults.mockReturnValue(makeCurrentDefaults(cityConfigPath));
    let sectionVisits = 0;
    let pluginMenuVisits = 0;
    let installedMenuVisits = 0;
    mocks.promptChoice.mockImplementation(async (prompt: string, options: Array<{ value: string }>) => {
      if (prompt === 'Choose language / 选择语言 / 언어 선택') return 'en';
      if (prompt === 'How should we configure this city?') return 'advanced';
      if (prompt === 'Which section do you want to change?') {
        sectionVisits += 1;
        return sectionVisits === 1 ? 'plugins' : 'finish';
      }
      if (options.some((option) => option.value === 'manage-installed') && options.some((option) => option.value === 'add-plugin')) {
        pluginMenuVisits += 1;
        return pluginMenuVisits === 1 ? 'manage-installed' : 'back';
      }
      if (options.some((option) => option.value === 'remove') && options.some((option) => option.value === 'back')) {
        installedMenuVisits += 1;
        return installedMenuVisits === 1 ? 'remove' : 'back';
      }
      if (prompt === 'Select an installed plugin') return 'back';
      if (prompt === 'What should Uruc do next?') return 'save';
      return options[0]?.value;
    });

    const { runConfigureCommand } = await import('../commands/configure.js');
    await runConfigureCommand({ args: ['--advanced'], json: false });

    const pickerCall = mocks.promptChoice.mock.calls.find(([prompt]) => prompt === 'Select an installed plugin');
    expect(pickerCall?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'uruc.social' }),
      expect.objectContaining({ value: 'back' }),
    ]));
    expect(mocks.removeConfiguredPlugin).not.toHaveBeenCalled();
    expect(mocks.unlinkConfiguredPlugin).not.toHaveBeenCalled();
    expect(mocks.setConfiguredPluginEnabled).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce('save');
    mocks.promptInput
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('secret')
      .mockResolvedValueOnce('admin@example.com');

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
      mutateExisting: false,
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
