import type { WsConnectionStatus, WsEnvelope } from './types';
import {
  createEmptyRuntimeState,
  toRuntimeSnapshot,
  type BrokerClientMessage,
  type BrokerWorkerMessage,
  type SerializedTransportError,
  type SharedRuntimeState,
} from './runtime-broker-protocol';
import { applyRuntimePatch, clearRuntimeFields, shouldClearRuntimeError } from './runtime-state';

export interface RuntimeSocket {
  getStatus(): WsConnectionStatus;
  connect(url: string, token?: string): Promise<{ agentId: string; agentName: string; snapshot: unknown }>;
  disconnect(): void;
  send<T>(type: string, payload?: unknown, timeoutMs?: number): Promise<T>;
  on(event: 'status', listener: (payload: WsConnectionStatus) => void): () => void;
  on(event: 'error', listener: (payload: string) => void): () => void;
  on(event: 'message', listener: (payload: WsEnvelope) => void): () => void;
}

interface BrokerClientSink {
  post: (message: BrokerWorkerMessage) => void;
}

function serializeTransportError(error: unknown): SerializedTransportError {
  if (error instanceof Error) {
    const typed = error as Error & {
      code?: string;
      action?: string;
      retryable?: boolean;
      details?: Record<string, unknown>;
    };
    return {
      message: error.message,
      name: error.name,
      code: typed.code,
      action: typed.action,
      retryable: typed.retryable,
      details: typed.details,
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown transport error',
  };
}

function hasLiveConnection(state: SharedRuntimeState, connectPromise: Promise<unknown> | undefined): boolean {
  return connectPromise !== undefined
    || state.status === 'connecting'
    || state.status === 'authenticating'
    || state.status === 'syncing'
    || state.status === 'connected'
    || state.status === 'reconnecting';
}

export class SharedRuntimeBrokerCore {
  private readonly clients = new Map<string, BrokerClientSink>();
  private readonly socket: RuntimeSocket;
  private readonly idleDisconnectMs: number;
  private readonly unbind: Array<() => void> = [];
  private state = createEmptyRuntimeState();
  private connectPromise?: Promise<{ agentId: string; agentName: string; snapshot: unknown }>;
  private idleTimer?: ReturnType<typeof setTimeout>;

  constructor(socketFactory: () => RuntimeSocket, opts?: { idleDisconnectMs?: number }) {
    this.socket = socketFactory();
    this.idleDisconnectMs = opts?.idleDisconnectMs ?? 5000;
    this.bindSocket();
  }

  attach(clientId: string, sink: BrokerClientSink): void {
    this.cancelIdleDisconnect();
    this.clients.set(clientId, sink);
    sink.post({ kind: 'snapshot', state: { ...this.state } });
  }

  detach(clientId: string): void {
    this.clients.delete(clientId);
    if (this.clients.size === 0) {
      this.scheduleIdleDisconnect();
    }
  }

  async handleMessage(clientId: string, message: BrokerClientMessage): Promise<void> {
    if (message.kind === 'attach' || message.kind === 'detach') {
      return;
    }

    try {
      switch (message.kind) {
        case 'connect': {
          const result = await this.handleConnect(message.url, message.token);
          this.respond(clientId, message.requestId, true, result);
          return;
        }
        case 'disconnect': {
          this.performDisconnect();
          this.respond(clientId, message.requestId, true, { disconnected: true });
          return;
        }
        case 'send': {
          const result = await this.handleSend(message.commandType, message.payload, message.timeoutMs);
          this.respond(clientId, message.requestId, true, result);
          return;
        }
        case 'reset_identity': {
          this.syncIdentity(message.identityKey);
          this.respond(clientId, message.requestId, true, { identityKey: this.state.identityKey });
          return;
        }
      }
    } catch (error) {
      this.respond(clientId, message.requestId, false, serializeTransportError(error));
    }
  }

  getState(): SharedRuntimeState {
    return { ...this.state };
  }

  dispose(): void {
    this.cancelIdleDisconnect();
    for (const cleanup of this.unbind) {
      cleanup();
    }
    this.unbind.length = 0;
    this.clients.clear();
    this.socket.disconnect();
  }

  private bindSocket(): void {
    this.unbind.push(this.socket.on('status', (status) => {
      this.state.status = status;
      if (status !== 'connected') {
        clearRuntimeFields(this.state);
      }
      this.broadcastSnapshot();
    }));

    this.unbind.push(this.socket.on('error', (message) => {
      this.state.error = message;
      this.broadcastSnapshot();
    }));

    this.unbind.push(this.socket.on('message', (envelope) => {
      this.applyEnvelope(envelope);
      this.broadcast({ kind: 'message', envelope });
      this.broadcastSnapshot();
    }));
  }

  private async handleConnect(url: string, token?: string) {
    if (this.state.wsUrl && this.state.wsUrl !== url && hasLiveConnection(this.state, this.connectPromise)) {
      throw new Error('A shared shadow-agent session is already connected with a different WebSocket URL.');
    }

    if (this.state.status === 'connected' && this.state.agentSession && this.state.wsUrl === url) {
      return {
        agentId: this.state.agentSession.agentId,
        agentName: this.state.agentSession.agentName,
        snapshot: toRuntimeSnapshot(this.state),
      };
    }

    if (this.connectPromise && this.state.wsUrl === url) {
      return this.connectPromise;
    }

    this.state.wsUrl = url;
    const pending = this.socket.connect(url, token)
      .then((result) => {
        this.state.wsUrl = url;
        this.state.agentSession = {
          agentId: result.agentId,
          agentName: result.agentName,
        };
        this.state.error = '';
        applyRuntimePatch(this.state, result.snapshot);
        this.broadcastSnapshot();
        return result;
      })
      .catch((error) => {
        this.state.error = error instanceof Error ? error.message : 'WebSocket connection failed';
        this.broadcastSnapshot();
        throw error;
      })
      .finally(() => {
        if (this.connectPromise === pending) {
          this.connectPromise = undefined;
        }
      });

    this.connectPromise = pending;
    return pending;
  }

  private async handleSend(type: string, payload?: unknown, timeoutMs?: number) {
    const result = await this.socket.send(type, payload, timeoutMs);
    applyRuntimePatch(this.state, result);
    if (shouldClearRuntimeError(result)) {
      this.state.error = '';
    }
    this.broadcastSnapshot();
    return result;
  }

  private syncIdentity(identityKey: string | null): void {
    if (this.state.identityKey === identityKey) return;
    const nextIdentityKey = identityKey;
    this.performDisconnect();
    this.state.identityKey = nextIdentityKey;
    this.broadcastSnapshot();
  }

  private performDisconnect(): void {
    this.cancelIdleDisconnect();
    this.socket.disconnect();
    this.state.agentSession = null;
    this.state.error = '';
    this.state.wsUrl = null;
    this.state.status = 'closed';
    clearRuntimeFields(this.state);
    this.broadcastSnapshot();
  }

  private applyEnvelope(envelope: WsEnvelope): void {
    if (envelope.type === 'session_state' || envelope.type === 'result') {
      applyRuntimePatch(this.state, envelope.payload);
      if (shouldClearRuntimeError(envelope.payload)) {
        this.state.error = '';
      }
      return;
    }

    if (envelope.type === 'error') {
      const payload = envelope.payload as { error?: string } | undefined;
      if (payload?.error) {
        this.state.error = payload.error;
      }
      return;
    }

    if (envelope.type === 'control_replaced') {
      applyRuntimePatch(this.state, envelope.payload);
      const payload = envelope.payload as { error?: string } | undefined;
      this.state.isController = false;
      this.state.error = payload?.error ?? this.state.error;
    }
  }

  private respond(clientId: string, requestId: string, ok: true, result: unknown): void;
  private respond(clientId: string, requestId: string, ok: false, error: SerializedTransportError): void;
  private respond(clientId: string, requestId: string, ok: boolean, payload: unknown): void {
    const sink = this.clients.get(clientId);
    if (!sink) return;

    if (ok) {
      sink.post({ kind: 'response', requestId, ok: true, result: payload });
      return;
    }

    sink.post({
      kind: 'response',
      requestId,
      ok: false,
      error: payload as SerializedTransportError,
    });
  }

  private broadcast(message: BrokerWorkerMessage): void {
    for (const sink of this.clients.values()) {
      sink.post(message);
    }
  }

  private broadcastSnapshot(): void {
    this.broadcast({ kind: 'snapshot', state: { ...this.state } });
  }

  private scheduleIdleDisconnect(): void {
    if (this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      if (this.clients.size > 0) return;
      this.performDisconnect();
    }, this.idleDisconnectMs);
  }

  private cancelIdleDisconnect(): void {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }
}
