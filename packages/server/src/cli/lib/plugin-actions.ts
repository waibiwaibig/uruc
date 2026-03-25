import { existsSync } from 'fs';
import path from 'path';

import { readCityConfig, readCityLock, writeCityConfig } from '../../core/plugin-platform/config.js';
import { readPluginPackageManifest } from '../../core/plugin-platform/manifest.js';
import { resolvePluginSourceRelease } from '../../core/plugin-platform/source-registry.js';
import type { CityConfigFile, PluginDiagnostic } from '../../core/plugin-platform/types.js';
import { PluginPlatformHost } from '../../core/plugin-platform/host.js';
import { getCityConfigPath, getCityLockPath, getPackageRoot, getPluginStoreDir } from '../../runtime-paths.js';
import { ensureOfficialMarketplaceSource, OFFICIAL_PLUGIN_SOURCE_ID } from './city.js';

const packageRoot = getPackageRoot();
const cityConfigPath = getCityConfigPath();
const cityLockPath = getCityLockPath();

export interface PluginActionPaths {
  configPath?: string;
  lockPath?: string;
  packageRoot?: string;
  pluginStoreDir?: string;
}

export interface PluginListRecord {
  pluginId: string;
  packageName?: string;
  enabled: boolean;
  installOrigin: 'linked-path' | 'source-registry';
  linkedPath?: string;
  sourceId?: string;
  configuredVersion?: string;
  revision?: string;
  runtimeStorePath?: string;
}

function resolveActionPaths(overrides: PluginActionPaths = {}) {
  return {
    configPath: overrides.configPath ?? cityConfigPath,
    lockPath: overrides.lockPath ?? cityLockPath,
    packageRoot: overrides.packageRoot ?? packageRoot,
    pluginStoreDir: overrides.pluginStoreDir ?? getPluginStoreDir(),
  };
}

function createHost(overrides: PluginActionPaths = {}): PluginPlatformHost {
  const resolved = resolveActionPaths(overrides);
  return new PluginPlatformHost({
    configPath: resolved.configPath,
    lockPath: resolved.lockPath,
    packageRoot: resolved.packageRoot,
    pluginStoreDir: resolved.pluginStoreDir,
  });
}

function formatResolutionFailures(failures: PluginDiagnostic[]): string {
  return failures
    .map((failure) => `${failure.pluginId} (${failure.lastError ?? 'unknown error'})`)
    .join('; ');
}

function toPluginListRecords(
  config: CityConfigFile,
  lock: Awaited<ReturnType<typeof readCityLock>>,
): PluginListRecord[] {
  return Object.keys(config.plugins)
    .sort((left, right) => left.localeCompare(right))
    .map((pluginId) => {
      const plugin = config.plugins[pluginId]!;
      const locked = lock.plugins[pluginId];
      return {
        pluginId,
        packageName: plugin.packageName,
        enabled: plugin.enabled ?? true,
        installOrigin: plugin.devOverridePath ? 'linked-path' : 'source-registry',
        linkedPath: plugin.devOverridePath,
        sourceId: plugin.source,
        configuredVersion: plugin.version,
        revision: locked?.revision,
        runtimeStorePath: locked?.packageRoot,
      } satisfies PluginListRecord;
    });
}

export async function syncConfiguredPluginLock(
  options: PluginActionPaths & { strictPluginId?: string } = {},
): Promise<void> {
  const host = createHost(options);
  const lock = await host.syncLockFile();
  const failures = host.getPluginDiagnostics().filter((item) => item.state === 'failed');

  if (failures.length > 0) {
    console.warn(`Warning: unresolved plugins were skipped during lock sync: ${formatResolutionFailures(failures)}`);
  }

  if (options.strictPluginId && !lock.plugins[options.strictPluginId]) {
    const failure = failures.find((item) => item.pluginId === options.strictPluginId);
    if (failure?.lastError) {
      throw new Error(`Plugin ${options.strictPluginId} could not be resolved: ${failure.lastError}`);
    }
    throw new Error(`Plugin ${options.strictPluginId} could not be resolved`);
  }
}

function mergePluginConfigEntry(options: {
  config: CityConfigFile;
  pluginId: string;
  packageName: string;
  version?: string;
  sourceId?: string;
  devOverridePath?: string;
}): void {
  const existing = options.config.plugins[options.pluginId];
  options.config.plugins[options.pluginId] = {
    pluginId: options.pluginId,
    packageName: options.packageName,
    version: options.version,
    enabled: existing?.enabled ?? true,
    source: options.sourceId,
    permissionsGranted: existing?.permissionsGranted ?? [],
    config: existing?.config ?? {},
    devOverridePath: options.devOverridePath,
  };
}

