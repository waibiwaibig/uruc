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
  | 'plugin_id_mismatch'
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

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

function canonicalPluginRoute(pluginId: string, route: Pick<PageRoutePayload, 'id' | 'pathSegment' | 'shell'>): string {
  const segment = (route.pathSegment ?? route.id).replace(/^\/+/, '');
  const base = (() => {
    switch (route.shell) {
      case 'public':
        return '/plugins';
      case 'app':
        return '/app/plugins';
      case 'standalone':
        // Keep venue URLs stable while moving plugin pages off the global gameplay chrome.
        return '/play/plugins';
      default:
        return '/play/plugins';
    }
  })();
  return `${base}/${pluginId}/${segment}`;
}

function packageNameFromSource(source: string): string {
  return source.split('/').slice(-2, -1)[0] ?? source;
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
    packages: discoveredPackages,
    diagnostics,
  };
}

function buildRegistryFromLoadedPlugins(
  loadedPlugins: LoadedPluginRecord[],
  diagnostics: FrontendPluginDiagnostic[],
): FrontendPluginRegistry {
  const plugins: FrontendPlugin[] = [];
  const pageRoutes: RegisteredPageRoute[] = [];
  const navEntries: RegisteredNavEntry[] = [];
  const introCards: RegisteredIntroCard[] = [];
  const runtimeSlices: RegisteredRuntimeSlice[] = [];
  const rawLocationPages: Array<RegisteredContributionBase & LocationPagePayload> = [];

  for (const { plugin, source } of loadedPlugins) {
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
          pageRoutes.push({
            ...base,
            ...(parsedPayload.data as PageRoutePayload),
            path: canonicalPluginRoute(plugin.pluginId, parsedPayload.data as PageRoutePayload),
          });
          break;
        case LOCATION_PAGE_TARGET:
          rawLocationPages.push({ ...base, ...(parsedPayload.data as LocationPagePayload) });
          break;
        case NAV_ENTRY_TARGET:
          navEntries.push({ ...base, ...(parsedPayload.data as NavEntryPayload) });
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
  const loadedPlugins: LoadedPluginRecord[] = [];

  for (const record of packages) {
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

    const candidate = ((mod as { default?: unknown }).default ?? mod) as unknown;
    const parsedPlugin = frontendPluginSchema.safeParse(candidate);
    if (!parsedPlugin.success) {
      diagnostics.push({
        pluginId: record.pluginId,
        state: 'invalid_manifest',
        source: record.entrySource,
        message: formatZodError(parsedPlugin.error),
      });
      continue;
    }

    const plugin = parsedPlugin.data as FrontendPlugin;
    if (plugin.pluginId !== record.pluginId) {
      diagnostics.push({
        pluginId: record.pluginId,
        state: 'plugin_id_mismatch',
        source: record.entrySource,
        message: `Frontend plugin id '${plugin.pluginId}' does not match backend plugin id '${record.pluginId}'`,
      });
      continue;
    }

    loadedPlugins.push({
      plugin,
      source: record.entrySource,
    });
  }

  return buildRegistryFromLoadedPlugins(loadedPlugins, diagnostics);
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
