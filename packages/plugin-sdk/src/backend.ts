import { z } from 'zod';

export type SerializablePrimitive = string | number | boolean | null;
export type SerializableValue =
  | SerializablePrimitive
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export interface Disposable {
  dispose(): void | Promise<void>;
}

export const disposableSchema = z.object({
  dispose: z.function().args().returns(z.union([z.void(), z.promise(z.void())])),
});

export const permissionSchema = z.string().min(1);
export const activationSchema = z.enum([
  'startup',
  'onCommand',
  'onLocationEnter',
  'onHttpRoute',
  'onAdminPage',
]);

export const pluginHealthcheckSchema = z.object({
  timeoutMs: z.number().int().positive().optional(),
});

export const venueModuleMetadataSchema = z.object({
  moduleId: z.string().min(1).optional(),
  namespace: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

export const pluginMigrationSchema = z.object({
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
  description: z.string().min(1).optional(),
});

export const backendPluginManifestSchema = z.object({
  pluginId: z.string().min(1),
  apiVersion: z.literal(2),
  kind: z.literal('backend'),
  entry: z.string().min(1),
  publisher: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1).optional(),
  venue: venueModuleMetadataSchema.optional(),
  permissions: z.array(permissionSchema).default([]),
  dependencies: z.array(z.string().min(1)).default([]),
  activation: z.array(activationSchema).default(['startup']),
  defaultConfigSchema: z.record(z.string(), z.unknown()).optional(),
  migrations: z.array(pluginMigrationSchema).default([]),
  healthcheck: pluginHealthcheckSchema.optional(),
});

export type BackendPluginManifest = z.infer<typeof backendPluginManifestSchema>;
export type VenueModuleMetadata = z.infer<typeof venueModuleMetadataSchema>;

export const authPolicySchema = z.enum(['agent', 'user', 'admin']);
export const locationScopeSchema = z.enum(['any', 'outside', 'city', 'in-city', 'location']);

export const commandInputShapeSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1).optional(),
  required: z.boolean().optional(),
});

export const commandPolicySchema = z.object({
  authPolicy: authPolicySchema.default('agent'),
  locationPolicy: z.object({
    scope: locationScopeSchema.default('any'),
    locations: z.array(z.string().min(1)).optional(),
  }).default({ scope: 'any' }),
  controlPolicy: z.object({
    controllerRequired: z.boolean().default(true),
  }).default({ controllerRequired: true }),
  confirmationPolicy: z.object({
    required: z.boolean().default(false),
  }).default({ required: false }),
  rateLimitPolicy: z.object({
    bucket: z.string().min(1).optional(),
    maxPerMinute: z.number().int().positive().optional(),
  }).default({}),
});

export type CommandPolicy = z.infer<typeof commandPolicySchema>;

export const residentProtocolReceiptStatusSchema = z.enum([
  'accepted',
  'rejected',
  'delivered',
  'expired',
  'duplicate',
  'require_approval',
]);

export const residentProtocolMetadataSchema = z.object({
  subject: z.literal('resident'),
  request: z.object({
    type: z.string().min(1),
    version: z.number().int().positive().optional(),
    requiredCapabilities: z.array(z.string().min(1)).optional(),
  }).optional(),
  receipt: z.object({
    type: z.string().min(1).optional(),
    statuses: z.array(residentProtocolReceiptStatusSchema).optional(),
  }).optional(),
  venue: z.object({
    id: z.string().min(1).optional(),
    moduleId: z.string().min(1).optional(),
  }).optional(),
  migration: z.object({
    currentTerm: z.string().min(1).optional(),
    removalIssue: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  }).optional(),
});

export type ResidentProtocolReceiptStatus = z.infer<typeof residentProtocolReceiptStatusSchema>;
export type ResidentProtocolMetadata = z.infer<typeof residentProtocolMetadataSchema>;

export interface BackendCommandHandlerContext<TConfig = unknown> {
  pluginId: string;
  config: TConfig;
  session?: {
    userId: string;
    agentId: string;
    agentName: string;
    role: 'owner' | 'agent';
    trustMode?: 'confirm' | 'full';
  } | null;
  httpSession?: {
    userId: string;
    role: string;
  } | null;
  inCity?: boolean;
  currentLocation?: string | null;
  request?: {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[]>;
    params: Record<string, string>;
    rawBody?: Uint8Array;
  };
  send?: (type: string, payload: SerializableValue) => Promise<void>;
}

export interface BackendHttpResponse<TResult = SerializableValue> {
  status?: number;
  headers?: Record<string, string>;
  body?: TResult | Uint8Array;
}

export interface BackendCommandDefinition<TInput = SerializableValue, TResult = SerializableValue> {
  id: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  resultSchema?: z.ZodType<TResult>;
  protocol?: ResidentProtocolMetadata;
  authPolicy?: z.infer<typeof authPolicySchema>;
  locationPolicy?: z.infer<typeof commandPolicySchema>['locationPolicy'];
  controlPolicy?: z.infer<typeof commandPolicySchema>['controlPolicy'];
  confirmationPolicy?: z.infer<typeof commandPolicySchema>['confirmationPolicy'];
  rateLimitPolicy?: z.infer<typeof commandPolicySchema>['rateLimitPolicy'];
  errorCodes?: string[];
  handler: (input: TInput, ctx: BackendCommandHandlerContext) => Promise<TResult> | TResult;
}

