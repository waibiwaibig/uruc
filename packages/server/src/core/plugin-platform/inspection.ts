import { existsSync } from 'fs';
import path from 'path';

import { readPluginPackageManifest } from './manifest.js';
import { resolvePluginSourceRelease } from './source-registry.js';
import type {
  CityConfigFile,
  CityLockFile,
  CityPluginSpec,
  PluginPackageManifest,
  PluginRuntimeState,
  ResolvedSourcePluginRelease,
} from './types.js';

export type PluginCheckLevel = 'ok' | 'warn' | 'fail';

export interface ResolvedConfiguredPlugin {
  pluginId: string;
  pluginConfig: CityPluginSpec;
  sourceType: 'path' | 'package';
  sourcePath: string;
  manifest: PluginPackageManifest;
  sourcedRelease: ResolvedSourcePluginRelease | null;
  expectedPackageName: string;
  expectedVersion: string;
  permissionsRequested: string[];
  permissionsGranted: string[];
}

export interface PluginCheck {
  pluginId: string;
  enabled: boolean;
  sourceType: 'path' | 'package';
  packageName: string;
  version: string;
  sourcePath?: string;
  lockedRevision?: string;
  lockedEntryPath?: string;
  status: PluginCheckLevel;
  configStatus: PluginCheckLevel;
  configDetail: string;
  lockStatus: PluginCheckLevel;
  lockDetail: string;
  runtimeState?: PluginRuntimeState;
  runtimeDetail?: string;
}

interface PluginRuntimeDiagnosticView {
  pluginId: string;
  state: PluginRuntimeState;
  lastError?: string;
}

function resolveConfiguredSourcePath(targetPath: string, baseDir: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
}

function issueLevel(enabled: boolean): Exclude<PluginCheckLevel, 'ok'> {
  return enabled ? 'fail' : 'warn';
}

export function aggregatePluginCheckLevel(levels: PluginCheckLevel[]): PluginCheckLevel {
  if (levels.includes('fail')) return 'fail';
  if (levels.includes('warn')) return 'warn';
  return 'ok';
}

export async function resolveConfiguredPlugin(options: {
  config: CityConfigFile;
  configPath: string;
  pluginId: string;
  pluginConfig: CityPluginSpec;
}): Promise<ResolvedConfiguredPlugin> {
  const configDir = path.dirname(options.configPath);
  const sourceType = options.pluginConfig.devOverridePath ? 'path' : 'package';
  const sourcedRelease = options.pluginConfig.devOverridePath
    ? null
    : await resolvePluginSourceRelease({
      sources: options.config.sources,
      pluginId: options.pluginId,
      sourceId: options.pluginConfig.source,
      version: options.pluginConfig.version,
      baseDir: configDir,
    });
  const sourcePath = options.pluginConfig.devOverridePath
    ? resolveConfiguredSourcePath(options.pluginConfig.devOverridePath, configDir)
    : sourcedRelease?.sourcePath;

  if (!sourcePath) {
    throw new Error(`Plugin ${options.pluginId} is missing a valid source path`);
  }

  const manifest = await readPluginPackageManifest(sourcePath);
  const urucPlugin = manifest.urucPlugin;

  if (urucPlugin.pluginId !== options.pluginId) {
    throw new Error(`Config entry ${options.pluginId} does not match manifest pluginId ${urucPlugin.pluginId}`);
  }

  if (options.config.approvedPublishers.length > 0 && !options.config.approvedPublishers.includes(urucPlugin.publisher)) {
    throw new Error(`Plugin ${options.pluginId} publisher "${urucPlugin.publisher}" is not approved`);
  }

  const expectedPackageName = options.pluginConfig.packageName ?? sourcedRelease?.packageName ?? manifest.packageName;
  if (expectedPackageName !== manifest.packageName) {
    throw new Error(`Plugin ${options.pluginId} expected package ${expectedPackageName}, but source manifest is ${manifest.packageName}`);
  }

  const expectedVersion = options.pluginConfig.version ?? sourcedRelease?.version ?? manifest.version;
  if (expectedVersion !== manifest.version) {
    throw new Error(`Plugin ${options.pluginId} expected version ${expectedVersion}, but source manifest is ${manifest.version}`);
  }

  const permissionsRequested = urucPlugin.permissions ?? [];
  const permissionsGranted = options.pluginConfig.permissionsGranted ?? permissionsRequested;
  const disallowed = permissionsGranted.filter((permission) => !permissionsRequested.includes(permission));
  if (disallowed.length > 0) {
    throw new Error(`Plugin ${options.pluginId} grants unknown permissions: ${disallowed.join(', ')}`);
  }

  return {
    pluginId: options.pluginId,
    pluginConfig: options.pluginConfig,
    sourceType,
    sourcePath,
    manifest,
    sourcedRelease,
    expectedPackageName,
    expectedVersion,
    permissionsRequested,
    permissionsGranted,
  };
}

