import { describe, expect, it } from 'vitest';

import { parseCommandContext } from '../lib/argv.js';
import { getConfigureActions, getConfigureSummaryLines } from '../lib/configure-plan.js';
import type { ConfigureAnswers } from '../lib/types.js';

function makeAnswers(overrides: Partial<ConfigureAnswers> = {}): ConfigureAnswers {
  return {
    lang: 'zh-CN',
    exposure: 'local-only',
    purpose: 'test',
    bindHost: '127.0.0.1',
    publicHost: '127.0.0.1',
    useHttps: false,
    httpPort: '3000',
    wsPort: '3001',
    adminUsername: 'admin',
    adminPassword: 'secret',
    adminEmail: 'admin@example.com',
    allowRegister: false,
    noindex: true,
    sitePassword: '',
    dbPath: './data/uruc.local.db',
    pluginConfigPath: './plugins.dev.json',
    allowedOrigins: 'http://127.0.0.1:3000,http://localhost:5173',
    jwtSecret: 'secret',
    baseUrl: 'http://127.0.0.1:3000',
    appBasePath: '',
    publicDir: '../human-web/dist',
    uploadsDir: './uploads',
    resendApiKey: '',
    fromEmail: 'noreply@example.com',
    googleClientId: '',
    googleClientSecret: '',
    githubClientId: '',
    githubClientSecret: '',
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
  it('keeps configure actions focused on runtime config and later start', () => {
    const actions = getConfigureActions(makeAnswers(), 'zh-CN');
    expect(actions).toContain('写入 packages/server/.env');
    expect(actions).toContain('后续通过 `uruc start` 或 `uruc start -b` 启动 city runtime');
  });

  it('keeps public exposure actions out of server install territory', () => {
    const actions = getConfigureActions(makeAnswers({
      exposure: 'direct-public',
      publicHost: 'uruc.life',
      useHttps: true,
      baseUrl: 'https://uruc.life',
    }), 'zh-CN');
    expect(actions).toContain('保留 nginx / SSL / systemd 给外部运维层处理');
  });

  it('summarizes the key deployment values', () => {
    const summary = getConfigureSummaryLines(makeAnswers({
      exposure: 'direct-public',
      publicHost: 'uruc.life',
      useHttps: true,
      baseUrl: 'https://uruc.life',
      appBasePath: '/app',
    }), 'zh-CN');
    expect(summary.some((line) => line.includes('uruc.life'))).toBe(true);
    expect(summary.some((line) => line.includes('City 路径: /app'))).toBe(true);
  });
});
