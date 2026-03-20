import { PluginCommandError } from '@uruc/plugin-sdk/frontend';
import type { WsConnectionStatus, WsEnvelope, WsErrorPayload } from './types';
import i18n from '../i18n';
import { localizeCoreError } from './error-text';

type Listener<T> = (payload: T) => void;

type WsEventMap = {
  status: WsConnectionStatus;
  error: string;
  message: WsEnvelope;
};

function normalizeError(payload: unknown): WsErrorPayload {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const next = payload as WsErrorPayload;
    return {
      ...next,
      error: localizeCoreError(next.code, next.error),
    };
  }
  return { error: i18n.t('errors:fallback.unknown') };
}

export class WsCommandError extends PluginCommandError {
  constructor(payload: WsErrorPayload) {
    super(payload);
    this.name = 'WsCommandError';
  }
}

export class AgentWsClient {
  private ws: WebSocket | null = null;
  private msgSeq = 1;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private status: WsConnectionStatus = 'idle';
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectPromise?: Promise<{ agentId: string; agentName: string; snapshot: unknown }>;
  private manualClose = false;
  private authPayload?: string;
  private canReconnect = false;
  private wsUrl: string | null = null;
  private readonly openTimeoutMs = 8000;
  private readonly authTimeoutMs = 10000;
  private readonly syncTimeoutMs = 10000;
  private connectAbort?: (error: Error) => void;

  getStatus(): WsConnectionStatus {
    return this.status;
  }

  async connect(url: string, token?: string): Promise<{ agentId: string; agentName: string; snapshot: unknown }> {
    this.manualClose = false;
    this.authPayload = token;
    this.canReconnect = true;
    this.wsUrl = url;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.setStatus('authenticating');
      const authResult = await this.send<{ agentId: string; agentName: string }>('auth', token, this.authTimeoutMs);
      this.setStatus('syncing');
      const snapshot = await this.send<unknown>('session_state', undefined, this.syncTimeoutMs);
      this.setStatus('connected');
      return { ...authResult, snapshot };
    }

    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      this.cleanupSocket(false);
      this.setStatus('connecting');
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(url);
          this.ws = socket;
          let settled = false;
          const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (this.connectAbort === fail) {
              this.connectAbort = undefined;
            }
            if (this.ws === socket) {
              this.ws = null;
            }
            reject(error);
          };
          const timeout = setTimeout(() => {
            socket.onopen = null;
            socket.onerror = null;
            socket.onclose = null;
            if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
              socket.close();
            }
            fail(new Error(i18n.t('runtime:websocket.connectTimeout')));
          }, this.openTimeoutMs);
          this.connectAbort = fail;

          socket.onopen = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (this.connectAbort === fail) {
              this.connectAbort = undefined;
            }
            this.bindSocket(socket);
            resolve();
          };

          socket.onerror = () => {
            fail(new Error(i18n.t('runtime:websocket.connectFailed')));
          };

          socket.onclose = () => {
            fail(new Error(i18n.t('runtime:websocket.connectClosed')));
          };
        });

        this.setStatus('authenticating');
        const authResult = await this.send<{ agentId: string; agentName: string }>('auth', token, this.authTimeoutMs);
        this.setStatus('syncing');
        const snapshot = await this.send<unknown>('session_state', undefined, this.syncTimeoutMs);
        this.setStatus('connected');
        return { ...authResult, snapshot };
      } catch (err) {
        this.setStatus('error');
        throw err;
      } finally {
        this.connectPromise = undefined;
      }
    })();

    return this.connectPromise;
  }

  disconnect(): void {
    this.manualClose = true;
    this.canReconnect = false;
    this.clearReconnect();
    if (this.connectAbort) {
      const abort = this.connectAbort;
      this.connectAbort = undefined;
      abort(new Error(i18n.t('runtime:websocket.cancelled')));
    }
    this.cleanupSocket(true);
    this.setStatus('closed');
  }

  async send<T>(type: string, payload?: unknown, timeoutMs = 15000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(i18n.t('runtime:websocket.notConnected'));
    }

    const id = String(this.msgSeq++);
    const body = JSON.stringify({ id, type, payload });

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(i18n.t('runtime:websocket.commandTimeout', { type })));
      }, timeoutMs);

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.ws!.send(body);
    });
  }

  on<K extends keyof WsEventMap>(event: K, listener: Listener<WsEventMap[K]>): () => void;
  on(event: string, listener: Listener<unknown>): () => void;
  on(event: string, listener: Listener<unknown>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener<unknown>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private bindSocket(socket: WebSocket): void {
    socket.onmessage = (evt) => {
      let envelope: WsEnvelope;
      try {
        envelope = JSON.parse(evt.data as string) as WsEnvelope;
      } catch {
        return;
      }

      if (envelope.id && this.pending.has(envelope.id)) {
        const pending = this.pending.get(envelope.id)!;
        clearTimeout(pending.timeout);
        this.pending.delete(envelope.id);

        if (envelope.type === 'error') {
          const err = normalizeError(envelope.payload);
          pending.reject(new WsCommandError(err));
        } else {
          pending.resolve(envelope.payload);
        }
        return;
      }

      if (envelope.type === 'kicked') {
        this.manualClose = true;
        this.clearReconnect();
      }

      this.emit('message', envelope);
      this.emit(envelope.type, envelope.payload);
    };

    socket.onclose = () => {
      this.failAllPending(i18n.t('runtime:events.disconnected'));
      this.ws = null;
      if (this.manualClose) {
        this.setStatus('closed');
        return;
      }
      if (this.connectPromise) {
        this.setStatus('error');
        this.emit('error', i18n.t('runtime:websocket.initInterrupted'));
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      this.emit('error', i18n.t('runtime:websocket.socketError'));
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.wsUrl || !this.canReconnect) return;

    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      if (!this.wsUrl || !this.canReconnect || this.manualClose) return;
      try {
        await this.connect(this.wsUrl, this.authPayload);
      } catch (err) {
        const message = err instanceof Error ? err.message : i18n.t('runtime:websocket.connectFailed');
        this.emit('error', message);
        this.scheduleReconnect();
      }
    }, 1500);
  }

  private emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  private setStatus(status: WsConnectionStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  private failAllPending(reason: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private cleanupSocket(close: boolean): void {
    if (!this.ws) return;

    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.onerror = null;

    if (close && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close();
    }

    this.ws = null;
  }
}
