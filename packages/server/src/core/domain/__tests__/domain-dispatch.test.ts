import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import { generateKeyPairSync, sign, verify, createPublicKey } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { AuthService } from '../../auth/service.js';
import { createDb, schema } from '../../database/index.js';
import { PermissionCredentialService } from '../../permission/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { signToken } from '../../server/middleware.js';
import { WSGateway } from '../../server/ws-gateway.js';
import { DomainAttachmentService } from '../service.js';
import { canonicalDomainDocumentPayload } from '../document.js';
import {
  DOMAIN_DISPATCH_ENVELOPE_SCHEMA,
  DOMAIN_DISPATCH_RECEIPT_SCHEMA,
  DOMAIN_DISPATCH_ENVELOPE_SIGNED_FIELDS,
  DOMAIN_DISPATCH_RECEIPT_SIGNED_FIELDS,
  DomainDispatchService,
  canonicalDomainDispatchEnvelopePayload,
  canonicalDomainDispatchReceiptPayload,
} from '../dispatch.js';

interface SentEnvelope {
  id?: string;
  type: string;
  payload?: Record<string, unknown>;
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

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function domainFixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();

  function signedDocument(baseUrl: string) {
    const unsigned = {
      schema: 'uruc.domain.document@v0',
      domainId: 'domain.acme.social',
      venue: {
        moduleId: 'acme.social',
        namespace: 'acme.social',
      },
      protocol: {
        version: 'uruc-domain-v0',
      },
      publicKeys: [{
        id: 'domain-key-1',
        type: 'ed25519-pem',
        publicKeyPem,
      }],
      endpoints: {
        attachment: `${baseUrl}/uruc/attach`,
        dispatch: `${baseUrl}/uruc/dispatch`,
      },
      capabilities: ['social.thread.write'],
      hints: {},
    };
    return {
      ...unsigned,
      proof: {
        type: 'ed25519-signature-2026',
        verificationMethod: 'domain-key-1',
        createdAt: '2026-05-03T00:00:00.000Z',
        canonicalization: 'uruc-domain-document-v0-sorted-json-without-proof',
        covered: [
          'capabilities',
          'domainId',
          'endpoints',
          'hints',
          'protocol',
          'publicKeys',
          'schema',
          'venue',
        ],
        signature: sign(null, canonicalDomainDocumentPayload(unsigned), privateKey).toString('base64'),
      },
    };
  }

  function signedReceipt(receipt: Record<string, unknown>) {
    return {
      ...receipt,
      proof: {
        type: 'ed25519-signature-2026',
        verificationMethod: 'domain-key-1',
        createdAt: '2026-05-03T00:00:01.000Z',
        canonicalization: 'uruc-domain-dispatch-receipt-v0-sorted-json-without-proof',
        covered: [...DOMAIN_DISPATCH_RECEIPT_SIGNED_FIELDS],
        signature: sign(null, canonicalDomainDispatchReceiptPayload(receipt), privateKey).toString('base64'),
      },
    };
  }

  return { publicKeyPem, signedDocument, signedReceipt };
}

