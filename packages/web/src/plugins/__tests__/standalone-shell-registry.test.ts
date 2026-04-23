import { describe, expect, it } from 'vitest';
import { loadFrontendPluginRegistry } from '../registry';

describe('frontend standalone plugin routes', () => {
  it('does not register standalone venue shells in the social-only public bundle', async () => {
    const registry = await loadFrontendPluginRegistry();
    const standaloneRoutes = registry.pageRoutes
      .filter((route) => route.shell === 'standalone')
      .map((route) => `${route.pluginId}:${route.id}`)
      .sort();

    expect(standaloneRoutes).toEqual([]);
    expect(registry.pageRoutes.some((route) => route.shell === 'game')).toBe(false);
  });
});
