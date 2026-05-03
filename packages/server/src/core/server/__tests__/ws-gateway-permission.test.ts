import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { AuthService } from '../../auth/service.js';
import { PermissionCredentialService } from '../../permission/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { registerCityCommands } from '../../city/commands.js';
import { WSGateway } from '../ws-gateway.js';
import { signToken } from '../middleware.js';

interface SentEnvelope {
  id?: string;
  type: string;
  payload?: {
    ok?: boolean;
    code?: string;
    text?: string;
    nextAction?: string;
    details?: Record<string, unknown>;
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

describe('WSGateway regular resident permission credentials', () => {
  let auth: AuthService;
  let permissions: PermissionCredentialService;
  let hooks: HookRegistry;
  let services: ServiceRegistry;
  let gateway: WSGateway;

  beforeEach(() => {
    const db = createDb(':memory:');
    auth = new AuthService(db);
    permissions = new PermissionCredentialService(db);
    hooks = new HookRegistry();
    services = new ServiceRegistry();
    services.register('permission', permissions);
    registerCityCommands(hooks);
    gateway = new WSGateway({ port: 0 }, hooks, services, auth);
  });

  it('resolves an active city-issued permission credential for a regular resident session', async () => {
    const user = await auth.register('permission-user', 'permission-user@example.com', 'secret-123');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-a', client);

    await (gateway as any).handleAgentAuth('client-a', client, {
      id: 'auth-a',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    const credential = await permissions.resolveActiveCityIssuedCredential(client.session);

    expect(credential).toMatchObject({
      residentId: client.session.agentId,
      issuerId: 'uruc.city',
      status: 'active',
      capabilities: ['uruc.city.basic@v1'],
    });
  });

  it('allows a venue request when the resident has every required capability', async () => {
    const user = await auth.register('capability-allow', 'capability-allow@example.com', 'secret-123');
    const [shadow] = await auth.getAgentsByUser(user.id);
    await permissions.issueCityCredential({
      residentId: shadow.id,
      capabilities: ['uruc.permission.fixture.write@v1'],
    });

    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.fixture_write@v1', handler, {
      type: 'uruc.permission.fixture_write@v1',
      description: 'Write one permission fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      controlPolicy: { controllerRequired: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.fixture.write.request@v1',
          requiredCapabilities: ['uruc.permission.fixture.write@v1'],
        },
        venue: { id: 'uruc.permission' },
      },
    });

    const sent: SentEnvelope[] = [];
    const client = createClient(sent);
    (gateway as any).clients.set('client-a', client);
    await (gateway as any).handleAgentAuth('client-a', client, {
      id: 'auth-a',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', {
      id: 'write-a',
      type: 'uruc.permission.fixture_write@v1',
      payload: {},
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'result',
      payload: { ok: true },
    });
  });

  it('returns a stable require_approval receipt before venue dispatch when permission is missing', async () => {
    const user = await auth.register('capability-deny', 'capability-deny@example.com', 'secret-123');
    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.fixture_write@v1', handler, {
      type: 'uruc.permission.fixture_write@v1',
      description: 'Write one permission fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      controlPolicy: { controllerRequired: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.fixture.write.request@v1',
          requiredCapabilities: ['uruc.permission.fixture.write@v1'],
        },
        receipt: {
          type: 'uruc.permission.fixture.write.receipt@v1',
          statuses: ['accepted', 'require_approval'],
        },
        venue: { id: 'uruc.permission' },
      },
    });

    const sent: SentEnvelope[] = [];
    const client = createClient(sent);
    (gateway as any).clients.set('client-a', client);
    await (gateway as any).handleAgentAuth('client-a', client, {
      id: 'auth-a',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', {
      id: 'write-a',
      type: 'uruc.permission.fixture_write@v1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'error',
      payload: {
        code: 'PERMISSION_REQUIRED',
        text: 'Permission required for this request.',
        nextAction: 'request_permission',
        details: {
          requestType: 'uruc.permission.fixture.write.request@v1',
          requiredCapabilities: ['uruc.permission.fixture.write@v1'],
          missingCapabilities: ['uruc.permission.fixture.write@v1'],
        },
      },
    });
  });

  it('keeps existing regular agent city commands runnable without venue capability metadata', async () => {
    const user = await auth.register('regular-agent', 'regular-agent@example.com', 'secret-123');
    const regularAgent = await auth.createAgent(user.id, 'regular-agent-alt');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-a', client);

    await (gateway as any).handleAgentAuth('client-a', client, {
      id: 'auth-a',
      type: 'auth',
      payload: regularAgent.token,
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });

    expect(sent.at(-1)).toMatchObject({
      id: 'enter-a',
      type: 'result',
    });
  });
});
