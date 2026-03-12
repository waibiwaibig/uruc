import { lookup } from 'dns/promises';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';

import { getPackageRoot } from '../../runtime-paths.js';
import { buildAll } from './build.js';
import { fetchHealth, getRuntimeStatus, rememberInstall } from './runtime.js';
import { commandExists, currentNodeMajor, exec, isRootUser, runOrThrow } from './process.js';
import { ensureCliDirs, getRepoRoot, getRuntimeDir, readCliMeta, writeCliMeta } from './state.js';
import type { SetupAnswers } from './types.js';

const packageRoot = getPackageRoot();
const repoRoot = getRepoRoot();

export interface SetupSummary {
  siteUrl: string;
  healthUrl: string;
  wsUrl: string;
  serviceName: string;
  adminUsername: string;
  adminPassword: string;
  nginxConfigPath?: string;
}

function getServiceName(): string {
  return readCliMeta().serviceName ?? 'uruc';
}

function isIpHost(host: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':');
}

function getSystemdServicePath(serviceName: string): string {
  return `/etc/systemd/system/${serviceName}.service`;
}

function getDeployUser(): string {
  return process.env.SUDO_USER ?? process.env.USER ?? 'root';
}

function getDeployGroup(user: string): string {
  const result = exec('id', ['-gn', user]);
  return result.status === 0 ? result.stdout.trim() || user : user;
}

function requireCommand(command: string, message: string): void {
  if (!commandExists(command)) {
    throw new Error(message);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getNginxCandidateFiles(serviceName: string): string[] {
  return [
    `/etc/nginx/conf.d/${serviceName}.conf`,
    `/etc/nginx/sites-available/${serviceName}`,
    `/etc/nginx/sites-enabled/${serviceName}`,
    `/etc/nginx/sites-available/${serviceName}.conf`,
    `/etc/nginx/sites-enabled/${serviceName}.conf`,
  ];
}

function cleanupServiceNginxFiles(serviceName: string): void {
  for (const target of getNginxCandidateFiles(serviceName)) {
    if (!existsSync(target)) continue;
    rmSync(target, { force: true, recursive: false });
  }
}

function findConflictingServerNameFiles(publicHost: string, serviceName: string): string[] {
  const roots = ['/etc/nginx/conf.d', '/etc/nginx/sites-available', '/etc/nginx/sites-enabled'];
  const ownFiles = new Set(getNginxCandidateFiles(serviceName));
  const matcher = new RegExp(`server_name[^;]*\\b${escapeRegex(publicHost)}\\b`, 'i');
  const conflicts: string[] = [];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const targetPath = path.join(root, entry.name);
      if (ownFiles.has(targetPath)) continue;
      try {
        const content = readFileSync(targetPath, 'utf8');
        if (matcher.test(content)) conflicts.push(targetPath);
      } catch {
        // ignore unreadable nginx files
      }
    }
  }

  return Array.from(new Set(conflicts)).sort();
}

function getAllowedListenerPid(serviceName: string): number | null {
  const result = exec('systemctl', ['show', '-p', 'MainPID', '--value', serviceName]);
  if (result.status !== 0) return null;
  const pid = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function assertPortAvailable(port: string, serviceName: string): void {
  const result = exec('ss', ['-ltnpH']);
  if (result.status !== 0) return;
  const allowedPid = commandExists('systemctl') ? getAllowedListenerPid(serviceName) : null;
  const foreign = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => new RegExp(`[:.]${escapeRegex(port)}\\s`).test(line))
    .filter((line) => {
      if (!allowedPid) return true;
      return !line.includes(`pid=${allowedPid},`);
    });

  if (foreign.length > 0) {
    throw new Error(`Port ${port} is already in use:\n${foreign.join('\n')}`);
  }
}

