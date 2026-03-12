import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../auth/service.js';
import { createDb } from '../../database/index.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { createHttpServer } from '../http-server.js';

describe('http app base path serving', () => {
  let httpServer: Server;
  let baseUrl: string;
  let publicDir: string;
  const originalAppBasePath = process.env.APP_BASE_PATH;
  const originalPublicDir = process.env.PUBLIC_DIR;

  beforeEach(async () => {
    publicDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-app-base-'));
    await mkdir(path.join(publicDir, 'assets'), { recursive: true });
    await writeFile(
      path.join(publicDir, 'index.html'),
      '<!doctype html><html><body><script type="module" src="/app/assets/main.js"></script></body></html>',
      'utf8',
    );
    await writeFile(path.join(publicDir, 'assets', 'main.js'), 'console.log("app-base-ok");', 'utf8');

    process.env.APP_BASE_PATH = '/app';
    process.env.PUBLIC_DIR = publicDir;

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
    if (originalAppBasePath === undefined) delete process.env.APP_BASE_PATH;
    else process.env.APP_BASE_PATH = originalAppBasePath;
    if (originalPublicDir === undefined) delete process.env.PUBLIC_DIR;
    else process.env.PUBLIC_DIR = originalPublicDir;

    await new Promise<void>((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
    if (publicDir) {
      await rm(publicDir, { recursive: true, force: true });
    }
  });

  it('serves the SPA and static assets beneath APP_BASE_PATH', async () => {
    const pageRes = await fetch(`${baseUrl}/app`);
    expect(pageRes.status).toBe(200);
    expect(await pageRes.text()).toContain('/app/assets/main.js');

    const assetRes = await fetch(`${baseUrl}/app/assets/main.js`);
    expect(assetRes.status).toBe(200);
    expect(await assetRes.text()).toContain('app-base-ok');
  });

  it('redirects the bare root to APP_BASE_PATH', async () => {
    const res = await fetch(`${baseUrl}/`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/app');
  });
});