export interface BackendHttpRouteDefinition<TInput = SerializableValue, TResult = SerializableValue> {
  routeId: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  authPolicy: 'public' | 'user' | 'admin';
  rateLimitPolicy?: z.infer<typeof commandPolicySchema>['rateLimitPolicy'];
  inputSchema?: z.ZodType<TInput>;
  resultSchema?: z.ZodType<TResult>;
  handler: (input: TInput, ctx: BackendCommandHandlerContext) => Promise<TResult | BackendHttpResponse<TResult>> | TResult | BackendHttpResponse<TResult>;
}

export type BackendPolicyKind = 'command' | 'location-enter' | 'location-leave' | 'message';

export interface BackendPolicyDefinition<TPayload = SerializableValue> {
  id: string;
  kind: BackendPolicyKind;
  handler: (payload: TPayload, ctx: BackendCommandHandlerContext) => Promise<SerializableValue | void> | SerializableValue | void;
}

export interface BackendLocationDefinition {
  id: string;
  name: string;
  description?: string;
}

export interface BackendStorageApi {
  migrate(version: string, handler: () => Promise<void> | void): Promise<void>;
  get<T = SerializableValue>(collection: string, recordId: string): Promise<T | null>;
  put<T = SerializableValue>(collection: string, recordId: string, value: T): Promise<void>;
  delete(collection: string, recordId: string): Promise<void>;
  list<T = SerializableValue>(collection: string): Promise<Array<{
    id: string;
    value: T;
    updatedAt: number;
  }>>;
}

export interface BackendCommandsApi {
  register(definition: BackendCommandDefinition): Promise<Disposable> | Disposable;
}

export interface BackendHttpApi {
  registerRoute(definition: BackendHttpRouteDefinition): Promise<Disposable> | Disposable;
}

export interface BackendLocationsApi {
  register(definition: BackendLocationDefinition): Promise<Disposable> | Disposable;
}

export interface BackendPoliciesApi {
  register(definition: BackendPolicyDefinition): Promise<Disposable> | Disposable;
}

export interface BackendNoopApi {
  invoke(input?: SerializableValue): Promise<SerializableValue | void>;
}

export type BackendEventName =
  | 'agent.authenticated'
  | 'connection.close'
  | 'location.entered'
  | 'location.left';

export interface BackendEventsApi {
  subscribe(
    event: BackendEventName,
    handler: (payload: SerializableValue, ctx: BackendCommandHandlerContext) => Promise<void> | void,
  ): Promise<Disposable> | Disposable;
}

export interface BackendMessagingApi {
  sendToAgent(agentId: string, type: string, payload: SerializableValue): void;
  pushToOwner(userId: string, type: string, payload: SerializableValue): void;
  broadcast(type: string, payload: SerializableValue): void;
  getOnlineAgentIds(): string[];
  getAgentCurrentLocation(agentId: string): string | null;
}

export interface BackendConfigApi<TConfig = SerializableValue> {
  get(): Promise<TConfig>;
}

export interface BackendLoggingApi {
  info(message: string, details?: SerializableValue): Promise<void>;
  warn(message: string, details?: SerializableValue): Promise<void>;
  error(message: string, details?: SerializableValue): Promise<void>;
}

export interface BackendDiagnosticsApi {
  report(name: string, payload: SerializableValue): Promise<void>;
}

export interface BackendLifecycleApi {
  onStop(handler: () => Promise<void> | void): void;
}

export interface BackendPluginSetupContext<TConfig = SerializableValue> {
  pluginId: string;
  commands: BackendCommandsApi;
  http: BackendHttpApi;
  locations: BackendLocationsApi;
  policies: BackendPoliciesApi;
  events: BackendEventsApi;
  messaging: BackendMessagingApi;
  storage: BackendStorageApi;
  identity: BackendNoopApi;
  agents: BackendNoopApi;
  presence: BackendNoopApi;
  assets: BackendNoopApi;
  moderation: BackendNoopApi;
  scheduler: BackendNoopApi;
  logging: BackendLoggingApi;
  diagnostics: BackendDiagnosticsApi;
  lifecycle: BackendLifecycleApi;
  config: BackendConfigApi<TConfig>;
}

export interface BackendPluginDefinition<TConfig = SerializableValue> {
  kind: 'uruc.backend-plugin@v2';
  pluginId: string;
  apiVersion: 2;
  setup: (ctx: BackendPluginSetupContext<TConfig>) => Promise<void | Disposable> | void | Disposable;
}

export function defineBackendPlugin<TConfig = SerializableValue>(
  definition: Omit<BackendPluginDefinition<TConfig>, 'kind' | 'apiVersion'>,
): BackendPluginDefinition<TConfig> {
  return {
    kind: 'uruc.backend-plugin@v2',
    apiVersion: 2,
    ...definition,
  };
}
