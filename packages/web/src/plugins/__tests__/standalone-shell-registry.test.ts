import { describe, expect, it } from 'vitest';
import { loadFrontendPluginRegistry } from '../registry';

describe('frontend standalone plugin routes', () => {
  it('registers chess as the only built-in standalone venue shell', async () => {
    const registry = await loadFrontendPluginRegistry();
    const standaloneRoutes = registry.pageRoutes
      .filter((route) => route.shell === 'standalone')
      .map((route) => `${route.pluginId}:${route.id}`)
      .sort();

    expect(standaloneRoutes).toEqual(['uruc.chess:hall']);
    expect(registry.pageRoutes.some((route) => route.shell === 'game')).toBe(false);
  });
});
