import type {
  CommandSchema,
  LocationDef,
  RuntimeSnapshot,
  WsConnectionStatus,
  WsEnvelope,
} from './types';

export interface SharedAgentSession {
  agentId: string;
  agentName: string;
}

export interface SharedRuntimeState {
  status: WsConnectionStatus;
  error: string;
  agentSession: SharedAgentSession | null;
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  serverTimestamp: number | null;
  availableCommands: CommandSchema[];
  availableLocations: LocationDef[];
  wsUrl: string | null;
  identityKey: string | null;
}

export interface SerializedTransportError {
  message: string;
  name?: string;
  code?: string;
  action?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export type BrokerClientMessage =
  | { kind: 'attach' }
  | { kind: 'detach' }
  | { kind: 'connect'; requestId: string; url: string; token?: string }
  | { kind: 'disconnect'; requestId: string }
  | { kind: 'send'; requestId: string; commandType: string; payload?: unknown; timeoutMs?: number }
  | { kind: 'reset_identity'; requestId: string; identityKey: string | null };

export type BrokerWorkerMessage =
  | { kind: 'snapshot'; state: SharedRuntimeState }
  | { kind: 'message'; envelope: WsEnvelope }
  | { kind: 'response'; requestId: string; ok: true; result: unknown }
  | { kind: 'response'; requestId: string; ok: false; error: SerializedTransportError };

export function createEmptyRuntimeState(identityKey: string | null = null): SharedRuntimeState {
  return {
    status: 'idle',
    error: '',
    agentSession: null,
    hasController: false,
    isController: false,
    inCity: false,
    currentLocation: null,
    serverTimestamp: null,
    availableCommands: [],
    availableLocations: [],
    wsUrl: null,
    identityKey,
  };
}

export function toRuntimeSnapshot(state: SharedRuntimeState): RuntimeSnapshot {
  return {
    connected: state.status === 'connected',
    hasController: state.hasController,
    isController: state.isController,
    inCity: state.inCity,
    currentLocation: state.currentLocation,
    serverTimestamp: state.serverTimestamp ?? Date.now(),
    availableCommands: state.availableCommands,
    availableLocations: state.availableLocations,
  };
}
