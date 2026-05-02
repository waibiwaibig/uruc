import type { WsConnectionStatus, WsEnvelope, WsErrorPayload } from './types';
import { AgentWsClient, WsCommandError } from './ws';
import i18n from '../i18n';
import type {
  BrokerClientMessage,
  BrokerWorkerMessage,
  SerializedTransportError,
  SharedRuntimeState,
} from './runtime-broker-protocol';
import { createEmptyRuntimeState } from './runtime-broker-protocol';
import { applyRuntimePatch, clearRuntimeFields, shouldClearRuntimeError } from './runtime-state';

type Listener<T> = (payload: T) => void;

export interface RuntimeTransport {
  connect: (url: string, token?: string) => Promise<{ agentId: string; agentName: string; snapshot: unknown }>;
  disconnect: () => void;
  send: <T = unknown>(type: string, payload?: unknown, timeoutMs?: number) => Promise<T>;
  resetIdentity: (identityKey: string | null) => Promise<void>;
  subscribeSnapshot: (listener: Listener<SharedRuntimeState>) => () => void;
  subscribeMessage: (listener: Listener<WsEnvelope>) => () => void;
  subscribeStatus: (listener: Listener<WsConnectionStatus>) => () => void;
  subscribeError: (listener: Listener<string>) => () => void;
  getState: () => SharedRuntimeState;
  dispose: () => void;
}

interface RuntimeTransportFactoryOptions {
  brokerWorkerFactory?: () => SharedWorker;
  directFactory?: () => RuntimeTransport;
  allowDirectFallback?: boolean;
}

class TransportEmitter<T> {
  private listeners = new Set<Listener<T>>();

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(payload: T): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

class UnavailableRuntimeTransport implements RuntimeTransport {
  private state = createEmptyRuntimeState();

  constructor(message: string) {
    this.state = {
      ...createEmptyRuntimeState(),
      status: 'error',
      error: message,
    };
  }

  async connect(): Promise<{ agentId: string; agentName: string; snapshot: unknown }> {
    throw new Error(this.state.error);
  }

  disconnect(): void {
    // Keep the transport in an error state so the UI continues to explain why runtime is unavailable.
  }

  async send<T = unknown>(): Promise<T> {
    throw new Error(this.state.error);
  }

  async resetIdentity(identityKey: string | null): Promise<void> {
    this.state = {
      ...this.state,
      identityKey,
    };
  }

  subscribeSnapshot(): () => void {
    return () => undefined;
  }

  subscribeMessage(): () => void {
    return () => undefined;
  }

  subscribeStatus(): () => void {
    return () => undefined;
  }

  subscribeError(): () => void {
    return () => undefined;
  }

  getState(): SharedRuntimeState {
    return { ...this.state };
  }

  dispose(): void {
    // No resources to release.
  }
}

function toWsCommandError(error: SerializedTransportError): Error {
  if (error.code || error.action || error.nextAction || error.retryable !== undefined || error.details || error.name === 'WsCommandError') {
    return new WsCommandError({
      error: error.message,
      code: error.code,
      action: error.action,
      nextAction: error.nextAction,
      retryable: error.retryable,
      details: error.details,
    } satisfies WsErrorPayload);
  }

  const plain = new Error(error.message);
  plain.name = error.name ?? 'Error';
  return plain;
}

class DirectRuntimeTransport implements RuntimeTransport {
  private readonly client: AgentWsClient;
  private readonly snapshotEmitter = new TransportEmitter<SharedRuntimeState>();
  private readonly messageEmitter = new TransportEmitter<WsEnvelope>();
  private readonly statusEmitter = new TransportEmitter<WsConnectionStatus>();
  private readonly errorEmitter = new TransportEmitter<string>();
  private readonly cleanup: Array<() => void> = [];
  private state = createEmptyRuntimeState();
  private previousStatus: WsConnectionStatus = this.state.status;
  private previousError = this.state.error;

