import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { AuthService } from '../../auth/service.js';
import { registerCityCommands } from '../../city/commands.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { WSGateway } from '../ws-gateway.js';
import { signToken } from '../middleware.js';

interface SentEnvelope {
  id?: string;
  type: string;
  payload?: {
    code?: string;
    currentLocation?: string | null;
    inCity?: boolean;
    error?: string;
  };
}

function createSocket(sent: SentEnvelope[]) {
  return {
    readyState: 1,
    send(data: string) {
      sent.push(JSON.parse(data) as SentEnvelope);
    },
    close: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
  } as any;
}

function createClient(sent: SentEnvelope[]) {
  return {
    id: `client-${Math.random().toString(16).slice(2)}`,
    ws: createSocket(sent),
    msgTimestamps: [],
    isAlive: true,
    lastPong: Date.now(),
  } as any;
}

describe('WSGateway control connection', () => {
  let auth: AuthService;
  let hooks: HookRegistry;
  let gateway: WSGateway;

  beforeEach(() => {
    const db = createDb(':memory:');
    auth = new AuthService(db);
    hooks = new HookRegistry();
    registerCityCommands(hooks);
    hooks.registerLocation({
      id: 'chess-club',
      name: '国际象棋馆',
      description: 'A calm chess hall.',
      pluginName: 'chess',
    });
    gateway = new WSGateway({ port: 0 }, hooks, new ServiceRegistry(), auth);
  });

  it('auto-claims control on the first gameplay command and rejects a second connection', async () => {
    const user = await auth.register('gilgamesh', 'gilgamesh@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sentA: SentEnvelope[] = [];
    const sentB: SentEnvelope[] = [];
    const clientA = createClient(sentA);
    const clientB = createClient(sentB);

    (gateway as any).clients.set('client-a', clientA);
    (gateway as any).clients.set('client-b', clientB);

    await (gateway as any).handleAgentAuth('client-a', clientA, { id: 'auth-a', type: 'auth', payload: token });
    await (gateway as any).handleAgentAuth('client-b', clientB, { id: 'auth-b', type: 'auth', payload: token });

    sentA.length = 0;
    sentB.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });

    expect(sentA.some((message) => message.type === 'control_claimed')).toBe(false);
    expect(sentA.some((message) => message.type === 'result' && message.payload?.inCity === true)).toBe(true);
    expect(sentA.some((message) => message.type === 'session_state')).toBe(false);
    expect(sentB.some((message) => message.type === 'session_state' && message.payload?.inCity === true)).toBe(true);

    await (gateway as any).handleMessage('client-b', { id: 'location-b', type: 'what_location', payload: {} });

    expect(sentB.at(-1)?.type).toBe('error');
    expect(sentB.at(-1)?.payload?.code).toBe('CONTROLLED_ELSEWHERE');
  });

  it('restores city state when a new connection claims control within the grace window', async () => {
    const user = await auth.register('enkidu', 'enkidu@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sentA: SentEnvelope[] = [];
    const sentB: SentEnvelope[] = [];
    const clientA = createClient(sentA);
    const clientB = createClient(sentB);

    (gateway as any).clients.set('client-a', clientA);
    (gateway as any).clients.set('client-b', clientB);

    await (gateway as any).handleAgentAuth('client-a', clientA, { id: 'auth-a', type: 'auth', payload: token });
    await (gateway as any).handleAgentAuth('client-b', clientB, { id: 'auth-b', type: 'auth', payload: token });

    sentA.length = 0;
    sentB.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });
    await (gateway as any).handleMessage('client-a', {
      id: 'enter-location-a',
      type: 'enter_location',
      payload: { locationId: 'chess-club' },
    });

    (gateway as any).cleanupClient('client-a', clientA);

    await (gateway as any).handleMessage('client-b', { id: 'claim-b', type: 'claim_control', payload: {} });

    expect(sentB.some((message) => message.type === 'session_restored')).toBe(false);
    const claimResult = sentB.find((message) => message.type === 'result');
    expect(claimResult?.payload).toMatchObject({
      claimed: true,
      restored: true,
      inCity: true,
      currentLocation: 'chess-club',
    });
  });

  it('sends control_replaced to the previous controller when another connection explicitly takes over', async () => {
    const user = await auth.register('ishtar', 'ishtar@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sentA: SentEnvelope[] = [];
    const sentB: SentEnvelope[] = [];
    const clientA = createClient(sentA);
    const clientB = createClient(sentB);

    (gateway as any).clients.set('client-a', clientA);
    (gateway as any).clients.set('client-b', clientB);

    await (gateway as any).handleAgentAuth('client-a', clientA, { id: 'auth-a', type: 'auth', payload: token });
    await (gateway as any).handleAgentAuth('client-b', clientB, { id: 'auth-b', type: 'auth', payload: token });

    sentA.length = 0;
    sentB.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });
    await (gateway as any).handleMessage('client-b', { id: 'claim-b', type: 'claim_control', payload: {} });

    expect(sentA.some((message) => message.type === 'control_replaced')).toBe(true);
    expect(clientA.ws.close).not.toHaveBeenCalled();
    expect(sentB.some((message) => message.type === 'control_claimed')).toBe(false);
    expect(sentB.find((message) => message.type === 'result')?.payload).toMatchObject({
      claimed: true,
      restored: false,
    });
  });

  it('does not push session_state to other connections for read-only commands', async () => {
    const user = await auth.register('ninsun', 'ninsun@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sentA: SentEnvelope[] = [];
    const sentB: SentEnvelope[] = [];
    const clientA = createClient(sentA);
    const clientB = createClient(sentB);

    (gateway as any).clients.set('client-a', clientA);
    (gateway as any).clients.set('client-b', clientB);

    await (gateway as any).handleAgentAuth('client-a', clientA, { id: 'auth-a', type: 'auth', payload: token });
    await (gateway as any).handleAgentAuth('client-b', clientB, { id: 'auth-b', type: 'auth', payload: token });

    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });

    sentA.length = 0;
    sentB.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'time-a', type: 'what_time', payload: {} });

    expect(sentA.some((message) => message.type === 'result')).toBe(true);
    expect(sentB.some((message) => message.type === 'session_state')).toBe(false);
  });
});
