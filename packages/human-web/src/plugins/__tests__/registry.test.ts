import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '../../lib/types';
import { loadFrontendPluginRegistry } from '../registry';
import { resolveEnabledPluginIds } from '../state';
import socialEn from '../../../../plugins/social/frontend/locales/en';

beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
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
});
