// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../lib/types';

const {
  dashboardMeMock,
  authLogoutMock,
} = vi.hoisted(() => ({
  dashboardMeMock: vi.fn(),
  authLogoutMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  AuthApi: {
    logout: (...args: unknown[]) => authLogoutMock(...args),
  },
  DashboardApi: {
    me: (...args: unknown[]) => dashboardMeMock(...args),
  },
}));

import { AuthProvider, useAuth } from '../AuthContext';

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();

  readonly name: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const peers = FakeBroadcastChannel.channels.get(name) ?? new Set<FakeBroadcastChannel>();
    peers.add(this);
    FakeBroadcastChannel.channels.set(name, peers);
  }

  postMessage(data: unknown) {
    const peers = FakeBroadcastChannel.channels.get(this.name) ?? new Set<FakeBroadcastChannel>();
    for (const peer of peers) {
      if (peer === this) continue;
      peer.onmessage?.({ data } as MessageEvent<unknown>);
    }
  }

  close() {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    peers.delete(this);
    if (peers.size === 0) {
      FakeBroadcastChannel.channels.delete(this.name);
    }
  }

  static reset() {
    FakeBroadcastChannel.channels.clear();
  }
}

type AuthSnapshot = ReturnType<typeof useAuth>;

let containerA: HTMLDivElement;
let containerB: HTMLDivElement;
let rootA: ReturnType<typeof createRoot>;
let rootB: ReturnType<typeof createRoot>;
let authA: AuthSnapshot | null = null;
let authB: AuthSnapshot | null = null;
let originalBroadcastChannel: typeof BroadcastChannel | undefined;

function Probe({ target }: { target: 'A' | 'B' }) {
  const auth = useAuth();
  if (target === 'A') {
    authA = auth;
  } else {
    authB = auth;
  }
  return <div data-target={target} data-ready={String(auth.ready)} data-user={auth.user?.username ?? ''} />;
}

async function settle() {
  for (let index = 0; index < 4; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderProviders() {
  await act(async () => {
    rootA.render(
      <AuthProvider>
        <Probe target="A" />
      </AuthProvider>,
    );
    rootB.render(
      <AuthProvider>
        <Probe target="B" />
      </AuthProvider>,
    );
  });
  await settle();
}

describe('AuthProvider multi-tab sync', () => {
  const signedInUser: User = {
    id: 'user-1',
    username: 'holder',
    role: 'admin',
    email: 'holder@example.com',
    emailVerified: true,
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    containerA = document.createElement('div');
    containerB = document.createElement('div');
    document.body.appendChild(containerA);
    document.body.appendChild(containerB);
    rootA = createRoot(containerA);
    rootB = createRoot(containerB);
    authA = null;
    authB = null;
    window.localStorage.clear();
    dashboardMeMock.mockReset();
    authLogoutMock.mockReset();
    FakeBroadcastChannel.reset();
    originalBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = FakeBroadcastChannel as unknown as typeof BroadcastChannel;
  });

  afterEach(async () => {
    await act(async () => {
      rootA.unmount();
      rootB.unmount();
    });
    containerA.remove();
    containerB.remove();
    globalThis.BroadcastChannel = originalBroadcastChannel as typeof BroadcastChannel;
    FakeBroadcastChannel.reset();
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('propagates login across tabs without a refresh', async () => {
    dashboardMeMock.mockRejectedValue(new Error('unauthorized'));

    await renderProviders();

    expect(authA?.ready).toBe(true);
    expect(authB?.ready).toBe(true);
    expect(authA?.user).toBeNull();
    expect(authB?.user).toBeNull();

    await act(async () => {
      authA?.login(signedInUser);
    });
    await settle();

    expect(authA?.user?.username).toBe('holder');
    expect(authB?.user?.username).toBe('holder');
  });

  it('propagates logout across tabs and clears the remote session view', async () => {
    dashboardMeMock.mockResolvedValue({ user: signedInUser });
    authLogoutMock.mockResolvedValue({ success: true });

    await renderProviders();

    expect(authA?.user?.username).toBe('holder');
    expect(authB?.user?.username).toBe('holder');

    await act(async () => {
      authA?.logout();
    });
    await settle();

    expect(authA?.user).toBeNull();
    expect(authB?.user).toBeNull();
    expect(authLogoutMock).toHaveBeenCalledTimes(1);
  });
});
