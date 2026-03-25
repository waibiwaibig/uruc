import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import dotenv from 'dotenv';

import { readCityConfig, readCityLock, writeCityConfig, writeCityLock } from '../core/plugin-platform/config.js';
import { readPluginPackageManifest, validatePluginPackageContract } from '../core/plugin-platform/manifest.js';
import {
  inspectConfiguredPlugins,
  resolveConfiguredPlugin,
  summarizePluginChecks,
} from '../core/plugin-platform/inspection.js';
import { listPluginSourceCatalog, resolvePluginSourceRelease } from '../core/plugin-platform/source-registry.js';
import type { CityConfigFile, PluginDiagnostic } from '../core/plugin-platform/types.js';
import { PluginPlatformHost } from '../core/plugin-platform/host.js';
import { readOption } from './lib/argv.js';
import { BUNDLED_PLUGINS, ensureOfficialMarketplaceSource, OFFICIAL_PLUGIN_SOURCE_ID } from './lib/city.js';
import { createPluginScaffold, defaultPluginScaffoldDir } from './lib/plugin-scaffold.js';
import type { CommandContext } from './lib/types.js';
import { getEnvPath, getPackageRoot, getCityConfigPath, getCityLockPath, getPluginStoreDir } from '../runtime-paths.js';

dotenv.config({ path: getEnvPath(), quiet: true });

const packageRoot = getPackageRoot();
const cityConfigPath = getCityConfigPath();
const cityLockPath = getCityLockPath();
const execFileAsync = promisify(execFile);

interface PluginListRecord {
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

interface ScanWorkspaceRecord {
  pluginId: string;
  packageName: string;
  label: string;
  path: string;
}

interface ScanSourceRecord {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
  alias?: string;
  sourceId: string;
  registry: string;
}

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

function formatResolutionFailures(failures: PluginDiagnostic[]): string {
  return failures
    .map((failure) => `${failure.pluginId} (${failure.lastError ?? 'unknown error'})`)
    .join('; ');
}

function workspacePathFromPackageDir(packageDir: string): string {
  return path.resolve(packageRoot, '..', 'plugins', packageDir);
}

function toPluginListRecords(config: CityConfigFile, lock: Awaited<ReturnType<typeof readCityLock>>): PluginListRecord[] {
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

function emitJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
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

async function installResolvedSourcePlugin(options: {
  config: CityConfigFile;
  pluginId: string;
  packageName: string;
  version: string;
  sourceId: string;
}): Promise<void> {
  mergePluginConfigEntry({
    config: options.config,
    pluginId: options.pluginId,
    packageName: options.packageName,
    version: options.version,
    sourceId: options.sourceId,
  });

  await writeCityConfig(cityConfigPath, options.config);
  await syncLock({ strictPluginId: options.pluginId });
}

async function linkWorkspacePlugin(targetPath: string): Promise<string> {
  const config = await readCityConfig(cityConfigPath);
  const manifest = await readPluginPackageManifest(targetPath);
  const pluginId = manifest.urucPlugin.pluginId;

  mergePluginConfigEntry({
    config,
    pluginId,
    packageName: manifest.packageName,
    devOverridePath: path.relative(path.dirname(cityConfigPath), manifest.packageRoot),
  });

  await writeCityConfig(cityConfigPath, config);
  await syncLock({ strictPluginId: pluginId });
  return pluginId;
}

async function resolveInstallRelease(options: {
  config: CityConfigFile;
  target: string;
  sourceId?: string;
  requestedVersion?: string;
}) {
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
      baseDir: path.dirname(cityConfigPath),
    });
  } catch (pluginError) {
    const aliasSourceId = options.sourceId ?? OFFICIAL_PLUGIN_SOURCE_ID;
    try {
      return await resolvePluginSourceRelease({
        sources,
        alias: options.target,
        sourceId: aliasSourceId,
        version: options.requestedVersion,
        baseDir: path.dirname(cityConfigPath),
      });
    } catch (aliasError) {
      throw aliasError instanceof Error ? aliasError : pluginError;
    }
  }
}

function requireNoLegacyPathInstall(target: string | undefined, next: string | undefined): void {
  const maybePath = resolveMaybePath(target) ?? resolveMaybePath(next);
  if (maybePath) {
    throw new Error('`uruc plugin install <path>` was removed. Use `uruc plugin link <path>`.');
  }
}

