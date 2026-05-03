import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { access, cp, mkdir, readFile, realpath, rm, symlink } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';

import { parseBody, sendError, sendJson } from '../server/middleware.js';
import { compactErrorPayload } from '../server/errors.js';
import { setCorsHeaders, setSecurityHeaders } from '../server/security.js';
import type {
  HttpContext,
  HookDisposable,
  CommandSchema,
  ResidentProtocolMetadata,
  ResidentProtocolReceiptStatus,
  WSContext,
  WSMessage,
  HookRegistry,
  HttpHandler,
} from '../plugin-system/hook-registry.js';
import { readCityConfig, readCityLock, writeCityLock } from './config.js';
import { resolveConfiguredPlugin } from './inspection.js';
import { readPluginPackageManifest } from './manifest.js';
import { createSourceFingerprint, formatIntegrityFingerprint } from './source-fingerprint.js';
import { DisposableScope, type Disposable } from './scope.js';
import type { UrucDb } from '../database/index.js';
import type {
  BackendPluginDefinition,
  CityConfigFile,
  CityLockFile,
  LockedPluginHistoryEntry,
  LockedPluginSpec,
  PluginDiagnostic,
  PluginListEntry,
  PluginPlatformContext,
  PluginPlatformHealthProvider,
  PluginRuntimeState,
} from './types.js';

interface PluginPlatformOptions {
  configPath: string;
  lockPath: string;
  packageRoot: string;
  pluginStoreDir: string;
}

interface ActivePluginEntry {
  spec: LockedPluginSpec;
  scope: DisposableScope;
  state: PluginRuntimeState;
  started: boolean;
  inFlightCount: number;
  lastError?: string;
  stopHandlers: Array<() => Promise<void> | void>;
}

interface PluginStorageRow {
  recordId: string;
  valueJson: string;
  updatedAt: number;
}

const execFileAsync = promisify(execFile);
const HOST_BRIDGED_RUNTIME_DEPENDENCIES = new Set([
  '@uruc/plugin-sdk',
]);

async function resolveExistingPackageRoot(candidate: string): Promise<string | null> {
  try {
    const resolved = await realpath(candidate);
    await access(path.join(resolved, 'package.json'));
    return resolved;
  } catch {
    return null;
  }
}

