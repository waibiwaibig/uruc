import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

import { getPackageRoot, getPluginConfigFilename } from '../../runtime-paths.js';
import { getRepoRoot, getRootEnvPath, getServerEnvPath } from './state.js';
import type {
  ConfigureAnswers,
  ExposureMode,
  InstancePurpose,
  LegacyDeploymentMode,
} from './types.js';

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

export function legacyDeploymentModeToExposure(mode: LegacyDeploymentMode | string | undefined): ExposureMode {
  return mode === 'server' ? 'direct-public' : 'local-only';
}

export function defaultBindHostForExposure(exposure: ExposureMode): string {
  return exposure === 'local-only' ? '127.0.0.1' : '0.0.0.0';
}

function inferHttps(baseUrl: string | undefined, legacyEnableSsl: string | undefined): boolean {
  if (baseUrl) {
    try {
      return new URL(baseUrl).protocol === 'https:';
    } catch {
      // Fall back to the legacy flag if BASE_URL is malformed.
    }
  }
  return toBool(legacyEnableSsl, false);
}

function getOrigin(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

export function normalizeAppBasePath(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '' || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

export function buildBaseUrl(publicHost: string, httpPort: string, useHttps: boolean): string {
  const scheme = useHttps ? 'https' : 'http';
  const defaultPort = useHttps ? '443' : '80';
  const safeHost = publicHost.trim() === '' ? '127.0.0.1' : publicHost.trim();
  return `${scheme}://${safeHost}${httpPort === defaultPort ? '' : `:${httpPort}`}`;
}

export function buildSiteUrl(baseUrl: string, appBasePath: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedBasePath = normalizeAppBasePath(appBasePath);
  return normalizedBasePath === '' ? normalizedBase : `${normalizedBase}${normalizedBasePath}`;
}

export function defaultConfig(
  exposure: ExposureMode,
  purpose: InstancePurpose,
  bindHost: string,
  publicHost: string,
  httpPort: string,
  wsPort: string,
  useHttps: boolean,
): Omit<ConfigureAnswers, 'lang' | 'exposure' | 'purpose' | 'bindHost' | 'publicHost' | 'httpPort' | 'wsPort' | 'useHttps'> {
  const baseUrl = buildBaseUrl(publicHost, httpPort, useHttps);
  const pluginConfigPath = getDefaultPluginConfig(purpose);
  const dbPath = purpose === 'production' ? './data/uruc.prod.db' : './data/uruc.local.db';
  const origin = getOrigin(baseUrl);
  const defaultOrigins = Array.from(new Set([
    origin,
    `http://127.0.0.1:${httpPort}`,
    `http://localhost:${httpPort}`,
    'http://localhost:5173',
  ])).join(',');

  return {
    baseUrl,
    appBasePath: '',
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

export function currentConfigureDefaults(
  exposure: ExposureMode,
  purpose: InstancePurpose,
  bindHost: string,
  publicHost: string,
  httpPort: string,
  wsPort: string,
): ConfigureAnswers {
  const current = parseEnvFile(serverEnvPath);
  const useHttps = inferHttps(current.BASE_URL, current.ENABLE_SSL);
  const defaults = defaultConfig(exposure, purpose, bindHost, publicHost, httpPort, wsPort, useHttps);
  return {
    lang: getCurrentLanguage(),
    exposure,
    purpose,
    bindHost: current.BIND_HOST ?? bindHost,
    publicHost,
    httpPort,
    wsPort,
    useHttps,
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
    appBasePath: normalizeAppBasePath(current.APP_BASE_PATH ?? defaults.appBasePath),
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

export function configureAnswersToEnv(answers: ConfigureAnswers): Record<string, string> {
  const env = parseEnvFile(serverEnvPath);
  const baseUrl = answers.baseUrl || buildBaseUrl(answers.publicHost, answers.httpPort, answers.useHttps);
  return {
    ...env,
    URUC_CLI_LANG: answers.lang,
    URUC_EXPOSURE: answers.exposure,
    URUC_PURPOSE: answers.purpose,
    BASE_URL: baseUrl,
    BIND_HOST: answers.bindHost,
    PORT: answers.httpPort,
    WS_PORT: answers.wsPort,
    DB_PATH: answers.dbPath,
    PLUGIN_CONFIG_PATH: answers.pluginConfigPath,
    APP_BASE_PATH: normalizeAppBasePath(answers.appBasePath),
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
    ENABLE_SSL: '',
    LETSENCRYPT_EMAIL: '',
    URUC_DEPLOYMENT_MODE: '',
  };
}

export function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function generateSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function getDefaultPluginConfig(purpose: InstancePurpose): string {
  return `./${getPluginConfigFilename(purpose === 'production' ? 'production' : 'development')}`;
}

export function getRepoRootPath(): string {
  return getRepoRoot();
}
