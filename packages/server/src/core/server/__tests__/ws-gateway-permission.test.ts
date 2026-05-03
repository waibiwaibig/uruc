import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb, schema } from '../../database/index.js';
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
  let db: ReturnType<typeof createDb>;
  let auth: AuthService;
  let permissions: PermissionCredentialService;
  let hooks: HookRegistry;
  let services: ServiceRegistry;
  let gateway: WSGateway;

  beforeEach(() => {
    db = createDb(':memory:');
    auth = new AuthService(db);
    permissions = new PermissionCredentialService(db);
    hooks = new HookRegistry();
    services = new ServiceRegistry();
    services.register('permission', permissions);
    registerCityCommands(hooks);
    gateway = new WSGateway({ port: 0 }, hooks, services, auth);
  });

  it('resolves active city-issued basic credentials for shadow and regular resident sessions', async () => {
    const user = await auth.register('permission-user', 'permission-user@example.com', 'secret-123');
    const sent: SentEnvelope[] = [];
    const shadowClient = createClient(sent);

    (gateway as any).clients.set('client-a', shadowClient);

    await (gateway as any).handleAgentAuth('client-a', shadowClient, {
      id: 'auth-a',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    const shadowCredential = await permissions.resolveActiveCityIssuedCredential(shadowClient.session);

    expect(shadowCredential).toMatchObject({
      residentId: shadowClient.session.agentId,
      issuerId: 'uruc.city',
      status: 'active',
      capabilities: ['uruc.city.basic@v1'],
      validUntil: null,
    });
    expect(shadowCredential.issuedAt).toBeInstanceOf(Date);
    expect(shadowCredential.validFrom).toBeInstanceOf(Date);

    const regularAgent = await auth.createAgent(user.id, 'permission-user-regular');
    const regularClient = createClient(sent);
    (gateway as any).clients.set('client-b', regularClient);

    await (gateway as any).handleAgentAuth('client-b', regularClient, {
      id: 'auth-b',
      type: 'auth',
      payload: regularAgent.token,
    });

    const regularCredential = await permissions.resolveActiveCityIssuedCredential(regularClient.session);

    expect(regularCredential).toMatchObject({
      residentId: regularAgent.id,
      issuerId: 'uruc.city',
      status: 'active',
      capabilities: ['uruc.city.basic@v1'],
      validUntil: null,
    });
    expect(regularCredential.issuedAt).toBeInstanceOf(Date);
    expect(regularCredential.validFrom).toBeInstanceOf(Date);
  });

  it('allows a venue request when the resident has every required capability', async () => {
    const user = await auth.register('capability-allow', 'capability-allow@example.com', 'secret-123');
    const [shadow] = await auth.getAgentsByUser(user.id);
    await permissions.approveCredential({
      authorityUserId: user.id,
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
      actionLeasePolicy: { required: false },
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
      actionLeasePolicy: { required: false },
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
        nextAction: 'require_approval',
        details: {
          requestType: 'uruc.permission.fixture.write.request@v1',
          requiredCapabilities: ['uruc.permission.fixture.write@v1'],
          missingCapabilities: ['uruc.permission.fixture.write@v1'],
        },
      },
    });
  });

  it('allows a principal-backed resident request after accountable-principal approval', async () => {
    const user = await auth.register('principal-backed-allow', 'principal-backed-allow@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);
    const resident = await auth.createPrincipalBackedResident({
      accountablePrincipalId: principal.id,
      name: 'principal-backed-allow-worker',
    });
    await permissions.approveCredential({
      authorityUserId: user.id,
      residentId: resident.id,
      capabilities: ['uruc.permission.fixture.write@v1'],
    });

    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true, agentId: ctx.session?.agentId } });
    });
    hooks.registerWSCommand('uruc.permission.principal_write@v1', handler, {
      type: 'uruc.permission.principal_write@v1',
      description: 'Write one principal-backed fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.principal.write.request@v1',
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
      payload: resident.token,
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', {
      id: 'write-a',
      type: 'uruc.permission.principal_write@v1',
      payload: {},
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'result',
      payload: { ok: true, agentId: resident.id },
    });
  });

  it('exposes principal-backed registration state during resident session auth', async () => {
    const user = await auth.register('principal-backed-auth', 'principal-backed-auth@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);
    const resident = await auth.createPrincipalBackedResident({
      accountablePrincipalId: principal.id,
      name: 'principal-backed-auth-worker',
    });

    const sent: SentEnvelope[] = [];
    const client = createClient(sent);
    (gateway as any).clients.set('client-a', client);
    await (gateway as any).handleAgentAuth('client-a', client, {
      id: 'auth-a',
      type: 'auth',
      payload: resident.token,
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'auth-a',
      type: 'result',
      payload: {
        agentId: resident.id,
        registrationType: 'principal_backed',
        accountablePrincipalId: principal.id,
      },
    });
  });

  it('returns a stable require_approval receipt before principal-backed venue dispatch when permission is missing', async () => {
    const user = await auth.register('principal-backed-deny', 'principal-backed-deny@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);
    const resident = await auth.createPrincipalBackedResident({
      accountablePrincipalId: principal.id,
      name: 'principal-backed-deny-worker',
    });
    await permissions.issueCityCredential({
      residentId: resident.id,
      capabilities: ['uruc.permission.fixture.write@v1'],
    });
    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.principal_deny@v1', handler, {
      type: 'uruc.permission.principal_deny@v1',
      description: 'Write one principal-backed denied fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.principal.deny.request@v1',
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
      payload: resident.token,
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', {
      id: 'write-a',
      type: 'uruc.permission.principal_deny@v1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'error',
      payload: {
        code: 'PERMISSION_REQUIRED',
        text: 'Principal-backed permission required for this request.',
        nextAction: 'require_approval',
        details: {
          requestType: 'uruc.permission.principal.deny.request@v1',
          accountablePrincipalId: principal.id,
          missingCapabilities: ['uruc.permission.fixture.write@v1'],
        },
      },
    });
  });

  it('ignores expired approval credentials during venue dispatch', async () => {
    const user = await auth.register('expired-approval', 'expired-approval@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);
    const resident = await auth.createPrincipalBackedResident({
      accountablePrincipalId: principal.id,
      name: 'expired-approval-worker',
    });
    await db.insert(schema.permissionCredentials).values({
      id: 'perm_expired_approval',
      residentId: resident.id,
      issuerId: principal.id,
      status: 'active',
      capabilities: JSON.stringify(['uruc.permission.fixture.write@v1']),
      issuedAt: new Date(Date.now() - 3_000),
      validFrom: new Date(Date.now() - 3_000),
      validUntil: new Date(Date.now() - 1_000),
    });
    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.expired_approval@v1', handler, {
      type: 'uruc.permission.expired_approval@v1',
      description: 'Write one expired approval fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.expired-approval.write.request@v1',
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
      payload: resident.token,
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', {
      id: 'write-a',
      type: 'uruc.permission.expired_approval@v1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'error',
      payload: {
        code: 'PERMISSION_REQUIRED',
        nextAction: 'require_approval',
        details: {
          requestType: 'uruc.permission.expired-approval.write.request@v1',
          missingCapabilities: ['uruc.permission.fixture.write@v1'],
        },
      },
    });
  });

  it('returns deny instead of require_approval when request policy forbids approval', async () => {
    const user = await auth.register('capability-deny-policy', 'capability-deny-policy@example.com', 'secret-123');
    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.policy_denied@v1', handler, {
      type: 'uruc.permission.policy_denied@v1',
      description: 'Write one policy-denied fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.policy-denied.write.request@v1',
          requiredCapabilities: ['uruc.permission.fixture.write@v1'],
          approval: 'forbidden',
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
      type: 'uruc.permission.policy_denied@v1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'error',
      payload: {
        code: 'PERMISSION_DENIED',
        text: 'Permission policy denies this request.',
        nextAction: 'deny',
        details: {
          requestType: 'uruc.permission.policy-denied.write.request@v1',
          missingCapabilities: ['uruc.permission.fixture.write@v1'],
        },
      },
    });
  });

  it('uses permission approval instead of confirmation for capability-scoped requests', async () => {
    const user = await auth.register('confirmation-migration', 'confirmation-migration@example.com', 'secret-123');
    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.confirmation_migrated@v1', handler, {
      type: 'uruc.permission.confirmation_migrated@v1',
      description: 'Write one confirmation-migrated fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      actionLeasePolicy: { required: false },
      confirmationPolicy: { required: true },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.permission.confirmation-migrated.write.request@v1',
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
    client.session.trustMode = 'confirm';

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', {
      id: 'write-a',
      type: 'uruc.permission.confirmation_migrated@v1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      id: 'write-a',
      type: 'error',
      payload: {
        code: 'PERMISSION_REQUIRED',
        text: 'Permission required for this request.',
        nextAction: 'require_approval',
        details: {
          requestType: 'uruc.permission.confirmation-migrated.write.request@v1',
          missingCapabilities: ['uruc.permission.fixture.write@v1'],
        },
      },
    });
  });

  it('keeps a venue request runnable when required capabilities are not declared', async () => {
    const user = await auth.register('capability-undeclared', 'capability-undeclared@example.com', 'secret-123');
    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { ok: true } });
    });
    hooks.registerWSCommand('uruc.permission.fixture_read@v1', handler, {
      type: 'uruc.permission.fixture_read@v1',
      description: 'Read one permission fixture value.',
      pluginName: 'uruc.permission',
      params: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: { type: 'uruc.permission.fixture.read.request@v1' },
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
      id: 'read-a',
      type: 'uruc.permission.fixture_read@v1',
      payload: {},
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sent.at(-1)).toMatchObject({
      id: 'read-a',
      type: 'result',
      payload: { ok: true },
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

  it('keeps existing shadow resident city commands runnable without venue capability metadata', async () => {
    const user = await auth.register('shadow-agent', 'shadow-agent@example.com', 'secret-123');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);

    (gateway as any).clients.set('client-a', client);

    await (gateway as any).handleAgentAuth('client-a', client, {
      id: 'auth-a',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-a', { id: 'enter-a', type: 'enter_city', payload: {} });

    expect(sent.at(-1)).toMatchObject({
      id: 'enter-a',
      type: 'result',
    });
  });
});
