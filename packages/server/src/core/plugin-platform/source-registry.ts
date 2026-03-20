import { existsSync } from 'fs';
import { mkdtemp, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import type {
  CityPluginSource,
  ResolvedSourcePluginRelease,
  SourceRegistryFile,
  SourceRegistryRelease,
} from './types.js';
import { downloadAndExtractPluginArtifact } from './remote-artifact.js';

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid source registry field "${field}"`);
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function isFileUrl(value: string): boolean {
  return value.startsWith('file://');
}

function parseRegistryFile(raw: unknown, sourceId: string): SourceRegistryFile {
  if (!isObject(raw)) {
    throw new Error(`Source ${sourceId} registry must be a JSON object`);
  }

  if (raw.apiVersion !== 1) {
    throw new Error(`Source ${sourceId} only supports apiVersion=1`);
  }

  if (!Array.isArray(raw.packages)) {
    throw new Error(`Source ${sourceId} registry is missing packages[]`);
  }

  const packages = raw.packages.map((entry, index) => {
    if (!isObject(entry)) {
      throw new Error(`Source ${sourceId} packages[${index}] must be an object`);
    }

    return {
      alias: typeof entry.alias === 'string' ? entry.alias : undefined,
      pluginId: assertString(entry.pluginId, `packages[${index}].pluginId`),
      packageName: assertString(entry.packageName, `packages[${index}].packageName`),
      version: assertString(entry.version, `packages[${index}].version`),
      publisher: assertString(entry.publisher, `packages[${index}].publisher`),
      path: typeof entry.path === 'string' ? assertString(entry.path, `packages[${index}].path`) : undefined,
      artifactUrl: typeof entry.artifactUrl === 'string'
        ? assertString(entry.artifactUrl, `packages[${index}].artifactUrl`)
        : undefined,
      integrity: typeof entry.integrity === 'string' ? entry.integrity : undefined,
    } satisfies SourceRegistryRelease;
  });

  for (const [index, entry] of packages.entries()) {
    if (!entry.path && !entry.artifactUrl) {
      throw new Error(`Source ${sourceId} packages[${index}] must define either path or artifactUrl`);
    }
  }

  return {
    apiVersion: 1,
    packages,
  };
}

function compareVersions(left: string, right: string): number {
  const leftMain = left.split('-')[0] ?? left;
  const rightMain = right.split('-')[0] ?? right;
  const leftParts = leftMain.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = rightMain.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }

  if (left === right) return 0;
  const leftHasPre = left.includes('-');
  const rightHasPre = right.includes('-');
  if (leftHasPre !== rightHasPre) {
    return leftHasPre ? -1 : 1;
  }
  return left.localeCompare(right);
}

async function readRegistryDocument(source: CityPluginSource, baseDir: string): Promise<{
  registry: SourceRegistryFile;
  registryLocation: string;
}> {
  if (isHttpUrl(source.registry)) {
    const response = await fetch(source.registry);
    if (!response.ok) {
      throw new Error(`Source ${source.id} registry request failed (${response.status} ${response.statusText})`);
    }

    const raw = await response.json() as unknown;
    return {
      registry: parseRegistryFile(raw, source.id),
      registryLocation: source.registry,
    };
  }

  const registryPath = isFileUrl(source.registry)
    ? fileURLToPath(source.registry)
    : path.resolve(baseDir, source.registry);
  const candidatePath = existsSync(registryPath) && !registryPath.endsWith('.json')
    ? path.join(registryPath, 'uruc-registry.json')
    : registryPath;

  const raw = JSON.parse(await readFile(candidatePath, 'utf8')) as unknown;
  return {
    registry: parseRegistryFile(raw, source.id),
    registryLocation: candidatePath,
  };
}

function resolveRegistryLocation(registryLocation: string, target: string): string {
  if (isHttpUrl(target)) {
    return target;
  }

  if (isFileUrl(target)) {
    return fileURLToPath(target);
  }

  if (isHttpUrl(registryLocation)) {
    return new URL(target, registryLocation).href;
  }

  if (path.isAbsolute(target)) {
    return target;
  }

  return path.resolve(path.dirname(registryLocation), target);
}

async function resolveReleaseSourcePath(sourceId: string, registryLocation: string, release: SourceRegistryRelease): Promise<string> {
  if (release.path) {
    const resolvedPath = resolveRegistryLocation(registryLocation, release.path);
    if (isHttpUrl(resolvedPath)) {
      throw new Error(`Source ${sourceId} release ${release.pluginId}@${release.version} resolved a remote path; use artifactUrl instead`);
    }
    return resolvedPath;
  }

  if (!release.artifactUrl) {
    throw new Error(`Source ${sourceId} release ${release.pluginId}@${release.version} is missing a source path`);
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), `uruc-plugin-source-${sourceId}-`));
  const { packageRoot } = await downloadAndExtractPluginArtifact({
    artifactUrl: resolveRegistryLocation(registryLocation, release.artifactUrl),
    integrity: release.integrity,
    stagingRoot,
  });
  return packageRoot;
}

export async function resolvePluginSourceRelease(options: {
  sources: CityPluginSource[];
  pluginId?: string;
  alias?: string;
  baseDir: string;
  sourceId?: string;
  version?: string;
}): Promise<ResolvedSourcePluginRelease> {
  if (!options.pluginId && !options.alias) {
    throw new Error('Plugin source resolution requires either pluginId or alias');
  }

  const candidates = options.sourceId
    ? options.sources.filter((source) => source.id === options.sourceId)
    : options.sources;

  if (candidates.length === 0) {
    throw new Error(options.sourceId
      ? `Source ${options.sourceId} is not configured`
      : 'No plugin sources are configured');
  }

  for (const source of candidates) {
    const { registry, registryLocation } = await readRegistryDocument(source, options.baseDir);
    const matching = registry.packages
      .filter((entry) => (
        options.alias
          ? entry.alias === options.alias
          : entry.pluginId === options.pluginId
      ))
      .sort((left, right) => compareVersions(right.version, left.version));

    if (matching.length === 0) {
      continue;
    }

    const picked = options.version
      ? matching.find((entry) => entry.version === options.version)
      : matching[0];

    if (!picked) {
      const requested = options.alias ?? options.pluginId;
      throw new Error(`Source ${source.id} does not provide ${requested}@${options.version}`);
    }

    return {
      ...picked,
      sourceId: source.id,
      registry: source.registry,
      sourcePath: await resolveReleaseSourcePath(source.id, registryLocation, picked),
    };
  }

  const requested = options.alias ?? options.pluginId;
  throw new Error(options.sourceId
    ? `Source ${options.sourceId} does not provide ${requested}`
    : `No configured source provides ${requested}`);
}
