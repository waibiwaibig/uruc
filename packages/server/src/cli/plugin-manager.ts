import { existsSync } from 'fs';
import { readdir, rm } from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';

import { readCityConfig, readCityLock, writeCityConfig, writeCityLock } from '../core/plugin-platform/config.js';
import { readPluginPackageManifest } from '../core/plugin-platform/manifest.js';
import {
  inspectConfiguredPlugins,
  resolveConfiguredPlugin,
  summarizePluginChecks,
} from '../core/plugin-platform/inspection.js';
import { resolvePluginSourceRelease } from '../core/plugin-platform/source-registry.js';
import type { PluginDiagnostic } from '../core/plugin-platform/types.js';
import { PluginPlatformHost } from '../core/plugin-platform/host.js';
import { readOption } from './lib/argv.js';
import { ensureOfficialMarketplaceSource, OFFICIAL_PLUGIN_SOURCE_ID } from './lib/city.js';
import { createPluginScaffold, defaultPluginScaffoldDir } from './lib/plugin-scaffold.js';
import { getEnvPath, getPackageRoot, getCityConfigPath, getCityLockPath, getPluginStoreDir } from '../runtime-paths.js';

dotenv.config({ path: getEnvPath(), quiet: true });

const packageRoot = getPackageRoot();
const cityConfigPath = getCityConfigPath();
const cityLockPath = getCityLockPath();

function createHost(): PluginPlatformHost {
  return new PluginPlatformHost({
    configPath: cityConfigPath,
    lockPath: cityLockPath,
    packageRoot,
    pluginStoreDir: getPluginStoreDir(),
  });
}

function resolveMaybePath(value: string | undefined): string | null {
  if (!value) return null;
  const resolved = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
  return existsSync(resolved) ? resolved : null;
}

function formatResolutionFailures(failures: PluginDiagnostic[]): string {
  return failures
    .map((failure) => `${failure.pluginId} (${failure.lastError ?? 'unknown error'})`)
    .join('; ');
}