function ensurePlatformStorage(db: UrucDb): void {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS plugin_storage_records (
      plugin_id TEXT NOT NULL,
      collection TEXT NOT NULL,
      record_id TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (plugin_id, collection, record_id)
    )
  `);
  db.run(sql`
    CREATE INDEX IF NOT EXISTS plugin_storage_records_lookup_idx
    ON plugin_storage_records(plugin_id, collection, updated_at DESC)
  `);
}

function decodeStoredValue(row?: { valueJson: string } | null): unknown | null {
  if (!row) return null;
  return JSON.parse(row.valueJson);
}

async function getStoredRecord(db: UrucDb, pluginId: string, collection: string, recordId: string): Promise<unknown | null> {
  const row = db.get(sql<PluginStorageRow>`
    SELECT record_id AS recordId, value_json AS valueJson, updated_at AS updatedAt
    FROM plugin_storage_records
    WHERE plugin_id = ${pluginId} AND collection = ${collection} AND record_id = ${recordId}
  `) as PluginStorageRow | undefined;
  return decodeStoredValue(row);
}

async function putStoredRecord(
  db: UrucDb,
  pluginId: string,
  collection: string,
  recordId: string,
  value: unknown,
): Promise<void> {
  const valueJson = JSON.stringify(value ?? null);
  db.run(sql`
    INSERT INTO plugin_storage_records (plugin_id, collection, record_id, value_json, updated_at)
    VALUES (${pluginId}, ${collection}, ${recordId}, ${valueJson}, ${Date.now()})
    ON CONFLICT(plugin_id, collection, record_id)
    DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `);
}

async function deleteStoredRecord(db: UrucDb, pluginId: string, collection: string, recordId: string): Promise<void> {
  db.run(sql`
    DELETE FROM plugin_storage_records
    WHERE plugin_id = ${pluginId} AND collection = ${collection} AND record_id = ${recordId}
  `);
}

async function listStoredRecords(
  db: UrucDb,
  pluginId: string,
  collection: string,
): Promise<Array<{ id: string; value: unknown; updatedAt: number }>> {
  const rows = db.all(sql<PluginStorageRow>`
    SELECT record_id AS recordId, value_json AS valueJson, updated_at AS updatedAt
    FROM plugin_storage_records
    WHERE plugin_id = ${pluginId} AND collection = ${collection}
    ORDER BY updated_at DESC, record_id ASC
  `) as PluginStorageRow[];
  return rows.map((row) => ({
    id: row.recordId,
    value: JSON.parse(row.valueJson),
    updatedAt: row.updatedAt,
  }));
}

function isBackendPluginDefinition(value: unknown): value is BackendPluginDefinition {
  return typeof value === 'object'
    && value !== null
    && (value as BackendPluginDefinition).kind === 'uruc.backend-plugin@v2';
}

function namespacePluginCommand(pluginId: string, commandId: string): string {
  return `${pluginId}.${commandId}@v1`;
}

function namespacePluginLocation(pluginId: string, locationId: string): string {
  return `${pluginId}.${locationId}`;
}

function getPluginHttpBasePath(pluginId: string): string {
  return `/api/plugins/${pluginId}/v1`;
}

async function loadPluginModule(entryPath: string, revision: string): Promise<BackendPluginDefinition> {
  const moduleUrl = `${pathToFileURL(entryPath).href}?revision=${encodeURIComponent(revision)}`;
  const loaded = await import(moduleUrl) as BackendPluginDefinition | { default?: BackendPluginDefinition };
  const candidate = ('default' in loaded && loaded.default) ? loaded.default : loaded;

  if (isBackendPluginDefinition(candidate)) {
    return candidate;
  }

  throw new Error(`Plugin entry ${entryPath} did not export a valid V2 backend plugin`);
}

function toHistoryEntry(spec: LockedPluginSpec): LockedPluginHistoryEntry {
  return {
    revision: spec.revision,
    version: spec.version,
    packageRoot: spec.packageRoot,
    entryPath: spec.entryPath,
    frontend: spec.frontend,
    integrity: spec.integrity,
    sourceFingerprint: spec.sourceFingerprint,
    ...(spec.venue ? { venue: spec.venue } : {}),
    generatedAt: spec.generatedAt,
  };
}

async function resolveLockedSourceFingerprint(spec: LockedPluginSpec): Promise<string | undefined> {
  if (typeof spec.sourceFingerprint === 'string' && spec.sourceFingerprint.trim() !== '') {
    return spec.sourceFingerprint;
  }

  if (typeof spec.integrity === 'string' && spec.integrity.trim() !== '') {
    return formatIntegrityFingerprint(spec.integrity.trim());
  }

  try {
    return await createSourceFingerprint(spec.packageRoot);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function normalizeConfig(config: CityConfigFile): CityConfigFile {
  return {
    apiVersion: 2,
    approvedPublishers: config.approvedPublishers ?? [],
    pluginStoreDir: config.pluginStoreDir,
    sources: config.sources ?? [],
    plugins: config.plugins ?? {},
  };
}

function buildCommandSchema(pluginId: string, definition: Record<string, any>): CommandSchema {
  const params = Object.fromEntries(
    Object.entries(definition.inputSchema ?? {}).map(([key, value]) => {
      const shape = (value && typeof value === 'object' ? value : {}) as {
        description?: unknown;
        type?: unknown;
        required?: unknown;
      };
      const description = typeof shape.description === 'string' && shape.description.trim() !== ''
        ? shape.description
        : undefined;

      return [
        key,
        {
          type: typeof shape.type === 'string' && shape.type.trim() !== ''
            ? shape.type
            : 'unknown',
          required: typeof shape.required === 'boolean' ? shape.required : false,
          ...(description ? { description } : {}),
        },
      ];
    }),
  );

  const schema: CommandSchema = {
    type: namespacePluginCommand(pluginId, definition.id),
    description: String(definition.description ?? definition.id),
    pluginName: pluginId,
    params,
    resultSchema: definition.resultSchema,
    authPolicy: definition.authPolicy ?? 'agent',
    locationPolicy: definition.locationPolicy ?? { scope: 'any' },
    actionLeasePolicy: definition.actionLeasePolicy ?? { required: true },
    confirmationPolicy: definition.confirmationPolicy ?? { required: false },
    rateLimitPolicy: definition.rateLimitPolicy ?? {},
    errorCodes: Array.isArray(definition.errorCodes) ? definition.errorCodes : [],
    requiresConfirmation: definition.confirmationPolicy?.required ?? false,
  };
  const protocol = normalizeResidentProtocolMetadata(definition.protocol);
  if (protocol) schema.protocol = protocol;
  return schema;
}

const RESIDENT_PROTOCOL_RECEIPT_STATUSES = new Set<ResidentProtocolReceiptStatus>([
  'accepted',
  'rejected',
  'delivered',
  'expired',
  'duplicate',
  'require_approval',
]);

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const stringValue = getString(item);
    if (!stringValue || seen.has(stringValue)) continue;
    seen.add(stringValue);
    result.push(stringValue);
  }
  return result;
}

function normalizeResidentProtocolMetadata(value: unknown): ResidentProtocolMetadata | undefined {
  const input = getRecord(value);
  if (!input || input.subject !== 'resident') return undefined;

  const protocol: ResidentProtocolMetadata = { subject: 'resident' };
  const request = getRecord(input.request);
  const requestType = getString(request?.type);
  const requiredCapabilities = getStringList(request?.requiredCapabilities);
  if (requestType) {
    protocol.request = {
      type: requestType,
      ...(typeof request?.version === 'number' && Number.isInteger(request.version) && request.version > 0
        ? { version: request.version }
        : {}),
      ...(requiredCapabilities.length > 0 ? { requiredCapabilities } : {}),
    };
  }

  const receipt = getRecord(input.receipt);
  const receiptType = getString(receipt?.type);
  const receiptStatuses = Array.isArray(receipt?.statuses)
    ? receipt.statuses.filter((status): status is ResidentProtocolReceiptStatus => (
        typeof status === 'string' && RESIDENT_PROTOCOL_RECEIPT_STATUSES.has(status as ResidentProtocolReceiptStatus)
      ))
    : [];
  if (receiptType || receiptStatuses.length > 0) {
    protocol.receipt = {
      ...(receiptType ? { type: receiptType } : {}),
      ...(receiptStatuses.length > 0 ? { statuses: receiptStatuses } : {}),
    };
  }

  const venue = getRecord(input.venue);
  const venueId = getString(venue?.id);
  const venueModuleId = getString(venue?.moduleId);
  if (venueId || venueModuleId) {
    protocol.venue = {
      ...(venueId ? { id: venueId } : {}),
      ...(venueModuleId ? { moduleId: venueModuleId } : {}),
    };
  }

  const migration = getRecord(input.migration);
  const currentTerm = getString(migration?.currentTerm);
  const removalIssue = getString(migration?.removalIssue);
  const note = getString(migration?.note);
  if (currentTerm || removalIssue || note) {
    protocol.migration = {
      ...(currentTerm ? { currentTerm } : {}),
      ...(removalIssue ? { removalIssue } : {}),
      ...(note ? { note } : {}),
    };
  }

  return protocol;
}

function buildQueryObject(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
      continue;
    }
    if (Array.isArray(existing)) {
      existing.push(value);
      continue;
    }
    query[key] = [existing, value];
  }
  return query;
}

function matchRoutePath(pattern: string, actualPath: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = actualPath.split('/').filter(Boolean);
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]!;
    const pathSegment = pathSegments[index]!;
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }
    if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

async function readRawRequestBody(req: HttpContext['req'], maxSize = 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > maxSize) {
      throw Object.assign(new Error('Request body is too large'), { statusCode: 413, code: 'BODY_TOO_LARGE' });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readPackageDependencies(packageRoot: string): Promise<Array<{ name: string; version: string }>> {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const raw = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, unknown>;
  };
  if (!raw.dependencies || typeof raw.dependencies !== 'object') {
    return [];
  }

  return Object.entries(raw.dependencies)
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([name, value]) => ({
      name,
      version: value as string,
    }));
}

async function hasInstalledDependency(packageRoot: string, dependencyName: string): Promise<boolean> {
  let currentDir = packageRoot;

  while (true) {
    try {
      await access(path.join(currentDir, 'node_modules', ...dependencyName.split('/'), 'package.json'));
      return true;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return false;
    }
    currentDir = parentDir;
  }
}

function parseRouteInput(method: string, url: URL, headers: HttpContext['req']['headers'], rawBody?: Buffer): unknown {
  if (method === 'GET') {
    return buildQueryObject(url);
  }

  if (!rawBody || rawBody.length === 0) {
    return {};
  }

  const contentType = String(headers['content-type'] ?? '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw Object.assign(new Error('Invalid JSON'), { statusCode: 400, code: 'INVALID_JSON' });
    }
  }

  return {};
}

function isRouteResponseEnvelope(value: unknown): value is { status?: number; headers?: Record<string, string>; body?: unknown } {
  return typeof value === 'object'
    && value !== null
    && ('status' in value || 'headers' in value || 'body' in value);
}

function sendRouteResult(res: HttpContext['res'], req: HttpContext['req'], value: unknown): void {
  if (!isRouteResponseEnvelope(value)) {
    sendJson(res, 200, value, req);
    return;
  }

  const status = typeof value.status === 'number' ? value.status : 200;
  const headers = { ...(value.headers ?? {}) };
  const body = value.body;

  setSecurityHeaders(res, req);
  setCorsHeaders(req, res);

  if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/octet-stream';
    }
    res.writeHead(status, headers);
    res.end(body);
    return;
  }

  if (typeof body === 'string' && headers['Content-Type'] && !headers['Content-Type'].includes('application/json')) {
    res.writeHead(status, headers);
    res.end(body);
    return;
  }

  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...headers,
  });
  res.end(JSON.stringify(body ?? {}));
}

export class PluginPlatformHost implements PluginPlatformHealthProvider {
  private readonly configPath: string;
  private readonly lockPath: string;
  private readonly packageRoot: string;
  private readonly pluginStoreDir: string;
  private runtimeSdkPackageRoot?: string;
  private readonly activePlugins = new Map<string, ActivePluginEntry>();
  private readonly diagnostics = new Map<string, PluginDiagnostic>();
  private readonly initOrder: string[] = [];
  private runtimeContext?: PluginPlatformContext;

  constructor(options: PluginPlatformOptions) {
    this.configPath = options.configPath;
    this.lockPath = options.lockPath;
    this.packageRoot = options.packageRoot;
    this.pluginStoreDir = options.pluginStoreDir;
    process.env.URUC_SERVER_PACKAGE_ROOT = this.packageRoot;
  }

  private async ensurePluginRuntimeDependencies(packageRoot: string, pluginId: string): Promise<void> {
    const dependencies = await readPackageDependencies(packageRoot);
    if (dependencies.length === 0) {
      return;
    }

    const missing = dependencies.filter((dependency) => !HOST_BRIDGED_RUNTIME_DEPENDENCIES.has(dependency.name));
    if (missing.length === 0) {
      return;
    }

    const installed = await Promise.all(
      missing.map((dependency) => hasInstalledDependency(packageRoot, dependency.name)),
    );
    const dependenciesToInstall = missing.filter((_, index) => !installed[index]);
    if (dependenciesToInstall.length === 0) {
      return;
    }

    try {
      await execFileAsync('npm', [
        'install',
        '--no-save',
        '--omit=dev',
        '--package-lock=false',
        '--no-audit',
        '--no-fund',
        ...dependenciesToInstall.map((dependency) => `${dependency.name}@${dependency.version}`),
      ], {
        cwd: packageRoot,
        env: process.env,
      });
    } catch (error: any) {
      const message = error?.stderr?.trim()
        || error?.stdout?.trim()
        || error?.message
        || String(error);
      throw new Error(`Failed to install runtime dependencies for plugin ${pluginId}: ${message}`);
    }
  }

  private async resolveFrontendBuildScriptPath(): Promise<string> {
    const candidates = [
      path.resolve(this.packageRoot, '..', '..', 'scripts', 'build-plugin-frontend.mjs'),
      path.resolve(this.packageRoot, 'scripts', 'build-plugin-frontend.mjs'),
    ];

    for (const candidate of candidates) {
      try {
        await access(candidate);
        return candidate;
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    throw new Error(`Could not locate scripts/build-plugin-frontend.mjs from package root ${this.packageRoot}`);
  }

  private async ensureMaterializedFrontendBuild(
    packageRoot: string,
    pluginId: string,
    sourceType: 'path' | 'package',
  ) {
    let manifest = await readPluginPackageManifest(packageRoot);
    if (sourceType !== 'path' || !manifest.urucFrontend || manifest.frontendBuild) {
      return manifest;
    }

    const buildScriptPath = await this.resolveFrontendBuildScriptPath();

    try {
      await execFileAsync(process.execPath, [
        buildScriptPath,
        '--plugin',
        packageRoot,
        '--out',
        path.join(packageRoot, 'frontend-dist'),
      ], {
        cwd: this.packageRoot,
        env: process.env,
      });
    } catch (error: any) {
      const message = error?.stderr?.trim()
        || error?.stdout?.trim()
        || error?.message
        || String(error);
      throw new Error(`Failed to build frontend assets for plugin ${pluginId}: ${message}`);
    }

    manifest = await readPluginPackageManifest(packageRoot);
    if (!manifest.frontendBuild) {
      throw new Error(`Frontend build for plugin ${pluginId} did not produce frontend-dist/manifest.json`);
    }

    return manifest;
  }

  async syncLockFile(): Promise<CityLockFile> {
    const config = normalizeConfig(await readCityConfig(this.configPath));
    const existingLock = await readCityLock(this.lockPath);
    const resolvedPlugins: CityLockFile['plugins'] = {};
    const configDir = path.dirname(this.configPath);
    const storeRoot = path.isAbsolute(config.pluginStoreDir ?? '')
      ? (config.pluginStoreDir as string)
      : path.resolve(configDir, config.pluginStoreDir ?? this.pluginStoreDir);

    for (const [pluginId, pluginConfig] of Object.entries(config.plugins)) {
      const previous = existingLock.plugins[pluginId];
      try {
        const resolved = await resolveConfiguredPlugin({
          config,
          configPath: this.configPath,
          pluginId,
          pluginConfig,
        });
        const sourceFingerprint = await createSourceFingerprint(resolved.sourcePath, resolved.sourcedRelease?.integrity);
        const previousSourceFingerprint = previous
          ? await resolveLockedSourceFingerprint(previous)
          : undefined;
        const changed = !previous
          || previous.packageName !== resolved.expectedPackageName
          || previous.version !== resolved.expectedVersion
          || previous.publisher !== resolved.manifest.urucPlugin.publisher
          || previousSourceFingerprint !== sourceFingerprint;
        const revision = changed ? nanoid() : previous.revision;
        const materializedPackageRoot = path.join(storeRoot, pluginId, revision);
        const expectedEntryPath = path.resolve(materializedPackageRoot, resolved.manifest.urucPlugin.entry);
        const needsRematerialization = changed
          || !previous
          || path.resolve(previous.packageRoot) !== path.resolve(materializedPackageRoot)
          || path.resolve(previous.entryPath) !== expectedEntryPath
          || !existsSync(previous.entryPath);
        const history = previous
          ? (changed ? [toHistoryEntry(previous), ...(previous.history ?? [])] : previous.history ?? [])
          : [];
        const packageRoot = needsRematerialization
          ? await this.materializePluginRevision(resolved.sourcePath, pluginId, revision, storeRoot)
          : previous.packageRoot;
        const runtimeManifest = await this.ensureMaterializedFrontendBuild(packageRoot, pluginId, resolved.sourceType);
        await this.ensurePluginRuntimeDependencies(packageRoot, pluginId);
        await this.ensureRuntimeSdkBridge(packageRoot);

        resolvedPlugins[pluginId] = {
          pluginId,
          packageName: resolved.expectedPackageName,
          version: resolved.expectedVersion,
          publisher: runtimeManifest.urucPlugin.publisher,
          venue: resolved.venue,
          revision,
          sourcePath: resolved.sourcePath,
          packageRoot,
          entryPath: path.resolve(packageRoot, runtimeManifest.urucPlugin.entry),
          enabled: pluginConfig.enabled ?? true,
          dependencies: runtimeManifest.urucPlugin.dependencies ?? [],
          activation: runtimeManifest.urucPlugin.activation ?? ['startup'],
          permissionsRequested: resolved.permissionsRequested,
          permissionsGranted: resolved.permissionsGranted,
          config: pluginConfig.config ?? {},
          source: pluginConfig.source ?? resolved.sourcedRelease?.sourceId,
          sourceType: resolved.sourceType,
          frontend: runtimeManifest.frontendBuild,
          integrity: resolved.sourcedRelease?.integrity,
          sourceFingerprint,
          healthcheck: runtimeManifest.urucPlugin.healthcheck,
          history,
          generatedAt: new Date().toISOString(),
        };

        if (!this.activePlugins.has(pluginId)) {
          this.diagnostics.delete(pluginId);
        }
      } catch (error: any) {
        this.setResolutionFailureDiagnostic(pluginId, pluginConfig, previous, error);
        if (previous) {
          resolvedPlugins[pluginId] = {
            ...previous,
            enabled: previous.enabled && (pluginConfig.enabled ?? true),
          };
        }
      }
    }

    const lock: CityLockFile = {
      apiVersion: 2,
      generatedAt: new Date().toISOString(),
      plugins: resolvedPlugins,
    };

    await writeCityLock(this.lockPath, lock);
    return lock;
  }

  private async materializePluginRevision(
    sourcePath: string,
    pluginId: string,
    revision: string,
    storeRoot: string,
  ): Promise<string> {
    const destinationRoot = path.join(storeRoot, pluginId, revision);
    await mkdir(path.dirname(destinationRoot), { recursive: true });
    await rm(destinationRoot, { recursive: true, force: true });
    await cp(sourcePath, destinationRoot, {
      recursive: true,
      force: true,
    });
    return destinationRoot;
  }

  private async resolveRuntimeSdkPackageRoot(): Promise<string> {
    if (this.runtimeSdkPackageRoot) {
      return this.runtimeSdkPackageRoot;
    }

    const candidates = Array.from(new Set([
      path.resolve(this.packageRoot, 'node_modules', '@uruc', 'plugin-sdk'),
      path.resolve(this.packageRoot, '..', '..', 'node_modules', '@uruc', 'plugin-sdk'),
      path.resolve(process.cwd(), 'node_modules', '@uruc', 'plugin-sdk'),
    ]));

    for (const candidate of candidates) {
      const resolved = await resolveExistingPackageRoot(candidate);
      if (resolved) {
        this.runtimeSdkPackageRoot = resolved;
        return resolved;
      }
    }

    throw new Error(`Host runtime cannot resolve @uruc/plugin-sdk from package root ${this.packageRoot}`);
  }

  private async ensureRuntimeSdkBridge(packageRoot: string): Promise<void> {
    const sdkPackageRoot = await realpath(await this.resolveRuntimeSdkPackageRoot());
    const scopeRoot = path.join(packageRoot, 'node_modules', '@uruc');
    const linkPath = path.join(scopeRoot, 'plugin-sdk');
    const target = sdkPackageRoot;

    await mkdir(scopeRoot, { recursive: true });
    await rm(linkPath, { recursive: true, force: true });
    await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  }

  async startAll(ctx: PluginPlatformContext): Promise<void> {
    this.runtimeContext = ctx;
    ensurePlatformStorage(ctx.db);
    const lock = await readCityLock(this.lockPath);
    const enabledPlugins = Object.values(lock.plugins).filter((plugin) => plugin.enabled);
    const sorted = this.sortPlugins(enabledPlugins);
    this.initOrder.length = 0;

    for (const plugin of sorted) {
      try {
        await this.activatePlugin(plugin, ctx);
      } catch {
        continue;
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const pluginId of [...this.initOrder].reverse()) {
      await this.stopPlugin(pluginId);
    }
  }

  async destroyAll(): Promise<void> {
    await this.stopAll();
  }

  async enablePlugin(pluginId: string): Promise<void> {
    if (!this.runtimeContext) {
      throw new Error('Plugin host has not been started');
    }
    if (this.activePlugins.has(pluginId)) {
      return;
    }

    const lock = await readCityLock(this.lockPath);
    const spec = lock.plugins[pluginId];
    if (!spec) {
      throw new Error(`Plugin ${pluginId} is not present in the city lock`);
    }
    if (!spec.enabled) {
      throw new Error(`Plugin ${pluginId} is disabled in the city lock`);
    }

    await this.activatePlugin(spec, this.runtimeContext);
  }

  async disablePlugin(pluginId: string): Promise<void> {
    await this.stopPlugin(pluginId);
  }

  async reloadPlugin(pluginId: string): Promise<void> {
    if (!this.runtimeContext) {
      throw new Error('Plugin host has not been started');
    }

    const lock = await readCityLock(this.lockPath);
    const spec = lock.plugins[pluginId];
    if (!spec) {
      throw new Error(`Plugin ${pluginId} is not present in the city lock`);
    }

    await this.stopPlugin(pluginId);
    if (spec.enabled) {
      await this.activatePlugin(spec, this.runtimeContext);
    }
  }

  async syncAndReloadPlugin(pluginId: string): Promise<void> {
    await this.syncLockFile();
    await this.reloadPlugin(pluginId);
  }

  async listFrontendPlugins() {
    const lock = await readCityLock(this.lockPath);

    return Object.values(lock.plugins)
      .filter((plugin) => plugin.enabled && plugin.frontend)
      .map((plugin) => {
        const frontend = plugin.frontend!;
        const entry = frontend.entry.replace(/^\.\//, '');
        const css = frontend.css.map((assetPath) => assetPath.replace(/^\.\//, ''));
        const encodedPluginId = encodeURIComponent(plugin.pluginId);
        const encodedRevision = encodeURIComponent(plugin.revision);

        return {
          pluginId: plugin.pluginId,
          version: plugin.version,
          revision: plugin.revision,
          format: frontend.format,
          entryUrl: `/api/plugin-assets/${encodedPluginId}/${encodedRevision}/frontend-dist/${entry}`,
          cssUrls: css.map((assetPath) => `/api/plugin-assets/${encodedPluginId}/${encodedRevision}/frontend-dist/${assetPath}`),
          exportKey: frontend.exportKey,
          source: 'frontend-dist/manifest.json',
        };
      });
  }

  async readFrontendAsset(pluginId: string, revision: string, assetPath: string) {
    const lock = await readCityLock(this.lockPath);
    const plugin = lock.plugins[pluginId];
    if (!plugin || !plugin.enabled || !plugin.frontend || plugin.revision !== revision) {
      return null;
    }

    const normalizedAssetPath = assetPath.replace(/^\/+/, '');
    if (!normalizedAssetPath.startsWith('frontend-dist/')) {
      return null;
    }

    const pluginRoot = path.resolve(plugin.packageRoot);
    const frontendRoot = path.resolve(pluginRoot, 'frontend-dist');
    const filePath = path.resolve(pluginRoot, normalizedAssetPath);
    const relativeAssetPath = path.relative(frontendRoot, filePath);
    if (
      relativeAssetPath === ''
      || relativeAssetPath.startsWith('..')
      || path.isAbsolute(relativeAssetPath)
    ) {
      return null;
    }

    try {
      return {
        body: await readFile(filePath),
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  listPlugins(): PluginListEntry[] {
    return [...this.activePlugins.values()].map((entry) => ({
      name: entry.spec.pluginId,
      version: entry.spec.version,
      started: entry.started,
      state: entry.state,
      ...(entry.spec.venue ? { venue: entry.spec.venue } : {}),
    }));
  }

  getPluginDiagnostics(): PluginDiagnostic[] {
    return [...this.diagnostics.values()].map((entry) => ({ ...entry }));
  }

  private async activatePlugin(spec: LockedPluginSpec, ctx: PluginPlatformContext): Promise<void> {
    const scope = new DisposableScope();
    const entry: ActivePluginEntry = {
      spec,
      scope,
      state: 'loading',
      started: false,
      inFlightCount: 0,
      stopHandlers: [],
    };
    this.activePlugins.set(spec.pluginId, entry);
    this.setDiagnostic(entry);

    try {
      const loaded = await loadPluginModule(spec.entryPath, spec.revision);
      await this.activateBackendPlugin(loaded, entry, ctx);

      entry.state = 'active';
      entry.started = true;
      if (!this.initOrder.includes(spec.pluginId)) {
        this.initOrder.push(spec.pluginId);
      }
      this.setDiagnostic(entry);
    } catch (error: any) {
      entry.state = 'failed';
      entry.lastError = error?.message ?? String(error);

      let cleanupErrorMessage = '';
      for (const handler of entry.stopHandlers) {
        try {
          await handler();
        } catch (cleanupError: any) {
          cleanupErrorMessage = cleanupError?.message ?? String(cleanupError);
        }
      }
      try {
        await entry.scope.dispose();
      } catch (cleanupError: any) {
        cleanupErrorMessage = cleanupError?.message ?? String(cleanupError);
      }

      entry.started = false;
      this.activePlugins.delete(spec.pluginId);
      const index = this.initOrder.indexOf(spec.pluginId);
      if (index >= 0) {
        this.initOrder.splice(index, 1);
      }
      if (cleanupErrorMessage) {
        entry.lastError = `${entry.lastError}; cleanup: ${cleanupErrorMessage}`;
      }

      this.setDiagnostic(entry);
      throw error;
    }
  }

  private async activateBackendPlugin(
    plugin: BackendPluginDefinition,
    entry: ActivePluginEntry,
    ctx: PluginPlatformContext,
  ): Promise<void> {
    const runtimeContext = {
      pluginId: entry.spec.pluginId,
      commands: {
        register: (definition: Record<string, unknown>) => this.registerBackendCommand(entry, ctx.hooks, definition),
      },
      http: {
        registerRoute: (definition: Record<string, unknown>) => this.registerBackendRoute(entry, ctx.hooks, definition),
      },
      locations: {
        register: (definition: Record<string, unknown>) => this.registerBackendLocation(entry, ctx.hooks, definition),
      },
      policies: {
        register: (definition: Record<string, unknown>) => this.registerBackendPolicy(entry, ctx.hooks, definition),
      },
      events: {
        subscribe: (
          event: 'agent.authenticated' | 'connection.close' | 'location.entered' | 'location.left',
          handler: (payload: unknown, ctx: { pluginId: string; config: Record<string, unknown> }) => Promise<void> | void,
        ) => this.registerBackendEvent(entry, ctx.hooks, event, handler),
      },
      messaging: {
        sendToAgent: (agentId: string, type: string, payload: unknown) => {
          const gateway = ctx.services.tryGet('ws-gateway' as never) as { sendToAgent(agentId: string, msg: WSMessage): void } | undefined;
          gateway?.sendToAgent(agentId, { id: '', type, payload });
        },
        pushToOwner: (userId: string, type: string, payload: unknown) => {
          const gateway = ctx.services.tryGet('ws-gateway' as never) as { pushToOwner(userId: string, msg: WSMessage): void } | undefined;
          gateway?.pushToOwner(userId, { id: '', type, payload });
        },
        broadcast: (type: string, payload: unknown) => {
          const gateway = ctx.services.tryGet('ws-gateway' as never) as { broadcast(msg: WSMessage): void } | undefined;
          gateway?.broadcast({ id: '', type, payload });
        },
        getOnlineAgentIds: () => {
          const gateway = ctx.services.tryGet('ws-gateway' as never) as { getOnlineAgentIds(): string[] } | undefined;
          return gateway?.getOnlineAgentIds() ?? [];
        },
        getAgentCurrentLocation: (agentId: string) => {
          const gateway = ctx.services.tryGet('ws-gateway' as never) as { getAgentCurrentLocation(agentId: string): string | undefined } | undefined;
          return gateway?.getAgentCurrentLocation(agentId) ?? null;
        },
      },
      storage: {
        migrate: async (_version: string, handler: () => Promise<void> | void) => {
          await handler();
        },
        get: async (collection: string, recordId: string) => getStoredRecord(ctx.db, entry.spec.pluginId, collection, recordId),
        put: async (collection: string, recordId: string, value: unknown) => {
          await putStoredRecord(ctx.db, entry.spec.pluginId, collection, recordId, value);
        },
        delete: async (collection: string, recordId: string) => {
          await deleteStoredRecord(ctx.db, entry.spec.pluginId, collection, recordId);
        },
        list: async (collection: string) => listStoredRecords(ctx.db, entry.spec.pluginId, collection),
      },
      identity: { invoke: async () => undefined },
      agents: {
        invoke: async (input?: unknown) => {
          const action = typeof input === 'object' && input ? (input as Record<string, unknown>).action : undefined;
          if (action === 'get') {
            const agentId = String((input as Record<string, unknown>).agentId ?? '');
            if (!agentId) return null;
            const row = ctx.db.get(sql<{
              agentId: string;
              userId: string;
              agentName: string;
              description: string | null;
              avatarPath: string | null;
              frozen: number;
              searchable: number | null;
              isOnline: number;
            }>`
              SELECT
                id AS agentId,
                user_id AS userId,
                name AS agentName,
                description,
                avatar_path AS avatarPath,
                frozen,
                searchable,
                is_online AS isOnline
              FROM agents
              WHERE id = ${agentId}
            `) as {
              agentId: string;
              userId: string;
              agentName: string;
              description: string | null;
              avatarPath: string | null;
              frozen: number;
              searchable: number | null;
              isOnline: number;
            } | undefined;
            return row
              ? {
                  agentId: row.agentId,
                  userId: row.userId,
                  agentName: row.agentName,
                  description: row.description,
                  avatarPath: row.avatarPath,
                  frozen: row.frozen === 1,
                  searchable: row.searchable !== 0,
                  isOnline: row.isOnline === 1,
                }
              : null;
          }

          if (action === 'search') {
            const query = String((input as Record<string, unknown>).query ?? '').trim().toLowerCase();
            const limit = Math.min(50, Math.max(1, Number((input as Record<string, unknown>).limit ?? 20) || 20));
            const rows = ctx.db.all(sql<{
              agentId: string;
              userId: string;
              agentName: string;
              description: string | null;
              avatarPath: string | null;
              frozen: number;
              searchable: number | null;
              isOnline: number;
            }>`
              SELECT
                id AS agentId,
                user_id AS userId,
                name AS agentName,
                description,
                avatar_path AS avatarPath,
                frozen,
                searchable,
                is_online AS isOnline
              FROM agents
              WHERE searchable != 0
              ORDER BY is_online DESC, created_at DESC
            `) as Array<{
              agentId: string;
              userId: string;
              agentName: string;
              description: string | null;
              avatarPath: string | null;
              frozen: number;
              searchable: number | null;
              isOnline: number;
            }>;
            return rows
              .filter((row) => !row.frozen)
              .filter((row) => query === ''
                || row.agentId.toLowerCase().includes(query)
                || row.agentName.toLowerCase().includes(query)
                || (row.description ?? '').toLowerCase().includes(query))
              .slice(0, limit)
              .map((row) => ({
                agentId: row.agentId,
                userId: row.userId,
                agentName: row.agentName,
                description: row.description,
                avatarPath: row.avatarPath,
                frozen: row.frozen === 1,
                searchable: row.searchable !== 0,
                isOnline: row.isOnline === 1,
              }));
          }

          if (action === 'listOwned') {
            const userId = String((input as Record<string, unknown>).userId ?? '').trim();
            if (!userId) return [];
            const rows = ctx.db.all(sql<{
              agentId: string;
              userId: string;
              agentName: string;
              description: string | null;
              avatarPath: string | null;
              frozen: number;
              searchable: number | null;
              isOnline: number;
              isShadow: number;
            }>`
              SELECT
                id AS agentId,
                user_id AS userId,
                name AS agentName,
                description,
                avatar_path AS avatarPath,
                frozen,
                searchable,
                is_online AS isOnline,
                is_shadow AS isShadow
              FROM agents
              WHERE user_id = ${userId}
              ORDER BY is_shadow DESC, created_at DESC
            `) as Array<{
              agentId: string;
              userId: string;
              agentName: string;
              description: string | null;
              avatarPath: string | null;
              frozen: number;
              searchable: number | null;
              isOnline: number;
              isShadow: number;
            }>;
            return rows.map((row) => ({
              agentId: row.agentId,
              userId: row.userId,
              agentName: row.agentName,
              description: row.description,
              avatarPath: row.avatarPath,
              frozen: row.frozen === 1,
              searchable: row.searchable !== 0,
              isOnline: row.isOnline === 1,
              isShadow: row.isShadow === 1,
            }));
          }

          return undefined;
        },
      },
      presence: { invoke: async () => undefined },
      assets: { invoke: async () => undefined },
      moderation: { invoke: async () => undefined },
      scheduler: { invoke: async () => undefined },
      logging: {
        info: async (message: string, details?: unknown) => {
          console.log(`[plugin:${entry.spec.pluginId}] ${message}`, details ?? '');
        },
        warn: async (message: string, details?: unknown) => {
          console.warn(`[plugin:${entry.spec.pluginId}] ${message}`, details ?? '');
        },
        error: async (message: string, details?: unknown) => {
          console.error(`[plugin:${entry.spec.pluginId}] ${message}`, details ?? '');
        },
      },
      diagnostics: {
        report: async (name: string, payload: unknown) => {
          console.log(`[plugin:${entry.spec.pluginId}] diagnostic:${name}`, payload ?? '');
        },
      },
      lifecycle: {
        onStop: (handler: () => Promise<void> | void) => {
          entry.stopHandlers.push(handler);
        },
      },
      config: {
        get: async () => entry.spec.config,
      },
    };

    const setupResult = await plugin.setup(runtimeContext as any);
    if (setupResult && typeof setupResult === 'object' && 'dispose' in setupResult) {
      entry.scope.add(setupResult as Disposable);
    }
  }

  private registerBackendCommand(entry: ActivePluginEntry, hooks: HookRegistry, definition: Record<string, any>): HookDisposable {
    const commandSchema = buildCommandSchema(entry.spec.pluginId, definition);
    const handler = async (wsCtx: WSContext, msg: WSMessage) => {
      entry.inFlightCount += 1;
      this.setDiagnostic(entry);
      try {
        const result = await definition.handler(msg.payload ?? {}, {
          pluginId: entry.spec.pluginId,
          config: entry.spec.config,
          session: wsCtx.session,
          inCity: wsCtx.inCity,
          currentLocation: wsCtx.currentLocation,
          send: async (type: string, payload: unknown) => {
            wsCtx.gateway.send(wsCtx.ws, {
              id: '',
              type,
              payload,
            });
          },
        });
        wsCtx.gateway.send(wsCtx.ws, {
          id: msg.id,
          type: 'result',
          payload: result,
        });
      } catch (error: any) {
        wsCtx.gateway.send(wsCtx.ws, {
          id: msg.id,
          type: 'error',
          payload: {
            ...compactErrorPayload({
              error: error?.message ?? error?.error ?? 'Plugin command failed',
              code: error?.code ?? 'PLUGIN_COMMAND_FAILED',
              action: error?.action,
              nextAction: error?.nextAction,
              details: error?.details,
            }),
            citytime: Date.now(),
          },
        });
      } finally {
        entry.inFlightCount -= 1;
        this.setDiagnostic(entry);
      }
    };

    return entry.scope.add(hooks.registerWSCommand(commandSchema.type, handler, commandSchema))!;
  }

  private registerBackendRoute(entry: ActivePluginEntry, hooks: HookRegistry, definition: Record<string, any>): HookDisposable {
    const basePath = getPluginHttpBasePath(entry.spec.pluginId);
    const routePath = `${basePath}${String(definition.path ?? '')}`;
    const handler: HttpHandler = async (httpCtx: HttpContext) => {
      if (httpCtx.method !== definition.method) {
        return false;
      }

      const routeParams = matchRoutePath(routePath, httpCtx.path);
      if (!routeParams) {
        return false;
      }

      const authPolicy = definition.authPolicy ?? 'user';
      if (authPolicy !== 'public' && !httpCtx.session) {
        return false;
      }
      if (authPolicy === 'admin' && httpCtx.session?.role !== 'admin') {
        sendError(httpCtx.res, 403, { error: 'Admin access required.', code: 'FORBIDDEN' }, httpCtx.req);
        return true;
      }

      entry.inFlightCount += 1;
      this.setDiagnostic(entry);

      try {
        const requestUrl = new URL(httpCtx.req.url ?? '/', 'http://localhost');
        const contentType = String(httpCtx.req.headers['content-type'] ?? '').toLowerCase();
        const rawBody = httpCtx.method === 'GET'
          ? undefined
          : contentType.includes('application/json')
            ? undefined
            : await readRawRequestBody(httpCtx.req);
        const input = rawBody
          ? parseRouteInput(httpCtx.method, requestUrl, httpCtx.req.headers, rawBody)
          : httpCtx.method === 'GET'
            ? parseRouteInput(httpCtx.method, requestUrl, httpCtx.req.headers)
            : await parseBody(httpCtx.req);
        const result = await definition.handler(input, {
          pluginId: entry.spec.pluginId,
          config: entry.spec.config,
          httpSession: httpCtx.session ?? null,
          request: {
            method: httpCtx.method,
            path: httpCtx.path,
            headers: httpCtx.req.headers,
            query: buildQueryObject(requestUrl),
            params: routeParams,
            rawBody,
          },
        });
        sendRouteResult(httpCtx.res, httpCtx.req, result);
      } catch (error: any) {
        sendError(httpCtx.res, error?.statusCode ?? 500, {
          error: error?.message ?? error?.error ?? 'Plugin route failed',
          code: error?.code ?? 'PLUGIN_ROUTE_FAILED',
          action: error?.action,
          nextAction: error?.nextAction,
          details: error?.details,
        }, httpCtx.req);
      } finally {
        entry.inFlightCount -= 1;
        this.setDiagnostic(entry);
      }

      return true;
    };

    return entry.scope.add(hooks.registerHttpRoute(handler))!;
  }

  private registerBackendLocation(entry: ActivePluginEntry, hooks: HookRegistry, definition: Record<string, any>): HookDisposable {
    const locationId = namespacePluginLocation(entry.spec.pluginId, String(definition.id));
    return entry.scope.add(hooks.registerLocation({
      id: locationId,
      name: String(definition.name ?? definition.id),
      description: typeof definition.description === 'string' ? definition.description : undefined,
      pluginName: entry.spec.pluginId,
    }))!;
  }

  private registerBackendPolicy(entry: ActivePluginEntry, hooks: HookRegistry, definition: Record<string, any>): HookDisposable {
    const kind = definition.kind;
    const handler = definition.handler;
    if (typeof handler !== 'function') {
      throw new Error(`Policy ${definition.id ?? 'unknown'} is missing a handler`);
    }

    if (kind === 'command' || kind === 'message') {
      return entry.scope.add(hooks.before('ws.command', async (hookCtx: Record<string, unknown>) => {
        const result = await handler(hookCtx, {
          pluginId: entry.spec.pluginId,
          config: entry.spec.config,
        });
        if (result && typeof result === 'object' && 'cancelled' in (result as Record<string, unknown>)) {
          Object.assign(hookCtx, result);
        }
      }))!;
    }

    if (kind === 'location-enter') {
      return entry.scope.add(hooks.before('location.enter', (payload) => handler(payload, { pluginId: entry.spec.pluginId, config: entry.spec.config })))!;
    }

    if (kind === 'location-leave') {
      return entry.scope.add(hooks.before('location.leave', (payload) => handler(payload, { pluginId: entry.spec.pluginId, config: entry.spec.config })))!;
    }

    throw new Error(`Unsupported policy kind: ${String(kind)}`);
  }

  private registerBackendEvent(
    entry: ActivePluginEntry,
    hooks: HookRegistry,
    event: 'agent.authenticated' | 'connection.close' | 'location.entered' | 'location.left',
    handler: (payload: unknown, ctx: { pluginId: string; config: Record<string, unknown> }) => Promise<void> | void,
  ): HookDisposable {
    const callback = (payload: unknown) => handler(payload, {
      pluginId: entry.spec.pluginId,
      config: entry.spec.config,
    });

    switch (event) {
      case 'agent.authenticated':
        return entry.scope.add(hooks.after('agent.authenticated', callback))!;
      case 'connection.close':
        return entry.scope.add(hooks.before('connection.close', callback))!;
      case 'location.entered':
        return entry.scope.add(hooks.after('location.enter', callback))!;
      case 'location.left':
        return entry.scope.add(hooks.after('location.leave', callback))!;
      default:
        throw new Error(`Unsupported event: ${event satisfies never}`);
    }
  }

  private async stopPlugin(pluginId: string): Promise<void> {
    const entry = this.activePlugins.get(pluginId);
    if (!entry) return;

    entry.state = 'draining';
    this.setDiagnostic(entry);

    for (const handler of entry.stopHandlers) {
      await handler();
    }
    await entry.scope.dispose();

    entry.state = 'disabled';
    entry.started = false;
    this.setDiagnostic(entry);
    this.activePlugins.delete(pluginId);
    const index = this.initOrder.indexOf(pluginId);
    if (index >= 0) {
      this.initOrder.splice(index, 1);
    }
  }

  private sortPlugins(plugins: LockedPluginSpec[]): LockedPluginSpec[] {
    const byId = new Map(plugins.map((plugin) => [plugin.pluginId, plugin]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: LockedPluginSpec[] = [];

    const visit = (pluginId: string) => {
      if (visited.has(pluginId)) return;
      if (visiting.has(pluginId)) {
        throw new Error(`Circular plugin dependency detected at ${pluginId}`);
      }

      const plugin = byId.get(pluginId);
      if (!plugin) {
        throw new Error(`Missing dependency ${pluginId}`);
      }

      visiting.add(pluginId);
      for (const dependency of plugin.dependencies) {
        if (byId.has(dependency)) {
          visit(dependency);
        }
      }
      visiting.delete(pluginId);
      visited.add(pluginId);
      result.push(plugin);
    };

    for (const plugin of plugins) {
      visit(plugin.pluginId);
    }

    return result;
  }

  private setDiagnostic(entry: ActivePluginEntry): void {
    this.diagnostics.set(entry.spec.pluginId, {
      pluginId: entry.spec.pluginId,
      packageName: entry.spec.packageName,
      version: entry.spec.version,
      state: entry.state,
      revision: entry.spec.revision,
      publisher: entry.spec.publisher,
      ...(entry.spec.venue ? { venue: entry.spec.venue } : {}),
      permissionsGranted: entry.spec.permissionsGranted,
      inFlightCount: entry.inFlightCount,
      lastError: entry.lastError,
    });
  }

  private setResolutionFailureDiagnostic(
    pluginId: string,
    pluginConfig: CityConfigFile['plugins'][string],
    previous: LockedPluginSpec | undefined,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    this.diagnostics.set(pluginId, {
      pluginId,
      packageName: pluginConfig.packageName ?? previous?.packageName ?? pluginId,
      version: pluginConfig.version ?? previous?.version ?? 'unresolved',
      state: 'failed',
      revision: previous?.revision ?? 'unresolved',
      publisher: previous?.publisher ?? 'unknown',
      ...(previous?.venue ? { venue: previous.venue } : {}),
      permissionsGranted: previous?.permissionsGranted ?? pluginConfig.permissionsGranted ?? [],
      inFlightCount: 0,
      lastError: message,
    });
  }
}
