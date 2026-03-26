import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsConnectionStatus, WsEnvelope } from '../types';
import { SharedRuntimeBrokerCore, type RuntimeSocket } from '../runtime-broker-core';
import type { BrokerWorkerMessage } from '../runtime-broker-protocol';

function createSnapshot(overrides: Partial<{
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number;
}> = {}) {
  return {
    connected: true,
    hasController: overrides.hasController ?? false,
    isController: overrides.isController ?? false,
    inCity: overrides.inCity ?? false,
    currentLocation: overrides.currentLocation ?? null,
    citytime: overrides.citytime ?? 123,
  };
}

class FakeSocket implements RuntimeSocket {
  status: WsConnectionStatus = 'idle';
  connectCalls: string[] = [];
  disconnectCalls = 0;
  sendCalls: Array<{ type: string; payload: unknown; timeoutMs?: number }> = [];
  nextSendResult: unknown = {};
  connectResult = {
    agentId: 'shadow-1',
    agentName: 'Shadow',
    snapshot: createSnapshot(),
  };
  private readonly listeners = {
    status: new Set<(payload: WsConnectionStatus) => void>(),
    error: new Set<(payload: string) => void>(),
    message: new Set<(payload: WsEnvelope) => void>(),
  };

  getStatus(): WsConnectionStatus {
    return this.status;
  }

  async connect(url: string): Promise<{ agentId: string; agentName: string; snapshot: unknown }> {
    this.connectCalls.push(url);
    this.emitStatus('connecting');
    this.emitStatus('authenticating');
    this.emitStatus('syncing');
    this.emitStatus('connected');
    return this.connectResult;
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.emitStatus('closed');
  }

  async send<T>(type: string, payload?: unknown, timeoutMs?: number): Promise<T> {
    this.sendCalls.push({ type, payload, timeoutMs });
    return this.nextSendResult as T;
  }

