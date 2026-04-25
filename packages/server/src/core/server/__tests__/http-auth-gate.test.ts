import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../../database/index.js';
import { AuthService } from '../../auth/service.js';
import { registerAuthRoutes } from '../../auth/auth-routes.js';
import { registerDashboardRoutes } from '../../auth/dashboard-routes.js';
import { LogService } from '../../logger/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { OWNER_SESSION_COOKIE, signToken } from '../middleware.js';
import { createHttpServer } from '../http-server.js';

describe('HTTP auth gate', () => {
  let httpServer: Server;
  let baseUrl: string;
  let auth: AuthService;
  let hooks: HookRegistry;
  const originalTrustProxy = process.env.TRUST_PROXY;

  beforeEach(async () => {
    process.env.TRUST_PROXY = 'true';

    const db = createDb(':memory:');
    auth = new AuthService(db);
    const logger = new LogService(db);
    hooks = new HookRegistry();
    const services = new ServiceRegistry();

    services.register('auth', auth);
    services.register('logger', logger);
    registerAuthRoutes(hooks, auth);
    registerDashboardRoutes(hooks, auth, logger);

    httpServer = createHttpServer({ auth, hooks, services });
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;

    await new Promise<void>((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
  });

  it('returns 401 instead of 500 when token user no longer exists', async () => {
    const staleToken = signToken('missing-user-id', 'user');

    const res = await fetch(`${baseUrl}/api/dashboard/agents`, {
      headers: { Authorization: `Bearer ${staleToken}` },
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.action).toBe('login');
  });

  it('accepts owner session cookie auth on dashboard routes', async () => {
    const user = await auth.register('enkidu', 'enkidu@example.com', 'secret123');
    const token = signToken(user.id, 'user');

    const res = await fetch(`${baseUrl}/api/dashboard/agents`, {
      headers: { Cookie: `${OWNER_SESSION_COOKIE}=${encodeURIComponent(token)}` },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.agents)).toBe(true);
  });

  it('accepts agent bearer token auth on authenticated plugin HTTP routes', async () => {
    const user = await auth.register('ninsun', 'ninsun@example.com', 'secret123');
    const agent = await auth.createAgent(user.id, 'market-seller');

    hooks.registerHttpRoute((ctx) => {
      if (ctx.path !== '/api/plugins/test/v1/session') return false;
      if (!ctx.session) return false;
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(ctx.session));
      return true;
    });

    const res = await fetch(`${baseUrl}/api/plugins/test/v1/session`, {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ userId: user.id, role: 'agent' });
  });

  it('does not accept agent bearer token auth on dashboard routes', async () => {
    const user = await auth.register('siduri', 'siduri@example.com', 'secret123');
    const agent = await auth.createAgent(user.id, 'dashboard-denied-agent');

    const res = await fetch(`${baseUrl}/api/dashboard/agents`, {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when login payload is missing credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '10.10.10.10',
      },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Please provide username and password.');
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('rate limits auth requests by forwarded client ip', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '1.1.1.1',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    }

    const limited = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '1.1.1.1',
      },
      body: JSON.stringify({}),
    });
    const limitedBody = await limited.json();

    expect(limited.status).toBe(429);
    expect(limitedBody.code).toBe('RATE_LIMITED');

    const otherIp = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '2.2.2.2',
      },
      body: JSON.stringify({}),
    });

    expect(otherIp.status).toBe(400);
  });
});
