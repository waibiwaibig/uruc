import { existsSync } from 'fs';
import path from 'path';

import { PluginPlatformHost } from '../../core/plugin-platform/host.js';
import { EMPTY_CITY_CONFIG, readCityConfig, writeCityConfig } from '../../core/plugin-platform/config.js';
import type { CityConfigFile, CityPluginSource } from '../../core/plugin-platform/types.js';
import type { BundledPluginId, BundledPluginState, ConfigurePluginPreset } from './types.js';

export const DEFAULT_PLUGIN_PRESET: ConfigurePluginPreset = 'social-only';
export const DEFAULT_PLUGIN_STORE_DIR = '.uruc/plugins';
export const OFFICIAL_PLUGIN_SOURCE_ID = 'official';
export const OFFICIAL_PLUGIN_REGISTRY_URL = 'https://uruk.life/market/registry.json';

const BUNDLED_PLUGINS: Array<{
  pluginId: BundledPluginId;
  packageName: string;
  packageDir: string;
}> = [
  { pluginId: 'uruc.social', packageName: '@uruc/plugin-social', packageDir: 'social' },
];

function defaultBundledPluginConfig(pluginId: BundledPluginId, currentConfig?: Record<string, unknown>): Record<string, unknown> {
  return currentConfig ?? {};
}

function isLikelyUrl(value: string): boolean {
  return /^[a-z]+:\/\//i.test(value);
}

function createOfficialMarketplaceSource(): CityPluginSource {
  return {
    id: OFFICIAL_PLUGIN_SOURCE_ID,
    type: 'npm',
    registry: OFFICIAL_PLUGIN_REGISTRY_URL,
  };
}

export function ensureOfficialMarketplaceSource(sources: CityPluginSource[]): CityPluginSource[] {
  if (sources.some((source) => source.id === OFFICIAL_PLUGIN_SOURCE_ID)) {
    return sources;
  }

  return [createOfficialMarketplaceSource(), ...sources];
}

export function rebaseCityConfigPaths(config: CityConfigFile, fromConfigPath: string, toConfigPath: string): CityConfigFile {
  if (fromConfigPath === toConfigPath) {
    return structuredClone(config);
  }

  const fromDir = path.dirname(fromConfigPath);
  const toDir = path.dirname(toConfigPath);

  return {
    ...config,
    sources: (config.sources ?? []).map((source) => ({
      ...source,
      registry: !source.registry || path.isAbsolute(source.registry) || isLikelyUrl(source.registry)
        ? source.registry
        : path.relative(toDir, path.resolve(fromDir, source.registry)),
    })),
    plugins: Object.fromEntries(
      Object.entries(config.plugins ?? {}).map(([pluginId, plugin]) => [
        pluginId,
        {
          ...plugin,
          devOverridePath: !plugin.devOverridePath || path.isAbsolute(plugin.devOverridePath)
            ? plugin.devOverridePath
            : path.relative(toDir, path.resolve(fromDir, plugin.devOverridePath)),
        },
      ]),
    ),
  };
}

export function getBundledPluginPresetState(
  preset: ConfigurePluginPreset,
  current?: Partial<BundledPluginState>,
): BundledPluginState {
  if (preset === 'empty-core') {
    return {
      'uruc.social': false,
    };
  }

  if (preset === 'custom') {
    return {
      'uruc.social': current?.['uruc.social'] ?? true,
    };
  }

  return {
    'uruc.social': true,
  };
}

export function detectBundledPluginState(config: CityConfigFile): BundledPluginState {
  return {
    'uruc.social': config.plugins['uruc.social']?.enabled ?? false,
  };
}

export function inferPluginPreset(state: BundledPluginState): ConfigurePluginPreset {
  const socialOnly = getBundledPluginPresetState('social-only');
  const empty = getBundledPluginPresetState('empty-core');
  if (JSON.stringify(state) === JSON.stringify(socialOnly)) return 'social-only';
  if (JSON.stringify(state) === JSON.stringify(empty)) return 'empty-core';
  return 'custom';
}

function toRelativePluginPath(configPath: string, packageRoot: string, packageDir: string): string {
  const target = path.resolve(packageRoot, '..', 'plugins', packageDir);
  const relative = path.relative(path.dirname(configPath), target);
  return relative === '' ? '.' : relative;
}

