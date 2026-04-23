import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

vi.mock('../oauth.js', async () => {
  const actual = await vi.importActual<typeof import('../oauth.js')>('../oauth.js');
  return {
    ...actual,
    verifyState: vi.fn(() => true),
    exchangeCode: vi.fn(async () => ({
      provider: 'github' as const,
      providerId: 'oauth-user-1',
      email: 'oauth@example.com',
      name: 'oauth-user',
    })),
  };
});

import { createDb, schema } from '../../database/index.js';
import { LogService } from '../../logger/service.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { createHttpServer } from '../../server/http-server.js';
import { OWNER_SESSION_COOKIE } from '../../server/middleware.js';
import { registerAuthRoutes } from '../auth-routes.js';
import { registerDashboardRoutes } from '../dashboard-routes.js';
import { AuthService } from '../service.js';

describe('owner session cookie flow', () => {
  let db: ReturnType<typeof createDb>;
  let auth: AuthService;
  let httpServer: Server;
  let baseUrl: string;
  const originalTrustProxy = process.env.TRUST_PROXY;

  beforeEach(async () => {
    process.env.TRUST_PROXY = 'true';

    db = createDb(':memory:');
    auth = new AuthService(db);
    const logger = new LogService(db);
    const hooks = new HookRegistry();
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

  function extractSessionCookie(res: Response): string {
    const header = res.headers.get('set-cookie');
    expect(header).toContain(`${OWNER_SESSION_COOKIE}=`);
    return header!.split(';')[0];
  }

  it('sets a session cookie on login and accepts cookie auth for dashboard', async () => {
    const user = await auth.register('gilgamesh', 'gilgamesh@example.com', 'secret123');
    await db.update(schema.users).set({
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    }).where(eq(schema.users.id, user.id));

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
      body: JSON.stringify({ username: 'gilgamesh', password: 'secret123' }),
    });
    const loginBody = await loginRes.json();

    expect(loginRes.status).toBe(200);
    expect(loginBody).toEqual({
      user: expect.objectContaining({
        id: user.id,
        username: 'gilgamesh',
        email: 'gilgamesh@example.com',
      }),
    });
    expect(loginBody.token).toBeUndefined();
    const cookie = extractSessionCookie(loginRes);

    const meRes = await fetch(`${baseUrl}/api/dashboard/me`, {
      headers: { Cookie: cookie },
    });
    const meBody = await meRes.json();
    expect(meRes.status).toBe(200);
    expect(meBody.user.username).toBe('gilgamesh');
  });

  it('accepts email identifiers on login without changing the session cookie flow', async () => {
    const user = await auth.register('enkidu', 'enkidu@example.com', 'secret123');
    await db.update(schema.users).set({
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    }).where(eq(schema.users.id, user.id));

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.2' },
      body: JSON.stringify({ username: 'enkidu@example.com', password: 'secret123' }),
    });
    const loginBody = await loginRes.json();

    expect(loginRes.status).toBe(200);
    expect(loginBody).toEqual({
      user: expect.objectContaining({
        id: user.id,
        username: 'enkidu',
        email: 'enkidu@example.com',
      }),
    });
    const cookie = extractSessionCookie(loginRes);

    const meRes = await fetch(`${baseUrl}/api/dashboard/me`, {
      headers: { Cookie: cookie },
    });
    const meBody = await meRes.json();
    expect(meRes.status).toBe(200);
    expect(meBody.user.username).toBe('enkidu');
  });

  it('sets a session cookie on verify-email and does not return token in json', async () => {
    const user = await auth.register('ishtar', 'ishtar@example.com', 'secret123');
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '2.2.2.2' },
      body: JSON.stringify({ email: 'ishtar@example.com', code: row.verificationCode }),
    });
    const verifyBody = await verifyRes.json();

    expect(verifyRes.status).toBe(200);
    expect(verifyBody).toEqual({
      user: expect.objectContaining({
        id: user.id,
        username: 'ishtar',
        email: 'ishtar@example.com',
      }),
    });
    expect(verifyBody.token).toBeUndefined();
    extractSessionCookie(verifyRes);
  });

  it('clears the session cookie on logout', async () => {
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });
    const body = await logoutRes.json();
    const cookieHeader = logoutRes.headers.get('set-cookie');

    expect(logoutRes.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(cookieHeader).toContain(`${OWNER_SESSION_COOKIE}=`);
    expect(cookieHeader).toContain('Max-Age=0');
  });

  it('redirects oauth callback without exposing token in the url and sets cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/callback/github?code=abc&state=ok`, {
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/callback');
    expect(res.headers.get('location')).not.toContain('token=');
    extractSessionCookie(res);
  });
});