function resolveRuntimeViewDetail(runtimeDiagnostic: PluginRuntimeDiagnosticView | undefined): string | undefined {
  if (!runtimeDiagnostic) return undefined;
  if (runtimeDiagnostic.lastError) return runtimeDiagnostic.lastError;
  return `Runtime state is ${runtimeDiagnostic.state}`;
}

export async function inspectConfiguredPlugins(options: {
  config: CityConfigFile;
  lock: CityLockFile;
  configPath: string;
  runtimeDiagnostics?: PluginRuntimeDiagnosticView[];
}): Promise<PluginCheck[]> {
  const runtimeById = new Map((options.runtimeDiagnostics ?? []).map((item) => [item.pluginId, item]));
  const checks: PluginCheck[] = [];

  for (const [pluginId, pluginConfig] of Object.entries(options.config.plugins)) {
    const enabled = pluginConfig.enabled ?? true;
    const expectedSourceType = pluginConfig.devOverridePath ? 'path' : 'package';
    const lockEntry = options.lock.plugins[pluginId];
    const runtimeDiagnostic = runtimeById.get(pluginId);

    let packageName = pluginConfig.packageName ?? lockEntry?.packageName ?? pluginId;
    let version = pluginConfig.version ?? lockEntry?.version ?? 'unresolved';
    let sourcePath = lockEntry?.sourcePath;
    let configStatus: PluginCheckLevel = 'ok';
    let configDetail = 'Configuration resolves cleanly';
    let resolved: ResolvedConfiguredPlugin | undefined;

    try {
      resolved = await resolveConfiguredPlugin({
        config: options.config,
        configPath: options.configPath,
        pluginId,
        pluginConfig,
      });
      packageName = resolved.expectedPackageName;
      version = resolved.expectedVersion;
      sourcePath = resolved.sourcePath;
      configDetail = `Resolved ${resolved.sourceType}-backed plugin from ${resolved.sourcePath}`;
    } catch (error) {
      configStatus = issueLevel(enabled);
      configDetail = error instanceof Error ? error.message : String(error);
    }

    let lockStatus: PluginCheckLevel = 'ok';
    let lockDetail = lockEntry
      ? `Locked revision ${lockEntry.revision} is present`
      : 'No lock entry is present for this plugin';

    if (!lockEntry) {
      lockStatus = issueLevel(enabled);
    } else if (!existsSync(lockEntry.entryPath)) {
      lockStatus = issueLevel(enabled);
      lockDetail = `Locked entry path is missing: ${lockEntry.entryPath}`;
    } else if (resolved) {
      const mismatches: string[] = [];
      if (lockEntry.packageName !== resolved.expectedPackageName) {
        mismatches.push(`package ${lockEntry.packageName} != ${resolved.expectedPackageName}`);
      }
      if (lockEntry.version !== resolved.expectedVersion) {
        mismatches.push(`version ${lockEntry.version} != ${resolved.expectedVersion}`);
      }
      if (lockEntry.sourceType !== expectedSourceType) {
        mismatches.push(`sourceType ${lockEntry.sourceType} != ${expectedSourceType}`);
      }
      if (mismatches.length > 0) {
        lockStatus = issueLevel(enabled);
        lockDetail = `Lock is stale: ${mismatches.join(', ')}`;
      }
    }

    const runtimeState = runtimeDiagnostic?.state;
    const runtimeDetail = resolveRuntimeViewDetail(runtimeDiagnostic);
    const status = aggregatePluginCheckLevel([
      configStatus,
      lockStatus,
      runtimeState === 'failed' ? 'fail' : 'ok',
    ]);

    checks.push({
      pluginId,
      enabled,
      sourceType: expectedSourceType,
      packageName,
      version,
      sourcePath,
      lockedRevision: lockEntry?.revision,
      lockedEntryPath: lockEntry?.entryPath,
      status,
      configStatus,
      configDetail,
      lockStatus,
      lockDetail,
      runtimeState,
      runtimeDetail,
    });
  }

  return checks;
}

export function summarizePluginChecks(checks: PluginCheck[]): string {
  if (checks.length === 0) {
    return 'No plugins are configured';
  }

  const summary = {
    ok: checks.filter((item) => item.status === 'ok').length,
    warn: checks.filter((item) => item.status === 'warn').length,
    fail: checks.filter((item) => item.status === 'fail').length,
  };

  return `${checks.length} plugin(s): ${summary.ok} ok, ${summary.warn} warn, ${summary.fail} fail`;
}