async function waitForUrl(url: string, timeoutSeconds: number): Promise<boolean> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const health = await fetchHealth(url);
    if (health.ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function verifyLocalAdmin(answers: SetupAnswers): Promise<void> {
  const endpoint = `http://127.0.0.1:${answers.httpPort}/api/auth/login`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: answers.adminUsername, password: answers.adminPassword }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Local admin login verification failed (HTTP ${response.status}). ` +
      `Possible cause: existing username already present with a different password. Response: ${body}`,
    );
  }
}

function renderNoindexBlock(noindex: boolean): string {
  if (!noindex) return '';
  return `
    add_header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet" always;

    location = /robots.txt {
        default_type text/plain;
        return 200 "User-agent: *\\nDisallow: /\\n";
    }`;
}

function writeSystemdService(answers: SetupAnswers, serviceName: string): void {
  const deployUser = getDeployUser();
  const deployGroup = getDeployGroup(deployUser);
  const servicePath = getSystemdServicePath(serviceName);
  const envPath = path.join(packageRoot, '.env');
  const content = `[Unit]
Description=Uruc City
After=network.target

[Service]
Type=simple
WorkingDirectory=${packageRoot}
EnvironmentFile=${envPath}
ExecStart=${process.execPath} dist/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
User=${deployUser}
Group=${deployGroup}

[Install]
WantedBy=multi-user.target
`;

  writeFileSync(servicePath, content, 'utf8');
  mkdirSync(path.join(packageRoot, 'data'), { recursive: true });
  mkdirSync(path.join(packageRoot, 'uploads'), { recursive: true });
  mkdirSync(path.join(repoRoot, 'packages', 'human-web', 'dist'), { recursive: true });

  if (commandExists('chown')) {
    exec('chown', [`${deployUser}:${deployGroup}`, envPath]);
    exec('chown', ['-R', `${deployUser}:${deployGroup}`, path.join(packageRoot, 'data')]);
    exec('chown', ['-R', `${deployUser}:${deployGroup}`, path.join(packageRoot, 'uploads')]);
    exec('chown', ['-R', `${deployUser}:${deployGroup}`, getRuntimeDir()]);
  }
}

function writeNginxConfig(answers: SetupAnswers, serviceName: string): string {
  const noindexBlock = renderNoindexBlock(answers.noindex);
  const sitesAvailable = '/etc/nginx/sites-available';
  const sitesEnabled = '/etc/nginx/sites-enabled';
  const configPath = existsSync(sitesAvailable)
    ? path.join(sitesAvailable, serviceName)
    : `/etc/nginx/conf.d/${serviceName}.conf`;

  cleanupServiceNginxFiles(serviceName);

  const content = `server {
    listen 80;
    server_name ${answers.publicHost};

    client_max_body_size 10m;${noindexBlock}

    location / {
        proxy_pass http://127.0.0.1:${answers.httpPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://127.0.0.1:${answers.wsPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
`;

  writeFileSync(configPath, content, 'utf8');
  if (existsSync(sitesAvailable)) {
    mkdirSync(sitesEnabled, { recursive: true });
    const symlinkPath = path.join(sitesEnabled, serviceName);
    if (existsSync(symlinkPath)) rmSync(symlinkPath, { force: true });
    symlinkSync(configPath, symlinkPath);
  }
  return configPath;
}

async function assertDomainResolves(publicHost: string): Promise<void> {
  if (isIpHost(publicHost)) return;
  await lookup(publicHost);
}

async function ensureServerPackages(): Promise<void> {
  requireCommand('apt-get', 'Only Ubuntu/Debian (apt) is supported for server setup.');
  await runOrThrow('apt-get', ['update']);
  await runOrThrow('apt-get', [
    'install', '-y',
    'curl',
    'ca-certificates',
    'git',
    'nginx',
    'openssl',
    'certbot',
    'python3-certbot-nginx',
    'build-essential',
    'python3',
    'make',
    'g++',
  ]);
}

async function ensureNode20(): Promise<void> {
  if (currentNodeMajor() >= 20) return;
  await runOrThrow('bash', ['-lc', 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -']);
  await runOrThrow('apt-get', ['install', '-y', 'nodejs']);
}

function probeBetterSqlite3(): { ok: boolean; detail: string } {
  const script = [
    "import Database from 'better-sqlite3';",
    "const db = new Database(':memory:');",
    "db.prepare('select 1 as ok').get();",
    'db.close();',
  ].join(' ');
  const result = exec(process.execPath, ['--input-type=module', '-e', script], repoRoot);
  const detail = (result.stderr || result.stdout).trim();
  return { ok: result.status === 0, detail };
}

async function ensureBetterSqlite3Ready(): Promise<'ready' | 'rebuilt'> {
  const initialProbe = probeBetterSqlite3();
  if (initialProbe.ok) {
    return 'ready';
  }

  console.log('[uruc setup] better-sqlite3 is not ready yet; rebuilding native module from source.');
  if (initialProbe.detail) {
    console.log(`[uruc setup] probe detail: ${initialProbe.detail}`);
  }

  await runOrThrow('npm', ['rebuild', 'better-sqlite3', '--build-from-source'], { cwd: repoRoot });

  const finalProbe = probeBetterSqlite3();
  if (!finalProbe.ok) {
    throw new Error(
      `better-sqlite3 still failed after rebuild.${finalProbe.detail ? ` Detail: ${finalProbe.detail}` : ''}`,
    );
  }
  return 'rebuilt';
}

async function installDependenciesAndBuild(): Promise<void> {
  await runOrThrow('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: repoRoot });
  const sqliteStatus = await ensureBetterSqlite3Ready();
  if (sqliteStatus === 'ready') {
    console.log('[uruc setup] better-sqlite3 is already usable; skipping native rebuild.');
  }
  await buildAll(true);
}

function shouldCheckSiteRoot(answers: SetupAnswers): boolean {
  return !answers.sitePassword;
}

function persistSetupMeta(answers: SetupAnswers): void {
  const serviceName = getServiceName();
  writeCliMeta({
    ...readCliMeta(),
    language: answers.lang,
    deploymentMode: answers.mode,
    purpose: answers.purpose,
    serviceName,
  });
}

export async function installServer(answers: SetupAnswers): Promise<SetupSummary> {
  if (!isRootUser()) {
    throw new Error('Server setup requires root. Run `sudo uruc setup`.');
  }
  if (answers.enableSsl && !answers.letsencryptEmail) {
    throw new Error('SSL is enabled but no Let\'s Encrypt email was provided.');
  }

  const serviceName = getServiceName();
  ensureCliDirs();
  persistSetupMeta(answers);

  assertPortAvailable(answers.httpPort, serviceName);
  assertPortAvailable(answers.wsPort, serviceName);

  const conflicts = findConflictingServerNameFiles(answers.publicHost, serviceName);
  if (conflicts.length > 0) {
    throw new Error(`nginx already has another config claiming ${answers.publicHost}:\n${conflicts.join('\n')}`);
  }

  await ensureServerPackages();
  await ensureNode20();
  await installDependenciesAndBuild();

  writeSystemdService(answers, serviceName);
  await runOrThrow('systemctl', ['daemon-reload']);
  await runOrThrow('systemctl', ['enable', serviceName]);
  await runOrThrow('systemctl', ['restart', serviceName]);

  if (!(await waitForUrl(`http://127.0.0.1:${answers.httpPort}/api/health`, 40))) {
    throw new Error(`Backend did not become healthy on port ${answers.httpPort}.`);
  }

  await verifyLocalAdmin(answers);

  if (shouldCheckSiteRoot(answers)) {
    if (!(await waitForUrl(`http://127.0.0.1:${answers.httpPort}/`, 40))) {
      throw new Error(`Backend root did not become healthy on port ${answers.httpPort}.`);
    }
  }

  const nginxConfigPath = writeNginxConfig(answers, serviceName);
  await runOrThrow('nginx', ['-t']);
  await runOrThrow('systemctl', ['enable', 'nginx']);
  await runOrThrow('systemctl', ['restart', 'nginx']);

  if (answers.enableSsl && !isIpHost(answers.publicHost)) {
    await assertDomainResolves(answers.publicHost);
    await runOrThrow('certbot', [
      '--nginx',
      '--non-interactive',
      '--agree-tos',
      '--redirect',
      '-m',
      answers.letsencryptEmail,
      '-d',
      answers.publicHost,
    ]);
  }

  const status = await getRuntimeStatus();
  if (!(await waitForUrl(status.healthUrl, 40))) {
    throw new Error(`Public health check failed: ${status.healthUrl}`);
  }
  if (shouldCheckSiteRoot(answers) && !(await waitForUrl(status.siteUrl, 40))) {
    throw new Error(`Public site root check failed: ${status.siteUrl}`);
  }

  rememberInstall(status);
  return {
    siteUrl: status.siteUrl,
    healthUrl: status.healthUrl,
    wsUrl: status.wsUrl,
    serviceName,
    adminUsername: answers.adminUsername,
    adminPassword: answers.adminPassword,
    nginxConfigPath,
  };
}

export function saveLocalSetupMeta(answers: SetupAnswers): void {
  persistSetupMeta(answers);
}

export function getSetupActions(answers: SetupAnswers): string[] {
  const base = [
    '写入 packages/server/.env',
    '记录 .uruc/cli.json 元数据',
  ];

  if (answers.mode === 'local') {
    base.push('等待后续通过 `uruc start` 自动构建并启动');
    return base;
  }

  base.push('安装系统依赖（Ubuntu/Debian）');
  base.push('安装 Node.js 20（如当前版本不足）');
  base.push('npm install + 按需重建 better-sqlite3');
  base.push('构建 server 与 human-web');
  base.push('写入并启动 systemd 服务');
  base.push('写入 nginx 反向代理配置');
  if (answers.enableSsl && !isIpHost(answers.publicHost)) {
    base.push('申请并部署 HTTPS 证书');
  }
  base.push('执行健康检查与管理员登录校验');
  return base;
}

export function getSetupSummaryLines(answers: SetupAnswers): string[] {
  const scheme = answers.enableSsl ? 'https' : 'http';
  const siteUrl = answers.baseUrl || `${scheme}://${answers.publicHost}`;
  return [
    `部署位置: ${answers.mode === 'server' ? '服务器部署' : '本地试用'}`,
    `实例用途: ${answers.purpose === 'production' ? '正式' : '测试'}`,
    `访问地址: ${siteUrl}`,
    `HTTP / WS: ${answers.httpPort} / ${answers.wsPort}`,
    `管理员: ${answers.adminUsername}`,
    `开放注册: ${answers.allowRegister ? '是' : '否'}`,
    `搜索引擎收录: ${answers.noindex ? '禁止' : '允许'}`,
    `站点访问密码: ${answers.sitePassword ? '已设置' : '未设置'}`,
    `数据库: ${answers.dbPath}`,
    `插件配置: ${answers.pluginConfigPath}`,
    `运行环境: ${os.platform()} ${os.release()}`,
  ];
}
