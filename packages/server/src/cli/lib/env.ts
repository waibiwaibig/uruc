import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

import { getPackageRoot, getPluginConfigFilename } from '../../runtime-paths.js';
import { getRepoRoot, getRootEnvPath, getServerEnvPath } from './state.js';
import type { DeploymentMode, InstancePurpose, SetupAnswers } from './types.js';

const packageRoot = getPackageRoot();
const serverEnvPath = getServerEnvPath();
const exampleEnvPath = path.join(packageRoot, '.env.example');
const rootEnvPath = getRootEnvPath();

export function loadServerEnv(): NodeJS.ProcessEnv {
  dotenv.config({ path: serverEnvPath, override: true, quiet: true });
  return process.env;
}

export function rootEnvExists(): boolean {
  return existsSync(rootEnvPath);
}

export function serverEnvExists(): boolean {
  return existsSync(serverEnvPath);
}

export function ensureServerEnvFile(): void {
  if (existsSync(serverEnvPath)) return;
  if (existsSync(exampleEnvPath)) {
    copyFileSync(exampleEnvPath, serverEnvPath);
    return;
  }
  writeFileSync(serverEnvPath, '', 'utf8');
}

export function parseEnvFile(targetPath: string = serverEnvPath): Record<string, string> {
  if (!existsSync(targetPath)) return {};
  const content = readFileSync(targetPath, 'utf8');
  const parsed = dotenv.parse(content);
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    normalized[key] = value;
  }
  return normalized;
}

export function writeEnvFile(values: Record<string, string>, targetPath: string = serverEnvPath): void {
  const lines = Object.entries(values)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`);
  writeFileSync(targetPath, `${lines.join('\n')}\n`, 'utf8');
}

export function mergeWithCurrentEnv(next: Record<string, string>): Record<string, string> {
  const current = parseEnvFile(serverEnvPath);
  return { ...current, ...next };
}

export function getCurrentLanguage(): 'zh-CN' | 'en' | 'ko' {
  const env = parseEnvFile(serverEnvPath);
  const lang = env.URUC_CLI_LANG;
  if (lang === 'en' || lang === 'ko' || lang === 'zh-CN') return lang;
  return 'zh-CN';
}

export function defaultConfig(mode: DeploymentMode, purpose: InstancePurpose, publicHost: string, httpPort: string, wsPort: string): Omit<SetupAnswers, 'lang' | 'mode' | 'purpose' | 'publicHost' | 'httpPort' | 'wsPort'> {
  const isServer = mode === 'server';
  const enableSsl = isServer && !!publicHost && !/^\d+\.\d+\.\d+\.\d+$/.test(publicHost);
  const baseUrl = isServer
    ? `${enableSsl ? 'https' : 'http'}://${publicHost || '127.0.0.1'}`
    : `${enableSsl ? 'https' : 'http'}://${publicHost || '127.0.0.1'}${httpPort === '80' || (enableSsl && httpPort === '443') ? '' : `:${httpPort}`}`;
  const pluginConfigPath = isServer ? './plugins.prod.json' : './plugins.dev.json';
  const dbPath = isServer ? './data/uruc.prod.db' : './data/uruc.local.db';
  const defaultOrigins = isServer
    ? `${baseUrl},http://localhost:3000,http://localhost:5173`
    : `http://127.0.0.1:${httpPort},http://localhost:${httpPort},http://localhost:5173`;

  return {
    enableSsl,
    letsencryptEmail: '',
    adminUsername: 'admin',
    adminPassword: '',
    adminEmail: 'admin@localhost',
    allowRegister: false,
    noindex: purpose === 'test',
    sitePassword: '',
    dbPath,
    pluginConfigPath,
    allowedOrigins: defaultOrigins,
    jwtSecret: generateSecret(),
    baseUrl,
    publicDir: '../human-web/dist',
    uploadsDir: './uploads',
    resendApiKey: '',
    fromEmail: 'noreply@yourdomain.com',
    googleClientId: '',
    googleClientSecret: '',
    githubClientId: '',
    githubClientSecret: '',
  };
}

