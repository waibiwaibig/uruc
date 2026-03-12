import { describe, expect, it } from 'vitest';

import { parseCommandContext } from '../lib/argv.js';
import { getSetupActions, getSetupSummaryLines } from '../lib/server-install.js';
import type { SetupAnswers } from '../lib/types.js';

function makeAnswers(overrides: Partial<SetupAnswers> = {}): SetupAnswers {
  return {
    lang: 'zh-CN',
    mode: 'local',
    purpose: 'test',
    publicHost: '127.0.0.1',
    enableSsl: false,
    letsencryptEmail: '',
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

describe('setup summaries', () => {
  it('keeps local setup actions focused on config and later start', () => {
    const actions = getSetupActions(makeAnswers());
    expect(actions).toContain('写入 packages/server/.env');
    expect(actions).toContain('等待后续通过 `uruc start` 自动构建并启动');
  });

  it('includes server install steps for server deployments', () => {
    const actions = getSetupActions(makeAnswers({ mode: 'server', publicHost: 'uruc.life', enableSsl: true, letsencryptEmail: 'ops@example.com', baseUrl: 'https://uruc.life' }));
    expect(actions).toContain('写入并启动 systemd 服务');
    expect(actions).toContain('写入 nginx 反向代理配置');
    expect(actions).toContain('申请并部署 HTTPS 证书');
  });

  it('summarizes the key deployment values', () => {
    const summary = getSetupSummaryLines(makeAnswers({ mode: 'server', publicHost: 'uruc.life', enableSsl: true, baseUrl: 'https://uruc.life' }));
    expect(summary.some((line) => line.includes('uruc.life'))).toBe(true);
    expect(summary.some((line) => line.includes('管理员: admin'))).toBe(true);
  });
});
