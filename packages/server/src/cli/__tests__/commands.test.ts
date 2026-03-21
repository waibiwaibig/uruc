import { describe, expect, it } from 'vitest';

import { parseCommandContext } from '../lib/argv.js';
import { DEFAULT_PLUGIN_PRESET, DEFAULT_PLUGIN_STORE_DIR, getBundledPluginPresetState } from '../lib/city.js';
import { getConfigureActions, getConfigureSummaryLines } from '../lib/configure.js';
import type { ConfigureAnswers } from '../lib/types.js';

function makeAnswers(overrides: Partial<ConfigureAnswers> = {}): ConfigureAnswers {
  return {
    lang: 'zh-CN',
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
    adminPassword: 'secret',
    adminEmail: 'admin@example.com',
    allowRegister: false,
    noindex: true,
    sitePassword: '',
    dbPath: './data/uruc.local.db',
    cityConfigPath: './uruc.city.json',
    allowedOrigins: 'http://127.0.0.1:3000,http://localhost:5173',
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
    pluginPreset: DEFAULT_PLUGIN_PRESET,
    pluginStoreDir: DEFAULT_PLUGIN_STORE_DIR,
    bundledPluginState: getBundledPluginPresetState(DEFAULT_PLUGIN_PRESET),
    ...overrides,
  };
}

describe('CLI command parsing', () => {
  it('parses global flags separately from the subcommand', () => {
    const { command, context } = parseCommandContext(['start', '--background', '--json', '--lang', 'en']);
    expect(command).toBe('start');
    expect(context.json).toBe(true);
    expect(context.lang).toBe('en');
    expect(context.args).toEqual(['--background']);
  });
});

describe('configure summaries', () => {
  it('describes the configure flow in city terms', () => {
    const actions = getConfigureActions();
    expect(actions).toContain('写入 packages/server/.env');
    expect(actions).toContain('可选立即启动主城');
  });

  it('summarizes lan share settings', () => {
    const summary = getConfigureSummaryLines(makeAnswers({
      reachability: 'lan',
      bindHost: '0.0.0.0',
      publicHost: '192.168.1.50',
      baseUrl: 'http://192.168.1.50:3000',
      allowRegister: true,
    }));
    expect(summary.some((line) => line.includes('局域网'))).toBe(true);
    expect(summary.some((line) => line.includes('0.0.0.0'))).toBe(true);
  });

  it('summarizes the key deployment values', () => {
    const summary = getConfigureSummaryLines(makeAnswers({
      reachability: 'server',
      bindHost: '0.0.0.0',
      publicHost: 'uruk.life',
      siteProtocol: 'https',
      baseUrl: 'https://uruk.life',
    }));
    expect(summary.some((line) => line.includes('uruk.life'))).toBe(true);
    expect(summary.some((line) => line.includes('管理员: admin'))).toBe(true);
  });

  it('labels the default bundled preset as custom', () => {
    const summary = getConfigureSummaryLines(makeAnswers());
    expect(summary.some((line) => line.includes('插件预设: custom'))).toBe(true);
  });
});
