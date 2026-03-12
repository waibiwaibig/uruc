import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { registerAuthRoutes } from '../../auth/auth-routes.js';
import { registerDashboardRoutes } from '../../auth/dashboard-routes.js';
import { AuthService } from '../../auth/service.js';
import { registerAdminRoutes } from '../../admin/routes.js';
import { AdminService } from '../../admin/service.js';
import { LogService } from '../../logger/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { signToken } from '../middleware.js';
import { createHttpServer } from '../http-server.js';

describe('core http error codes', () => {
  let db: ReturnType<typeof createDb>;
  let auth: AuthService;
  let httpServer: Server;
  let baseUrl: string;
  const originalTrustProxy = process.env.TRUST_PROXY;

  beforeEach(async () => {
    process.env.TRUST_PROXY = 'true';

    db = createDb(':memory:');
    auth = new AuthService(db);
    const admin = new AdminService(db);
    const logger = new LogService(db);
    const hooks = new HookRegistry();
    const services = new ServiceRegistry();

    services.register('auth', auth);
    services.register('logger', logger);
    services.register('admin', admin);
    registerAuthRoutes(hooks, auth);
    registerDashboardRoutes(hooks, auth, logger);
    registerAdminRoutes(hooks, admin, logger, services);

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

  it('returns NOT_FOUND when deleting a missing dashboard agent', async () => {
    const user = await auth.register('gilgamesh', 'gilgamesh@example.com', 'secret123');
    const token = signToken(user.id, 'user');

    const res = await fetch(`${baseUrl}/api/dashboard/agents/missing-agent`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns FORBIDDEN when a non-admin user hits admin routes', async () => {
    const user = await auth.register('enkidu', 'enkidu@example.com', 'secret123');
    const token = signToken(user.id, 'user');

    const res = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

});