async function syncLock(options: { strictPluginId?: string } = {}): Promise<void> {
  const host = createHost();
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

async function installResolvedSourcePlugin(options: {
  config: Awaited<ReturnType<typeof readCityConfig>>;
  pluginId: string;
  packageName: string;
  version: string;
  sourceId: string;
}): Promise<void> {
  const existing = options.config.plugins[options.pluginId];
  options.config.plugins[options.pluginId] = {
    pluginId: options.pluginId,
    packageName: options.packageName,
    version: options.version,
    enabled: true,
    source: options.sourceId,
    permissionsGranted: existing?.permissionsGranted ?? [],
    config: existing?.config ?? {},
  };

  await writeCityConfig(cityConfigPath, options.config);
  await syncLock({ strictPluginId: options.pluginId });
}

function resolveTargetPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function resolveStoreRoot(config: Awaited<ReturnType<typeof readCityConfig>>): string {
  if (config.pluginStoreDir && path.isAbsolute(config.pluginStoreDir)) {
    return config.pluginStoreDir;
  }
  if (config.pluginStoreDir) {
    return path.resolve(packageRoot, config.pluginStoreDir);
  }
  return getPluginStoreDir();
}

export async function runPluginCommand(args: string[]): Promise<void> {
  const command = args[0] ?? 'list';

  try {
    switch (command) {
      case 'list':
        await listPlugins();
        return;
      case 'install':
        await installPlugin(args.slice(1));
        return;
      case 'add':
        await addPlugin(args.slice(1));
        return;
      case 'enable':
        await setPluginEnabled(args[1], true);
        return;
      case 'disable':
        await setPluginEnabled(args[1], false);
        return;
      case 'uninstall':
        await uninstallPlugin(args[1]);
        return;
      case 'update':
        await updatePlugin(args[1]);
        return;
      case 'rollback':
        await rollbackPlugin(args[1]);
        return;
      case 'inspect':
        await inspectPlugin(args[1]);
        return;
      case 'validate':
        await validatePlugin(args[1]);
        return;
      case 'doctor':
        await doctorPlugins();
        return;
      case 'gc':
        await garbageCollectPlugins(args.slice(1));
        return;
      case 'create':
        await createPlugin(args.slice(1));
        return;
      default:
        showHelp();
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function listPlugins(): Promise<void> {
  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);

  console.log('\n=== City Plugins ===\n');
  if (Object.keys(config.plugins).length === 0) {
    console.log('No plugins configured.\n');
    return;
  }

  for (const [pluginId, plugin] of Object.entries(config.plugins)) {
    const locked = lock.plugins[pluginId];
    const enabled = plugin.enabled ?? true ? 'enabled' : 'disabled';
    const revision = locked?.revision ?? 'unresolved';
    const version = locked?.version ?? plugin.version ?? 'n/a';
    console.log(`  ${pluginId.padEnd(22)} ${enabled.padEnd(9)} v${version.padEnd(8)} rev:${revision}`);
    if (plugin.devOverridePath) {
      console.log(`    path: ${plugin.devOverridePath}`);
    }
  }
  console.log();
}

async function installPlugin(args: string[]): Promise<void> {
  const config = await readCityConfig(cityConfigPath);
  const target = args[0];
  const sourceId = readOption(args, '--source');
  const requestedVersion = readOption(args, '--version');
  const maybePath = resolveMaybePath(target) ?? resolveMaybePath(args[1]);
  if (!maybePath) {
    if (!target) {
      throw new Error('Usage: uruc plugin install <path> or uruc plugin install <pluginId> [--source <id>] [--version <version>]');
    }

    const release = await resolvePluginSourceRelease({
      sources: config.sources,
      pluginId: target,
      sourceId,
      version: requestedVersion,
      baseDir: path.dirname(cityConfigPath),
    });

    await installResolvedSourcePlugin({
      config,
      pluginId: release.pluginId,
      packageName: release.packageName,
      version: release.version,
      sourceId: release.sourceId,
    });
    console.log(`✓ Installed ${target} from source ${release.sourceId} (${release.version})`);
    return;
  }

  const manifest = await readPluginPackageManifest(maybePath);
  const pluginId = args[0] && !resolveMaybePath(args[0]) ? args[0] : manifest.urucPlugin.pluginId;
  config.plugins[pluginId] = {
    pluginId,
    packageName: manifest.packageName,
    enabled: true,
    permissionsGranted: manifest.urucPlugin.permissions ?? [],
    devOverridePath: path.relative(path.dirname(cityConfigPath), manifest.packageRoot),
  };

  await writeCityConfig(cityConfigPath, config);
  await syncLock({ strictPluginId: pluginId });
  console.log(`✓ Installed ${pluginId} from ${manifest.packageRoot}`);
}

async function addPlugin(args: string[]): Promise<void> {
  const alias = args[0];
  if (!alias) {
    throw new Error('Usage: uruc plugin add <alias>');
  }

  const config = await readCityConfig(cityConfigPath);
  config.sources = ensureOfficialMarketplaceSource(config.sources ?? []);

  const release = await resolvePluginSourceRelease({
    sources: config.sources,
    alias,
    sourceId: OFFICIAL_PLUGIN_SOURCE_ID,
    baseDir: path.dirname(cityConfigPath),
  });

  await installResolvedSourcePlugin({
    config,
    pluginId: release.pluginId,
    packageName: release.packageName,
    version: release.version,
    sourceId: release.sourceId,
  });
  console.log(`✓ Added ${alias} from source ${release.sourceId} (${release.version})`);
}

async function setPluginEnabled(pluginId: string | undefined, enabled: boolean): Promise<void> {
  if (!pluginId) {
    throw new Error(`Usage: uruc plugin ${enabled ? 'enable' : 'disable'} <pluginId>`);
  }

  const config = await readCityConfig(cityConfigPath);
  const target = config.plugins[pluginId];
  if (!target) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }
  target.enabled = enabled;
  await writeCityConfig(cityConfigPath, config);
  await syncLock(enabled ? { strictPluginId: pluginId } : undefined);
  console.log(`✓ ${enabled ? 'Enabled' : 'Disabled'} ${pluginId}`);
}

async function uninstallPlugin(pluginId: string | undefined): Promise<void> {
  if (!pluginId) {
    throw new Error('Usage: uruc plugin uninstall <pluginId>');
  }

  const config = await readCityConfig(cityConfigPath);
  if (!config.plugins[pluginId]) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }

  delete config.plugins[pluginId];
  await writeCityConfig(cityConfigPath, config);
  await syncLock();
  console.log(`✓ Uninstalled ${pluginId} from the current city`);
}

async function updatePlugin(pluginId: string | undefined): Promise<void> {
  const config = await readCityConfig(cityConfigPath);
  if (pluginId && !config.plugins[pluginId]) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }

  const targets = pluginId ? [pluginId] : Object.keys(config.plugins);
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const targetId of targets) {
    const plugin = config.plugins[targetId];
    if (!plugin || plugin.devOverridePath) {
      continue;
    }

    let release;
    try {
      release = await resolvePluginSourceRelease({
        sources: config.sources,
        pluginId: targetId,
        sourceId: plugin.source,
        baseDir: path.dirname(cityConfigPath),
      });
    } catch (error) {
      if (pluginId) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      skipped.push(`${targetId} (${message})`);
      continue;
    }

    const changed = plugin.packageName !== release.packageName
      || plugin.version !== release.version
      || plugin.source !== release.sourceId;
    plugin.packageName = release.packageName;
    plugin.version = release.version;
    plugin.source = release.sourceId;
    if (changed) {
      updated.push(`${targetId}@${release.version}`);
    }
  }

  await writeCityConfig(cityConfigPath, config);

  await syncLock(pluginId ? { strictPluginId: pluginId } : undefined);
  if (skipped.length > 0) {
    console.warn(`Warning: skipped plugin updates: ${skipped.join('; ')}`);
  }
  if (pluginId) {
    console.log(`✓ Updated ${pluginId}${updated.length > 0 ? ` -> ${updated[0]!.split('@')[1]}` : ''}`);
    return;
  }
  console.log(`✓ Updated plugin lock file${updated.length > 0 ? ` (${updated.join(', ')})` : ''}`);
}

