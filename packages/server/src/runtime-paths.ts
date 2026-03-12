import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..');

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

export function getPluginConfigFilename(env: string = process.env.NODE_ENV ?? 'development'): string {
  return env === 'production' ? 'plugins.prod.json' : 'plugins.dev.json';
}

export function getPluginConfigPath(): string {
  const override = process.env.PLUGIN_CONFIG_PATH;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return path.join(packageRoot, getPluginConfigFilename());
}

export function getDbPath(): string {
  const override = process.env.DB_PATH;
  if (override && override.trim() !== '') return resolveFromPackageRoot(override);
  return path.join(packageRoot, 'data', 'uruc.db');
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
