import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  frontendPluginSchema,
  pluginPackageSchema,
  type FrontendPlugin,
  type IntroCardPayload,
  type LocationPagePayload,
  type NavEntryPayload,
  type PageRoutePayload,
  type PluginPackageMetadata,
  type RuntimeSlicePayload,
} from '@uruc/plugin-sdk/frontend';
import { ZodError } from 'zod';
import { PublicApi } from '../lib/api';
import type { FrontendRuntimePluginManifest } from '../lib/types';
import { extensionRegistry } from './extension-points';

const packageModules = import.meta.glob('../../../plugins/*/package.json', { eager: true });
const pluginEntryModules = {
  ...import.meta.glob('../../../plugins/*/frontend/plugin.ts'),
  ...import.meta.glob('../../../plugins/*/frontend/plugin.tsx'),
} as Record<string, () => Promise<unknown>>;

type DiagnosticState =
  | 'loaded'
  | 'invalid_manifest'
  | 'missing_entry'
  | 'missing_runtime_export'
  | 'plugin_id_mismatch'
  | 'duplicate_plugin'
  | 'unknown_extension'
  | 'invalid_payload'
  | 'duplicate_route'
  | 'duplicate_alias'
  | 'duplicate_location'
  | 'broken_reference'
  | 'load_failed'
  | 'runtime_error';

export interface FrontendPluginDiagnostic {
  pluginId: string;
  state: DiagnosticState;
  message: string;
  source: string;
  target?: string;
}

interface RegisteredContributionBase {
  pluginId: string;
  pluginVersion: string;
  source: string;
}

export interface RegisteredPageRoute extends RegisteredContributionBase, Omit<PageRoutePayload, 'load'> {
  path: string;
  load: PageRoutePayload['load'];
}

export interface RegisteredLocationPage extends RegisteredContributionBase, LocationPagePayload {
  resolvedPath: string;
}

export interface RegisteredNavEntry extends RegisteredContributionBase, NavEntryPayload {}
export interface RegisteredIntroCard extends RegisteredContributionBase, IntroCardPayload {}
export interface RegisteredRuntimeSlice extends RegisteredContributionBase, RuntimeSlicePayload {}

export interface FrontendPluginRegistry {
  plugins: FrontendPlugin[];
  pageRoutes: RegisteredPageRoute[];
  locationPages: RegisteredLocationPage[];
  navEntries: RegisteredNavEntry[];
  introCards: RegisteredIntroCard[];
  runtimeSlices: RegisteredRuntimeSlice[];
  diagnostics: FrontendPluginDiagnostic[];
}

interface LoadedPluginRecord {
  plugin: FrontendPlugin;
  source: string;
}

interface DiscoveredPackageRecord {
  packageSource: string;
  pluginId: string;
  packageName: string;
  frontendEntry: string;
  entrySource: string;
  loadEntry: (() => Promise<unknown>) | null;
}

const runtimeScriptLoads = new Map<string, Promise<void>>();
const runtimeStylesLoaded = new Set<string>();

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

function getRuntimePluginExports(): Record<string, unknown> {
  const root = globalThis as Record<string, unknown>;
  const existing = root.__uruc_plugin_exports;
  if (existing && typeof existing === 'object') {
    return existing as Record<string, unknown>;
  }

  const next: Record<string, unknown> = {};
  root.__uruc_plugin_exports = next;
  return next;
}

function hasRuntimeFrontendEnvironment(): boolean {
  return typeof fetch === 'function'
    && typeof document !== 'undefined'
    && typeof document.createElement === 'function'
    && typeof document.head?.appendChild === 'function';
}

