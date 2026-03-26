import { z } from 'zod';

export const PAGE_ROUTE_TARGET = 'uruc.page-route@v1';
export const LOCATION_PAGE_TARGET = 'uruc.location-page@v1';
export const NAV_ENTRY_TARGET = 'uruc.nav-entry@v1';
export const INTRO_CARD_TARGET = 'uruc.intro-card@v1';
export const RUNTIME_SLICE_TARGET = 'uruc.runtime-slice@v1';

export type ExtensionTarget =
  | typeof PAGE_ROUTE_TARGET
  | typeof LOCATION_PAGE_TARGET
  | typeof NAV_ENTRY_TARGET
  | typeof INTRO_CARD_TARGET
  | typeof RUNTIME_SLICE_TARGET;

export type PluginShell = 'public' | 'app' | 'standalone';
export type PluginGuard = 'public' | 'auth' | 'admin';
export type PluginRole = 'user' | 'admin';
export type FrontendApiVersion = 1;

export type PluginPageModule = { default: unknown };
export type PluginPageLoader = () => Promise<PluginPageModule>;
export type RuntimeListener = (payload: unknown) => void;

export interface PluginCommandErrorPayload {
  error: string;
  code?: string;
  retryable?: boolean;
  action?: string;
  details?: Record<string, unknown>;
}

export class PluginCommandError extends Error {
  code?: string;
  action?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;

  constructor(payload: PluginCommandErrorPayload) {
    super(payload.error);
    this.name = 'PluginCommandError';
    this.code = payload.code;
    this.action = payload.action;
    this.retryable = payload.retryable;
    this.details = payload.details;
  }
}

export function isPluginCommandError(error: unknown): error is PluginCommandError {
  return error instanceof PluginCommandError
    || (
      typeof error === 'object'
      && error !== null
      && 'message' in error
      && ('code' in error || 'retryable' in error || 'action' in error || 'details' in error)
    );
}

export function getPluginLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en';
}

export function formatPluginDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(getPluginLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatPluginDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(getPluginLocale(), {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function formatPluginTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(getPluginLocale(), {
    timeStyle: 'medium',
  }).format(new Date(value));
}

export interface PluginRuntimeSnapshot {
  status: string;
  isConnected: boolean;
  hasController: boolean;
  isController: boolean;
  error: string;
  inCity: boolean;
  currentLocation: string | null;
  agentId: string | null;
  agentName: string | null;
}

export interface PluginSessionState {
  connected: boolean;
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number;
}

export interface PluginRuntimeApi extends PluginRuntimeSnapshot {
  connect: () => Promise<void>;
  disconnect: () => void;
  claimControl: () => Promise<PluginSessionState>;
  releaseControl: () => Promise<PluginSessionState>;
  refreshSessionState: () => Promise<PluginSessionState>;
  refreshCommands: (query?: { scope: 'city' } | { scope: 'plugin'; pluginId: string }) => Promise<unknown>;
  sendCommand: <T = unknown>(type: string, payload?: unknown) => Promise<T>;
  enterCity: () => Promise<PluginSessionState>;
  leaveCity: () => Promise<void>;
  enterLocation: (locationId: string) => Promise<void>;
  leaveLocation: () => Promise<void>;
  subscribe: (event: string, listener: RuntimeListener) => () => void;
  reportEvent: (message: string) => void;
}

export interface PluginUserSummary {
  id: string;
  username: string;
  role: PluginRole;
  email?: string;
  emailVerified?: boolean;
}

export interface PluginAgentSummary {
  id: string;
  name: string;
  isShadow?: boolean;
}

export interface PluginShellApi {}

export interface PluginPageData {
  pluginId: string;
  runtime: PluginRuntimeApi;
  user: PluginUserSummary | null;
  ownerAgent: PluginAgentSummary | null;
  connectedAgent: PluginAgentSummary | null;
  shell: PluginShellApi;
}

export type RuntimeSliceMount = (api: PluginRuntimeApi) => void | (() => void);

export interface ExtensionPoint<T> {
  id: ExtensionTarget;
  version: 'v1';
  schema: z.ZodType<T>;
}

const functionSchema = z.custom<(...args: any[]) => unknown>((value) => typeof value === 'function', {
  message: 'Expected function',
});

export const pluginShellSchema = z.enum(['public', 'app', 'standalone']);
export const pluginGuardSchema = z.enum(['public', 'auth', 'admin']);
export const pluginRoleSchema = z.enum(['user', 'admin']);
const namespacedIdSchema = z.string().min(1).refine((value) => value.includes('.'), {
  message: 'Expected a namespaced id',
});

export const pageRouteSchema = z.object({
  id: z.string().min(1),
  pathSegment: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  shell: pluginShellSchema,
  guard: pluginGuardSchema,
  order: z.number().optional(),
  load: functionSchema,
});

export const locationPageSchema = z.object({
  locationId: namespacedIdSchema,
  routeId: z.string().min(1),
  titleKey: z.string().min(1),
  shortLabelKey: z.string().min(1).optional(),
  descriptionKey: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  accent: z.string().min(1).optional(),
  order: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const navEntrySchema = z.object({
  id: z.string().min(1),
  to: z.string().min(1),
  labelKey: z.string().min(1),
  icon: z.string().min(1).optional(),
  order: z.number().optional(),
  requiresRole: pluginRoleSchema.optional(),
});

export const introCardSchema = z.object({
  id: z.string().min(1),
  titleKey: z.string().min(1),
  bodyKey: z.string().min(1),
  icon: z.string().min(1).optional(),
  order: z.number().optional(),
});

export const runtimeSliceSchema = z.object({
  id: z.string().min(1),
  mount: functionSchema,
});

export const frontendPluginSchema = z.object({
  pluginId: namespacedIdSchema,
  version: z.string().min(1),
  contributes: z.array(z.object({
    target: z.string().min(1),
    payload: z.unknown(),
  })),
  translations: z.record(z.string(), z.record(z.string(), z.record(z.unknown()))).optional(),
});

export const frontendPackageMetadataSchema = z.object({
  apiVersion: z.literal(1),
  entry: z.string().min(1),
});

export const pluginPackageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  urucPlugin: z.object({
    pluginId: namespacedIdSchema,
  }),
  urucFrontend: frontendPackageMetadataSchema.optional(),
});

export type PageRoutePayload = z.infer<typeof pageRouteSchema> & { load: PluginPageLoader };
export type LocationPagePayload = z.infer<typeof locationPageSchema>;
export type NavEntryPayload = z.infer<typeof navEntrySchema>;
export type IntroCardPayload = z.infer<typeof introCardSchema>;
export type RuntimeSlicePayload = z.infer<typeof runtimeSliceSchema> & { mount: RuntimeSliceMount };
export type FrontendPlugin = z.infer<typeof frontendPluginSchema> & {
  contributes: Array<{
    target: ExtensionTarget;
    payload: unknown;
  }>;
};
export type FrontendPackageMetadata = z.infer<typeof frontendPackageMetadataSchema>;
export type PluginPackageMetadata = z.infer<typeof pluginPackageSchema>;

export function defineExtensionPoint<T>(point: ExtensionPoint<T>): ExtensionPoint<T> {
  return point;
}

export function defineFrontendPlugin<T extends FrontendPlugin>(plugin: T): T {
  return plugin;
}
