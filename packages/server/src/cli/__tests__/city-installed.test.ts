import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPackageRoot: vi.fn(() => '/tmp/uruc-installed-package'),
  isWorkspaceLayout: vi.fn(() => false),
}));

vi.mock('../../runtime-paths.js', () => ({
  getPackageRoot: mocks.getPackageRoot,
  isWorkspaceLayout: mocks.isWorkspaceLayout,
}));

const tempDirs: string[] = [];

afterEach(async () => {
  vi.resetModules();
  mocks.isWorkspaceLayout.mockReturnValue(false);
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('installed package bundled plugin config', () => {
  it('writes absolute bundled plugin paths instead of workspace-relative plugin paths', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-installed-city-'));
    tempDirs.push(tempRoot);

    const packageRoot = path.join(tempRoot, 'package-root');
    const bundledPluginRoot = path.join(packageRoot, 'bundled-plugins', 'social');
    const cityConfigPath = path.join(tempRoot, 'runtime-home', 'uruc.city.json');

    await mkdir(bundledPluginRoot, { recursive: true });
    await writeFile(path.join(bundledPluginRoot, 'package.json'), JSON.stringify({
      name: '@uruc/plugin-social',
      version: '0.1.0',
      urucPlugin: {
        pluginId: 'uruc.social',
      },
    }, null, 2));

    mocks.getPackageRoot.mockReturnValue(packageRoot);

    const { DEFAULT_PLUGIN_PRESET, DEFAULT_PLUGIN_STORE_DIR, ensureCityConfig } = await import('../lib/city.js');
    const config = await ensureCityConfig({
      configPath: cityConfigPath,
      packageRoot,
      preset: DEFAULT_PLUGIN_PRESET,
      pluginStoreDir: DEFAULT_PLUGIN_STORE_DIR,
    });

    expect(config.plugins['uruc.social']?.devOverridePath).toBe(bundledPluginRoot);
    expect(config.plugins['uruc.social']?.devOverridePath).not.toContain('../plugins/social');

    const written = JSON.parse(await readFile(cityConfigPath, 'utf8')) as {
      plugins: Record<string, { devOverridePath?: string }>;
    };
    expect(written.plugins['uruc.social']?.devOverridePath).toBe(bundledPluginRoot);
  });
});