function assertUsage(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function listPlugins(context: CommandContext): Promise<void> {
  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);
  const records = toPluginListRecords(config, lock);

  if (context.json) {
    emitJson({ plugins: records });
    return;
  }

  console.log('\n=== Installed Plugins ===\n');
  if (records.length === 0) {
    console.log('No installed plugins.\n');
    return;
  }

  for (const record of records) {
    const enabled = record.enabled ? 'enabled' : 'disabled';
    const version = record.configuredVersion ?? 'n/a';
    const revision = record.revision ?? 'unresolved';
    console.log(`  ${record.pluginId.padEnd(22)} ${enabled.padEnd(9)} ${record.installOrigin.padEnd(15)} v${version.padEnd(8)} rev:${revision}`);
    if (record.linkedPath) {
      console.log(`    workspace path: ${record.linkedPath}`);
    }
    if (record.sourceId) {
      console.log(`    source: ${record.sourceId}`);
    }
    if (record.runtimeStorePath) {
      console.log(`    runtime store: ${record.runtimeStorePath}`);
    }
  }
  console.log();
}

async function installPlugin(args: string[]): Promise<void> {
  const target = args[0];
  assertUsage(target, 'Usage: uruc plugin install <pluginId-or-alias> [--source <id>] [--version <version>]');
  requireNoLegacyPathInstall(target, args[1]);

  const config = await readCityConfig(cityConfigPath);
  const release = await resolveInstallRelease({
    config,
    target,
    sourceId: readOption(args, '--source'),
    requestedVersion: readOption(args, '--version'),
  });

  await installResolvedSourcePlugin({
    config,
    pluginId: release.pluginId,
    packageName: release.packageName,
    version: release.version,
    sourceId: release.sourceId,
  });
  console.log(`✓ Installed ${release.pluginId} from source ${release.sourceId} (${release.version})`);
}

async function linkPlugin(args: string[]): Promise<void> {
  const candidatePath = resolveMaybePath(args[0]);
  assertUsage(candidatePath, 'Usage: uruc plugin link <path>');

  const pluginId = await linkWorkspacePlugin(candidatePath);
  console.log(`✓ Linked ${pluginId} from ${candidatePath}`);
}

async function setPluginEnabled(pluginId: string | undefined, enabled: boolean): Promise<void> {
  assertUsage(pluginId, `Usage: uruc plugin ${enabled ? 'enable' : 'disable'} <pluginId>`);

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

async function removePlugin(pluginId: string | undefined): Promise<void> {
  assertUsage(pluginId, 'Usage: uruc plugin remove <pluginId>');

  const config = await readCityConfig(cityConfigPath);
  if (!config.plugins[pluginId]) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }

  delete config.plugins[pluginId];
  await writeCityConfig(cityConfigPath, config);
  await syncLock();
  console.log(`✓ Removed ${pluginId} from the current city`);
}

async function unlinkPlugin(pluginId: string | undefined): Promise<void> {
  assertUsage(pluginId, 'Usage: uruc plugin unlink <pluginId>');

  const config = await readCityConfig(cityConfigPath);
  const plugin = config.plugins[pluginId];
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} is not configured`);
  }
  if (!plugin.devOverridePath) {
    throw new Error(`Plugin ${pluginId} is not linked from a workspace path. Use \`uruc plugin remove ${pluginId}\` instead.`);
  }

  await removePlugin(pluginId);
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
  assertUsage(pluginId, 'Usage: uruc plugin rollback <pluginId>');

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
  target.frontend = previous.frontend;
  target.integrity = previous.integrity;
  target.sourceFingerprint = previous.sourceFingerprint;
  target.generatedAt = new Date().toISOString();

  await writeCityLock(cityLockPath, lock);
  console.log(`✓ Rolled back ${pluginId} to revision ${target.revision}`);
}

async function inspectPlugin(pluginId: string | undefined, jsonMode: boolean): Promise<void> {
  assertUsage(pluginId, 'Usage: uruc plugin inspect <pluginId>');

  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);
  const pluginConfig = config.plugins[pluginId] ?? null;
  const locked = lock.plugins[pluginId] ?? null;
  const record = pluginConfig
    ? toPluginListRecords(config, lock).find((item) => item.pluginId === pluginId) ?? null
    : null;

  const payload = {
    pluginId,
    summary: record,
    config: pluginConfig,
    lock: locked,
  };
  if (jsonMode) {
    emitJson(payload);
    return;
  }
  emitJson(payload);
}

