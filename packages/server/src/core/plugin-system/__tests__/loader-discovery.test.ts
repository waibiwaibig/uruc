/**
 * PluginLoader + Discovery integration tests.
 *
 * Tests loader behavior with and without Discovery.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginLoader } from '../loader.js';
import { PluginDiscovery } from '../discovery.js';
import type { Plugin, PluginContext } from '../plugin-interface.js';

const mockCtx = {
  db: {} as any,
  services: { register: () => { }, get: () => ({} as any), tryGet: () => undefined } as any,
  hooks: { registerWSCommand: () => { }, registerHttpRoute: () => { } } as any,
} satisfies PluginContext;

class MockPlugin implements Plugin {
  name = 'mock-plugin';
  version = '1.0.0';
  dependencies: string[] = [];

  initCalled = false;
  startCalled = false;
  stopCalled = false;

  async init(ctx: PluginContext): Promise<void> {
    this.initCalled = true;
  }

  async start(): Promise<void> {
    this.startCalled = true;
  }

  async stop(): Promise<void> {
    this.stopCalled = true;
  }
}

describe('PluginLoader with Discovery', () => {
  let loader: PluginLoader;
  let discovery: PluginDiscovery;

  beforeEach(() => {
    discovery = {
      isEnabled: (name: string) => name !== 'disabled-plugin',
      shouldAutoLoad: (name: string) => true,
    } as any;

    loader = new PluginLoader(discovery);
  });

  it('should work without discovery', async () => {
    const loaderWithoutDiscovery = new PluginLoader();
    const plugin = new MockPlugin();

    loaderWithoutDiscovery.register(plugin);
    await loaderWithoutDiscovery.initAll(mockCtx);

    expect(plugin.initCalled).toBe(true);
  });

  it('should register, init, start, and stop plugins', async () => {
    const plugin = new MockPlugin();
    plugin.name = 'test-plugin';

    loader.register(plugin);
    await loader.initAll(mockCtx);
    await loader.startAll();

    expect(plugin.initCalled).toBe(true);
    expect(plugin.startCalled).toBe(true);

    await loader.stopAll();
    expect(plugin.stopCalled).toBe(true);
  });

  it('should get a registered plugin', () => {
    const plugin = new MockPlugin();
    loader.register(plugin);
    expect(loader.getPlugin('mock-plugin')).toBe(plugin);
  });

  it('should list registered plugins', async () => {
    const p1 = new MockPlugin();
    p1.name = 'plugin1';
    const p2 = new MockPlugin();
    p2.name = 'plugin2';
    p2.dependencies = ['plugin1'];

    loader.register(p1);
    loader.register(p2);
    await loader.initAll(mockCtx);

    const list = loader.listPlugins();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.name)).toContain('plugin1');
    expect(list.map(p => p.name)).toContain('plugin2');
  });

  it('should resolve dependencies in correct order', async () => {
    const initOrder: string[] = [];

    const p1 = new MockPlugin();
    p1.name = 'plugin1';
    p1.init = async () => { initOrder.push('plugin1'); };

    const p2 = new MockPlugin();
    p2.name = 'plugin2';
    p2.dependencies = ['plugin1'];
    p2.init = async () => { initOrder.push('plugin2'); };

    // Register in reverse order
    loader.register(p2);
    loader.register(p1);
    await loader.initAll(mockCtx);

    expect(initOrder).toEqual(['plugin1', 'plugin2']);
  });
});
