import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '../../lib/types';
import { loadFrontendPluginRegistry } from '../registry';
import { resolveEnabledPluginIds } from '../state';
import socialEn from '../../../../plugins/social/frontend/locales/en';
import { PAGE_ROUTE_TARGET } from '@uruc/plugin-sdk/frontend';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>).__uruc_plugin_exports;
});

describe('frontend plugin registry v2', () => {
  it('discovers only packages that declare urucFrontend metadata', async () => {
    const registry = await loadFrontendPluginRegistry();
    const pluginIds = registry.plugins.map((plugin) => plugin.pluginId).sort();

    expect(pluginIds).toEqual(['uruc.social']);
  });

  it('generates canonical app-shell paths and aliases for social pages', async () => {
    const registry = await loadFrontendPluginRegistry();
    const hub = registry.pageRoutes.find((route) => route.pluginId === 'uruc.social' && route.id === 'hub');
    const moderation = registry.pageRoutes.find((route) => route.pluginId === 'uruc.social' && route.id === 'moderation');

    expect(hub).toMatchObject({
      path: '/app/plugins/uruc.social/hub',
      aliases: ['/app/social'],
      shell: 'app',
      guard: 'auth',
    });
    expect(moderation).toMatchObject({
      path: '/app/plugins/uruc.social/moderation',
      aliases: ['/admin/social'],
      shell: 'app',
      guard: 'admin',
    });
    expect(registry.locationPages).toEqual([]);
  });

  it('registers user and admin nav entries for social surfaces', async () => {
    const registry = await loadFrontendPluginRegistry();
    const socialNav = registry.navEntries.find((entry) => entry.pluginId === 'uruc.social' && entry.id === 'social-link');
    const socialAdminNav = registry.navEntries.find((entry) => entry.pluginId === 'uruc.social' && entry.id === 'social-admin-link');

    expect(socialNav).toMatchObject({
      to: '/app/plugins/uruc.social/hub',
      labelKey: 'social:nav.label',
      icon: 'landmark',
    });
    expect(socialNav?.requiresRole).toBeUndefined();
    expect(socialAdminNav).toMatchObject({
      to: '/app/plugins/uruc.social/moderation',
      labelKey: 'socialAdmin:nav.label',
      icon: 'tower',
      requiresRole: 'admin',
    });
  });

  it('enables UI strictly from backend health status', () => {
    expect(resolveEnabledPluginIds(null)).toEqual(new Set());

    const health = {
      status: 'ok',
      services: [],
      plugins: [
        { pluginId: 'uruc.social', name: 'uruc.social', version: '0.1.0', started: true },
        { pluginId: 'acme.hidden', name: 'acme.hidden', version: '0.1.0', started: false },
      ],
      pluginDiagnostics: [],
    } satisfies HealthResponse;

    const enabled = resolveEnabledPluginIds(health);
    expect(enabled.has('uruc.social')).toBe(true);
    expect(enabled.has('acme.hidden')).toBe(false);
  });

  it('ships readable English copy for the social plugin', () => {
    expect(socialEn.social.nav.label).not.toBe('social:nav.label');
    expect(socialEn.social.intro.title).not.toBe('social:intro.title');
    expect(socialEn.socialAdmin.nav.label).not.toBe('socialAdmin:nav.label');
    expect(socialEn.socialAdmin.page.queue.title).not.toBe('socialAdmin:page.queue.title');
  });

  it('merges runtime-installed frontend plugins returned by the server', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;

      if (url === '/api/frontend-plugins') {
        return new Response(JSON.stringify({
          plugins: [{
            pluginId: 'acme.runtime',
            version: '0.1.0',
            revision: 'rev-runtime',
            format: 'global-script',
            entryUrl: '/api/plugin-assets/acme.runtime/rev-runtime/frontend-dist/plugin.js',
            cssUrls: ['/api/plugin-assets/acme.runtime/rev-runtime/frontend-dist/plugin.css'],
            exportKey: 'acme.runtime',
            source: 'frontend-dist/manifest.json',
          }],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }));

    const appended: Array<{ tagName: string; href?: string; src?: string }> = [];
    vi.stubGlobal('document', {
      head: {
        appendChild(node: Record<string, unknown>) {
          appended.push({
            tagName: String(node.tagName ?? ''),
            href: typeof node.href === 'string' ? node.href : undefined,
            src: typeof node.src === 'string' ? node.src : undefined,
          });
          if (typeof node.onload === 'function') {
            node.onload(new Event('load'));
          }
          return node;
        },
      },
      querySelector: () => null,
      createElement(tagName: string) {
        return {
          tagName: tagName.toUpperCase(),
          rel: '',
          href: '',
          src: '',
          async: false,
          onload: null,
          onerror: null,
          setAttribute() {},
        };
      },
    });

    (globalThis as Record<string, unknown>).__uruc_plugin_exports = {
      'acme.runtime': {
        pluginId: 'acme.runtime',
        version: '0.1.0',
        contributes: [{
          target: PAGE_ROUTE_TARGET,
          payload: {
            id: 'home',
            pathSegment: 'home',
            shell: 'app',
            guard: 'auth',
            load: async () => ({ default: () => null }),
          },
        }],
      },
    };

    const registry = await loadFrontendPluginRegistry();

    expect(registry.plugins.map((plugin) => plugin.pluginId).sort()).toEqual(['acme.runtime', 'uruc.social']);
    expect(registry.pageRoutes.some((route) => route.pluginId === 'acme.runtime' && route.path === '/app/plugins/acme.runtime/home')).toBe(true);
    expect(appended).toEqual(expect.arrayContaining([
      expect.objectContaining({ tagName: 'LINK', href: '/api/plugin-assets/acme.runtime/rev-runtime/frontend-dist/plugin.css' }),
      expect.objectContaining({ tagName: 'SCRIPT', src: '/api/plugin-assets/acme.runtime/rev-runtime/frontend-dist/plugin.js' }),
    ]));
  });
});
