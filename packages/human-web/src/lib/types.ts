export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  emailVerified?: boolean;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  token: string;
  isShadow: boolean;
  trustMode: 'confirm' | 'full';
  allowedLocations: string[];
  isOnline: boolean;
  description?: string | null;
  avatarPath?: string | null;
  frozen?: number;
  searchable?: number | boolean | null;
  createdAt: string;
}

export interface HealthPlugin {
  pluginId?: string;
  name: string;
  version: string;
  started: boolean;
  state?: string;
}

export interface HealthPluginDiagnostic {
  pluginId?: string;
  name?: string;
  packageName?: string;
  package?: string;
  version?: string;
  state: 'installed' | 'resolved' | 'loading' | 'active' | 'draining' | 'disabled' | 'failed' | 'loaded' | 'initialized' | 'started' | 'skipped';
  reason?: string;
  revision?: string;
  publisher?: string;
  permissionsGranted?: string[];
  inFlightCount?: number;
  lastError?: string;
}

export interface HealthResponse {
  status: string;
  plugins: HealthPlugin[];
  pluginDiagnostics?: HealthPluginDiagnostic[];
  services: string[];
}

export interface FrontendRuntimePluginManifest {
  pluginId: string;
  version: string;
  revision: string;
  format: 'global-script';
  entryUrl: string;
  cssUrls: string[];
  exportKey: string;
  source: string;
}

export interface FrontendRuntimePluginIndexResponse {
  plugins: FrontendRuntimePluginManifest[];
}

export interface ActionLog {
  id: string;
  userId: string;
  agentId: string;
  locationId?: string | null;
  actionType: string;
  payload?: string | null;
  result: 'success' | 'failure';
  detail?: string | null;
  createdAt: string;
}

export interface LocationDef {
  id: string;
  name: string;
  description?: string;
  pluginName?: string;
}

export interface CommandSchema {
  type: string;
  description: string;
  pluginName?: string;
  params: Record<string, { type: string; description?: string; required?: boolean }>;
  requiresConfirmation?: boolean;
}

export type WsConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'syncing'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface WsErrorPayload {
  error: string;
  code?: string;
  retryable?: boolean;
  action?: string;
  details?: Record<string, unknown>;
}

export interface WsEnvelope {
  id?: string;
  type: string;
  payload?: unknown;
}

export interface RuntimeSnapshot {
  connected: boolean;
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  serverTimestamp: number;
  availableCommands: CommandSchema[];
  availableLocations: LocationDef[];
}
