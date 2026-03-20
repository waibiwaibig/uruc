import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { readCityLock, writeCityConfig } from '../config.js';
import { PluginPlatformHost } from '../host.js';
import { inspectConfiguredPlugins } from '../inspection.js';

const tempDirs: string[] = [];

async function createPluginPackage(root: string, options: {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
}): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify({
    name: options.packageName,
    version: options.version,
    type: 'module',
    urucPlugin: {
      pluginId: options.pluginId,
      apiVersion: 2,
      kind: 'backend',
      entry: './index.mjs',
      publisher: options.publisher,
      displayName: options.pluginId,
      permissions: [],
      dependencies: [],
      activation: ['startup'],
    },
  }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(root, 'index.mjs'), 'export default { kind: "uruc.backend-plugin@v2", pluginId: "test", apiVersion: 2, async setup() {} };\n', 'utf8');
}

async function writeRegistry(
  registryDir: string,
  packages: Array<{
    pluginId: string;
    packageName: string;
    version: string;
    publisher: string;
    path: string;
  }>,
): Promise<void> {
  await mkdir(registryDir, { recursive: true });
  await writeFile(path.join(registryDir, 'uruc-registry.json'), `${JSON.stringify({
    apiVersion: 1,
    packages,
  }, null, 2)}\n`, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('inspectConfiguredPlugins', () => {
  it('treats a source-backed plugin with a valid lock as healthy', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-inspection-'));
    tempDirs.push(tempRoot);
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');
    const registryDir = path.join(tempRoot, 'registry');
    const packageRoot = path.join(tempRoot, 'packages', 'venue-v1');

    await createPluginPackage(packageRoot, {
      pluginId: 'acme.venue',
      packageName: '@acme/plugin-venue',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeRegistry(registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: packageRoot,
      },
    ]);
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [
        { id: 'local', type: 'npm', registry: registryDir },
      ],
      plugins: {
        'acme.venue': {
          pluginId: 'acme.venue',
          packageName: '@acme/plugin-venue',
          version: '1.0.0',
          enabled: true,
          source: 'local',
          permissionsGranted: [],
        },
      },
    });

    const host = new PluginPlatformHost({
      configPath,
      lockPath,
      packageRoot: process.cwd(),
      pluginStoreDir,
    });
    await host.syncLockFile();

    const checks = await inspectConfiguredPlugins({
      config: {
        apiVersion: 2,
        approvedPublishers: ['acme'],
        pluginStoreDir,
        sources: [
          { id: 'local', type: 'npm', registry: registryDir },
        ],
        plugins: {
          'acme.venue': {
            pluginId: 'acme.venue',
            packageName: '@acme/plugin-venue',
            version: '1.0.0',
            enabled: true,
            source: 'local',
            permissionsGranted: [],
          },
        },
      },
      lock: await readCityLock(lockPath),
      configPath,
      runtimeDiagnostics: [
        { pluginId: 'acme.venue', state: 'active' },
      ],
    });

    expect(checks).toEqual([
      expect.objectContaining({
        pluginId: 'acme.venue',
        status: 'ok',
        configStatus: 'ok',
        lockStatus: 'ok',
        sourceType: 'package',
        runtimeState: 'active',
      }),
    ]);
  });

  it('warns instead of failing when a disabled plugin cannot be resolved', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-inspection-'));
    tempDirs.push(tempRoot);
    const configPath = path.join(tempRoot, 'uruc.city.json');

    const checks = await inspectConfiguredPlugins({
      config: {
        apiVersion: 2,
        approvedPublishers: ['acme'],
        pluginStoreDir: path.join(tempRoot, '.uruc', 'plugins'),
        sources: [],
        plugins: {
          'acme.disabled': {
            pluginId: 'acme.disabled',
            packageName: '@acme/plugin-disabled',
            enabled: false,
            permissionsGranted: [],
            devOverridePath: './plugins/missing-disabled',
          },
        },
      },
      lock: {
        apiVersion: 2,
        generatedAt: new Date().toISOString(),
        plugins: {},
      },
      configPath,
    });

    expect(checks).toEqual([
      expect.objectContaining({
        pluginId: 'acme.disabled',
        status: 'warn',
        configStatus: 'warn',
        lockStatus: 'warn',
      }),
    ]);
  });

  it('reports source resolution failure even when an old lock revision is still available', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-inspection-'));
    tempDirs.push(tempRoot);
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');
    const registryDir = path.join(tempRoot, 'registry');
    const packageRoot = path.join(tempRoot, 'packages', 'venue-v1');
    const config = {
      apiVersion: 2 as const,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [
        { id: 'local', type: 'npm' as const, registry: registryDir },
      ],
      plugins: {
        'acme.venue': {
          pluginId: 'acme.venue',
          packageName: '@acme/plugin-venue',
          version: '1.0.0',
          enabled: true,
          source: 'local',
          permissionsGranted: [],
        },
      },
    };

    await createPluginPackage(packageRoot, {
      pluginId: 'acme.venue',
      packageName: '@acme/plugin-venue',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeRegistry(registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: packageRoot,
      },
    ]);
    await writeCityConfig(configPath, config);

    const host = new PluginPlatformHost({
      configPath,
      lockPath,
      packageRoot: process.cwd(),
      pluginStoreDir,
    });
    await host.syncLockFile();

    await writeRegistry(registryDir, []);

    const checks = await inspectConfiguredPlugins({
      config,
      lock: await readCityLock(lockPath),
      configPath,
      runtimeDiagnostics: [
        { pluginId: 'acme.venue', state: 'active' },
      ],
    });

    expect(checks).toEqual([
      expect.objectContaining({
        pluginId: 'acme.venue',
        status: 'fail',
        configStatus: 'fail',
        lockStatus: 'ok',
        runtimeState: 'active',
      }),
    ]);
  });
});
