import { describe, it, expect, beforeEach } from 'vitest';
import { PluginLoader } from '../loader.js';
import type { Plugin, PluginContext } from '../plugin-interface.js';

const mockCtx = {
  db: {} as any,
  services: { register: () => { }, get: () => ({} as any), tryGet: () => undefined } as any,
  hooks: { registerWSCommand: () => { }, registerHttpRoute: () => { } } as any,
} satisfies PluginContext;

function createPlugin(name: string, dependencies?: string[], initSpy?: () => void): Plugin {
  return {
    name,
    version: '1.0.0',
    dependencies,
    async init(_ctx: PluginContext) {
      initSpy?.();
    },
  };
}

describe('Plugin dependency isolation', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader();
  });

  it('should mark circular dependency plugins as failed without throwing', async () => {
    loader.register(createPlugin('plugin-a', ['plugin-b']));
    loader.register(createPlugin('plugin-b', ['plugin-a']));

    await expect(loader.initAll(mockCtx)).resolves.not.toThrow();

    const diagnostics = loader.getPluginDiagnostics();
    expect(diagnostics.find((item) => item.name === 'plugin-a')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.name === 'plugin-b')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.name === 'plugin-a')?.reason).toMatch(/circular dependency/i);
  });

  it('should only block dependent plugin when dependency is missing', async () => {
    let healthyInitCalled = false;
    loader.register(createPlugin('broken-plugin', ['missing-plugin']));
    loader.register(createPlugin('healthy-plugin', [], () => {
      healthyInitCalled = true;
    }));

    await expect(loader.initAll(mockCtx)).resolves.not.toThrow();

    const diagnostics = loader.getPluginDiagnostics();
    expect(diagnostics.find((item) => item.name === 'broken-plugin')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.name === 'broken-plugin')?.reason).toMatch(/missing dependency/i);
    expect(diagnostics.find((item) => item.name === 'healthy-plugin')?.state).toBe('initialized');
    expect(healthyInitCalled).toBe(true);
  });

  it('should preserve normal initialization order for valid dependency graphs', async () => {
    const initOrder: string[] = [];

    loader.register(createPlugin('plugin-a', [], () => initOrder.push('plugin-a')));
    loader.register(createPlugin('plugin-b', ['plugin-a'], () => initOrder.push('plugin-b')));
    loader.register(createPlugin('plugin-c', ['plugin-b'], () => initOrder.push('plugin-c')));

    await expect(loader.initAll(mockCtx)).resolves.not.toThrow();
    expect(initOrder).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
  });
});
