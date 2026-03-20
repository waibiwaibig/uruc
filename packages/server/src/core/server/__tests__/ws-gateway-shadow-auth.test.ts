import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb, schema } from '../../database/index.js';
import { AuthService } from '../../auth/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { WSGateway } from '../ws-gateway.js';
import { OWNER_SESSION_COOKIE, getCookieAuthUser, signToken } from '../middleware.js';

function createSocket(sent: Array<{ id?: string; type: string; payload?: unknown }>) {
  return {
    readyState: 1,
    send(data: string) {
      sent.push(JSON.parse(data) as { id?: string; type: string; payload?: unknown });
    },
    close: vi.fn(),
    ping: vi.fn(),
  } as any;
}

describe('WSGateway shadow agent auth', () => {
  let db: ReturnType<typeof createDb>;
  let auth: AuthService;
  let gateway: WSGateway;
  let hooks: HookRegistry;

  beforeEach(() => {
    db = createDb(':memory:');
    auth = new AuthService(db);
    hooks = new HookRegistry();
    gateway = new WSGateway({ port: 0 }, hooks, new ServiceRegistry(), auth);
  });

  it('accepts a user JWT on the existing auth command and maps it to the shadow agent', async () => {
    const user = await auth.register('marduk', 'marduk@example.com', 'secret-123');
    const sent: Array<{ id?: string; type: string; payload?: unknown }> = [];
    const socket = createSocket(sent);
    const client: any = {
      ws: socket,
      inCity: false,
      msgTimestamps: [],
      isAlive: true,
      lastPong: Date.now(),
    };

    (gateway as any).clients.set('client-1', client);

    await (gateway as any).handleAgentAuth('client-1', client, {
      id: 'auth-1',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    const [shadow] = await auth.getAgentsByUser(user.id);

    expect(client.session).toBeDefined();
    expect(client.session.agentId).toBe(shadow.id);
    expect(client.session.agentName).toBe(shadow.name);
    const result = sent.find((message) => message.type === 'result');
    expect(result).toBeDefined();
    expect(result?.payload).toMatchObject({
      agentId: shadow.id,
      agentName: shadow.name,
      connected: true,
      hasController: false,
      isController: false,
      inCity: false,
      currentLocation: null,
    });
    expect(sent.some((message) => message.type === 'session_state')).toBe(false);
  });

  it('rejects JWT auth when the shadow agent is frozen', async () => {
    const user = await auth.register('ereshkigal', 'ereshkigal@example.com', 'secret-123');
    const [shadow] = await auth.getAgentsByUser(user.id);
    const sent: Array<{ id?: string; type: string; payload?: { code?: string } }> = [];
    const socket = createSocket(sent);
    const client: any = {
      ws: socket,
      inCity: false,
      msgTimestamps: [],
      isAlive: true,
      lastPong: Date.now(),
    };

    await db.update(schema.agents).set({ frozen: 1 }).where(eq(schema.agents.id, shadow.id));
    (gateway as any).clients.set('client-2', client);

    await (gateway as any).handleAgentAuth('client-2', client, {
      id: 'auth-2',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    expect(sent.at(-1)?.type).toBe('error');
    expect(sent.at(-1)?.payload?.code).toBe('AGENT_FROZEN');
  });

  it('accepts empty auth payload when the ws connection already has a valid owner session cookie', async () => {
    const user = await auth.register('ninlil', 'ninlil@example.com', 'secret123');
    const sent: Array<{ id?: string; type: string; payload?: unknown }> = [];
    const socket = createSocket(sent);
    const cookieUser = getCookieAuthUser({
      headers: { cookie: `${OWNER_SESSION_COOKIE}=${encodeURIComponent(signToken(user.id, 'user'))}` },
    } as any);
    const client: any = {
      ws: socket,
      cookieAuthUser: cookieUser ?? undefined,
      inCity: false,
      msgTimestamps: [],
      isAlive: true,
      lastPong: Date.now(),
    };

    (gateway as any).clients.set('client-3', client);

    await (gateway as any).handleAgentAuth('client-3', client, {
      id: 'auth-3',
      type: 'auth',
      payload: undefined,
    });

    const [shadow] = await auth.getAgentsByUser(user.id);

    expect(client.session).toBeDefined();
    expect(client.session.agentId).toBe(shadow.id);
    expect(sent.some((message) => message.type === 'result')).toBe(true);
  });

  it('runs agent.authenticated after-hooks so auth can include bootstrap data before the auth result is sent', async () => {
    const user = await auth.register('nabu', 'nabu@example.com', 'secret-123');
    const sent: Array<{ id?: string; type: string; payload?: any }> = [];
    const socket = createSocket(sent);
    const client: any = {
      ws: socket,
      inCity: false,
      msgTimestamps: [],
      isAlive: true,
      lastPong: Date.now(),
    };

    hooks.after('agent.authenticated', async ({ bootstrapData }) => {
      bootstrapData.description = 'Welcome to Uruc.';
    });

    (gateway as any).clients.set('client-4', client);

    await (gateway as any).handleAgentAuth('client-4', client, {
      id: 'auth-4',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    expect(sent.find((message) => message.type === 'result')?.payload).toMatchObject({
      description: 'Welcome to Uruc.',
    });
  });
});
