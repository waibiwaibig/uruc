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
import { registerDashboardRoutes } from '../dashboard-routes.js';
import { registerAuthRoutes } from '../auth-routes.js';
import { AuthService } from '../service.js';
import { verifyState } from '../oauth.js';

describe('auth route error codes', () => {
  let db: ReturnType<typeof createDb>;
  let auth: AuthService;
  let httpServer: Server;
  let baseUrl: string;
  const originalTrustProxy = process.env.TRUST_PROXY;
  const originalAllowRegister = process.env.ALLOW_REGISTER;

  beforeEach(async () => {
    process.env.TRUST_PROXY = 'true';
    process.env.ALLOW_REGISTER = 'true';

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
    vi.mocked(verifyState).mockReturnValue(true);
  });

  afterEach(async () => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;

    if (originalAllowRegister === undefined) delete process.env.ALLOW_REGISTER;
    else process.env.ALLOW_REGISTER = originalAllowRegister;

    await new Promise<void>((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
  });

  it('returns USERNAME_TAKEN for duplicate usernames', async () => {
    await auth.register('gilgamesh', 'one@example.com', 'secret123');

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
      body: JSON.stringify({ username: 'gilgamesh', email: 'two@example.com', password: 'secret123' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('USERNAME_TAKEN');
  });

  it('returns EMAIL_TAKEN for duplicate emails', async () => {
    await auth.register('enkidu', 'shared@example.com', 'secret123');

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '2.2.2.2' },
      body: JSON.stringify({ username: 'new-user', email: 'shared@example.com', password: 'secret123' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('EMAIL_TAKEN');
  });

  it('returns WEAK_PASSWORD for weak registration passwords', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '3.3.3.3' },
      body: JSON.stringify({ username: 'weakling', email: 'weak@example.com', password: 'abcdefgh' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('WEAK_PASSWORD');
  });

  it('returns INVALID_CREDENTIALS for wrong passwords', async () => {
    const user = await auth.register('ishtar', 'ishtar@example.com', 'secret123');
    await db.update(schema.users).set({
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    }).where(eq(schema.users.id, user.id));

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '4.4.4.4' },
      body: JSON.stringify({ username: 'ishtar', password: 'wrongpass1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns EMAIL_NOT_VERIFIED when login is blocked by verification state', async () => {
    await auth.register('ninsun', 'ninsun@example.com', 'secret123');

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '5.5.5.5' },
      body: JSON.stringify({ username: 'ninsun', password: 'secret123' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns INVALID_VERIFICATION_CODE for bad verification attempts', async () => {
    await auth.register('marduk', 'marduk@example.com', 'secret123');

    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '6.6.6.6' },
      body: JSON.stringify({ email: 'marduk@example.com', code: '000000' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_VERIFICATION_CODE');
  });

  it('adds OAUTH_STATE_INVALID to oauth callback redirects when state verification fails', async () => {
    vi.mocked(verifyState).mockReturnValue(false);

    const res = await fetch(`${baseUrl}/api/auth/callback/github?code=abc&state=bad`, {
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('code=OAUTH_STATE_INVALID');
  });
});
