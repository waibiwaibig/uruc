import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb, schema } from '../../database/index.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { createHttpServer } from '../../server/http-server.js';
import { sendVerificationEmail } from '../email.js';
import { registerAuthRoutes } from '../auth-routes.js';
import { AuthService } from '../service.js';

describe('resend-code hardening', () => {
  let auth: AuthService;
  let db: ReturnType<typeof createDb>;
  let httpServer: Server;
  let baseUrl: string;
  const originalTrustProxy = process.env.TRUST_PROXY;

  beforeEach(async () => {
    process.env.TRUST_PROXY = 'true';

    db = createDb(':memory:');
    auth = new AuthService(db);

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    services.register('auth', auth);
    registerAuthRoutes(hooks, auth);

    httpServer = createHttpServer({ auth, hooks, services });
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    vi.mocked(sendVerificationEmail).mockClear();
  });

  afterEach(async () => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
    vi.mocked(sendVerificationEmail).mockClear();

    await new Promise<void>((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
  });

  async function postResend(email: unknown, forwardedFor = '10.10.10.10') {
    return fetch(`${baseUrl}/api/auth/resend-code`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({ email }),
    });
  }

  it('returns 400 for invalid email format', async () => {
    const res = await postResend('invalid-email');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('邮箱格式不正确');
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('returns success without sending for unknown or verified emails', async () => {
    let res = await postResend('missing@example.com');
    let body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();

    const user = await auth.register('ishtar', 'ishtar@example.com', 'secret123');
    await db.update(schema.users).set({
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    }).where(eq(schema.users.id, user.id));
    vi.mocked(sendVerificationEmail).mockClear();

    res = await postResend('ishtar@example.com');
    body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('only rate limits pending users by email and ip', async () => {
    for (let i = 0; i < 4; i += 1) {
      const res = await postResend('ghost@example.com', '1.1.1.1');
      expect(res.status).toBe(200);
    }

    await auth.register('gilgamesh', 'gilgamesh@example.com', 'secret123');
    vi.mocked(sendVerificationEmail).mockClear();

    const firstPending = await postResend('gilgamesh@example.com', '1.1.1.1');
    expect(firstPending.status).toBe(200);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

    await postResend('gilgamesh@example.com', '1.1.1.1');
    await postResend('gilgamesh@example.com', '1.1.1.1');
    expect(sendVerificationEmail).toHaveBeenCalledTimes(3);

    const limited = await postResend('gilgamesh@example.com', '1.1.1.1');
    const limitedBody = await limited.json();
    expect(limited.status).toBe(200);
    expect(limitedBody).toEqual({ success: true });
    expect(sendVerificationEmail).toHaveBeenCalledTimes(3);

    const otherIp = await postResend('gilgamesh@example.com', '2.2.2.2');
    const otherIpBody = await otherIp.json();
    expect(otherIp.status).toBe(200);
    expect(otherIpBody).toEqual({ success: true });
    expect(sendVerificationEmail).toHaveBeenCalledTimes(4);
  });
});