async function rollbackPlugin(pluginId: string | undefined): Promise<void> {
  if (!pluginId) {
    throw new Error('Usage: uruc plugin rollback <pluginId>');
  }

  const lock = await readCityLock(cityLockPath);
  const target = lock.plugins[pluginId];
  if (!target) {
    throw new Error(`Plugin ${pluginId} is not locked`);
  }

  const [previous, ...rest] = target.history;
  if (!previous) {
    throw new Error(`Plugin ${pluginId} has no previous revision to roll back to`);
  }

  target.history = rest;
  target.revision = previous.revision;
  target.version = previous.version;
  target.packageRoot = previous.packageRoot;
  target.entryPath = previous.entryPath;
  target.integrity = previous.integrity;
  target.sourceFingerprint = previous.sourceFingerprint;
  target.generatedAt = new Date().toISOString();

  await writeCityLock(cityLockPath, lock);
  console.log(`✓ Rolled back ${pluginId} to revision ${target.revision}`);
}

async function garbageCollectPlugins(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);
  const storeRoot = resolveStoreRoot(config);

  if (!existsSync(storeRoot)) {
    console.log('✓ Plugin store does not exist; nothing to collect');
    return;
  }

  const keep = new Set<string>();
  for (const plugin of Object.values(lock.plugins)) {
    keep.add(path.join(plugin.pluginId, plugin.revision));
    const recentHistory = plugin.history[0];
    if (recentHistory) {
      keep.add(path.join(plugin.pluginId, recentHistory.revision));
    }
  }

  const removals: string[] = [];
  const pluginDirs = await readdir(storeRoot, { withFileTypes: true });
  for (const pluginEntry of pluginDirs) {
    if (!pluginEntry.isDirectory()) {
      continue;
    }

    const pluginRoot = path.join(storeRoot, pluginEntry.name);
    const revisionEntries = await readdir(pluginRoot, { withFileTypes: true });
    for (const revisionEntry of revisionEntries) {
      if (!revisionEntry.isDirectory()) {
        continue;
      }

      const keepKey = path.join(pluginEntry.name, revisionEntry.name);
      if (keep.has(keepKey)) {
        continue;
      }

      removals.push(path.join(pluginRoot, revisionEntry.name));
    }
  }

  if (removals.length === 0) {
    console.log(`✓ Plugin store is already clean${dryRun ? ' (dry-run)' : ''}`);
    return;
  }

  if (dryRun) {
    console.log('Plugin GC dry-run would remove:');
    for (const target of removals) {
      console.log(`  - ${path.relative(storeRoot, target)}`);
    }
    return;
  }

  for (const target of removals) {
    await rm(target, { recursive: true, force: true });
  }

  for (const pluginEntry of pluginDirs) {
    if (!pluginEntry.isDirectory()) {
      continue;
    }

    const pluginRoot = path.join(storeRoot, pluginEntry.name);
    if (!existsSync(pluginRoot)) {
      continue;
    }
    const remaining = await readdir(pluginRoot);
    if (remaining.length === 0) {
      await rm(pluginRoot, { recursive: true, force: true });
    }
  }

  console.log(`✓ Removed ${removals.length} unused plugin revision${removals.length === 1 ? '' : 's'}`);
}

