import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import type { CityConfigFile, CityLockFile } from './types.js';

export const EMPTY_CITY_CONFIG: CityConfigFile = {
  apiVersion: 2,
  approvedPublishers: [],
  sources: [],
  plugins: {},
};

export const EMPTY_CITY_LOCK: CityLockFile = {
  apiVersion: 2,
  generatedAt: new Date(0).toISOString(),
  plugins: {},
};

async function ensureParentDir(targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

export async function readCityConfig(configPath: string): Promise<CityConfigFile> {
  try {
    const raw = JSON.parse(await readFile(configPath, 'utf8')) as CityConfigFile;
    return {
      ...EMPTY_CITY_CONFIG,
      ...raw,
      plugins: raw.plugins ?? {},
      sources: raw.sources ?? [],
      approvedPublishers: raw.approvedPublishers ?? [],
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return structuredClone(EMPTY_CITY_CONFIG);
    }
    throw error;
  }
}

export async function writeCityConfig(configPath: string, config: CityConfigFile): Promise<void> {
  await ensureParentDir(configPath);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export async function readCityLock(lockPath: string): Promise<CityLockFile> {
  try {
    const raw = JSON.parse(await readFile(lockPath, 'utf8')) as CityLockFile;
    return {
      ...EMPTY_CITY_LOCK,
      ...raw,
      plugins: raw.plugins ?? {},
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return structuredClone(EMPTY_CITY_LOCK);
    }
    throw error;
  }
}

export async function writeCityLock(lockPath: string, lock: CityLockFile): Promise<void> {
  await ensureParentDir(lockPath);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
}
