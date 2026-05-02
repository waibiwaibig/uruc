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
    citytime?: number;
    actionLeaseAcquired?: boolean;
    current?: {
      place?: string;
      locationId?: string | null;
      locationName?: string | null;
    };
    code?: string;
    currentLocation?: string | null;
    inCity?: boolean;
    error?: string;
    locations?: Array<{ id: string; name: string }>;
    detailRequest?: { type: string; payload?: Record<string, unknown> };
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
      id: 'uruc.chess.chess-club',
      name: '国际象棋馆',
      description: 'A calm chess hall.',
      pluginName: 'uruc.chess',
    });
    gateway = new WSGateway({ port: 0 }, hooks, new ServiceRegistry(), auth);
  });

  it('auto-acquires the same-resident action lease on the first write command and rejects a second writer', async () => {
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
    expect(sentB.find((message) => message.type === 'session_state' && message.payload?.inCity === true)?.payload).toMatchObject({
      detailRequest: { type: 'what_state_am_i' },
    });

    await (gateway as any).handleMessage('client-b', {
      id: 'enter-location-b',
      type: 'enter_location',
      payload: { locationId: 'uruc.chess.chess-club' },
    });

    expect(sentB.at(-1)?.type).toBe('error');
    expect(sentB.at(-1)?.payload).toMatchObject({
      code: 'ACTION_LEASE_HELD',
      action: 'acquire_action_lease',
      error: 'This resident already has an active action lease in another session.',
    });
  });

  it('restores city state when a new connection acquires the action lease within the grace window', async () => {
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
      payload: { locationId: 'uruc.chess.chess-club' },
    });

    (gateway as any).cleanupClient('client-a', clientA);

    await (gateway as any).handleMessage('client-b', { id: 'lease-b', type: 'acquire_action_lease', payload: {} });

    expect(sentB.some((message) => message.type === 'session_restored')).toBe(false);
    const leaseResult = sentB.find((message) => message.type === 'result');
    expect(leaseResult?.payload).toMatchObject({
      actionLeaseAcquired: true,
      restored: true,
      inCity: true,
      currentLocation: 'uruc.chess.chess-club',
    });
  });

  it('notifies the previous action lease holder when another same-resident session acquires it', async () => {
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
    await (gateway as any).handleMessage('client-b', { id: 'lease-b', type: 'acquire_action_lease', payload: {} });

    expect(sentA.some((message) => message.type === 'action_lease_moved')).toBe(true);
    expect(clientA.ws.close).not.toHaveBeenCalled();
    expect(sentB.some((message) => message.type === 'control_claimed')).toBe(false);
    expect(sentB.find((message) => message.type === 'result')?.payload).toMatchObject({
      actionLeaseAcquired: true,
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

    await (gateway as any).handleMessage('client-a', { id: 'state-a', type: 'what_state_am_i', payload: {} });

    expect(sentA.find((message) => message.type === 'result')?.payload).toMatchObject({
      citytime: expect.any(Number),
      inCity: true,
    });
    expect(sentB.some((message) => message.type === 'session_state')).toBe(false);
  });

  it('returns current and available locations through where_can_i_go without command data', async () => {
    const user = await auth.register('nidaba', 'nidaba@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-a', client);

    await (gateway as any).handleAgentAuth('client-a', client, { id: 'auth-a', type: 'auth', payload: token });
    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });
    sent.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'where-a', type: 'where_can_i_go', payload: {} });

    expect(sent.at(-1)).toMatchObject({
      id: 'where-a',
      type: 'result',
      payload: {
        citytime: expect.any(Number),
        current: {
          place: 'city',
          locationId: null,
          locationName: null,
        },
        locations: [
          {
            id: 'uruc.chess.chess-club',
            name: '国际象棋馆',
          },
        ],
      },
    });
    expect(sent.at(-1)?.payload).not.toHaveProperty('commands');
    expect(sent.at(-1)?.payload).not.toHaveProperty('availableCommands');
  });

  it('discovers action lease commands instead of controller commands', async () => {
    const user = await auth.register('nanna', 'nanna@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-a', client);

    await (gateway as any).handleAgentAuth('client-a', client, { id: 'auth-a', type: 'auth', payload: token });
    sent.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'discover-a', type: 'what_can_i_do', payload: { scope: 'city' } });

    const payload = sent.find((message) => message.type === 'result')?.payload as { commands?: Array<{ type: string; description: string }> } | undefined;
    const commandTypes = payload?.commands?.map((command) => command.type) ?? [];
    expect(commandTypes).toContain('acquire_action_lease');
    expect(commandTypes).toContain('release_action_lease');
    expect(commandTypes).not.toContain('claim_control');
    expect(commandTypes).not.toContain('release_control');
    expect(payload?.commands?.find((command) => command.type === 'acquire_action_lease')?.description).toContain('action lease');
  });

  it('rejects action lease release from a session that does not hold the lease', async () => {
    const user = await auth.register('utu', 'utu@example.com', 'secret-123');
    const token = signToken(user.id, 'user');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-a', client);

    await (gateway as any).handleAgentAuth('client-a', client, { id: 'auth-a', type: 'auth', payload: token });
    sent.length = 0;

    await (gateway as any).handleMessage('client-a', { id: 'release-a', type: 'release_action_lease', payload: {} });

    expect(sent.at(-1)).toMatchObject({
      id: 'release-a',
      type: 'error',
      payload: {
        code: 'NOT_ACTION_LEASE_HOLDER',
        action: 'acquire_action_lease',
        error: 'This session does not hold the active action lease.',
      },
    });
  });

  it('includes citytime in action lease replacement pushes', async () => {
    const user = await auth.register('dumuzid', 'dumuzid@example.com', 'secret-123');
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
    await (gateway as any).handleMessage('client-b', { id: 'lease-b', type: 'acquire_action_lease', payload: {} });

    expect(sentA.find((message) => message.type === 'action_lease_moved')?.payload).toMatchObject({
      citytime: expect.any(Number),
      error: 'This resident action lease moved to another session.',
      nextAction: 'acquire_action_lease',
      detailRequest: { type: 'what_state_am_i' },
    });
  });
});