async function resolveInstallRelease(options: {
  config: CityConfigFile;
  target: string;
  sourceId?: string;
  requestedVersion?: string;
  paths?: PluginActionPaths;
}) {
  const resolved = resolveActionPaths(options.paths);
  const sources = options.sourceId
    ? options.config.sources
    : ensureOfficialMarketplaceSource(options.config.sources ?? []);
  options.config.sources = sources;

  try {
    return await resolvePluginSourceRelease({
      sources,
      pluginId: options.target,
      sourceId: options.sourceId,
      version: options.requestedVersion,
      baseDir: path.dirname(resolved.configPath),
    });
  } catch (pluginError) {
    const aliasSourceId = options.sourceId ?? OFFICIAL_PLUGIN_SOURCE_ID;
    try {
      return await resolvePluginSourceRelease({
        sources,
        alias: options.target,
        sourceId: aliasSourceId,
        version: options.requestedVersion,
        baseDir: path.dirname(resolved.configPath),
      });
    } catch (aliasError) {
      throw aliasError instanceof Error ? aliasError : pluginError;
    }
  }
}

export function resolvePluginInputPath(value: string | undefined): string | null {
  if (!value) return null;
  const resolved = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
  return existsSync(resolved) ? resolved : null;
}

export async function listConfiguredPlugins(paths: PluginActionPaths = {}): Promise<PluginListRecord[]> {
  const resolved = resolveActionPaths(paths);
  const config = await readCityConfig(resolved.configPath);
  const lock = await readCityLock(resolved.lockPath);
  return toPluginListRecords(config, lock);
}

export async function installSourcePlugin(options: {
  target: string;
  sourceId?: string;
  requestedVersion?: string;
  paths?: PluginActionPaths;
}): Promise<{ pluginId: string; packageName: string; sourceId: string; version: string }> {
  const resolved = resolveActionPaths(options.paths);
  const config = await readCityConfig(resolved.configPath);
  const release = await resolveInstallRelease({
    config,
    target: options.target,
    sourceId: options.sourceId,
    requestedVersion: options.requestedVersion,
    paths: resolved,
  });

  mergePluginConfigEntry({
    config,
    pluginId: release.pluginId,
    packageName: release.packageName,
    version: release.version,
    sourceId: release.sourceId,
  });

  await writeCityConfig(resolved.configPath, config);
  await syncConfiguredPluginLock({ ...resolved, strictPluginId: release.pluginId });
  return release;
}

export async function linkLocalPlugin(
  targetPath: string,
  paths: PluginActionPaths = {},
): Promise<{ pluginId: string; resolvedPath: string }> {
  const resolved = resolveActionPaths(paths);
  const config = await readCityConfig(resolved.configPath);
  const manifest = await readPluginPackageManifest(targetPath);
  const pluginId = manifest.urucPlugin.pluginId;

  mergePluginConfigEntry({
    config,
    pluginId,
    packageName: manifest.packageName,
    devOverridePath: path.relative(path.dirname(resolved.configPath), manifest.packageRoot),
  });

  await writeCityConfig(resolved.configPath, config);
  await syncConfiguredPluginLock({ ...resolved, strictPluginId: pluginId });
  return { pluginId, resolvedPath: targetPath };
}

export async function setConfiguredPluginEnabled(
  pluginId: string,
  enabled: boolean,
  paths: PluginActionPaths = {},
): Promise<void> {
  const resolved = resolveActionPaths(paths);
  const config = await readCityConfig(resolved.configPath);
  const target = config.plugins[pluginId];
  if (!target) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }
  target.enabled = enabled;
  await writeCityConfig(resolved.configPath, config);
  await syncConfiguredPluginLock(enabled ? { ...resolved, strictPluginId: pluginId } : resolved);
}

export async function removeConfiguredPlugin(pluginId: string, paths: PluginActionPaths = {}): Promise<void> {
  const resolved = resolveActionPaths(paths);
  const config = await readCityConfig(resolved.configPath);
  if (!config.plugins[pluginId]) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }

  delete config.plugins[pluginId];
  await writeCityConfig(resolved.configPath, config);
  await syncConfiguredPluginLock(resolved);
}

export async function unlinkConfiguredPlugin(pluginId: string, paths: PluginActionPaths = {}): Promise<void> {
  const resolved = resolveActionPaths(paths);
  const config = await readCityConfig(resolved.configPath);
  const plugin = config.plugins[pluginId];
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }
  if (!plugin.devOverridePath) {
    throw new Error(`Plugin ${pluginId} is not linked from a workspace path. Use \`uruc plugin remove ${pluginId}\` instead.`);
  }

  delete config.plugins[pluginId];
  await writeCityConfig(resolved.configPath, config);
  await syncConfiguredPluginLock(resolved);
}