function ensureRuntimeStylesheet(url: string): void {
  if (!hasRuntimeFrontendEnvironment()) {
    return;
  }
  if (runtimeStylesLoaded.has(url)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.setAttribute?.('data-uruc-plugin-asset', url);
  document.head.appendChild(link);
  runtimeStylesLoaded.add(url);
}

async function ensureRuntimeScript(url: string): Promise<void> {
  if (runtimeScriptLoads.has(url)) {
    await runtimeScriptLoads.get(url);
    return;
  }
  if (!hasRuntimeFrontendEnvironment()) {
    throw new Error(`Cannot load runtime plugin script '${url}' without a browser document`);
  }

  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.setAttribute?.('data-uruc-plugin-asset', url);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load runtime plugin script '${url}'`));
    document.head.appendChild(script);
  });

  runtimeScriptLoads.set(url, pending);
  await pending;
}

function canonicalPluginRoute(pluginId: string, route: Pick<PageRoutePayload, 'id' | 'pathSegment' | 'shell'>): string {
  const segment = (route.pathSegment ?? route.id).replace(/^\/+/, '');
  return `/workspace/plugins/${pluginId}/${segment}`;
}

function normalizePluginPath(targetPath: string): string {
  const appShellMatch = targetPath.match(/^\/(?:app|play)\/plugins\/([^/]+)\/(.+)$/);
  if (appShellMatch) {
    return `/workspace/plugins/${appShellMatch[1]}/${appShellMatch[2]}`;
  }

  const legacyMatch = targetPath.match(/^\/plugins\/([^/]+)\/(.+)$/);
  if (legacyMatch) {
    return `/workspace/plugins/${legacyMatch[1]}/${legacyMatch[2]}`;
  }

  return targetPath;
}

function packageNameFromSource(source: string): string {
  return source.split('/').slice(-2, -1)[0] ?? source;
}

function preferredPluginDirectoryName(pluginId: string): string {
  const segments = pluginId.split('.');
  return segments[segments.length - 1] ?? pluginId;
}

function discoveredPackageSortRank(record: DiscoveredPackageRecord): [number, string] {
  const packageDir = packageNameFromSource(record.packageSource);
  const preferredDir = preferredPluginDirectoryName(record.pluginId);
  return [packageDir === preferredDir ? 0 : 1, record.packageSource];
}

function ensureUniqueBy<T extends { pluginId: string; source: string }>(
  items: T[],
  keyFn: (item: T) => string,
  state: DiagnosticState,
  diagnostics: FrontendPluginDiagnostic[],
  describe: (key: string) => string,
): T[] {
  const seen = new Map<string, T>();
  const next: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      diagnostics.push({
        pluginId: item.pluginId,
        state,
        source: item.source,
        message: describe(key),
      });
      continue;
    }
    seen.set(key, item);
    next.push(item);
  }

  return next;
}

export function createEmptyFrontendPluginRegistry(): FrontendPluginRegistry {
  return {
    plugins: [],
    pageRoutes: [],
    locationPages: [],
    navEntries: [],
    introCards: [],
    runtimeSlices: [],
    diagnostics: [],
  };
}

function addLoadedPluginCandidate(options: {
  expectedPluginId: string;
  candidate: unknown;
  source: string;
  diagnostics: FrontendPluginDiagnostic[];
  loadedPlugins: LoadedPluginRecord[];
}): void {
  const parsedPlugin = frontendPluginSchema.safeParse(options.candidate);
  if (!parsedPlugin.success) {
    options.diagnostics.push({
      pluginId: options.expectedPluginId,
      state: 'invalid_manifest',
      source: options.source,
      message: formatZodError(parsedPlugin.error),
    });
    return;
  }

  const plugin = parsedPlugin.data as FrontendPlugin;
  if (plugin.pluginId !== options.expectedPluginId) {
    options.diagnostics.push({
      pluginId: options.expectedPluginId,
      state: 'plugin_id_mismatch',
      source: options.source,
      message: `Frontend plugin id '${plugin.pluginId}' does not match backend plugin id '${options.expectedPluginId}'`,
    });
    return;
  }

  options.loadedPlugins.push({
    plugin,
    source: options.source,
  });
}

function discoverFrontendPackages(): {
  packages: DiscoveredPackageRecord[];
  diagnostics: FrontendPluginDiagnostic[];
} {
  const diagnostics: FrontendPluginDiagnostic[] = [];
  const discoveredPackages: DiscoveredPackageRecord[] = [];

  for (const [source, mod] of Object.entries(packageModules)) {
    const candidate = ((mod as { default?: unknown }).default ?? mod) as unknown;
    const parsedPackage = pluginPackageSchema.safeParse(candidate);
    if (!parsedPackage.success) {
      diagnostics.push({
        pluginId: packageNameFromSource(source),
        state: 'invalid_manifest',
        source,
        message: formatZodError(parsedPackage.error),
      });
      continue;
    }

    const pkg = parsedPackage.data as PluginPackageMetadata;
    if (!pkg.urucFrontend) {
      continue;
    }

    const entrySource = source.replace(/package\.json$/, pkg.urucFrontend.entry.replace(/^\.\//, ''));
    discoveredPackages.push({
      packageSource: source,
      pluginId: pkg.urucPlugin.pluginId,
      packageName: pkg.name,
      frontendEntry: pkg.urucFrontend.entry,
      entrySource,
      loadEntry: pluginEntryModules[entrySource] ?? null,
    });
  }

  return {
    packages: [...discoveredPackages].sort((left, right) => {
      const [leftRank, leftSource] = discoveredPackageSortRank(left);
      const [rightRank, rightSource] = discoveredPackageSortRank(right);
      return leftRank - rightRank || leftSource.localeCompare(rightSource);
    }),
    diagnostics,
  };
}

async function loadDiscoveredFrontendPackages(
  packages: DiscoveredPackageRecord[],
  diagnostics: FrontendPluginDiagnostic[],
): Promise<LoadedPluginRecord[]> {
  const loadedPlugins: LoadedPluginRecord[] = [];
  const seenPluginIds = new Set<string>();

  for (const record of packages) {
    if (seenPluginIds.has(record.pluginId)) {
      diagnostics.push({
        pluginId: record.pluginId,
        state: 'duplicate_plugin',
        source: record.packageSource,
        message: `Frontend plugin '${record.pluginId}' is shadowed by a higher-priority source package`,
      });
      continue;
    }
    seenPluginIds.add(record.pluginId);

    if (!record.loadEntry) {
      diagnostics.push({
        pluginId: record.pluginId,
        state: 'missing_entry',
        source: record.packageSource,
        message: `Frontend entry '${record.frontendEntry}' was not found for ${record.packageName}`,
      });
      continue;
    }

    let mod: unknown;
    try {
      mod = await record.loadEntry();
    } catch (error) {
      diagnostics.push({
        pluginId: record.pluginId,
        state: 'load_failed',
        source: record.entrySource,
        message: error instanceof Error ? error.message : `Failed to load frontend entry '${record.frontendEntry}'`,
      });
      continue;
    }

    addLoadedPluginCandidate({
      expectedPluginId: record.pluginId,
      candidate: ((mod as { default?: unknown }).default ?? mod) as unknown,
      source: record.entrySource,
      diagnostics,
      loadedPlugins,
    });
  }

  return loadedPlugins;
}

async function loadRuntimeFrontendPlugins(staticPluginIds: Set<string>): Promise<{
  loadedPlugins: LoadedPluginRecord[];
  diagnostics: FrontendPluginDiagnostic[];
}> {
  const diagnostics: FrontendPluginDiagnostic[] = [];
  const loadedPlugins: LoadedPluginRecord[] = [];
  if (!hasRuntimeFrontendEnvironment()) {
    return { loadedPlugins, diagnostics };
  }

  let manifests: FrontendRuntimePluginManifest[];
  try {
    manifests = (await PublicApi.frontendPlugins()).plugins ?? [];
  } catch (error) {
    diagnostics.push({
      pluginId: 'frontend-host',
      state: 'load_failed',
      source: '/api/frontend-plugins',
      message: error instanceof Error ? error.message : 'Failed to load runtime frontend plugin manifests',
    });
    return { loadedPlugins, diagnostics };
  }

  const seenRuntimePluginIds = new Set<string>();

  for (const manifest of manifests) {
    if (staticPluginIds.has(manifest.pluginId)) {
      diagnostics.push({
        pluginId: manifest.pluginId,
        state: 'duplicate_plugin',
        source: manifest.entryUrl,
        message: `Runtime plugin '${manifest.pluginId}' is shadowed by a built-in plugin with the same id`,
      });
      continue;
    }

    if (seenRuntimePluginIds.has(manifest.pluginId)) {
      diagnostics.push({
        pluginId: manifest.pluginId,
        state: 'duplicate_plugin',
        source: manifest.entryUrl,
        message: `Runtime plugin '${manifest.pluginId}' was returned more than once`,
      });
      continue;
    }
    seenRuntimePluginIds.add(manifest.pluginId);

    try {
      for (const cssUrl of manifest.cssUrls) {
        ensureRuntimeStylesheet(cssUrl);
      }
      await ensureRuntimeScript(manifest.entryUrl);
    } catch (error) {
      diagnostics.push({
        pluginId: manifest.pluginId,
        state: 'load_failed',
        source: manifest.entryUrl,
        message: error instanceof Error ? error.message : `Failed to load runtime frontend assets for '${manifest.pluginId}'`,
      });
      continue;
    }

    const candidate = getRuntimePluginExports()[manifest.exportKey];
    if (!candidate) {
      diagnostics.push({
        pluginId: manifest.pluginId,
        state: 'missing_runtime_export',
        source: manifest.entryUrl,
        message: `Runtime plugin export '${manifest.exportKey}' was not found after loading '${manifest.entryUrl}'`,
      });
      continue;
    }

    addLoadedPluginCandidate({
      expectedPluginId: manifest.pluginId,
      candidate,
      source: manifest.entryUrl,
      diagnostics,
      loadedPlugins,
    });
  }

  return { loadedPlugins, diagnostics };
}

function buildRegistryFromLoadedPlugins(
  loadedPlugins: LoadedPluginRecord[],
  diagnostics: FrontendPluginDiagnostic[],
): FrontendPluginRegistry {
  const seenPluginIds = new Set<string>();
  const plugins: FrontendPlugin[] = [];
  const pageRoutes: RegisteredPageRoute[] = [];
  const navEntries: RegisteredNavEntry[] = [];
  const introCards: RegisteredIntroCard[] = [];
  const runtimeSlices: RegisteredRuntimeSlice[] = [];
  const rawLocationPages: Array<RegisteredContributionBase & LocationPagePayload> = [];

  for (const { plugin, source } of loadedPlugins) {
    if (seenPluginIds.has(plugin.pluginId)) {
      diagnostics.push({
        pluginId: plugin.pluginId,
        state: 'duplicate_plugin',
        source,
        message: `Frontend plugin '${plugin.pluginId}' was loaded more than once`,
      });
      continue;
    }
    seenPluginIds.add(plugin.pluginId);

    plugins.push(plugin);
    diagnostics.push({
      pluginId: plugin.pluginId,
      state: 'loaded',
      source,
      message: `Loaded ${plugin.contributes.length} contribution(s)`,
    });

    for (const contribution of plugin.contributes) {
      const extension = extensionRegistry[contribution.target];
      if (!extension) {
        diagnostics.push({
          pluginId: plugin.pluginId,
          state: 'unknown_extension',
          source,
          target: contribution.target,
          message: `Unsupported extension point '${contribution.target}'`,
        });
        continue;
      }

      const parsedPayload = extension.schema.safeParse(contribution.payload);
      if (!parsedPayload.success) {
        diagnostics.push({
          pluginId: plugin.pluginId,
          state: 'invalid_payload',
          source,
          target: contribution.target,
          message: formatZodError(parsedPayload.error),
        });
        continue;
      }

      const base = {
        pluginId: plugin.pluginId,
        pluginVersion: plugin.version,
        source,
      } satisfies RegisteredContributionBase;

      switch (contribution.target) {
        case PAGE_ROUTE_TARGET:
          {
            const payload = parsedPayload.data as PageRoutePayload;
          pageRoutes.push({
            ...base,
            ...payload,
            venue: payload.venue ? { ...payload.venue, category: payload.venue.category ?? 'else' } : undefined,
            path: canonicalPluginRoute(plugin.pluginId, payload),
          });
          }
          break;
        case LOCATION_PAGE_TARGET:
          rawLocationPages.push({
            ...base,
            ...(parsedPayload.data as LocationPagePayload),
            venueCategory: (parsedPayload.data as LocationPagePayload).venueCategory ?? 'else',
          });
          break;
        case NAV_ENTRY_TARGET:
          navEntries.push({
            ...base,
            ...(parsedPayload.data as NavEntryPayload),
            to: normalizePluginPath((parsedPayload.data as NavEntryPayload).to),
          });
          break;
        case INTRO_CARD_TARGET:
          introCards.push({ ...base, ...(parsedPayload.data as IntroCardPayload) });
          break;
        case RUNTIME_SLICE_TARGET:
          runtimeSlices.push({ ...base, ...(parsedPayload.data as RuntimeSlicePayload) });
          break;
      }
    }
  }

  const dedupedRoutes = ensureUniqueBy(
    pageRoutes,
    (route) => route.path,
    'duplicate_route',
    diagnostics,
    (path) => `Duplicate page route '${path}'`,
  ).sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.path.localeCompare(right.path));

  const routePathByPluginAndId = new Map(
    dedupedRoutes.map((route) => [`${route.pluginId}:${route.id}`, route.path] as const),
  );
  const canonicalPaths = new Set(dedupedRoutes.map((route) => route.path));

  const aliasOwnerByPath = new Map<string, RegisteredPageRoute>();
  for (const route of dedupedRoutes) {
    for (const alias of route.aliases ?? []) {
      const existingAlias = aliasOwnerByPath.get(alias);
      if (existingAlias) {
        diagnostics.push({
          pluginId: route.pluginId,
          state: 'duplicate_alias',
          source: route.source,
          target: PAGE_ROUTE_TARGET,
          message: `Duplicate alias route '${alias}'`,
        });
        continue;
      }

      if (route.path === alias || canonicalPaths.has(alias)) {
        diagnostics.push({
          pluginId: route.pluginId,
          state: 'duplicate_alias',
          source: route.source,
          target: PAGE_ROUTE_TARGET,
          message: `Alias '${alias}' conflicts with an existing canonical route`,
        });
        continue;
      }

      aliasOwnerByPath.set(alias, route);
    }
  }

  const resolvedLocationPages = rawLocationPages
    .map((location) => {
      const resolvedPath = routePathByPluginAndId.get(`${location.pluginId}:${location.routeId}`);
      if (!resolvedPath) {
        diagnostics.push({
          pluginId: location.pluginId,
          state: 'broken_reference',
          source: location.source,
          target: LOCATION_PAGE_TARGET,
          message: `Location '${location.locationId}' references missing route '${location.routeId}'`,
        });
        return null;
      }
      return {
        ...location,
        resolvedPath,
      } satisfies RegisteredLocationPage;
    })
    .filter((item): item is RegisteredLocationPage => item !== null);

  const locationPages = ensureUniqueBy(
    resolvedLocationPages,
    (location) => location.locationId,
    'duplicate_location',
    diagnostics,
    (locationId) => `Duplicate location '${locationId}'`,
  ).sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.locationId.localeCompare(right.locationId));

  return {
    plugins,
    pageRoutes: dedupedRoutes,
    locationPages,
    navEntries: [...navEntries].sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.to.localeCompare(right.to)),
    introCards: [...introCards].sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id)),
    runtimeSlices,
    diagnostics,
  };
}

export async function loadFrontendPluginRegistry(): Promise<FrontendPluginRegistry> {
  const { packages, diagnostics } = discoverFrontendPackages();
  const loadedPlugins = await loadDiscoveredFrontendPackages(packages, diagnostics);
  const runtime = await loadRuntimeFrontendPlugins(new Set(packages.map((pkg) => pkg.pluginId)));
  return buildRegistryFromLoadedPlugins(
    [...loadedPlugins, ...runtime.loadedPlugins],
    [...diagnostics, ...runtime.diagnostics],
  );
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