export function currentSetupDefaults(mode: DeploymentMode, purpose: InstancePurpose, publicHost: string, httpPort: string, wsPort: string): SetupAnswers {
  const current = parseEnvFile(serverEnvPath);
  const defaults = defaultConfig(mode, purpose, publicHost, httpPort, wsPort);
  return {
    lang: getCurrentLanguage(),
    mode,
    purpose,
    publicHost,
    httpPort,
    wsPort,
    enableSsl: toBool(current.ENABLE_SSL, defaults.enableSsl),
    letsencryptEmail: current.LETSENCRYPT_EMAIL ?? current.ADMIN_EMAIL ?? defaults.letsencryptEmail,
    adminUsername: current.ADMIN_USERNAME ?? defaults.adminUsername,
    adminPassword: current.ADMIN_PASSWORD ?? defaults.adminPassword,
    adminEmail: current.ADMIN_EMAIL ?? defaults.adminEmail,
    allowRegister: toBool(current.ALLOW_REGISTER, defaults.allowRegister),
    noindex: toBool(current.NO_INDEX ?? current.URUC_NOINDEX, defaults.noindex),
    sitePassword: current.SITE_PASSWORD ?? defaults.sitePassword,
    dbPath: current.DB_PATH ?? defaults.dbPath,
    pluginConfigPath: current.PLUGIN_CONFIG_PATH ?? defaults.pluginConfigPath,
    allowedOrigins: current.ALLOWED_ORIGINS ?? defaults.allowedOrigins,
    jwtSecret: current.JWT_SECRET ?? defaults.jwtSecret,
    baseUrl: current.BASE_URL ?? defaults.baseUrl,
    publicDir: current.PUBLIC_DIR ?? defaults.publicDir,
    uploadsDir: current.UPLOADS_DIR ?? defaults.uploadsDir,
    resendApiKey: current.RESEND_API_KEY ?? defaults.resendApiKey,
    fromEmail: current.FROM_EMAIL ?? defaults.fromEmail,
    googleClientId: current.GOOGLE_CLIENT_ID ?? defaults.googleClientId,
    googleClientSecret: current.GOOGLE_CLIENT_SECRET ?? defaults.googleClientSecret,
    githubClientId: current.GITHUB_CLIENT_ID ?? defaults.githubClientId,
    githubClientSecret: current.GITHUB_CLIENT_SECRET ?? defaults.githubClientSecret,
  };
}

export function setupAnswersToEnv(answers: SetupAnswers): Record<string, string> {
  const env = parseEnvFile(serverEnvPath);
  const scheme = answers.enableSsl ? 'https' : 'http';
  const baseUrl = answers.baseUrl || `${scheme}://${answers.publicHost}`;
  return {
    ...env,
    URUC_CLI_LANG: answers.lang,
    BASE_URL: baseUrl,
    PORT: answers.httpPort,
    WS_PORT: answers.wsPort,
    DB_PATH: answers.dbPath,
    PLUGIN_CONFIG_PATH: answers.pluginConfigPath,
    PUBLIC_DIR: answers.publicDir,
    UPLOADS_DIR: answers.uploadsDir,
    JWT_SECRET: answers.jwtSecret,
    ALLOW_REGISTER: answers.allowRegister ? 'true' : 'false',
    ALLOWED_ORIGINS: answers.allowedOrigins,
    ADMIN_USERNAME: answers.adminUsername,
    ADMIN_PASSWORD: answers.adminPassword,
    ADMIN_EMAIL: answers.adminEmail,
    SITE_PASSWORD: answers.sitePassword,
    RESEND_API_KEY: answers.resendApiKey,
    FROM_EMAIL: answers.fromEmail,
    GOOGLE_CLIENT_ID: answers.googleClientId,
    GOOGLE_CLIENT_SECRET: answers.googleClientSecret,
    GITHUB_CLIENT_ID: answers.githubClientId,
    GITHUB_CLIENT_SECRET: answers.githubClientSecret,
    URUC_NOINDEX: answers.noindex ? 'true' : 'false',
    ENABLE_SSL: answers.enableSsl ? 'true' : 'false',
    LETSENCRYPT_EMAIL: answers.letsencryptEmail,
    URUC_DEPLOYMENT_MODE: answers.mode,
    URUC_PURPOSE: answers.purpose,
  };
}

export function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function generateSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function getDefaultPluginConfig(mode: DeploymentMode): string {
  return `./${getPluginConfigFilename(mode === 'server' ? 'production' : 'development')}`;
}

export function getRepoRootPath(): string {
  return getRepoRoot();
}
