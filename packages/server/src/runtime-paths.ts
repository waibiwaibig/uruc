import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..');

function resolveRuntimePurpose(): 'test' | 'production' {
  return process.env.URUC_PURPOSE === 'production' ? 'production' : 'test';
}

export function getPackageRoot(): string {
  return packageRoot;
}

export function resolveFromPackageRoot(targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(packageRoot, targetPath);
}

export function getEnvPath(): string {
  return path.join(packageRoot, '.env');
}

export function getActiveEnvPath(): string {
  const override = process.env.URUC_SERVER_ENV_PATH;
  if (override && override.trim() !== '') {
    return path.resolve(override);
  }
  return getEnvPath();
}

export function getCityConfigPath(): string {
  const override = process.env.CITY_CONFIG_PATH;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return path.join(packageRoot, 'uruc.city.json');
}

export function getCityLockPath(): string {
  const override = process.env.CITY_LOCK_PATH;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return path.join(packageRoot, 'uruc.city.lock.json');
}

export function getPluginStoreDir(): string {
  const override = process.env.PLUGIN_STORE_DIR;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return path.join(packageRoot, '.uruc', 'plugins');
}

export function getDefaultDbRelativePath(purpose: 'test' | 'production' = resolveRuntimePurpose()): string {
  return purpose === 'production' ? './data/uruc.prod.db' : './data/uruc.local.db';
}

export function getDbPath(): string {
  const override = process.env.DB_PATH;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return resolveFromPackageRoot(getDefaultDbRelativePath(resolveRuntimePurpose()));
}

export function getUploadsDir(): string {
  const override = process.env.UPLOADS_DIR;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return path.join(packageRoot, 'uploads');
}

export function getPublicDir(): string {
  const override = process.env.PUBLIC_DIR;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);

  const humanWebDist = path.resolve(packageRoot, '..', 'human-web', 'dist');
  if (existsSync(path.join(humanWebDist, 'index.html'))) {
    return humanWebDist;
  }

  return path.join(packageRoot, 'public');
}
