import { readFile } from 'fs/promises';
import path from 'path';

import type {
  PackageJsonUrucFrontend,
  PackageJsonUrucPlugin,
  PluginFrontendBuildManifest,
  PluginPackageManifest,
  VenueModuleManifest,
} from './types.js';

export type PluginPackageContractMode = 'source' | 'distribution';

const HOST_BRIDGED_RUNTIME_DEPENDENCIES = new Set([
  '@uruc/plugin-sdk',
]);

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid plugin manifest field "${field}"`);
  }
  return value;
}

function assertStringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    throw new Error(`Invalid plugin manifest field "${field}"`);
  }
  return value as string[];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function normalizeVenueMetadata(
  raw: unknown,
  defaults: { pluginId: string; displayName: string; description?: string },
): VenueModuleManifest {
  if (raw !== undefined && (!raw || typeof raw !== 'object')) {
    throw new Error('Invalid urucPlugin.venue');
  }

  const value = (raw ?? {}) as Record<string, unknown>;
  const metadata: VenueModuleManifest = {
    moduleId: optionalString(value.moduleId) ?? defaults.pluginId,
    namespace: optionalString(value.namespace) ?? defaults.pluginId,
  };
  const displayName = optionalString(value.displayName) ?? defaults.displayName;
  const description = optionalString(value.description) ?? defaults.description;
  const category = optionalString(value.category);
  if (displayName) metadata.displayName = displayName;
  if (description) metadata.description = description;
  if (category) metadata.category = category;
  return metadata;
}

function normalizeUrucFrontend(raw: unknown): PackageJsonUrucFrontend | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid package.json#urucFrontend');
  }

  const value = raw as Record<string, unknown>;
  if (value.apiVersion !== 1) {
    throw new Error('Only urucFrontend.apiVersion=1 is supported');
  }

  return {
    apiVersion: 1,
    entry: assertString(value.entry, 'urucFrontend.entry'),
  };
}

function normalizeFrontendBuild(raw: unknown): PluginFrontendBuildManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid frontend build manifest');
  }

  const value = raw as Record<string, unknown>;
  if (value.apiVersion !== 1) {
    throw new Error('Only frontend build apiVersion=1 is supported');
  }
  if (value.format !== 'global-script') {
    throw new Error('Only frontend build format="global-script" is supported');
  }

  return {
    apiVersion: 1,
    pluginId: assertString(value.pluginId, 'frontend-dist/manifest.json pluginId'),
    version: assertString(value.version, 'frontend-dist/manifest.json version'),
    format: 'global-script',
    entry: assertString(value.entry, 'frontend-dist/manifest.json entry'),
    css: assertStringArray(value.css, 'frontend-dist/manifest.json css'),
    exportKey: assertString(value.exportKey, 'frontend-dist/manifest.json exportKey'),
  };
}

function normalizeUrucPlugin(raw: unknown): PackageJsonUrucPlugin {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Missing package.json#urucPlugin');
  }

  const value = raw as Record<string, unknown>;
  const apiVersion = value.apiVersion;
  if (apiVersion !== 2) {
    throw new Error('Only urucPlugin.apiVersion=2 is supported');
  }

  const kind = assertString(value.kind, 'urucPlugin.kind');
  if (kind !== 'backend') {
    throw new Error('Only urucPlugin.kind="backend" is supported');
  }

  const pluginId = assertString(value.pluginId, 'urucPlugin.pluginId');
  const displayName = assertString(value.displayName, 'urucPlugin.displayName');
  const description = typeof value.description === 'string' ? value.description : undefined;

  return {
    pluginId,
    apiVersion: 2,
    kind: 'backend',
    entry: assertString(value.entry, 'urucPlugin.entry'),
    publisher: assertString(value.publisher, 'urucPlugin.publisher'),
    displayName,
    description,
    venue: normalizeVenueMetadata(value.venue, { pluginId, displayName, description }),
    permissions: assertStringArray(value.permissions, 'urucPlugin.permissions'),
    dependencies: assertStringArray(value.dependencies, 'urucPlugin.dependencies'),
    activation: assertStringArray(value.activation, 'urucPlugin.activation') as PackageJsonUrucPlugin['activation'],
    defaultConfigSchema: (value.defaultConfigSchema && typeof value.defaultConfigSchema === 'object')
      ? value.defaultConfigSchema as Record<string, unknown>
      : undefined,
    migrations: Array.isArray(value.migrations)
      ? value.migrations as PackageJsonUrucPlugin['migrations']
      : [],
    healthcheck: (value.healthcheck && typeof value.healthcheck === 'object')
      ? value.healthcheck as PackageJsonUrucPlugin['healthcheck']
      : undefined,
  };
}

export async function readPluginPackageManifest(packageRoot: string): Promise<PluginPackageManifest> {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
  const packageName = assertString(packageJson.name, 'package.json.name');
  const version = assertString(packageJson.version, 'package.json.version');
  const urucPlugin = normalizeUrucPlugin(packageJson.urucPlugin);
  const urucFrontend = normalizeUrucFrontend(packageJson.urucFrontend);
  let frontendBuild: PluginFrontendBuildManifest | undefined;

  try {
    const frontendBuildPath = path.join(packageRoot, 'frontend-dist', 'manifest.json');
    frontendBuild = normalizeFrontendBuild(JSON.parse(await readFile(frontendBuildPath, 'utf8')) as unknown);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if (frontendBuild && frontendBuild.pluginId !== urucPlugin.pluginId) {
    throw new Error(
      `Frontend build pluginId '${frontendBuild.pluginId}' does not match backend pluginId '${urucPlugin.pluginId}'`,
    );
  }

  if (frontendBuild && frontendBuild.version !== version) {
    throw new Error(
      `Frontend build version '${frontendBuild.version}' does not match package.json version '${version}'`,
    );
  }

  return {
    packageName,
    version,
    packageRoot,
    entryPath: path.resolve(packageRoot, urucPlugin.entry),
    urucPlugin,
    urucFrontend,
    frontendBuild,
  };
}

export async function validatePluginPackageContract(
  packageRoot: string,
  manifest: PluginPackageManifest,
  mode: PluginPackageContractMode,
): Promise<void> {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, unknown>;
  };
  const runtimeDependencies = packageJson.dependencies ?? {};

  for (const dependencyName of HOST_BRIDGED_RUNTIME_DEPENDENCIES) {
    if (typeof runtimeDependencies[dependencyName] === 'string' && runtimeDependencies[dependencyName]!.trim() !== '') {
      throw new Error(
        `package.json dependencies must not include ${dependencyName}; the host provides it at runtime`,
      );
    }
  }

  if (mode === 'distribution' && manifest.urucFrontend && !manifest.frontendBuild) {
    throw new Error(
      `Frontend plugin packages must include frontend-dist/manifest.json before they can be installed from package sources`,
    );
  }
}
