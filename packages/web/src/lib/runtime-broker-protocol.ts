import type {
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
  hasActionLease: boolean;
  isActionLeaseHolder: boolean;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number | null;
  wsUrl: string | null;
  identityKey: string | null;
}

export interface SerializedTransportError {
  message: string;
  name?: string;
  code?: string;
  action?: string;
  nextAction?: string;
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
    hasActionLease: false,
    isActionLeaseHolder: false,
    inCity: false,
    currentLocation: null,
    citytime: null,
    wsUrl: null,
    identityKey,
  };
}

export function toRuntimeSnapshot(state: SharedRuntimeState): RuntimeSnapshot {
  return {
    connected: state.status === 'connected',
    hasActionLease: state.hasActionLease,
    isActionLeaseHolder: state.isActionLeaseHolder,
    inCity: state.inCity,
    currentLocation: state.currentLocation,
    citytime: state.citytime ?? Date.now(),
  };
}
