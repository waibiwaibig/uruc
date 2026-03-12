import { describe, it, expect } from 'vitest';
import { PluginDiscovery } from '../discovery.js';
import { PluginLoader } from '../loader.js';
import type { Plugin, PluginContext } from '../plugin-interface.js';
import path from 'path';

const mockCtx = {
  db: {} as any,
  services: { register: () => { }, get: () => ({} as any), tryGet: () => undefined } as any,
  hooks: { registerWSCommand: () => { }, registerHttpRoute: () => { } } as any,
} satisfies PluginContext;

describe('Plugin System Integration', () => {
  it('should integrate discovery with loader', async () => {
    const configPath = path.join(process.cwd(), 'plugins.dev.json');
    const discovery = new PluginDiscovery(configPath);
    const loader = new PluginLoader(discovery);

    await discovery.loadConfig();

    const plugin: Plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      async init(_ctx: PluginContext) { },
    };

    loader.register(plugin);
    await loader.initAll(mockCtx);

    expect(loader).toBeDefined();
    expect(discovery).toBeDefined();
  });

  it('should discover real plugins from project', async () => {
    const configPath = path.join(process.cwd(), 'plugins.dev.json');
    const discovery = new PluginDiscovery(configPath);

    await discovery.loadConfig();
    const discovered = await discovery.discoverPlugins();

    expect(discovered.size).toBeGreaterThan(0);
    expect(discovered.has('chess')).toBe(true);
  });

  it('should respect enabled/disabled state', async () => {
    const configPath = path.join(process.cwd(), 'plugins.dev.json');
    const discovery = new PluginDiscovery(configPath);

    await discovery.loadConfig();

    expect(discovery.isEnabled('chess')).toBe(true);
  });
});
