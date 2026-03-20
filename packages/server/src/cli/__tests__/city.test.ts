import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { readCityConfig, readCityLock } from '../../core/plugin-platform/config.js';
import {
  DEFAULT_PLUGIN_PRESET,
  DEFAULT_PLUGIN_STORE_DIR,
  ensureCityConfig,
  prepareCityRuntime,
} from '../lib/city.js';
import { getPackageRoot } from '../../runtime-paths.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('city runtime preparation', () => {
  it('writes the social-only bundled plugin state into a new city config', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-city-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');

    const config = await ensureCityConfig({
      configPath: cityConfigPath,
      packageRoot: getPackageRoot(),
      preset: DEFAULT_PLUGIN_PRESET,
      pluginStoreDir: DEFAULT_PLUGIN_STORE_DIR,
    });

    expect(config.plugins['uruc.social']?.enabled).toBe(true);
    expect(config.plugins['uruc.social']?.devOverridePath).toContain('plugins/social');
  });

  it('writes the official marketplace source into a fresh city config', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-city-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');

    const config = await ensureCityConfig({
      configPath: cityConfigPath,
      packageRoot: getPackageRoot(),
      preset: DEFAULT_PLUGIN_PRESET,
      pluginStoreDir: DEFAULT_PLUGIN_STORE_DIR,
    });

    expect(config.sources).toContainEqual(expect.objectContaining({
      id: 'official',
      type: 'npm',
      registry: 'https://uruk.life/market/registry.json',
    }));
  });

  it('auto-creates a default city config and lock during runtime preparation', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-city-'));
    tempDirs.push(tempRoot);
    const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
    const cityLockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    const result = await prepareCityRuntime({
      configPath: cityConfigPath,
      lockPath: cityLockPath,
      packageRoot: getPackageRoot(),
      pluginStoreDir,
      defaultPreset: DEFAULT_PLUGIN_PRESET,
      autoCreateDefault: true,
    });

    const config = await readCityConfig(cityConfigPath);
    const lock = await readCityLock(cityLockPath);
    const rawLock = JSON.parse(await readFile(cityLockPath, 'utf8')) as { plugins: Record<string, { revision: string }> };

    expect(result).toBe('created');
    expect(config.plugins['uruc.social']?.enabled).toBe(true);
    expect(lock.plugins['uruc.social']?.enabled).toBe(true);
    expect(rawLock.plugins['uruc.social']?.revision).toBeTruthy();
  });
});
