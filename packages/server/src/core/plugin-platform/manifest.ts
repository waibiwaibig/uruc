import { readFile } from 'fs/promises';
import path from 'path';

import type { PackageJsonUrucPlugin, PluginPackageManifest } from './types.js';

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

  return {
    pluginId: assertString(value.pluginId, 'urucPlugin.pluginId'),
    apiVersion: 2,
    kind: 'backend',
    entry: assertString(value.entry, 'urucPlugin.entry'),
    publisher: assertString(value.publisher, 'urucPlugin.publisher'),
    displayName: assertString(value.displayName, 'urucPlugin.displayName'),
    description: typeof value.description === 'string' ? value.description : undefined,
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

  return {
    packageName,
    version,
    packageRoot,
    entryPath: path.resolve(packageRoot, urucPlugin.entry),
    urucPlugin,
  };
}
