import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { PluginDiscovery } from '../discovery.js';
import { PluginLoader } from '../loader.js';
import type { PluginContext } from '../plugin-interface.js';

const TEST_ROOT = path.join(process.cwd(), 'test-plugin-runtime-contract');

const mockCtx = {
  db: {} as any,
  services: { register: () => { }, get: () => ({} as any), tryGet: () => undefined } as any,
  hooks: { registerWSCommand: () => { }, registerHttpRoute: () => { } } as any,
} satisfies PluginContext;

afterEach(async () => {
  if (existsSync(TEST_ROOT)) {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  }
});

describe('Plugin runtime contract', () => {
  it('should continue startup with stale config entries and dependency break', async () => {
    await fs.mkdir(path.join(TEST_ROOT, 'plugins/plugin-a'), { recursive: true });
    await fs.mkdir(path.join(TEST_ROOT, 'plugins/plugin-c'), { recursive: true });

    const config = {
      plugins: {
        'stale-plugin': { enabled: true, autoLoad: true },
        'plugin-a': { enabled: true, autoLoad: true },
        'plugin-c': { enabled: true, autoLoad: true },
      },
      discovery: {
        enabled: true,
        paths: ['./plugins'],
        exclude: ['__tests__', 'node_modules'],
      },
    };

    await fs.writeFile(path.join(TEST_ROOT, 'plugins.prod.json'), JSON.stringify(config, null, 2));

    await fs.writeFile(path.join(TEST_ROOT, 'plugins/plugin-a/plugin.json'), JSON.stringify({
      name: 'plugin-a',
      version: '1.0.0',
      main: './index.js',
      dependencies: ['plugin-b'],
    }, null, 2));
    await fs.writeFile(path.join(TEST_ROOT, 'plugins/plugin-a/index.js'), `
export default class PluginA {
  name = 'plugin-a';
  version = '1.0.0';
  dependencies = ['plugin-b'];
  async init() {}
}
`);

    await fs.writeFile(path.join(TEST_ROOT, 'plugins/plugin-c/plugin.json'), JSON.stringify({
      name: 'plugin-c',
      version: '1.0.0',
      main: './index.js',
      dependencies: [],
    }, null, 2));
    await fs.writeFile(path.join(TEST_ROOT, 'plugins/plugin-c/index.js'), `
export default class PluginC {
  name = 'plugin-c';
  version = '1.0.0';
  dependencies = [];
  async init() {}
}
`);

    const discovery = new PluginDiscovery(path.join(TEST_ROOT, 'plugins.prod.json'), TEST_ROOT);
    const loader = new PluginLoader(discovery);

    await expect(loader.discoverAndLoadAll(mockCtx)).resolves.not.toThrow();

    const diagnostics = loader.getPluginDiagnostics();

    expect(diagnostics.find((item) => item.name === 'stale-plugin')?.state).toBe('skipped');
    expect(diagnostics.find((item) => item.name === 'plugin-a')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.name === 'plugin-c')?.state).toBe('started');
  });
});