  constructor(client = new AgentWsClient()) {
    this.client = client;
    this.cleanup.push(this.client.on('status', (status) => {
      this.state.status = status as WsConnectionStatus;
      if (status !== 'connected') {
        clearRuntimeFields(this.state);
      }
      this.emitSnapshot();
    }));

    this.cleanup.push(this.client.on('error', (message) => {
      this.state.error = String(message);
      this.emitSnapshot();
    }));

    this.cleanup.push(this.client.on('message', (raw) => {
      const envelope = raw as WsEnvelope;
      this.applyEnvelope(envelope);
      this.messageEmitter.emit(envelope);
      this.emitSnapshot();
    }));
  }

  async connect(url: string, token?: string) {
    const result = await this.client.connect(url, token);
    this.state.wsUrl = url;
    this.state.agentSession = {
      agentId: result.agentId,
      agentName: result.agentName,
    };
    this.state.error = '';
    applyRuntimePatch(this.state, result.snapshot);
    this.emitSnapshot();
    return result;
  }

  disconnect(): void {
    this.client.disconnect();
    this.state.agentSession = null;
    this.state.error = '';
    this.state.wsUrl = null;
    this.state.status = 'closed';
    clearRuntimeFields(this.state);
    this.emitSnapshot();
  }

  async send<T = unknown>(type: string, payload?: unknown, timeoutMs?: number): Promise<T> {
    try {
      const result = await this.client.send<T>(type, payload, timeoutMs);
      applyRuntimePatch(this.state, result);
      if (shouldClearRuntimeError(result)) {
        this.state.error = '';
      }
      this.emitSnapshot();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Command failed';
      this.state.error = message;
      this.emitSnapshot();
      throw error;
    }
  }

  async resetIdentity(identityKey: string | null): Promise<void> {
    if (this.state.identityKey === identityKey) return;
    this.client.disconnect();
    this.state = createEmptyRuntimeState(identityKey);
    this.emitSnapshot();
  }

  subscribeSnapshot(listener: Listener<SharedRuntimeState>): () => void {
    return this.snapshotEmitter.subscribe(listener);
  }

  subscribeMessage(listener: Listener<WsEnvelope>): () => void {
    return this.messageEmitter.subscribe(listener);
  }

  subscribeStatus(listener: Listener<WsConnectionStatus>): () => void {
    return this.statusEmitter.subscribe(listener);
  }

  subscribeError(listener: Listener<string>): () => void {
    return this.errorEmitter.subscribe(listener);
  }

  getState(): SharedRuntimeState {
    return { ...this.state };
  }

  dispose(): void {
    for (const cleanup of this.cleanup) {
      cleanup();
    }
    this.cleanup.length = 0;
    this.snapshotEmitter.clear();
    this.messageEmitter.clear();
    this.statusEmitter.clear();
    this.errorEmitter.clear();
    this.client.disconnect();
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

    // `control_replaced` is a hidden compatibility read path for servers older than
    // issue #13. Remove it once deployed servers emit action_lease_moved only.
    if (envelope.type === 'action_lease_moved' || envelope.type === 'control_replaced') {
      applyRuntimePatch(this.state, envelope.payload);
      const payload = envelope.payload as { error?: string } | undefined;
      this.state.isController = false;
      if (payload?.error) {
        this.state.error = payload.error;
      }
    }
  }

  private emitSnapshot(): void {
    this.snapshotEmitter.emit({ ...this.state });
    if (this.state.status !== this.previousStatus) {
      this.previousStatus = this.state.status;
      this.statusEmitter.emit(this.state.status);
    }
    if (this.state.error && this.state.error !== this.previousError) {
      this.previousError = this.state.error;
      this.errorEmitter.emit(this.state.error);
    }
    if (!this.state.error) {
      this.previousError = '';
    }
  }
}

class SharedWorkerRuntimeTransport implements RuntimeTransport {
  private readonly worker: SharedWorker;
  private readonly port: MessagePort;
  private readonly snapshotEmitter = new TransportEmitter<SharedRuntimeState>();
  private readonly messageEmitter = new TransportEmitter<WsEnvelope>();
  private readonly statusEmitter = new TransportEmitter<WsConnectionStatus>();
  private readonly errorEmitter = new TransportEmitter<string>();
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private requestSeq = 1;
  private state = createEmptyRuntimeState();
  private disposed = false;