export function applyBundledPluginStateToConfig(
  configPath: string,
  packageRoot: string,
  config: CityConfigFile,
  state: BundledPluginState,
  pluginStoreDir: string,
): CityConfigFile {
  const next: CityConfigFile = {
    ...EMPTY_CITY_CONFIG,
    ...config,
    apiVersion: 2,
    approvedPublishers: Array.from(new Set(['uruc', ...(config.approvedPublishers ?? [])])),
    pluginStoreDir: pluginStoreDir || config.pluginStoreDir || DEFAULT_PLUGIN_STORE_DIR,
    plugins: { ...(config.plugins ?? {}) },
    sources: ensureOfficialMarketplaceSource(config.sources ?? []),
  };

  for (const bundled of BUNDLED_PLUGINS) {
    const current = next.plugins[bundled.pluginId] ?? { pluginId: bundled.pluginId };
    next.plugins[bundled.pluginId] = {
      ...current,
      pluginId: bundled.pluginId,
      packageName: bundled.packageName,
      enabled: state[bundled.pluginId],
      permissionsGranted: current.permissionsGranted ?? [],
      config: defaultBundledPluginConfig(bundled.pluginId, current.config),
      devOverridePath: toRelativePluginPath(configPath, packageRoot, bundled.packageDir),
      source: undefined,
      version: undefined,
    };
  }

  return next;
}

export interface EnsureCityConfigOptions {
  configPath: string;
  packageRoot: string;
  preset?: ConfigurePluginPreset;
  pluginState?: BundledPluginState;
  pluginStoreDir?: string;
  createIfMissing?: boolean;
  mutateExisting?: boolean;
  baseConfig?: CityConfigFile;
}

export async function ensureCityConfig(options: EnsureCityConfigOptions): Promise<CityConfigFile> {
  const createIfMissing = options.createIfMissing ?? true;
  const mutateExisting = options.mutateExisting ?? true;
  const hasConfig = existsSync(options.configPath);
  if (!hasConfig && !createIfMissing) {
    throw new Error(`City config does not exist at ${options.configPath}`);
  }

  const base = options.baseConfig ?? (hasConfig ? await readCityConfig(options.configPath) : {
    ...EMPTY_CITY_CONFIG,
    apiVersion: 2,
    approvedPublishers: ['uruc'],
    pluginStoreDir: options.pluginStoreDir ?? DEFAULT_PLUGIN_STORE_DIR,
    plugins: {},
    sources: [],
  });

  let next: CityConfigFile = {
    ...base,
    approvedPublishers: Array.from(new Set(['uruc', ...(base.approvedPublishers ?? [])])),
    pluginStoreDir: options.pluginStoreDir ?? base.pluginStoreDir ?? DEFAULT_PLUGIN_STORE_DIR,
    sources: ensureOfficialMarketplaceSource(base.sources ?? []),
  };

  if (!hasConfig || mutateExisting) {
    const state = options.pluginState ?? getBundledPluginPresetState(
      options.preset ?? DEFAULT_PLUGIN_PRESET,
      detectBundledPluginState(base),
    );
    next = applyBundledPluginStateToConfig(
      options.configPath,
      options.packageRoot,
      next,
      state,
      next.pluginStoreDir ?? DEFAULT_PLUGIN_STORE_DIR,
    );
  }

  await writeCityConfig(options.configPath, next);
  return next;
}

export interface SyncCityLockOptions {
  configPath: string;
  lockPath: string;
  packageRoot: string;
  pluginStoreDir: string;
}

export async function syncCityLock(options: SyncCityLockOptions): Promise<void> {
  const host = new PluginPlatformHost({
    configPath: options.configPath,
    lockPath: options.lockPath,
    packageRoot: options.packageRoot,
    pluginStoreDir: options.pluginStoreDir,
  });
  await host.syncLockFile();
}

export interface PrepareCityRuntimeOptions extends SyncCityLockOptions {
  defaultPreset?: ConfigurePluginPreset;
  autoCreateDefault?: boolean;
}

export async function prepareCityRuntime(options: PrepareCityRuntimeOptions): Promise<'created' | 'synced'> {
  if (!existsSync(options.configPath)) {
    if (!options.autoCreateDefault) {
      throw new Error(`City config does not exist at ${options.configPath}`);
    }

    await ensureCityConfig({
      configPath: options.configPath,
      packageRoot: options.packageRoot,
      preset: options.defaultPreset ?? DEFAULT_PLUGIN_PRESET,
      pluginStoreDir: DEFAULT_PLUGIN_STORE_DIR,
      createIfMissing: true,
      mutateExisting: true,
    });
    await syncCityLock(options);
    return 'created';
  }

  await syncCityLock(options);
  return 'synced';
}