async function createPlugin(args: string[]): Promise<void> {
  const pluginId = args[0];
  if (!pluginId) {
    throw new Error('Usage: uruc plugin create <pluginId> [--frontend] [--dir <path>]');
  }

  const withFrontend = args.includes('--frontend');
  const outputDir = readOption(args, '--dir');
  const targetDir = outputDir
    ? resolveTargetPath(outputDir)
    : defaultPluginScaffoldDir(packageRoot, pluginId);

  if (existsSync(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  const result = await createPluginScaffold({
    pluginId,
    withFrontend,
    targetDir,
  });

  console.log(`✓ Created ${result.pluginId} at ${result.targetDir}`);
}

async function inspectPlugin(pluginId: string | undefined): Promise<void> {
  if (!pluginId) {
    throw new Error('Usage: uruc plugin inspect <pluginId>');
  }

  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);
  console.log(JSON.stringify({
    pluginId,
    config: config.plugins[pluginId] ?? null,
    lock: lock.plugins[pluginId] ?? null,
  }, null, 2));
}

async function validatePlugin(target: string | undefined): Promise<void> {
  const candidatePath = resolveMaybePath(target);
  if (candidatePath) {
    const manifest = await readPluginPackageManifest(candidatePath);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  const config = await readCityConfig(cityConfigPath);
  const pluginId = target;
  if (!pluginId || !config.plugins[pluginId]) {
    throw new Error('Usage: uruc plugin validate <pluginId|path>');
  }

  const resolved = await resolveConfiguredPlugin({
    config,
    configPath: cityConfigPath,
    pluginId,
    pluginConfig: config.plugins[pluginId],
  });
  console.log(JSON.stringify(resolved.manifest, null, 2));
}

async function doctorPlugins(): Promise<void> {
  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);
  const checks = await inspectConfiguredPlugins({
    config,
    lock,
    configPath: cityConfigPath,
  });
  const failures = checks.filter((item) => item.status === 'fail');
  const warnings = checks.filter((item) => item.status === 'warn');

  if (failures.length === 0 && warnings.length === 0) {
    console.log('✓ City plugin configuration is healthy');
    return;
  }

  console.log(`Plugin doctor summary: ${summarizePluginChecks(checks)}`);
  if (warnings.length > 0) {
    console.log('Plugin doctor warnings:');
    for (const warning of warnings) {
      console.log(`  - ${warning.pluginId}: ${warning.configDetail}; ${warning.lockDetail}`);
    }
  }
  if (failures.length > 0) {
    console.log('Plugin doctor found failures:');
    for (const failure of failures) {
      console.log(`  - ${failure.pluginId}: ${failure.configDetail}; ${failure.lockDetail}`);
    }
    process.exitCode = 1;
  }
}

function showHelp(): void {
  console.log(`
Plugin Manager (V2)

Usage:
  uruc plugin list
  uruc plugin add <alias>
  uruc plugin install <path>
  uruc plugin install <pluginId> [--source <id>] [--version <version>]
  uruc plugin enable <pluginId>
  uruc plugin disable <pluginId>
  uruc plugin uninstall <pluginId>
  uruc plugin update [pluginId]
  uruc plugin rollback <pluginId>
  uruc plugin inspect <pluginId>
  uruc plugin validate <pluginId|path>
  uruc plugin doctor
  uruc plugin gc [--dry-run]
  uruc plugin create <pluginId> [--frontend] [--dir <path>]
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runPluginCommand(process.argv.slice(2));
}