describe('Domain signed dispatch', () => {
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
    gateway = new WSGateway({ port: 0 }, hooks, services, auth);
  });

  it('dispatches an attached domain venue request after City Core permission checks and records the signed receipt', async () => {
    const fixture = domainFixture();
    const receivedEnvelopes: Array<Record<string, any>> = [];
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(fixture.signedDocument(baseUrl)));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'accepted',
          code: 'ATTACHED',
          receiptId: 'attach-1',
          validUntil: '2026-06-03T00:00:00.000Z',
        }));
        return;
      }
      if (req.url === '/uruc/dispatch' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const envelope = JSON.parse(body);
          receivedEnvelopes.push(envelope);
          expect(envelope).toMatchObject({
            schema: DOMAIN_DISPATCH_ENVELOPE_SCHEMA,
            audit: { id: expect.any(String) },
            city: { id: 'city.alpha' },
            domain: { id: 'domain.acme.social' },
            attachment: {
              id: expect.any(String),
              documentUrl: `${baseUrl}/.well-known/uruc-domain.json`,
              documentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
            resident: { id: expect.any(String) },
            venue: {
              pluginId: 'acme.social',
              moduleId: 'acme.social',
              namespace: 'acme.social',
            },
            request: {
              id: 'write-a',
              command: 'acme.social.publish@v1',
              type: 'acme.social.publish.request@v1',
              payload: { text: 'hello' },
            },
            proofs: {
              requiredCapabilities: ['social.thread.write'],
              permissionCredentialRefs: [expect.stringMatching(/^perm_/)],
            },
          });
          expect(verify(
            null,
            canonicalDomainDispatchEnvelopePayload(envelope),
            createPublicKey(envelope.city.publicKeyPem),
            Buffer.from(envelope.proof.signature, 'base64'),
          )).toBe(true);
          expect(envelope.proof.covered).toEqual([...DOMAIN_DISPATCH_ENVELOPE_SIGNED_FIELDS]);
          const receipt = {
            schema: DOMAIN_DISPATCH_RECEIPT_SCHEMA,
            domainId: 'domain.acme.social',
            cityId: 'city.alpha',
            auditId: envelope.audit.id,
            requestId: envelope.request.id,
            status: 'delivered',
            code: 'DOMAIN_DELIVERED',
            receiptId: 'domain-receipt-1',
            envelopeHash: envelope.envelopeHash,
            eventRef: 'domain-event-1',
            issuedAt: '2026-05-03T00:00:01.000Z',
          };
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(fixture.signedReceipt(receipt)));
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const attachment = new DomainAttachmentService(db);
      await attachment.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: { endpoint: baseUrl },
          },
        },
      });

      const domainDispatch = new DomainDispatchService(db, {
        cityId: 'city.alpha',
        pluginPlatform: {
          listPlugins: () => [{
            name: 'acme.social',
            version: '1.0.0',
            started: true,
            state: 'active',
            venue: {
              moduleId: 'acme.social',
              namespace: 'acme.social',
              topology: {
                declaration: 'domain_required',
                mode: 'domain',
                domain: { endpoint: baseUrl },
              },
            },
          }],
          getPluginDiagnostics: () => [],
          listFrontendPlugins: async () => [],
          readFrontendAsset: async () => null,
        },
        now: () => new Date('2026-05-03T00:00:00.000Z'),
      });
      services.register('domain-dispatch', domainDispatch);

      const handler = vi.fn(async (ctx, msg) => {
        ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { local: true } });
      });
      hooks.registerWSCommand('acme.social.publish@v1', handler, {
        type: 'acme.social.publish@v1',
        description: 'Publish to the shared social domain.',
        pluginName: 'acme.social',
        params: {},
        controlPolicy: { controllerRequired: false },
        protocol: {
          subject: 'resident',
          request: {
            type: 'acme.social.publish.request@v1',
            requiredCapabilities: ['social.thread.write'],
          },
          receipt: {
            type: 'acme.social.publish.receipt@v1',
            statuses: ['delivered', 'rejected'],
          },
          venue: {
            id: 'acme.social',
            moduleId: 'acme.social',
          },
        },
      });

      const user = await auth.register('domain-dispatch-user', 'domain-dispatch@example.com', 'secret-123');
      const [shadow] = await auth.getAgentsByUser(user.id);
      await permissions.approveCredential({
        authorityUserId: user.id,
        residentId: shadow.id,
        capabilities: ['social.thread.write'],
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
        type: 'acme.social.publish@v1',
        payload: { text: 'hello' },
      });

      expect(handler).not.toHaveBeenCalled();
      expect(receivedEnvelopes).toHaveLength(1);
      expect(sent.at(-1)).toMatchObject({
        id: 'write-a',
        type: 'result',
        payload: {
          ok: true,
          code: 'DOMAIN_DELIVERED',
          receiptId: 'domain-receipt-1',
          eventRef: 'domain-event-1',
        },
      });
      const audits = await db.select().from(schema.domainDispatchAudits);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        status: 'delivered',
        cityId: 'city.alpha',
        domainId: 'domain.acme.social',
        residentId: shadow.id,
        venueModuleId: 'acme.social',
        venueNamespace: 'acme.social',
        command: 'acme.social.publish@v1',
        requestType: 'acme.social.publish.request@v1',
        receiptCode: 'DOMAIN_DELIVERED',
      });
      expect(audits[0]?.envelopeHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await close(server);
    }
  });

  it('runs City Core runtime policy hooks before creating a domain envelope', async () => {
    const fixture = domainFixture();
    let dispatchCalls = 0;
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(fixture.signedDocument(baseUrl)));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'accepted',
          code: 'ATTACHED',
          receiptId: 'attach-policy',
          validUntil: '2026-06-03T00:00:00.000Z',
        }));
        return;
      }
      if (req.url === '/uruc/dispatch' && req.method === 'POST') {
        dispatchCalls += 1;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({}));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const attachment = new DomainAttachmentService(db);
      await attachment.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.policy',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: { endpoint: baseUrl },
          },
        },
      });

      const domainDispatch = new DomainDispatchService(db, {
        cityId: 'city.alpha',
        pluginPlatform: {
          listPlugins: () => [{
            name: 'acme.policy',
            version: '1.0.0',
            started: true,
            state: 'active',
            venue: {
              moduleId: 'acme.social',
              namespace: 'acme.social',
              topology: {
                declaration: 'domain_required',
                mode: 'domain',
                domain: { endpoint: baseUrl },
              },
            },
          }],
          getPluginDiagnostics: () => [],
          listFrontendPlugins: async () => [],
          readFrontendAsset: async () => null,
        },
      });
      services.register('domain-dispatch', domainDispatch);
      hooks.before('ws.command', (hookCtx) => {
        if ((hookCtx as any).command !== 'acme.policy.write@v1') return;
        Object.assign(hookCtx as any, {
          cancelled: true,
          blockReason: {
            error: 'Blocked by test policy.',
            code: 'COMMAND_BLOCKED_BY_POLICY',
          },
        });
      });
      const handler = vi.fn();
      hooks.registerWSCommand('acme.policy.write@v1', handler, {
        type: 'acme.policy.write@v1',
        description: 'Domain write blocked by policy.',
        pluginName: 'acme.policy',
        params: {},
        controlPolicy: { controllerRequired: false },
        protocol: {
          subject: 'resident',
          request: { type: 'acme.policy.write.request@v1' },
          venue: { id: 'acme.social', moduleId: 'acme.social' },
        },
      });

      const user = await auth.register('domain-policy-user', 'domain-policy@example.com', 'secret-123');
      const sent: SentEnvelope[] = [];
      const client = createClient(sent);
      (gateway as any).clients.set('client-policy', client);
      await (gateway as any).handleAgentAuth('client-policy', client, {
        id: 'auth-policy',
        type: 'auth',
        payload: signToken(user.id, 'user'),
      });

      sent.length = 0;
      await (gateway as any).handleMessage('client-policy', {
        id: 'write-policy',
        type: 'acme.policy.write@v1',
        payload: { text: 'blocked' },
      });

      expect(handler).not.toHaveBeenCalled();
      expect(dispatchCalls).toBe(0);
      expect(sent.at(-1)).toMatchObject({
        id: 'write-policy',
        type: 'error',
        payload: { code: 'COMMAND_BLOCKED_BY_POLICY' },
      });
      expect(await db.select().from(schema.domainDispatchAudits)).toHaveLength(0);
    } finally {
      await close(server);
    }
  });

  it('keeps local topology on the local handler and does not create domain audit records', async () => {
    const domainDispatch = new DomainDispatchService(db, {
      cityId: 'city.alpha',
      pluginPlatform: {
        listPlugins: () => [{
          name: 'acme.local',
          version: '1.0.0',
          started: true,
          state: 'active',
          venue: {
            moduleId: 'acme.local',
            namespace: 'acme.local',
            topology: {
              declaration: 'local',
              mode: 'local',
            },
          },
        }],
        getPluginDiagnostics: () => [],
        listFrontendPlugins: async () => [],
        readFrontendAsset: async () => null,
      },
    });
    services.register('domain-dispatch', domainDispatch);

    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { local: true } });
    });
    hooks.registerWSCommand('acme.local.echo@v1', handler, {
      type: 'acme.local.echo@v1',
      description: 'Local echo.',
      pluginName: 'acme.local',
      params: {},
      controlPolicy: { controllerRequired: false },
      protocol: {
        subject: 'resident',
        request: { type: 'acme.local.echo.request@v1' },
        venue: { id: 'acme.local', moduleId: 'acme.local' },
      },
    });

    const user = await auth.register('local-dispatch-user', 'local-dispatch@example.com', 'secret-123');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);
    (gateway as any).clients.set('client-local', client);
    await (gateway as any).handleAgentAuth('client-local', client, {
      id: 'auth-local',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-local', {
      id: 'echo-a',
      type: 'acme.local.echo@v1',
      payload: { text: 'local' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sent.at(-1)).toMatchObject({
      id: 'echo-a',
      type: 'result',
      payload: { local: true },
    });
    expect(await db.select().from(schema.domainDispatchAudits)).toHaveLength(0);
  });

  it('does not dispatch from an attachment unless the plugin runtime topology is domain', async () => {
    await db.insert(schema.domainAttachments).values({
      id: 'attached-local-1',
      status: 'attached',
      domainId: 'domain.acme.local',
      cityId: 'city.alpha',
      pluginId: 'acme.local-attached',
      venueModuleId: 'acme.local-attached',
      venueNamespace: 'acme.local-attached',
      protocolVersion: 'uruc-domain-v0',
      endpoint: 'https://domain.example/attach',
      dispatchEndpoint: 'https://domain.example/dispatch',
      documentUrl: 'https://domain.example/.well-known/uruc-domain.json',
      documentHash: '0'.repeat(64),
      publicKeys: '[]',
      capabilities: '[]',
      receiptCode: 'ATTACHED',
      receipt: JSON.stringify({ ok: true, code: 'ATTACHED' }),
      issuedAt: new Date('2026-05-03T00:00:00.000Z'),
      validUntil: new Date('2026-06-03T00:00:00.000Z'),
      createdAt: new Date('2026-05-03T00:00:00.000Z'),
      updatedAt: new Date('2026-05-03T00:00:00.000Z'),
    });

    const domainDispatch = new DomainDispatchService(db, {
      cityId: 'city.alpha',
      fetch: async () => {
        throw new Error('local topology must not call the domain network');
      },
      pluginPlatform: {
        listPlugins: () => [{
          name: 'acme.local-attached',
          version: '1.0.0',
          started: true,
          state: 'active',
          venue: {
            moduleId: 'acme.local-attached',
            namespace: 'acme.local-attached',
            topology: {
              declaration: 'local',
              mode: 'local',
            },
          },
        }],
        getPluginDiagnostics: () => [],
        listFrontendPlugins: async () => [],
        readFrontendAsset: async () => null,
      },
    });

    await expect(domainDispatch.dispatchVenueRequest({
      schema: {
        type: 'acme.local-attached.write@v1',
        description: 'Local write.',
        pluginName: 'acme.local-attached',
        params: {},
        protocol: {
          subject: 'resident',
          request: { type: 'acme.local-attached.write.request@v1' },
          venue: { id: 'acme.local-attached', moduleId: 'acme.local-attached' },
        },
      },
      msg: { id: 'local-attached-a', type: 'acme.local-attached.write@v1', payload: {} },
      session: { userId: 'user-a', agentId: 'resident-a', agentName: 'Resident A', role: 'agent' } as any,
      permissionCredentials: [],
    })).resolves.toEqual({ status: 'skipped' });
    expect(await db.select().from(schema.domainDispatchAudits)).toHaveLength(0);
  });

  it('fails compactly for domain topology without an active attachment and does not call the local handler', async () => {
    await db.insert(schema.domainAttachments).values({
      id: 'failed-attachment-1',
      status: 'failed',
      domainId: 'domain.acme.unattached',
      cityId: 'city.alpha',
      pluginId: 'acme.unattached',
      venueModuleId: 'acme.unattached',
      venueNamespace: 'acme.unattached',
      protocolVersion: 'uruc-domain-v0',
      endpoint: 'https://domain.example/attach',
      dispatchEndpoint: 'https://domain.example/dispatch',
      documentUrl: 'https://domain.example/.well-known/uruc-domain.json',
      documentHash: '0'.repeat(64),
      publicKeys: '[]',
      capabilities: '[]',
      receiptCode: 'CITY_NOT_ALLOWED',
      receipt: JSON.stringify({ ok: false, code: 'CITY_NOT_ALLOWED' }),
      createdAt: new Date('2026-05-03T00:00:00.000Z'),
      updatedAt: new Date('2026-05-03T00:00:00.000Z'),
    });

    const domainDispatch = new DomainDispatchService(db, {
      cityId: 'city.alpha',
      pluginPlatform: {
        listPlugins: () => [{
          name: 'acme.unattached',
          version: '1.0.0',
          started: true,
          state: 'active',
          venue: {
            moduleId: 'acme.unattached',
            namespace: 'acme.unattached',
            topology: {
              declaration: 'domain_required',
              mode: 'domain',
              domain: { endpoint: 'https://domain.example' },
            },
          },
        }],
        getPluginDiagnostics: () => [],
        listFrontendPlugins: async () => [],
        readFrontendAsset: async () => null,
      },
    });
    services.register('domain-dispatch', domainDispatch);

    const handler = vi.fn(async (ctx, msg) => {
      ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { local: true } });
    });
    hooks.registerWSCommand('acme.unattached.write@v1', handler, {
      type: 'acme.unattached.write@v1',
      description: 'Domain write.',
      pluginName: 'acme.unattached',
      params: {},
      controlPolicy: { controllerRequired: false },
      protocol: {
        subject: 'resident',
        request: { type: 'acme.unattached.write.request@v1' },
        venue: { id: 'acme.unattached', moduleId: 'acme.unattached' },
      },
    });

    const user = await auth.register('unattached-domain-user', 'unattached-domain@example.com', 'secret-123');
    const sent: SentEnvelope[] = [];
    const client = createClient(sent);
    (gateway as any).clients.set('client-unattached', client);
    await (gateway as any).handleAgentAuth('client-unattached', client, {
      id: 'auth-unattached',
      type: 'auth',
      payload: signToken(user.id, 'user'),
    });

    sent.length = 0;
    await (gateway as any).handleMessage('client-unattached', {
      id: 'write-unattached',
      type: 'acme.unattached.write@v1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      id: 'write-unattached',
      type: 'error',
      payload: {
        ok: false,
        code: 'DOMAIN_ATTACHMENT_NOT_ACTIVE',
        cityId: 'city.alpha',
        venueModuleId: 'acme.unattached',
      },
    });
    expect(await db.select().from(schema.domainDispatchAudits)).toHaveLength(0);
  });

  it('records a failed audit receipt when attached domain dispatch returns a non-JSON receipt', async () => {
    const fixture = domainFixture();
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(fixture.signedDocument(baseUrl)));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'accepted',
          code: 'ATTACHED',
          receiptId: 'attach-failure',
          validUntil: '2026-06-03T00:00:00.000Z',
        }));
        return;
      }
      if (req.url === '/uruc/dispatch' && req.method === 'POST') {
        res.statusCode = 502;
        res.setHeader('content-type', 'text/plain');
        res.end('bad gateway');
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const attachment = new DomainAttachmentService(db);
      await attachment.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.failure',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: { endpoint: baseUrl },
          },
        },
      });

      const domainDispatch = new DomainDispatchService(db, {
        cityId: 'city.alpha',
        pluginPlatform: {
          listPlugins: () => [{
            name: 'acme.failure',
            version: '1.0.0',
            started: true,
            state: 'active',
            venue: {
              moduleId: 'acme.social',
              namespace: 'acme.social',
              topology: {
                declaration: 'domain_required',
                mode: 'domain',
                domain: { endpoint: baseUrl },
              },
            },
          }],
          getPluginDiagnostics: () => [],
          listFrontendPlugins: async () => [],
          readFrontendAsset: async () => null,
        },
        now: () => new Date('2026-05-03T00:00:00.000Z'),
      });
      services.register('domain-dispatch', domainDispatch);

      const handler = vi.fn(async (ctx, msg) => {
        ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { local: true } });
      });
      hooks.registerWSCommand('acme.failure.write@v1', handler, {
        type: 'acme.failure.write@v1',
        description: 'Domain write.',
        pluginName: 'acme.failure',
        params: {},
        controlPolicy: { controllerRequired: false },
        protocol: {
          subject: 'resident',
          request: { type: 'acme.failure.write.request@v1' },
          venue: { id: 'acme.social', moduleId: 'acme.social' },
        },
      });

      const user = await auth.register('domain-failure-user', 'domain-failure@example.com', 'secret-123');
      const sent: SentEnvelope[] = [];
      const client = createClient(sent);
      (gateway as any).clients.set('client-failure', client);
      await (gateway as any).handleAgentAuth('client-failure', client, {
        id: 'auth-failure',
        type: 'auth',
        payload: signToken(user.id, 'user'),
      });

      sent.length = 0;
      await (gateway as any).handleMessage('client-failure', {
        id: 'write-failure',
        type: 'acme.failure.write@v1',
        payload: { text: 'fail' },
      });

      expect(handler).not.toHaveBeenCalled();
      expect(sent.at(-1)).toMatchObject({
        id: 'write-failure',
        type: 'error',
        payload: {
          ok: false,
          code: 'DOMAIN_DISPATCH_RECEIPT_CONTENT_TYPE_INVALID',
          cityId: 'city.alpha',
          domainId: 'domain.acme.social',
          venueModuleId: 'acme.social',
        },
      });
      const audits = await db.select().from(schema.domainDispatchAudits);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        status: 'failed',
        receiptCode: 'DOMAIN_DISPATCH_RECEIPT_CONTENT_TYPE_INVALID',
      });
    } finally {
      await close(server);
    }
  });

  it('rejects signed domain receipts whose semantic refs do not match the dispatch audit', async () => {
    const fixture = domainFixture();
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(fixture.signedDocument(baseUrl)));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'accepted',
          code: 'ATTACHED',
          receiptId: 'attach-mismatch',
          validUntil: '2026-06-03T00:00:00.000Z',
        }));
        return;
      }
      if (req.url === '/uruc/dispatch' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const envelope = JSON.parse(body);
          const receipt = {
            schema: DOMAIN_DISPATCH_RECEIPT_SCHEMA,
            domainId: 'domain.attacker',
            cityId: 'city.alpha',
            auditId: envelope.audit.id,
            requestId: envelope.request.id,
            status: 'delivered',
            code: 'DOMAIN_DELIVERED',
            receiptId: 'domain-receipt-mismatch',
            envelopeHash: envelope.envelopeHash,
            eventRef: null,
            issuedAt: '2026-05-03T00:00:01.000Z',
          };
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(fixture.signedReceipt(receipt)));
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const attachment = new DomainAttachmentService(db);
      await attachment.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.mismatch',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: { endpoint: baseUrl },
          },
        },
      });

      const domainDispatch = new DomainDispatchService(db, {
        cityId: 'city.alpha',
        pluginPlatform: {
          listPlugins: () => [{
            name: 'acme.mismatch',
            version: '1.0.0',
            started: true,
            state: 'active',
            venue: {
              moduleId: 'acme.social',
              namespace: 'acme.social',
              topology: {
                declaration: 'domain_required',
                mode: 'domain',
                domain: { endpoint: baseUrl },
              },
            },
          }],
          getPluginDiagnostics: () => [],
          listFrontendPlugins: async () => [],
          readFrontendAsset: async () => null,
        },
        now: () => new Date('2026-05-03T00:00:00.000Z'),
      });

      const result = await domainDispatch.dispatchVenueRequest({
        schema: {
          type: 'acme.mismatch.write@v1',
          description: 'Domain write.',
          pluginName: 'acme.mismatch',
          params: {},
          protocol: {
            subject: 'resident',
            request: { type: 'acme.mismatch.write.request@v1' },
            venue: { id: 'acme.social', moduleId: 'acme.social' },
          },
        },
        msg: { id: 'write-mismatch', type: 'acme.mismatch.write@v1', payload: {} },
        session: { userId: 'user-a', agentId: 'resident-a', agentName: 'Resident A', role: 'agent' } as any,
        permissionCredentials: [],
      });

      expect(result).toMatchObject({
        status: 'failed',
        receipt: {
          ok: false,
          code: 'DOMAIN_DISPATCH_RECEIPT_DOMAIN_MISMATCH',
          cityId: 'city.alpha',
          domainId: 'domain.acme.social',
          venueModuleId: 'acme.social',
        },
      });
      const audits = await db.select().from(schema.domainDispatchAudits);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        status: 'failed',
        receiptCode: 'DOMAIN_DISPATCH_RECEIPT_DOMAIN_MISMATCH',
      });
    } finally {
      await close(server);
    }
  });
});
