import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { AuthService } from '../../auth/service.js';
import { registerCityCommands } from '../../city/commands.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { signToken } from '../middleware.js';
import { WSGateway } from '../ws-gateway.js';

interface SentEnvelope {
  id?: string;
  type: string;
  payload?: {
    code?: string;
    error?: string;
  };
}

function createSocket(sent: SentEnvelope[]) {
  const handlers = new Map<string, (...args: any[]) => unknown>();

  return {
    readyState: 1,
    send(data: string) {
      sent.push(JSON.parse(data) as SentEnvelope);
    },
    on(event: string, handler: (...args: any[]) => unknown) {
      handlers.set(event, handler);
    },
    async emit(event: string, ...args: any[]) {
      const handler = handlers.get(event);
      if (!handler) return;
      await handler(...args);
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

describe('WS core error codes', () => {
  let auth: AuthService;
  let hooks: HookRegistry;
  let gateway: WSGateway;

  beforeEach(() => {
    auth = new AuthService(createDb(':memory:'));
    hooks = new HookRegistry();
    registerCityCommands(hooks);
    hooks.registerLocation({
      id: 'chess-club',
      name: 'Chess Club',
      description: 'A calm chess hall.',
      pluginName: 'chess',
    });
    gateway = new WSGateway({ port: 0 }, hooks, new ServiceRegistry(), auth);
  });

  it('returns INVALID_JSON for malformed websocket payloads', async () => {
    const sent: SentEnvelope[] = [];
    const socket = createSocket(sent);

    (gateway as any).handleConnection(socket, { headers: {} } as any);
    await socket.emit('message', Buffer.from('{bad-json'));

    expect(sent.at(-1)?.type).toBe('error');
    expect(sent.at(-1)?.payload?.code).toBe('INVALID_JSON');
  });

  it('returns UNKNOWN_COMMAND for unmapped websocket commands', async () => {
    const user = await auth.register('gilgamesh', 'gilgamesh@example.com', 'secret123');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-1', client);
    await (gateway as any).handleAgentAuth('client-1', client, {
      id: 'auth-1',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-1', { id: 'cmd-1', type: 'missing_command', payload: {} });

    expect(sent.at(-1)?.type).toBe('error');
    expect(sent.at(-1)?.payload?.code).toBe('UNKNOWN_COMMAND');
  });

  it('returns BAD_REQUEST when enter_location is missing locationId', async () => {
    const user = await auth.register('enkidu', 'enkidu@example.com', 'secret123');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-2', client);
    await (gateway as any).handleAgentAuth('client-2', client, {
      id: 'auth-2',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-2', { id: 'enter-1', type: 'enter_location', payload: {} });

    expect(sent.at(-1)?.type).toBe('error');
    expect(sent.at(-1)?.payload?.code).toBe('BAD_REQUEST');
  });
});
