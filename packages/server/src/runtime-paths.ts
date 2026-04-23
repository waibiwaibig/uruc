import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..');
const workspaceLayout = detectWorkspaceLayout();

function detectWorkspaceLayout(): boolean {
  const workspaceMarkers = [
    path.resolve(packageRoot, '..', 'web', 'package.json'),
    path.resolve(packageRoot, '..', 'plugin-sdk', 'package.json'),
    path.resolve(packageRoot, '..', '..', 'package.json'),
  ];
  return workspaceMarkers.every((targetPath) => existsSync(targetPath));
}

function resolveRuntimePurpose(): 'test' | 'production' {
  return process.env.URUC_PURPOSE === 'production' ? 'production' : 'test';
}

function resolveExplicitRuntimeHome(): string | null {
  const override = process.env.URUC_HOME?.trim();
  return override ? path.resolve(override) : null;
}

function defaultInstalledRuntimeHome(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    return path.join(localAppData || path.join(os.homedir(), 'AppData', 'Local'), 'uruc');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'uruc');
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  return path.join(xdgDataHome || path.join(os.homedir(), '.local', 'share'), 'uruc');
}

function resolveRuntimeRoot(): string {
  return resolveExplicitRuntimeHome()
    || (workspaceLayout ? packageRoot : defaultInstalledRuntimeHome());
}

export function getPackageRoot(): string {
  return packageRoot;
}

export function isWorkspaceLayout(): boolean {
  return workspaceLayout;
}

export function getRuntimeHome(): string {
  return resolveRuntimeRoot();
}

export function resolveFromPackageRoot(targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(packageRoot, targetPath);
}

export function resolveFromRuntimeHome(targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(resolveRuntimeRoot(), targetPath);
}

export function getEnvPath(): string {
  return path.join(resolveRuntimeRoot(), '.env');
}

export function getActiveEnvPath(): string {
  const override = process.env.URUC_SERVER_ENV_PATH;
  if (override && override.trim() !== '') {
    return path.resolve(override);
  }
  return getEnvPath();
}

export function getCityConfigPath(): string {
  const override = process.env.CITY_CONFIG_PATH?.trim();
  if (override) return resolveFromRuntimeHome(override);
  return path.join(resolveRuntimeRoot(), 'uruc.city.json');
}

export function getCityLockPath(): string {
  const override = process.env.CITY_LOCK_PATH?.trim();
  if (override) return resolveFromRuntimeHome(override);
  return path.join(resolveRuntimeRoot(), 'uruc.city.lock.json');
}

export function getPluginStoreDir(): string {
  const override = process.env.PLUGIN_STORE_DIR?.trim();
  if (override) return resolveFromRuntimeHome(override);
  return path.join(resolveRuntimeRoot(), '.uruc', 'plugins');
}

export function getDefaultDbRelativePath(purpose: 'test' | 'production' = resolveRuntimePurpose()): string {
  return purpose === 'production' ? './data/uruc.prod.db' : './data/uruc.local.db';
}

export function getDbPath(): string {
  const override = process.env.DB_PATH?.trim();
  if (override) return resolveFromRuntimeHome(override);
  return resolveFromRuntimeHome(getDefaultDbRelativePath(resolveRuntimePurpose()));
}

export function getUploadsDir(): string {
  const override = process.env.UPLOADS_DIR?.trim();
  if (override) return resolveFromRuntimeHome(override);
  return path.join(resolveRuntimeRoot(), 'uploads');
}

export function getPublicDir(): string {
  const override = process.env.PUBLIC_DIR?.trim();
  if (override) return resolveFromRuntimeHome(override);

  if (workspaceLayout) {
    const webDist = path.resolve(packageRoot, '..', 'web', 'dist');
    if (existsSync(path.join(webDist, 'index.html'))) {
      return webDist;
    }
  }

  return path.join(packageRoot, 'public');
}