  on(event: 'status', listener: (payload: WsConnectionStatus) => void): () => void;
  on(event: 'error', listener: (payload: string) => void): () => void;
  on(event: 'message', listener: (payload: WsEnvelope) => void): () => void;
  on(event: 'status' | 'error' | 'message', listener: ((payload: string | WsConnectionStatus | WsEnvelope) => void)): () => void {
    const listeners = this.listeners[event] as Set<(payload: string | WsConnectionStatus | WsEnvelope) => void>;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  emitMessage(envelope: WsEnvelope): void {
    for (const listener of this.listeners.message) {
      listener(envelope);
    }
  }

  private emitStatus(status: WsConnectionStatus): void {
    this.status = status;
    for (const listener of this.listeners.status) {
      listener(status);
    }
  }
}

function attachClient(core: SharedRuntimeBrokerCore, clientId: string) {
  const messages: BrokerWorkerMessage[] = [];
  core.attach(clientId, {
    post: (message) => {
      messages.push(message);
    },
  });
  return messages;
}

function getLastSnapshot(messages: BrokerWorkerMessage[]) {
  const snapshots = messages.filter((message) => message.kind === 'snapshot');
  return snapshots.at(-1);
}

describe('SharedRuntimeBrokerCore', () => {
  let socket: FakeSocket;
  let core: SharedRuntimeBrokerCore;

  beforeEach(() => {
    socket = new FakeSocket();
    core = new SharedRuntimeBrokerCore(() => socket, { idleDisconnectMs: 5000 });
  });

  it('reuses the same underlying connect for multiple attached clients', async () => {
    const clientA = attachClient(core, 'client-a');
    const clientB = attachClient(core, 'client-b');

    await core.handleMessage('client-a', {
      kind: 'connect',
      requestId: 'connect-a',
      url: 'ws://127.0.0.1:3001',
    });

    await core.handleMessage('client-b', {
      kind: 'connect',
      requestId: 'connect-b',
      url: 'ws://127.0.0.1:3001',
    });

    expect(socket.connectCalls).toEqual(['ws://127.0.0.1:3001']);
    expect(clientB.find((message) => message.kind === 'response' && message.requestId === 'connect-b')).toMatchObject({
      kind: 'response',
      ok: true,
    });
  });

  it('broadcasts runtime snapshot updates to every attached client after a command result', async () => {
    const clientA = attachClient(core, 'client-a');
    const clientB = attachClient(core, 'client-b');

    await core.handleMessage('client-a', {
      kind: 'connect',
      requestId: 'connect-a',
      url: 'ws://127.0.0.1:3001',
    });

    clientA.length = 0;
    clientB.length = 0;
    socket.nextSendResult = createSnapshot({
      hasController: true,
      isController: true,
      inCity: true,
      currentLocation: 'uruc.chess.chess-club',
      citytime: 456,
    });

    await core.handleMessage('client-a', {
      kind: 'send',
      requestId: 'enter-location',
      commandType: 'enter_location',
      payload: { locationId: 'uruc.chess.chess-club' },
    });

    expect(getLastSnapshot(clientA)).toMatchObject({
      kind: 'snapshot',
      state: {
        inCity: true,
        currentLocation: 'uruc.chess.chess-club',
      },
    });
    expect(getLastSnapshot(clientB)).toMatchObject({
      kind: 'snapshot',
      state: {
        inCity: true,
        currentLocation: 'uruc.chess.chess-club',
      },
    });
  });

  it('fans out raw websocket push events to every attached client', async () => {
    const clientA = attachClient(core, 'client-a');
    const clientB = attachClient(core, 'client-b');

    clientA.length = 0;
    clientB.length = 0;

    socket.emitMessage({
      id: '',
      type: 'social_message_new',
      payload: { threadId: 'thread-1' },
    });

    expect(clientA).toContainEqual({
      kind: 'message',
      envelope: {
        id: '',
        type: 'social_message_new',
        payload: { threadId: 'thread-1' },
      },
    });
    expect(clientB).toContainEqual({
      kind: 'message',
      envelope: {
        id: '',
        type: 'social_message_new',
        payload: { threadId: 'thread-1' },
      },
    });
  });

  it('disconnects only after the idle timeout and cancels the timer when another client reattaches', async () => {
    vi.useFakeTimers();
    const clientA = attachClient(core, 'client-a');
    await core.handleMessage('client-a', {
      kind: 'connect',
      requestId: 'connect-a',
      url: 'ws://127.0.0.1:3001',
    });

    core.detach('client-a');
    vi.advanceTimersByTime(4999);
    expect(socket.disconnectCalls).toBe(0);

    const clientB = attachClient(core, 'client-b');
    expect(getLastSnapshot(clientB)).toBeDefined();
    vi.advanceTimersByTime(10);
    expect(socket.disconnectCalls).toBe(0);

    core.detach('client-b');
    vi.advanceTimersByTime(5000);
    expect(socket.disconnectCalls).toBe(1);
    vi.useRealTimers();
    void clientA;
  });

  it('resets shared state and disconnects the socket when identity changes', async () => {
    const clientA = attachClient(core, 'client-a');

    await core.handleMessage('client-a', {
      kind: 'reset_identity',
      requestId: 'identity-a',
      identityKey: 'user-1:shadow-1',
    });

    await core.handleMessage('client-a', {
      kind: 'connect',
      requestId: 'connect-a',
      url: 'ws://127.0.0.1:3001',
    });

    clientA.length = 0;

    await core.handleMessage('client-a', {
      kind: 'reset_identity',
      requestId: 'identity-b',
      identityKey: null,
    });

    expect(socket.disconnectCalls).toBeGreaterThan(0);
    expect(getLastSnapshot(clientA)).toMatchObject({
      kind: 'snapshot',
      state: {
        agentSession: null,
        identityKey: null,
        status: 'closed',
      },
    });
  });
});
