import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { createServer, type Server } from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { promisify } from 'util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb } from '../../core/database/index.js';
import { readCityConfig, readCityLock, writeCityConfig } from '../../core/plugin-platform/config.js';
import { PluginPlatformHost } from '../../core/plugin-platform/host.js';
import { HookRegistry } from '../../core/plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../core/plugin-system/service-registry.js';
import type { CommandContext } from '../lib/types.js';

const tempDirs: string[] = [];
const servers: Server[] = [];
const execFileAsync = promisify(execFile);
const originalEnv = {
  CITY_CONFIG_PATH: process.env.CITY_CONFIG_PATH,
  CITY_LOCK_PATH: process.env.CITY_LOCK_PATH,
  PLUGIN_STORE_DIR: process.env.PLUGIN_STORE_DIR,
};

async function createPluginPackage(root: string, options: {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
  frontendEntry?: string;
  dependencies?: Record<string, string>;
  body?: string;
}): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify({
    name: options.packageName,
    version: options.version,
    type: 'module',
    ...(options.dependencies ? { dependencies: options.dependencies } : {}),
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
    ...(options.frontendEntry ? {
      urucFrontend: {
        apiVersion: 1,
        entry: options.frontendEntry,
      },
    } : {}),
  }, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(root, 'index.mjs'),
    options.body ?? `export default {
    kind: 'uruc.backend-plugin@v2',
    pluginId: '${options.pluginId}',
    apiVersion: 2,
    async setup() {},
  };\n`,
    'utf8',
  );
}

async function createFrontendPluginPackage(root: string, options: {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
}): Promise<void> {
  await createPluginPackage(root, {
    ...options,
    frontendEntry: './frontend/plugin.ts',
  });

  const frontendDir = path.join(root, 'frontend');
  await mkdir(frontendDir, { recursive: true });
  await writeFile(path.join(frontendDir, 'plugin.ts'), `import './plugin.css';
import { PAGE_ROUTE_TARGET, defineFrontendPlugin } from '@uruc/plugin-sdk/frontend';

export default defineFrontendPlugin({
  pluginId: '${options.pluginId}',
  version: '${options.version}',
  contributes: [{
    target: PAGE_ROUTE_TARGET,
    payload: {
      id: 'home',
      pathSegment: 'home',
      shell: 'app',
      guard: 'auth',
      load: async () => ({ default: (await import('./PluginPage')).PluginPage }),
    },
  }],
});
`, 'utf8');
  await writeFile(path.join(frontendDir, 'PluginPage.tsx'), `import i18n from 'i18next';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function PluginPage() {
  const { t } = useTranslation();
  return (
    <div className="plugin-pack-fixture">
      <Bot size={16} />
      <Link to="/app/plugins/${options.pluginId}/home">{t('pluginPack:title', { defaultValue: i18n.t('pluginPack:title', { defaultValue: 'frontend fixture' }) })}</Link>
    </div>
  );
}
`, 'utf8');
  await writeFile(path.join(frontendDir, 'plugin.css'), `.plugin-pack-fixture { color: rgb(10, 20, 30); }\n`, 'utf8');
}

