import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { LogService } from '../../logger/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { createHttpServer } from '../../server/http-server.js';
import { signToken } from '../../server/middleware.js';
import { registerDashboardRoutes } from '../dashboard-routes.js';
import { AuthService } from '../service.js';

describe('principal-backed resident HTTP registration', () => {
  let auth: AuthService;
  let httpServer: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const db = createDb(':memory:');
    auth = new AuthService(db);
    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const logger = new LogService(db);

    services.register('auth', auth);
    services.register('logger', logger);
    registerDashboardRoutes(hooks, auth, logger);
    httpServer = createHttpServer({ auth, hooks, services });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });
    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('registers a principal-backed resident through an authenticated API flow', async () => {
    const user = await auth.register('api-principal', 'api-principal@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);
    const token = signToken(user.id, 'user');

    const res = await fetch(`${baseUrl}/api/dashboard/principal-backed-residents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'api-backed-worker',
        accountablePrincipalId: principal.id,
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.resident).toMatchObject({
      name: 'api-backed-worker',
      userId: user.id,
      registrationType: 'principal_backed',
      accountablePrincipalId: principal.id,
    });
    expect(body.resident.id).not.toBe(principal.id);

    const multiple = await fetch(`${baseUrl}/api/dashboard/principal-backed-residents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'bad-backed-worker',
        accountablePrincipalId: [principal.id, principal.id],
      }),
    });
    const multipleBody = await multiple.json();

    expect(multiple.status).toBe(400);
    expect(multipleBody.code).toBe('BAD_REQUEST');
  });
});