async function validatePlugin(target: string | undefined): Promise<void> {
  const candidatePath = resolveMaybePath(target);
  if (candidatePath) {
    const manifest = await readPluginPackageManifest(candidatePath);
    await validatePluginPackageContract(
      candidatePath,
      manifest,
      manifest.frontendBuild ? 'distribution' : 'source',
    );
    emitJson(manifest);
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
  emitJson(resolved.manifest);
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

async function buildPluginFrontendForPack(packageRootPath: string): Promise<void> {
  const buildScriptPath = path.resolve(packageRoot, '..', '..', 'scripts', 'build-plugin-frontend.mjs');

  try {
    await execFileAsync(process.execPath, [
      buildScriptPath,
      '--plugin',
      packageRootPath,
      '--out',
      path.join(packageRootPath, 'frontend-dist'),
    ], {
      cwd: path.resolve(packageRoot, '..', '..'),
      env: process.env,
    });
  } catch (error: any) {
    const message = error?.stderr?.trim()
      || error?.stdout?.trim()
      || error?.message
      || String(error);
    throw new Error(`Failed to build plugin frontend for packaging: ${message}`);
  }
}

async function packPlugin(args: string[]): Promise<void> {
  const candidatePath = resolveMaybePath(args[0]);
  assertUsage(candidatePath, 'Usage: uruc plugin pack <path> [--out <dir>]');

  const manifest = await readPluginPackageManifest(candidatePath);
  const outputArg = readOption(args, '--out');
  const outputDir = outputArg
    ? resolveTargetPath(outputArg)
    : path.resolve(process.cwd(), 'dist', 'plugins');
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-pack-stage-'));
  const npmCacheDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-pack-cache-'));
  const stagedPackageRoot = path.join(stagingRoot, path.basename(candidatePath));

  try {
    await mkdir(outputDir, { recursive: true });
    await cp(candidatePath, stagedPackageRoot, {
      recursive: true,
      force: true,
    });
    await rm(path.join(stagedPackageRoot, 'frontend-dist'), { recursive: true, force: true });

    if (manifest.urucFrontend) {
      await buildPluginFrontendForPack(stagedPackageRoot);
    }
    const stagedManifest = await readPluginPackageManifest(stagedPackageRoot);
    await validatePluginPackageContract(stagedPackageRoot, stagedManifest, 'distribution');

    const { stdout } = await execFileAsync('npm', ['pack', stagedPackageRoot], {
      cwd: outputDir,
      env: {
        ...process.env,
        npm_config_cache: npmCacheDir,
      },
    });
    const tarballName = stdout.trim().split('\n').filter(Boolean).at(-1);
    if (!tarballName) {
      throw new Error(`npm pack did not produce a tarball for ${manifest.packageName}`);
    }

    const tarballPath = path.join(outputDir, tarballName);
    const tarball = await readFile(tarballPath);
    const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;

    console.log(`✓ Packed ${manifest.urucPlugin.pluginId} -> ${tarballPath}`);
    console.log(`integrity: ${integrity}`);
  } finally {
    await Promise.all([
      rm(stagingRoot, { recursive: true, force: true }),
      rm(npmCacheDir, { recursive: true, force: true }),
    ]);
  }
}

async function createPlugin(args: string[]): Promise<void> {
  const pluginId = args[0];
  assertUsage(pluginId, 'Usage: uruc plugin create <pluginId> [--frontend] [--dir <path>]');

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

async function listWorkspacePlugins(): Promise<ScanWorkspaceRecord[]> {
  return BUNDLED_PLUGINS.map((plugin) => ({
    pluginId: plugin.pluginId,
    packageName: plugin.packageName,
    label: plugin.label,
    path: workspacePathFromPackageDir(plugin.packageDir),
  }));
}

async function scanPlugins(context: CommandContext): Promise<void> {
  const scope = readOption(context.args.slice(1), '--scope') ?? 'all';
  const config = await readCityConfig(cityConfigPath);
  const lock = await readCityLock(cityLockPath);

  const includeWorkspace = scope === 'all' || scope === 'workspace';
  const includeSources = scope === 'all' || scope === 'sources';
  const includeInstalled = scope === 'all' || scope === 'installed';

  const workspace = includeWorkspace ? await listWorkspacePlugins() : [];
  const sources = includeSources
    ? (await listPluginSourceCatalog({
      sources: config.sources,
      baseDir: path.dirname(cityConfigPath),
    })).map((release) => ({
      pluginId: release.pluginId,
      packageName: release.packageName,
      version: release.version,
      publisher: release.publisher,
      alias: release.alias,
      sourceId: release.sourceId,
      registry: release.registry,
    } satisfies ScanSourceRecord))
    : [];
  const installed = includeInstalled ? toPluginListRecords(config, lock) : [];

  const payload = { workspace, sources, installed };
  if (context.json) {
    emitJson(payload);
    return;
  }

  console.log('\n=== Plugin Scan ===\n');
  console.log(`workspace: ${workspace.length}`);
  console.log(`sources:   ${sources.length}`);
  console.log(`installed: ${installed.length}`);
  console.log();
}

async function pluginSourceCommand(args: string[], jsonMode: boolean): Promise<void> {
  const command = args[0] ?? 'list';
  const config = await readCityConfig(cityConfigPath);

  switch (command) {
    case 'list': {
      if (jsonMode) {
        emitJson(config.sources);
        return;
      }
      if (config.sources.length === 0) {
        console.log('No plugin sources configured.');
        return;
      }
      for (const source of config.sources) {
        console.log(`${source.id}: ${source.registry}`);
      }
      return;
    }
    case 'add': {
      const [id, registry] = [args[1], args[2]];
      assertUsage(id && registry, 'Usage: uruc plugin source add <id> <registry>');
      config.sources = config.sources.filter((source) => source.id !== id);
      config.sources.push({ id, type: 'npm', registry });
      await writeCityConfig(cityConfigPath, config);
      console.log(`✓ Added source ${id}`);
      return;
    }
    case 'remove': {
      const id = args[1];
      assertUsage(id, 'Usage: uruc plugin source remove <id>');
      config.sources = config.sources.filter((source) => source.id !== id);
      await writeCityConfig(cityConfigPath, config);
      console.log(`✓ Removed source ${id}`);
      return;
    }
    default:
      throw new Error(`Unknown plugin source command: ${command}`);
  }
}

function showHelp(): void {
  console.log(`
Plugin CLI

Runtime Management:
  uruc plugin list
  uruc plugin install <pluginId-or-alias> [--source <id>] [--version <version>]
  uruc plugin link <path>
  uruc plugin remove <pluginId>
  uruc plugin unlink <pluginId>
  uruc plugin enable <pluginId>
  uruc plugin disable <pluginId>
  uruc plugin update [pluginId]
  uruc plugin rollback <pluginId>
  uruc plugin inspect <pluginId>
  uruc plugin validate <pluginId|path>
  uruc plugin doctor
  uruc plugin gc [--dry-run]
  uruc plugin source list|add|remove

Discovery:
  uruc plugin scan [--scope workspace|sources|installed|all]

Authoring:
  uruc plugin create <pluginId> [--frontend] [--dir <path>]
  uruc plugin pack <path> [--out <dir>]
  `);
}

export async function runPluginCommand(context: CommandContext): Promise<void> {
  const command = context.args[0] ?? 'list';

  switch (command) {
    case 'list':
      await listPlugins(context);
      return;
    case 'install':
      await installPlugin(context.args.slice(1));
      return;
    case 'link':
      await linkPlugin(context.args.slice(1));
      return;
    case 'enable':
      await setPluginEnabled(context.args[1], true);
      return;
    case 'disable':
      await setPluginEnabled(context.args[1], false);
      return;
    case 'remove':
      await removePlugin(context.args[1]);
      return;
    case 'unlink':
      await unlinkPlugin(context.args[1]);
      return;
    case 'update':
      await updatePlugin(context.args[1]);
      return;
    case 'rollback':
      await rollbackPlugin(context.args[1]);
      return;
    case 'inspect':
      await inspectPlugin(context.args[1], context.json);
      return;
    case 'validate':
      await validatePlugin(context.args[1]);
      return;
    case 'doctor':
      await doctorPlugins();
      return;
    case 'gc':
      await garbageCollectPlugins(context.args.slice(1));
      return;
    case 'pack':
      await packPlugin(context.args.slice(1));
      return;
    case 'create':
      await createPlugin(context.args.slice(1));
      return;
    case 'scan':
      await scanPlugins(context);
      return;
    case 'source':
      await pluginSourceCommand(context.args.slice(1), context.json);
      return;
    case 'add':
      throw new Error('`uruc plugin add` was removed. Use `uruc plugin install <pluginId-or-alias>`.');
    case 'uninstall':
      throw new Error('`uruc plugin uninstall` was removed. Use `uruc plugin remove <pluginId>`.');
    default:
      showHelp();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runPluginCommand({ args: process.argv.slice(2), json: false });
}