async function createTempRuntime(): Promise<{
  cityConfigPath: string;
  cityLockPath: string;
  pluginStoreDir: string;
  registryDir: string;
  packageV1: string;
  packageV2: string;
  packageV3: string;
  tempRoot: string;
}> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-cli-'));
  tempDirs.push(tempRoot);
  const cityConfigPath = path.join(tempRoot, 'uruc.city.json');
  const cityLockPath = path.join(tempRoot, 'uruc.city.lock.json');
  const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');
  const registryDir = path.join(tempRoot, 'registry');
  const packageV1 = path.join(tempRoot, 'packages', 'venue-v1');
  const packageV2 = path.join(tempRoot, 'packages', 'venue-v2');
  const packageV3 = path.join(tempRoot, 'packages', 'venue-v3');

  await createPluginPackage(packageV1, {
    pluginId: 'acme.venue',
    packageName: '@acme/plugin-venue',
    version: '1.0.0',
    publisher: 'acme',
  });
  await createPluginPackage(packageV2, {
    pluginId: 'acme.venue',
    packageName: '@acme/plugin-venue',
    version: '1.1.0',
    publisher: 'acme',
  });
  await createPluginPackage(packageV3, {
    pluginId: 'acme.venue',
    packageName: '@acme/plugin-venue',
    version: '1.2.0',
    publisher: 'acme',
  });

  await mkdir(registryDir, { recursive: true });
  await writeCityConfig(cityConfigPath, {
    apiVersion: 2,
    approvedPublishers: ['acme'],
    pluginStoreDir,
    sources: [
      {
        id: 'local',
        type: 'npm',
        registry: registryDir,
      },
    ],
    plugins: {},
  });

  process.env.CITY_CONFIG_PATH = cityConfigPath;
  process.env.CITY_LOCK_PATH = cityLockPath;
  process.env.PLUGIN_STORE_DIR = pluginStoreDir;

  return { cityConfigPath, cityLockPath, pluginStoreDir, registryDir, packageV1, packageV2, packageV3, tempRoot };
}

async function writeRegistry(
  registryDir: string,
  packages: Array<{
    alias?: string;
    pluginId: string;
    packageName: string;
    version: string;
    publisher: string;
    path: string;
  }>,
): Promise<void> {
  await writeFile(path.join(registryDir, 'uruc-registry.json'), `${JSON.stringify({
    apiVersion: 1,
    packages,
  }, null, 2)}\n`, 'utf8');
}

