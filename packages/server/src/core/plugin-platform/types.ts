import type { HookDisposable } from '../plugin-system/hook-registry.js';
import type { HookRegistry } from '../plugin-system/hook-registry.js';
import type { ServiceRegistry } from '../plugin-system/service-registry.js';
import type { UrucDb } from '../database/index.js';
import type { Disposable } from './scope.js';

export type PluginRuntimeState =
  | 'installed'
  | 'resolved'
  | 'loading'
  | 'active'
  | 'draining'
  | 'disabled'
  | 'failed';

export interface PluginPlatformContext {
  db: UrucDb;
  hooks: HookRegistry;
  services: ServiceRegistry;
}

export interface CityPluginSource {
  id: string;
  type: 'npm';
  registry: string;
}

export interface SourceRegistryRelease {
  alias?: string;
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
  path?: string;
  artifactUrl?: string;
  integrity?: string;
}

export interface SourceRegistryFile {
  apiVersion: 1;
  packages: SourceRegistryRelease[];
}

export interface ResolvedSourcePluginRelease extends SourceRegistryRelease {
  sourceId: string;
  registry: string;
  sourcePath: string;
}

export interface CityPluginSpec {
  pluginId: string;
  packageName?: string;
  version?: string;
  enabled?: boolean;
  source?: string;
  permissionsGranted?: string[];
  devOverridePath?: string;
  config?: Record<string, unknown>;
}

export interface CityConfigFile {
  apiVersion: 2;
  approvedPublishers: string[];
  pluginStoreDir?: string;
  sources: CityPluginSource[];
  plugins: Record<string, CityPluginSpec>;
}

export interface LockedPluginHistoryEntry {
  revision: string;
  version: string;
  packageRoot: string;
  entryPath: string;
  integrity?: string;
  sourceFingerprint?: string;
  generatedAt: string;
}

export interface LockedPluginSpec {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
  revision: string;
  sourcePath: string;
  packageRoot: string;
  entryPath: string;
  enabled: boolean;
  dependencies: string[];
  activation: Array<'startup' | 'onCommand' | 'onLocationEnter' | 'onHttpRoute' | 'onAdminPage'>;
  permissionsRequested: string[];
  permissionsGranted: string[];
  config: Record<string, unknown>;
  source?: string;
  sourceType: 'path' | 'package';
  integrity?: string;
  sourceFingerprint?: string;
  healthcheck?: {
    timeoutMs?: number;
  };
  history: LockedPluginHistoryEntry[];
  generatedAt: string;
}

export interface CityLockFile {
  apiVersion: 2;
  generatedAt: string;
  plugins: Record<string, LockedPluginSpec>;
}

export interface PackageJsonUrucPlugin {
  pluginId: string;
  apiVersion: 2;
  kind: 'backend';
  entry: string;
  publisher: string;
  displayName: string;
  description?: string;
  permissions?: string[];
  dependencies?: string[];
  activation?: Array<'startup' | 'onCommand' | 'onLocationEnter' | 'onHttpRoute' | 'onAdminPage'>;
  defaultConfigSchema?: Record<string, unknown>;
  migrations?: Array<{
    fromVersion: string;
    toVersion: string;
    description?: string;
  }>;
  healthcheck?: {
    timeoutMs?: number;
  };
}

export interface PluginPackageManifest {
  packageName: string;
  version: string;
  packageRoot: string;
  entryPath: string;
  urucPlugin: PackageJsonUrucPlugin;
}

export interface PluginListEntry {
  name: string;
  version: string;
  started: boolean;
  state?: PluginRuntimeState;
}

export interface PluginDiagnostic {
  pluginId: string;
  packageName: string;
  version: string;
  state: PluginRuntimeState;
  revision: string;
  publisher: string;
  permissionsGranted: string[];
  inFlightCount: number;
  lastError?: string;
}

export interface PluginHealthView {
  pluginId: string;
  package: string;
  publisher: string;
  revision: string;
  state: PluginRuntimeState;
  permissionsGranted: string[];
  inFlightCount: number;
  lastError?: string;
}

export interface PluginPlatformHealthProvider {
  listPlugins(): PluginListEntry[];
  getPluginDiagnostics(): unknown[];
}

export interface BackendPluginSetupContext {
  pluginId: string;
  commands: {
    register(definition: Record<string, unknown>): Promise<HookDisposable> | HookDisposable;
  };
  http: {
    registerRoute(definition: Record<string, unknown>): Promise<HookDisposable> | HookDisposable;
  };
  locations: {
    register(definition: Record<string, unknown>): Promise<HookDisposable> | HookDisposable;
  };
  policies: {
    register(definition: Record<string, unknown>): Promise<HookDisposable> | HookDisposable;
  };
  events: {
    subscribe(
      event: 'agent.authenticated' | 'connection.close' | 'location.entered' | 'location.left',
      handler: (payload: unknown, ctx: {
        pluginId: string;
        config: Record<string, unknown>;
      }) => Promise<void> | void,
    ): Promise<HookDisposable> | HookDisposable;
  };
  messaging: {
    sendToAgent(agentId: string, type: string, payload: unknown): void;
    pushToOwner(userId: string, type: string, payload: unknown): void;
    broadcast(type: string, payload: unknown): void;
    getOnlineAgentIds(): string[];
    getAgentCurrentLocation(agentId: string): string | null;
  };
  storage: {
    migrate(version: string, handler: () => Promise<void> | void): Promise<void>;
    get(collection: string, recordId: string): Promise<unknown | null>;
    put(collection: string, recordId: string, value: unknown): Promise<void>;
    delete(collection: string, recordId: string): Promise<void>;
    list(collection: string): Promise<Array<{
      id: string;
      value: unknown;
      updatedAt: number;
    }>>;
  };
  identity: {
    invoke(input?: unknown): Promise<unknown>;
  };
  agents: {
    invoke(input?: unknown): Promise<unknown>;
  };
  presence: {
    invoke(input?: unknown): Promise<unknown>;
  };
  assets: {
    invoke(input?: unknown): Promise<unknown>;
  };
  moderation: {
    invoke(input?: unknown): Promise<unknown>;
  };
  scheduler: {
    invoke(input?: unknown): Promise<unknown>;
  };
  logging: {
    info(message: string, details?: unknown): Promise<void>;
    warn(message: string, details?: unknown): Promise<void>;
    error(message: string, details?: unknown): Promise<void>;
  };
  diagnostics: {
    report(name: string, payload: unknown): Promise<void>;
  };
  lifecycle: {
    onStop(handler: () => Promise<void> | void): void;
  };
  config: {
    get(): Promise<Record<string, unknown>>;
  };
}

export interface BackendPluginDefinition {
  kind: 'uruc.backend-plugin@v2';
  pluginId: string;
  apiVersion: 2;
  setup(ctx: BackendPluginSetupContext): Promise<void | Disposable> | void | Disposable;
}