  constructor(workerFactory: () => SharedWorker) {
    this.worker = workerFactory();
    this.port = this.worker.port;
    this.port.onmessage = (event: MessageEvent<BrokerWorkerMessage>) => {
      this.handleWorkerMessage(event.data);
    };
    this.port.start();
    this.port.postMessage({ kind: 'attach' } satisfies BrokerClientMessage);
  }

  connect(url: string, token?: string) {
    return this.request<{ agentId: string; agentName: string; snapshot: unknown }>({
      kind: 'connect',
      requestId: this.nextRequestId(),
      url,
      token,
    });
  }

  disconnect(): void {
    void this.request({ kind: 'disconnect', requestId: this.nextRequestId() }).catch(() => undefined);
  }

  send<T = unknown>(type: string, payload?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>({
      kind: 'send',
      requestId: this.nextRequestId(),
      commandType: type,
      payload,
      timeoutMs,
    });
  }

  async resetIdentity(identityKey: string | null): Promise<void> {
    await this.request({
      kind: 'reset_identity',
      requestId: this.nextRequestId(),
      identityKey,
    });
  }

  subscribeSnapshot(listener: Listener<SharedRuntimeState>): () => void {
    return this.snapshotEmitter.subscribe(listener);
  }

  subscribeMessage(listener: Listener<WsEnvelope>): () => void {
    return this.messageEmitter.subscribe(listener);
  }

  subscribeStatus(listener: Listener<WsConnectionStatus>): () => void {
    return this.statusEmitter.subscribe(listener);
  }

  subscribeError(listener: Listener<string>): () => void {
    return this.errorEmitter.subscribe(listener);
  }

  getState(): SharedRuntimeState {
    return { ...this.state };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.port.postMessage({ kind: 'detach' } satisfies BrokerClientMessage);
    this.port.close();
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Runtime transport disposed'));
    }
    this.pending.clear();
    this.snapshotEmitter.clear();
    this.messageEmitter.clear();
    this.statusEmitter.clear();
    this.errorEmitter.clear();
  }

  private async request<T = unknown>(message: Extract<BrokerClientMessage, { requestId: string }>): Promise<T> {
    if (this.disposed) {
      throw new Error('Runtime transport disposed');
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.set(message.requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.port.postMessage(message);
    });
  }

  private nextRequestId(): string {
    return `shared-worker-${this.requestSeq++}`;
  }

  private handleWorkerMessage(message: BrokerWorkerMessage): void {
    if (message.kind === 'response') {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      this.pending.delete(message.requestId);
      if (message.ok) {
        pending.resolve(message.result);
        return;
      }
      pending.reject(toWsCommandError(message.error));
      return;
    }

    if (message.kind === 'message') {
      this.messageEmitter.emit(message.envelope);
      return;
    }

    const previousStatus = this.state.status;
    const previousError = this.state.error;
    this.state = message.state;
    this.snapshotEmitter.emit({ ...this.state });
    if (this.state.status !== previousStatus) {
      this.statusEmitter.emit(this.state.status);
    }
    if (this.state.error && this.state.error !== previousError) {
      this.errorEmitter.emit(this.state.error);
    }
  }
}

function createDefaultSharedWorker(): SharedWorker {
  return new SharedWorker(
    new URL('./runtime-broker.worker.ts', import.meta.url),
    {
      name: 'uruc-shadow-runtime-broker',
      type: 'module',
    },
  );
}

export function createRuntimeTransport(options?: RuntimeTransportFactoryOptions): RuntimeTransport {
  const directFactory = options?.directFactory ?? (() => new DirectRuntimeTransport());
  const allowDirectFallback = options?.allowDirectFallback ?? true;
  const sharedRuntimeUnavailable = () => new UnavailableRuntimeTransport(i18n.t('runtime:websocket.sharedRuntimeRequired'));

  if (typeof SharedWorker === 'undefined') {
    if (!allowDirectFallback) {
      return sharedRuntimeUnavailable();
    }
    return directFactory();
  }

  try {
    return new SharedWorkerRuntimeTransport(options?.brokerWorkerFactory ?? createDefaultSharedWorker);
  } catch (error) {
    console.warn('[runtime] Shared worker broker unavailable, falling back to direct transport.', error);
    if (!allowDirectFallback) {
      return sharedRuntimeUnavailable();
    }
    return directFactory();
  }
}