async function packPluginPackage(packageRoot: string): Promise<{
  tarballPath: string;
  integrity: string;
}> {
  const packDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-pack-'));
  const npmCacheDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-npm-cache-'));
  tempDirs.push(packDir);
  tempDirs.push(npmCacheDir);
  const { stdout } = await execFileAsync('npm', ['pack', packageRoot], {
    cwd: packDir,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
  const tarballName = stdout.trim().split('\n').filter(Boolean).at(-1);
  if (!tarballName) {
    throw new Error(`npm pack did not produce a tarball name for ${packageRoot}`);
  }
  const tarballPath = path.join(packDir, tarballName);
  const tarball = await readFile(tarballPath);
  return {
    tarballPath,
    integrity: `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
  };
}

async function startRegistryServer(options: {
  registry: unknown;
  tarballPath: string;
}): Promise<string> {
  const tarball = await readFile(options.tarballPath);
  const server = createServer((req, res) => {
    if (req.url === '/uruc-registry.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(options.registry));
      return;
    }

    if (req.url === '/artifacts/chess.tgz') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(tarball);
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('Registry server did not bind to an address');
  }
  return `http://127.0.0.1:${address.port}`;
}

async function runPlugin(args: string[], overrides: Partial<CommandContext> = {}): Promise<void> {
  const { runPluginCommand } = await import('../plugin-manager.js');
  await runPluginCommand({
    args,
    json: false,
    ...overrides,
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.CITY_CONFIG_PATH = originalEnv.CITY_CONFIG_PATH;
  process.env.CITY_LOCK_PATH = originalEnv.CITY_LOCK_PATH;
  process.env.PLUGIN_STORE_DIR = originalEnv.PLUGIN_STORE_DIR;
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('plugin manager', () => {
  it('installs a marketplace plugin by alias through plugin install from the official source', async () => {
    const runtime = await createTempRuntime();
    const chessPackage = path.join(runtime.tempRoot, 'packages', 'chess');
    await createFrontendPluginPackage(chessPackage, {
      pluginId: 'uruc.chess',
      packageName: '@uruc/plugin-chess',
      version: '0.1.0',
      publisher: 'uruc',
    });
    const packedDir = path.join(runtime.tempRoot, 'packed-official');
    await runPlugin(['pack', chessPackage, '--out', packedDir]);
    const tarballs = (await readdir(packedDir)).filter((entry) => entry.endsWith('.tgz'));
    const tarballPath = path.join(packedDir, tarballs[0]!);
    const tarball = await readFile(tarballPath);
    const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
    const baseUrl = await startRegistryServer({
      registry: {
        apiVersion: 1,
        packages: [
          {
            alias: '@uruc/chess',
            pluginId: 'uruc.chess',
            packageName: '@uruc/plugin-chess',
            version: '0.1.0',
            publisher: 'uruc',
            artifactUrl: './artifacts/chess.tgz',
            integrity,
          },
        ],
      },
      tarballPath,
    });

    const configBefore = await readCityConfig(runtime.cityConfigPath);
    configBefore.approvedPublishers = ['acme', 'uruc'];
    configBefore.sources = [
      { id: 'official', type: 'npm', registry: `${baseUrl}/uruc-registry.json` },
      ...configBefore.sources,
    ];
    await writeCityConfig(runtime.cityConfigPath, configBefore);

    await runPlugin(['install', '@uruc/chess']);

    const host = new PluginPlatformHost({
      configPath: runtime.cityConfigPath,
      lockPath: runtime.cityLockPath,
      packageRoot: process.cwd(),
      pluginStoreDir: runtime.pluginStoreDir,
    });
    await host.syncLockFile();
    await host.startAll({
      db: createDb(':memory:'),
      hooks: new HookRegistry(),
      services: new ServiceRegistry(),
    });

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['uruc.chess']).toMatchObject({
      pluginId: 'uruc.chess',
      packageName: '@uruc/plugin-chess',
      version: '0.1.0',
      source: 'official',
      enabled: true,
    });
    expect(lock.plugins['uruc.chess']).toMatchObject({
      pluginId: 'uruc.chess',
      packageName: '@uruc/plugin-chess',
      version: '0.1.0',
      source: 'official',
      sourceType: 'package',
      publisher: 'uruc',
      enabled: true,
      frontend: {
        format: 'global-script',
        entry: './plugin.js',
        exportKey: 'uruc.chess',
      },
    });
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'uruc.chess')?.state).toBe('active');

    await host.stopAll();
  });

  it('rejects marketplace install when artifact integrity does not match', async () => {
    const runtime = await createTempRuntime();
    const chessPackage = path.join(runtime.tempRoot, 'packages', 'chess');
    await createPluginPackage(chessPackage, {
      pluginId: 'uruc.chess',
      packageName: '@uruc/plugin-chess',
      version: '0.1.0',
      publisher: 'uruc',
    });
    const { tarballPath, integrity } = await packPluginPackage(chessPackage);
    const badIntegrity = `${integrity.slice(0, -1)}${integrity.endsWith('A') ? 'B' : 'A'}`;
    const baseUrl = await startRegistryServer({
      registry: {
        apiVersion: 1,
        packages: [
          {
            alias: '@uruc/chess',
            pluginId: 'uruc.chess',
            packageName: '@uruc/plugin-chess',
            version: '0.1.0',
            publisher: 'uruc',
            artifactUrl: './artifacts/chess.tgz',
            integrity: badIntegrity,
          },
        ],
      },
      tarballPath,
    });

    const configBefore = await readCityConfig(runtime.cityConfigPath);
    configBefore.approvedPublishers = ['acme', 'uruc'];
    configBefore.sources = [
      { id: 'official', type: 'npm', registry: `${baseUrl}/uruc-registry.json` },
      ...configBefore.sources,
    ];
    await writeCityConfig(runtime.cityConfigPath, configBefore);

    await expect(runPlugin(['install', '@uruc/chess'])).rejects.toThrow(/integrity/i);
    const config = await readCityConfig(runtime.cityConfigPath);
    expect(config.plugins['uruc.chess']).toBeUndefined();
  });

  it('fails with a migration hint when using the removed plugin add command', async () => {
    await createTempRuntime();
    await expect(runPlugin(['add', '@uruc/chess'])).rejects.toThrow(/plugin install/i);
  });

  it('installs a plugin by pluginId from a configured source and locks it as a package source', async () => {
    const runtime = await createTempRuntime();
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    await runPlugin(['install', 'acme.venue', '--source', 'local']);

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['acme.venue']).toMatchObject({
      pluginId: 'acme.venue',
      packageName: '@acme/plugin-venue',
      version: '1.0.0',
      source: 'local',
      enabled: true,
    });
    expect(config.plugins['acme.venue']?.devOverridePath).toBeUndefined();

    expect(lock.plugins['acme.venue']).toMatchObject({
      pluginId: 'acme.venue',
      packageName: '@acme/plugin-venue',
      version: '1.0.0',
      source: 'local',
      sourceType: 'package',
      publisher: 'acme',
      enabled: true,
    });
  });

  it('installs a healthy source-backed plugin even when another configured plugin is unresolved', async () => {
    const runtime = await createTempRuntime();
    const configBefore = await readCityConfig(runtime.cityConfigPath);
    configBefore.plugins['acme.broken'] = {
      pluginId: 'acme.broken',
      packageName: '@acme/plugin-broken',
      enabled: true,
      permissionsGranted: [],
      devOverridePath: './packages/missing-broken',
    };
    await writeCityConfig(runtime.cityConfigPath, configBefore);

    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runPlugin(['install', 'acme.venue', '--source', 'local']);

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['acme.venue']?.version).toBe('1.0.0');
    expect(lock.plugins['acme.venue']?.version).toBe('1.0.0');
    expect(lock.plugins['acme.broken']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('acme.broken'));

    warnSpy.mockRestore();
  });

  it('links a local workspace plugin that imports the sdk backend entrypoint', async () => {
    const runtime = await createTempRuntime();
    const localPlugin = path.join(runtime.tempRoot, 'packages', 'local-sdk-plugin');

    await createPluginPackage(localPlugin, {
      pluginId: 'acme.local-sdk',
      packageName: '@acme/plugin-local-sdk',
      version: '1.0.0',
      publisher: 'acme',
      body: `import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';

export default defineBackendPlugin({
  pluginId: 'acme.local-sdk',
  async setup(ctx) {
    await ctx.commands.register({
      id: 'ping',
      description: 'ping',
      inputSchema: {},
      handler: async () => ({ ok: true }),
    });
  },
});
`,
    });

    await runPlugin(['link', localPlugin]);

    const host = new PluginPlatformHost({
      configPath: runtime.cityConfigPath,
      lockPath: runtime.cityLockPath,
      packageRoot: process.cwd(),
      pluginStoreDir: runtime.pluginStoreDir,
    });
    await host.syncLockFile();
    await host.startAll({
      db: createDb(':memory:'),
      hooks: new HookRegistry(),
      services: new ServiceRegistry(),
    });

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['acme.local-sdk']).toMatchObject({
      pluginId: 'acme.local-sdk',
      packageName: '@acme/plugin-local-sdk',
      enabled: true,
    });
    expect(config.plugins['acme.local-sdk']?.devOverridePath).toBeTruthy();
    expect(lock.plugins['acme.local-sdk']?.sourceType).toBe('path');
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.local-sdk')?.state).toBe('active');

    await host.stopAll();
  });

  it('does not replace a linked local override during update', async () => {
    const runtime = await createTempRuntime();
    const localPlugin = path.join(runtime.tempRoot, 'packages', 'local-sdk-plugin');

    await createPluginPackage(localPlugin, {
      pluginId: 'acme.local-sdk',
      packageName: '@acme/plugin-local-sdk',
      version: '1.0.0',
      publisher: 'acme',
      body: `import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';
export default defineBackendPlugin({ pluginId: 'acme.local-sdk', async setup() {} });
`,
    });

    await runPlugin(['link', localPlugin]);
    await runPlugin(['update']);

    const config = await readCityConfig(runtime.cityConfigPath);
    expect(config.plugins['acme.local-sdk']?.devOverridePath).toBeTruthy();
    expect(config.plugins['acme.local-sdk']?.source).toBeUndefined();
  });

  it('lists scanned workspace, source, and installed plugins in json mode', async () => {
    const runtime = await createTempRuntime();
    const localPlugin = path.join(runtime.tempRoot, 'packages', 'local-sdk-plugin');
    await createPluginPackage(localPlugin, {
      pluginId: 'acme.local-sdk',
      packageName: '@acme/plugin-local-sdk',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeRegistry(runtime.registryDir, [
      {
        alias: '@acme/venue',
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    await runPlugin(['link', localPlugin]);
    await runPlugin(['install', 'acme.venue', '--source', 'local']);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runPlugin(['scan'], { json: true });

    const payload = JSON.parse(logSpy.mock.calls.flat().join('\n')) as {
      workspace: Array<{ pluginId: string }>;
      sources: Array<{ pluginId: string; sourceId: string }>;
      installed: Array<{ pluginId: string; installOrigin: string; runtimeStorePath?: string }>;
    };

    expect(payload.workspace.some((entry) => entry.pluginId === 'uruc.social')).toBe(true);
    expect(payload.sources).toContainEqual(expect.objectContaining({
      pluginId: 'acme.venue',
      sourceId: 'local',
    }));
    expect(payload.installed).toContainEqual(expect.objectContaining({
      pluginId: 'acme.local-sdk',
      installOrigin: 'linked-path',
      runtimeStorePath: expect.stringContaining(path.join('.uruc', 'plugins', 'acme.local-sdk')),
    }));
    expect(payload.installed).toContainEqual(expect.objectContaining({
      pluginId: 'acme.venue',
      installOrigin: 'source-registry',
      runtimeStorePath: expect.stringContaining(path.join('.uruc', 'plugins', 'acme.venue')),
    }));

    logSpy.mockRestore();
  });

  it('manages plugin sources through the plugin source subcommand', async () => {
    const runtime = await createTempRuntime();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runPlugin(['source', 'add', 'official', 'https://example.com/registry.json']);
    await runPlugin(['source', 'list'], { json: true });
    let payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string) as Array<{ id: string; registry: string }>;
    expect(payload).toContainEqual({
      id: 'official',
      type: 'npm',
      registry: 'https://example.com/registry.json',
    });

    await runPlugin(['source', 'remove', 'official']);
    await runPlugin(['source', 'list'], { json: true });
    payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string) as Array<{ id: string; registry: string }>;
    expect(payload.some((entry) => entry.id === 'official')).toBe(false);

    logSpy.mockRestore();
  });

  it('fails with a migration hint when using plugin install with a local path', async () => {
    const runtime = await createTempRuntime();
    const localPlugin = path.join(runtime.tempRoot, 'packages', 'local-sdk-plugin');
    await createPluginPackage(localPlugin, {
      pluginId: 'acme.local-sdk',
      packageName: '@acme/plugin-local-sdk',
      version: '1.0.0',
      publisher: 'acme',
    });

    await expect(runPlugin(['install', localPlugin])).rejects.toThrow(/plugin link/i);
  });

  it('updates a source-backed plugin to the newest available release and records rollback history', async () => {
    const runtime = await createTempRuntime();
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    await runPlugin(['install', 'acme.venue', '--source', 'local']);

    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.1.0',
        publisher: 'acme',
        path: runtime.packageV2,
      },
    ]);

    await runPlugin(['update', 'acme.venue']);

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['acme.venue']?.version).toBe('1.1.0');
    expect(lock.plugins['acme.venue']?.version).toBe('1.1.0');
    expect(lock.plugins['acme.venue']?.history[0]?.version).toBe('1.0.0');
    expect(lock.plugins['acme.venue']?.sourceType).toBe('package');
  });

  it('updates healthy source-backed plugins even when another plugin source can no longer resolve', async () => {
    const runtime = await createTempRuntime();
    const failingPackageV1 = path.join(runtime.tempRoot, 'packages', 'failing-v1');
    await createPluginPackage(failingPackageV1, {
      pluginId: 'acme.failing',
      packageName: '@acme/plugin-failing',
      version: '1.0.0',
      publisher: 'acme',
    });

    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
      {
        pluginId: 'acme.failing',
        packageName: '@acme/plugin-failing',
        version: '1.0.0',
        publisher: 'acme',
        path: failingPackageV1,
      },
    ]);

    await runPlugin(['install', 'acme.venue', '--source', 'local']);
    await runPlugin(['install', 'acme.failing', '--source', 'local']);

    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.1.0',
        publisher: 'acme',
        path: runtime.packageV2,
      },
    ]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runPlugin(['update']);

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['acme.venue']?.version).toBe('1.1.0');
    expect(lock.plugins['acme.venue']?.version).toBe('1.1.0');
    expect(config.plugins['acme.failing']?.version).toBe('1.0.0');
    expect(lock.plugins['acme.failing']?.version).toBe('1.0.0');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('plugin doctor accepts healthy source-backed plugins', async () => {
    const runtime = await createTempRuntime();
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runPlugin(['install', 'acme.venue', '--source', 'local']);
    await runPlugin(['doctor']);

    expect(logSpy).toHaveBeenCalledWith('✓ City plugin configuration is healthy');
    logSpy.mockRestore();
  });

  it('plugin doctor warns for disabled unresolved plugins without failing the command', async () => {
    const runtime = await createTempRuntime();
    const configBefore = await readCityConfig(runtime.cityConfigPath);
    configBefore.plugins['acme.disabled'] = {
      pluginId: 'acme.disabled',
      packageName: '@acme/plugin-disabled',
      enabled: false,
      permissionsGranted: [],
      devOverridePath: './packages/missing-disabled',
    };
    await writeCityConfig(runtime.cityConfigPath, configBefore);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runPlugin(['doctor']);

    expect(process.exitCode).not.toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Plugin doctor warnings:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('acme.disabled'));

    process.exitCode = 0;
    logSpy.mockRestore();
  });

  it('removes a configured plugin by deleting it from city config and lock state', async () => {
    const runtime = await createTempRuntime();
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    await runPlugin(['install', 'acme.venue', '--source', 'local']);
    await runPlugin(['remove', 'acme.venue']);
    await runPlugin(['update']);

    const config = await readCityConfig(runtime.cityConfigPath);
    const lock = await readCityLock(runtime.cityLockPath);

    expect(config.plugins['acme.venue']).toBeUndefined();
    expect(lock.plugins['acme.venue']).toBeUndefined();
  });

  it('fails with a clear error when removing a plugin that is not configured', async () => {
    await createTempRuntime();
    await expect(runPlugin(['remove', 'acme.missing'])).rejects.toThrow('Plugin acme.missing is not configured');
  });

  it('fails with a migration hint when using the removed plugin uninstall command', async () => {
    await createTempRuntime();
    await expect(runPlugin(['uninstall', 'acme.missing'])).rejects.toThrow(/plugin remove/i);
  });

  it('unlinks a linked local plugin but rejects unlink for source-backed plugins', async () => {
    const runtime = await createTempRuntime();
    const localPlugin = path.join(runtime.tempRoot, 'packages', 'local-sdk-plugin');
    await createPluginPackage(localPlugin, {
      pluginId: 'acme.local-sdk',
      packageName: '@acme/plugin-local-sdk',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    await runPlugin(['link', localPlugin]);
    await runPlugin(['install', 'acme.venue', '--source', 'local']);
    await runPlugin(['unlink', 'acme.local-sdk']);
    await expect(runPlugin(['unlink', 'acme.venue'])).rejects.toThrow(/plugin remove/i);

    const config = await readCityConfig(runtime.cityConfigPath);
    expect(config.plugins['acme.local-sdk']).toBeUndefined();
    expect(config.plugins['acme.venue']).toBeDefined();
  });

  it('keeps files in place during plugin gc dry-run', async () => {
    const runtime = await createTempRuntime();
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);

    await runPlugin(['install', 'acme.venue', '--source', 'local']);
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.1.0',
        publisher: 'acme',
        path: runtime.packageV2,
      },
    ]);
    await runPlugin(['update', 'acme.venue']);

    const pluginRoot = path.join(runtime.pluginStoreDir, 'acme.venue');
    const orphanRevision = path.join(runtime.pluginStoreDir, 'orphan.plugin', 'dry-run-revision');
    await mkdir(orphanRevision, { recursive: true });
    const before = (await readdir(pluginRoot)).sort();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runPlugin(['gc', '--dry-run']);

    const after = (await readdir(pluginRoot)).sort();
    expect(after).toEqual(before);
    expect(await readdir(path.join(runtime.pluginStoreDir, 'orphan.plugin'))).toEqual(['dry-run-revision']);
    expect(consoleSpy).toHaveBeenCalledWith('Plugin GC dry-run would remove:');
  });

  it('plugin gc removes unused revisions but keeps the current and most recent rollback revision', async () => {
    const runtime = await createTempRuntime();
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
    ]);
    await runPlugin(['install', 'acme.venue', '--source', 'local']);
    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.1.0',
        publisher: 'acme',
        path: runtime.packageV2,
      },
    ]);
    await runPlugin(['update', 'acme.venue']);

    await writeRegistry(runtime.registryDir, [
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.0.0',
        publisher: 'acme',
        path: runtime.packageV1,
      },
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.1.0',
        publisher: 'acme',
        path: runtime.packageV2,
      },
      {
        pluginId: 'acme.venue',
        packageName: '@acme/plugin-venue',
        version: '1.2.0',
        publisher: 'acme',
        path: runtime.packageV3,
      },
    ]);
    await runPlugin(['update', 'acme.venue']);
    await runPlugin(['disable', 'acme.venue']);

    const lockBeforeGc = await readCityLock(runtime.cityLockPath);
    const currentRevision = lockBeforeGc.plugins['acme.venue']!.revision;
    const recentRevision = lockBeforeGc.plugins['acme.venue']!.history[0]!.revision;
    const oldestRevision = lockBeforeGc.plugins['acme.venue']!.history[1]!.revision;

    const orphanRevision = path.join(runtime.pluginStoreDir, 'orphan.plugin', 'dead-revision');
    await mkdir(orphanRevision, { recursive: true });

    await runPlugin(['gc']);

    const pluginRevisions = (await readdir(path.join(runtime.pluginStoreDir, 'acme.venue'))).sort();
    expect(pluginRevisions).toContain(currentRevision);
    expect(pluginRevisions).toContain(recentRevision);
    expect(pluginRevisions).not.toContain(oldestRevision);

    await expect(readdir(path.join(runtime.pluginStoreDir, 'orphan.plugin'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('creates a backend-only plugin scaffold that validates as a V2 package', async () => {
    const runtime = await createTempRuntime();
    const outputDir = path.join(runtime.tempRoot, 'generated', 'acme-demo');
    await runPlugin(['create', 'acme.demo', '--dir', outputDir]);
    await runPlugin(['validate', outputDir]);

    const pkg = JSON.parse(await readFile(path.join(outputDir, 'package.json'), 'utf8')) as Record<string, any>;
    const backendEntry = await readFile(path.join(outputDir, 'index.mjs'), 'utf8');

    expect(pkg.urucPlugin?.pluginId).toBe('acme.demo');
    expect(pkg.urucFrontend).toBeUndefined();
    expect(pkg.dependencies?.['@uruc/plugin-sdk']).toBeUndefined();
    expect(backendEntry).toContain("@uruc/plugin-sdk/backend");
  });

  it('packs a frontend plugin into a marketplace tarball with prebuilt frontend assets', async () => {
    const runtime = await createTempRuntime();
    const pluginRoot = path.join(runtime.tempRoot, 'packages', 'acme-packed-ui');
    const outputDir = path.join(runtime.tempRoot, 'packed');
    await createFrontendPluginPackage(pluginRoot, {
      pluginId: 'acme.packed-ui',
      packageName: '@acme/plugin-packed-ui',
      version: '0.1.0',
      publisher: 'acme',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runPlugin(['pack', pluginRoot, '--out', outputDir]);

    const tarballs = (await readdir(outputDir)).filter((entry) => entry.endsWith('.tgz'));
    expect(tarballs).toHaveLength(1);

    const tarballPath = path.join(outputDir, tarballs[0]!);
    const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-pack-verify-'));
    tempDirs.push(stagingRoot);

    const { downloadAndExtractPluginArtifact } = await import('../../core/plugin-platform/remote-artifact.js');
    const extracted = await downloadAndExtractPluginArtifact({
      artifactUrl: tarballPath,
      stagingRoot,
    });

    expect(await readFile(path.join(extracted.packageRoot, 'frontend-dist', 'manifest.json'), 'utf8')).toContain('"format": "global-script"');
    expect(await readFile(path.join(extracted.packageRoot, 'frontend-dist', 'plugin.js'), 'utf8')).toContain('__uruc_plugin_exports');
    expect(logSpy.mock.calls.flat().join('\n')).toContain('sha512-');
  });

  it('creates a dual-entry plugin scaffold with stable frontend SDK imports', async () => {
    const runtime = await createTempRuntime();
    const outputDir = path.join(runtime.tempRoot, 'generated', 'acme-demo-ui');
    await runPlugin(['create', 'acme.demo-ui', '--frontend', '--dir', outputDir]);
    await runPlugin(['validate', outputDir]);

    const pkg = JSON.parse(await readFile(path.join(outputDir, 'package.json'), 'utf8')) as Record<string, any>;
    const frontendEntry = await readFile(path.join(outputDir, 'frontend', 'plugin.ts'), 'utf8');
    const frontendPage = await readFile(path.join(outputDir, 'frontend', 'PluginPage.tsx'), 'utf8');

    expect(pkg.urucPlugin?.pluginId).toBe('acme.demo-ui');
    expect(pkg.urucFrontend?.entry).toBe('./frontend/plugin.ts');
    expect(pkg.dependencies?.['@uruc/plugin-sdk']).toBeUndefined();
    expect(frontendEntry).toContain("@uruc/plugin-sdk/frontend");
    expect(frontendEntry).not.toContain("@uruc/plugin-sdk'");
    expect(frontendEntry).toContain("shell: 'app'");
    expect(frontendEntry).not.toContain("shell: 'game'");
    expect(frontendPage).toContain("@uruc/plugin-sdk/frontend-react");
  });

  it('rejects plugin packages that declare the host sdk as a runtime dependency', async () => {
    const runtime = await createTempRuntime();
    const pluginRoot = path.join(runtime.tempRoot, 'packages', 'acme-runtime-sdk');
    await createPluginPackage(pluginRoot, {
      pluginId: 'acme.runtime-sdk',
      packageName: '@acme/plugin-runtime-sdk',
      version: '0.1.0',
      publisher: 'acme',
      dependencies: {
        '@uruc/plugin-sdk': '0.1.0',
      },
    });

    await expect(runPlugin(['validate', pluginRoot])).rejects.toThrow('@uruc/plugin-sdk');
  });
});
