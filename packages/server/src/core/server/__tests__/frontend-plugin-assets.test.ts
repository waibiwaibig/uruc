import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../auth/service.js';
import { createDb } from '../../database/index.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { createHttpServer } from '../http-server.js';

describe('frontend plugin asset endpoints', () => {
  let httpServer: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const db = createDb(':memory:');
    const auth = new AuthService(db);
    const hooks = new HookRegistry();
    const services = new ServiceRegistry();

    httpServer = createHttpServer({
      auth,
      hooks,
      services,
      loader: {
        listPlugins: () => [],
        getPluginDiagnostics: () => [],
        listFrontendPlugins: () => [{
          pluginId: 'uruc.chess',
          version: '0.1.0',
          revision: 'rev-chess',
          format: 'global-script',
          entryUrl: '/api/plugin-assets/uruc.chess/rev-chess/frontend-dist/plugin.js',
          cssUrls: ['/api/plugin-assets/uruc.chess/rev-chess/frontend-dist/plugin.css'],
          exportKey: 'uruc.chess',
          source: 'frontend-dist/manifest.json',
        }],
        readFrontendAsset: async (pluginId: string, revision: string, assetPath: string) => {
          if (pluginId === 'uruc.chess' && revision === 'rev-chess' && assetPath === 'frontend-dist/plugin.js') {
            return {
              contentType: 'application/javascript; charset=utf-8',
              body: Buffer.from('window.__uruc_plugin_exports = window.__uruc_plugin_exports || {};', 'utf8'),
            };
          }
          return null;
        },
      } as any,
    });
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
  });

  it('lists runtime frontend plugin manifests from the plugin loader', async () => {
    const res = await fetch(`${baseUrl}/api/frontend-plugins`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      plugins: [{
        pluginId: 'uruc.chess',
        version: '0.1.0',
        revision: 'rev-chess',
        format: 'global-script',
        entryUrl: '/api/plugin-assets/uruc.chess/rev-chess/frontend-dist/plugin.js',
        cssUrls: ['/api/plugin-assets/uruc.chess/rev-chess/frontend-dist/plugin.css'],
        exportKey: 'uruc.chess',
        source: 'frontend-dist/manifest.json',
      }],
    });
  });

  it('serves revision-scoped frontend plugin asset files from the plugin loader', async () => {
    const res = await fetch(`${baseUrl}/api/plugin-assets/uruc.chess/rev-chess/frontend-dist/plugin.js`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    expect(body).toContain('window.__uruc_plugin_exports');
  });
});
