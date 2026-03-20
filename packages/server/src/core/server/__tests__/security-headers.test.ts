import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../auth/service.js';
import { createDb } from '../../database/index.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { createHttpServer } from '../http-server.js';

describe('security response headers', () => {
  let httpServer: Server;
  let baseUrl: string;
  const originalEnableHsts = process.env.ENABLE_HSTS;

  beforeEach(async () => {
    delete process.env.ENABLE_HSTS;

    const db = createDb(':memory:');
    const auth = new AuthService(db);
    const hooks = new HookRegistry();
    const services = new ServiceRegistry();

    httpServer = createHttpServer({ auth, hooks, services });
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (originalEnableHsts === undefined) delete process.env.ENABLE_HSTS;
    else process.env.ENABLE_HSTS = originalEnableHsts;

    await new Promise<void>((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
  });

  it('includes Content-Security-Policy by default', async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });

  it('includes HSTS only when explicitly enabled for https requests', async () => {
    process.env.ENABLE_HSTS = 'true';

    const httpsRes = await fetch(`${baseUrl}/api/health`, {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    expect(httpsRes.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');

    const httpRes = await fetch(`${baseUrl}/api/health`);
    expect(httpRes.headers.get('strict-transport-security')).toBeNull();
  });

  it('marks the health endpoint as non-cacheable', async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
