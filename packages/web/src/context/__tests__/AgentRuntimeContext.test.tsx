// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedRuntimeState } from '../../lib/runtime-broker-protocol';

const {
  createRuntimeTransportMock,
  useAuthMock,
  useAgentsMock,
} = vi.hoisted(() => ({
  createRuntimeTransportMock: vi.fn(),
  useAuthMock: vi.fn(),
  useAgentsMock: vi.fn(),
}));

vi.mock('../../lib/runtime-transport', () => ({
  createRuntimeTransport: createRuntimeTransportMock,
}));

vi.mock('../AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('../AgentsContext', () => ({
  useAgents: useAgentsMock,
}));

vi.mock('../../i18n', () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
        key,
      );
    },
  },
  formatTime: () => '12:00:00',
}));

import { AgentRuntimeProvider, useAgentRuntime } from '../AgentRuntimeContext';

function createState(overrides: Partial<SharedRuntimeState> = {}): SharedRuntimeState {
  return {
    status: 'idle',
    error: '',
    agentSession: null,
    hasController: false,
    isController: false,
    inCity: false,
    currentLocation: null,
    citytime: null,
    wsUrl: null,
    identityKey: null,
    ...overrides,
  };
}

class FakeTransport {
  state: SharedRuntimeState;
  resetIdentity = vi.fn(async (identityKey: string | null) => {
    if (this.state.identityKey === identityKey) return;
    this.state = createState({ identityKey });
    this.emitSnapshot();
  });
  connect = vi.fn(async () => ({
    agentId: 'shadow-1',
    agentName: 'Shadow',
    snapshot: {},
  }));
  disconnect = vi.fn();
  send = vi.fn(async () => ({}));
  dispose = vi.fn();
  private readonly snapshotListeners = new Set<(state: SharedRuntimeState) => void>();
  private readonly messageListeners = new Set<(payload: { type: string; payload?: unknown }) => void>();
  private readonly statusListeners = new Set<(status: string) => void>();
  private readonly errorListeners = new Set<(message: string) => void>();

  constructor(state: SharedRuntimeState) {
    this.state = state;
  }

  subscribeSnapshot(listener: (state: SharedRuntimeState) => void) {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  subscribeMessage(listener: (payload: { type: string; payload?: unknown }) => void) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  subscribeStatus(listener: (status: string) => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeError(listener: (message: string) => void) {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  getState() {
    return { ...this.state };
  }

  emitSnapshot(nextState: SharedRuntimeState = this.state) {
    this.state = nextState;
    for (const listener of this.snapshotListeners) {
      listener({ ...nextState });
    }
    for (const listener of this.statusListeners) {
      listener(nextState.status);
    }
    if (nextState.error) {
      for (const listener of this.errorListeners) {
        listener(nextState.error);
      }
    }
  }

  emitMessage(type: string, payload?: unknown) {
    for (const listener of this.messageListeners) {
      listener({ type, payload });
    }
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let latestRuntime: ReturnType<typeof useAgentRuntime> | null = null;

function Probe() {
  latestRuntime = useAgentRuntime();
  return <div data-status={latestRuntime.status} />;
}

async function renderProvider() {
  await act(async () => {
    root.render(
      <AgentRuntimeProvider>
        <Probe />
      </AgentRuntimeProvider>,
    );
  });
}

describe('AgentRuntimeProvider', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latestRuntime = null;

    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        username: 'holder',
        role: 'user',
      },
    });
    useAgentsMock.mockReturnValue({
      shadowAgent: {
        id: 'shadow-1',
        name: 'Shadow',
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    vi.clearAllMocks();
  });

  it('syncs shared runtime snapshots and fans out raw push events through subscribe()', async () => {
    const transport = new FakeTransport(createState({
      status: 'connected',
      agentSession: {
        agentId: 'shadow-1',
        agentName: 'Shadow',
      },
      hasController: true,
      isController: true,
      currentLocation: 'uruc.chess.chess-club',
      inCity: true,
      citytime: 123,
      identityKey: 'user-1:shadow-1',
    }));
    createRuntimeTransportMock.mockReturnValue(transport);

    await renderProvider();

    expect(createRuntimeTransportMock).toHaveBeenCalledWith({ allowDirectFallback: false });

    expect(latestRuntime?.status).toBe('connected');
    expect(latestRuntime?.currentLocation).toBe('uruc.chess.chess-club');

    const listener = vi.fn();
    const unsubscribe = latestRuntime!.subscribe('social_message_new', listener);

    await act(async () => {
      transport.emitMessage('social_message_new', { threadId: 'thread-1' });
    });

    expect(listener).toHaveBeenCalledWith({ threadId: 'thread-1' });

    unsubscribe();
  });

  it('resets the shared identity and clears local state when the owner logs out', async () => {
    const transport = new FakeTransport(createState({
      status: 'connected',
      agentSession: {
        agentId: 'shadow-1',
        agentName: 'Shadow',
      },
      hasController: true,
      isController: true,
      inCity: true,
      currentLocation: 'uruc.social.hub',
      citytime: 456,
      identityKey: 'user-1:shadow-1',
    }));
    createRuntimeTransportMock.mockReturnValue(transport);

    await renderProvider();
    transport.resetIdentity.mockClear();

    useAuthMock.mockReturnValue({ user: null });
    useAgentsMock.mockReturnValue({ shadowAgent: null });

    await renderProvider();

    expect(transport.resetIdentity).toHaveBeenCalledWith(null);
    expect(latestRuntime?.status).toBe('idle');
    expect(latestRuntime?.agentSession).toBeNull();
    expect(latestRuntime?.currentLocation).toBeNull();
  });
});
