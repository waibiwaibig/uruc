import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { createDb } from '../../database/index.js';
import { registerCityCommands } from '../../city/commands.js';
import { HookRegistry } from '../../plugin-system/hook-registry.js';
import { ServiceRegistry } from '../../plugin-system/service-registry.js';
import { PluginPlatformHost } from '../host.js';
import { readCityLock, writeCityConfig, writeCityLock } from '../config.js';

const tempDirs: string[] = [];
const execFileAsync = promisify(execFile);

async function createPluginPackage(root: string, options: {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
  dependencies?: Record<string, string>;
  frontendEntry?: string;
  frontendBuild?: {
    entry: string;
    css?: string[];
    exportKey?: string;
  };
  venue?: {
    moduleId?: string;
    namespace?: string;
    displayName?: string;
    description?: string;
    category?: string;
    topology?: Record<string, unknown>;
  };
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
      ...(options.venue ? { venue: options.venue } : {}),
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
  await writeFile(path.join(root, 'index.mjs'), options.body ?? `export default {
    kind: 'uruc.backend-plugin@v2',
    pluginId: '${options.pluginId}',
    apiVersion: 2,
    async setup() {},
  };\n`, 'utf8');

  if (options.frontendBuild) {
    const frontendDistDir = path.join(root, 'frontend-dist');
    await mkdir(frontendDistDir, { recursive: true });
    await writeFile(path.join(frontendDistDir, 'manifest.json'), `${JSON.stringify({
      apiVersion: 1,
      pluginId: options.pluginId,
      version: options.version,
      format: 'global-script',
      entry: options.frontendBuild.entry,
      css: options.frontendBuild.css ?? [],
      exportKey: options.frontendBuild.exportKey ?? options.pluginId,
    }, null, 2)}\n`, 'utf8');
    await writeFile(path.join(frontendDistDir, 'plugin.js'), 'window.__uruc_plugin_exports = window.__uruc_plugin_exports || {};\n', 'utf8');
  }
}

async function createExampleVenuePluginPackage(root: string): Promise<void> {
  await createPluginPackage(root, {
    pluginId: 'uruc.example',
    packageName: '@uruc/plugin-example-venue',
    version: '0.1.0',
    publisher: 'uruc',
    body: `import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';

const PLUGIN_ID = 'uruc.example';
const LOCATION_ID = 'sunny-plaza';
const FULL_LOCATION_ID = 'uruc.example.sunny-plaza';

export default defineBackendPlugin({
  pluginId: PLUGIN_ID,
  async setup(ctx) {
    await ctx.locations.register({
      id: LOCATION_ID,
      name: 'Sunny Plaza',
      description: 'A lightweight fixture venue for plugin host tests.',
    });

    await ctx.commands.register({
      id: 'wave',
      description: 'Return a friendly response from Sunny Plaza.',
      inputSchema: {},
      locationPolicy: {
        scope: 'location',
        locations: [FULL_LOCATION_ID],
      },
      handler: async () => ({
        ok: true,
        pluginId: PLUGIN_ID,
        message: 'hello from sunny plaza',
      }),
    });

    await ctx.commands.register({
      id: 'announce',
      description: 'A fixture command that requires confirmation.',
      inputSchema: {},
      locationPolicy: {
        scope: 'location',
        locations: [FULL_LOCATION_ID],
      },
      confirmationPolicy: {
        required: true,
      },
      handler: async () => ({
        ok: true,
        pluginId: PLUGIN_ID,
        message: 'announcement sent',
      }),
    });
  },
});
`,
  });
}

async function writeRegistry(
  registryDir: string,
  packages: Array<{
    pluginId: string;
    packageName: string;
    version: string;
    publisher: string;
    path: string;
    integrity?: string;
  }>,
): Promise<void> {
  await mkdir(registryDir, { recursive: true });
  await writeFile(path.join(registryDir, 'uruc-registry.json'), `${JSON.stringify({
    apiVersion: 1,
    packages,
  }, null, 2)}\n`, 'utf8');
}

function createGateway(sent: unknown[], agentPushes: Array<{ agentId: string; message: unknown }> = []) {
  return {
    send(_ws: unknown, message: unknown) {
      sent.push(message);
    },
    broadcast() {},
    sendToAgent(agentId: string, message: unknown) {
      agentPushes.push({ agentId, message });
    },
    pushToOwner() {},
    getOnlineAgentIds() {
      return [];
    },
  };
}

function createHttpRequest(
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: Buffer | string;
  } = {},
) {
  const body = options.body ?? Buffer.alloc(0);
  const stream = Readable.from(body.length > 0 ? [body] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
    socket: { encrypted: boolean; remoteAddress: string };
  };
  stream.method = method;
  stream.url = url;
  stream.headers = {
    host: 'localhost',
    ...options.headers,
  };
  stream.socket = {
    encrypted: false,
    remoteAddress: '127.0.0.1',
  };
  return stream;
}

function createHttpResponse() {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let statusCode = 200;

  return {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    writeHead(code: number, nextHeaders?: Record<string, string>) {
      statusCode = code;
      for (const [name, value] of Object.entries(nextHeaders ?? {})) {
        headers[name] = String(value);
      }
    },
    end(chunk?: Buffer | string) {
      if (!chunk) return;
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    },
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get bodyBuffer() {
      return Buffer.concat(chunks);
    },
    get bodyText() {
      return Buffer.concat(chunks).toString('utf8');
    },
  };
}

async function startSinglePluginHost(
  pluginId: string,
  packageName: string,
  pluginPath: string,
  configureServices?: (services: ServiceRegistry) => void,
) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), `uruc-plugin-host-${pluginId.replace(/\W+/g, '-')}-`));
  tempDirs.push(tempRoot);

  const configPath = path.join(tempRoot, 'uruc.city.json');
  const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
  const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

  await writeCityConfig(configPath, {
    apiVersion: 2,
    approvedPublishers: ['uruc'],
    pluginStoreDir,
    sources: [],
    plugins: {
      [pluginId]: {
        pluginId,
        packageName,
        enabled: true,
        permissionsGranted: [],
        devOverridePath: pluginPath,
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

  const hooks = new HookRegistry();
  registerCityCommands(hooks);
  const services = new ServiceRegistry();
  configureServices?.(services);
  const db = createDb(':memory:');
  await host.startAll({ db, hooks, services });

  return { host, hooks, services, db };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('PluginPlatformHost', () => {
  it('stores frontend build metadata from a materialized plugin revision in the city lock', async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-frontend-lock-'));
    tempDirs.push(pluginRoot);
    await createPluginPackage(pluginRoot, {
      pluginId: 'acme.frontend-lock',
      packageName: '@acme/plugin-frontend-lock',
      version: '0.1.0',
      publisher: 'acme',
      frontendEntry: './frontend/plugin.ts',
      frontendBuild: {
        entry: './plugin.js',
        css: ['./plugin.css'],
      },
    });

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-runtime-'));
    tempDirs.push(tempRoot);
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.frontend-lock': {
          pluginId: 'acme.frontend-lock',
          packageName: '@acme/plugin-frontend-lock',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginRoot,
        },
      },
    });

    const host = new PluginPlatformHost({
      configPath,
      lockPath,
      packageRoot: process.cwd(),
      pluginStoreDir,
    });

    const lock = await host.syncLockFile();

    expect(lock.plugins['acme.frontend-lock']).toMatchObject({
      pluginId: 'acme.frontend-lock',
      revision: expect.any(String),
      frontend: {
        apiVersion: 1,
        format: 'global-script',
        entry: './plugin.js',
        css: ['./plugin.css'],
        exportKey: 'acme.frontend-lock',
      },
    });
  });

  it('builds frontend assets for path-backed frontend plugins when frontend-dist is missing', async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-frontend-source-'));
    tempDirs.push(pluginRoot);
    await createPluginPackage(pluginRoot, {
      pluginId: 'acme.frontend-source',
      packageName: '@acme/plugin-frontend-source',
      version: '0.1.0',
      publisher: 'acme',
      frontendEntry: './frontend/plugin.ts',
    });
    await mkdir(path.join(pluginRoot, 'frontend'), { recursive: true });
    await writeFile(path.join(pluginRoot, 'frontend', 'plugin.ts'), `import { defineFrontendPlugin } from '@uruc/plugin-sdk/frontend';

export default defineFrontendPlugin({
  pluginId: 'acme.frontend-source',
  version: '0.1.0',
  contributes: [],
});
`, 'utf8');

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-frontend-source-runtime-'));
    tempDirs.push(tempRoot);
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.frontend-source': {
          pluginId: 'acme.frontend-source',
          packageName: '@acme/plugin-frontend-source',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginRoot,
        },
      },
    });

    const host = new PluginPlatformHost({
      configPath,
      lockPath,
      packageRoot: process.cwd(),
      pluginStoreDir,
    });

    const lock = await host.syncLockFile();
    const plugin = lock.plugins['acme.frontend-source'];

    expect(plugin.frontend).toMatchObject({
      apiVersion: 1,
      format: 'global-script',
      entry: './plugin.js',
      css: [],
      exportKey: 'acme.frontend-source',
    });

    expect(existsSync(path.join(plugin.packageRoot, 'frontend-dist', 'manifest.json'))).toBe(true);

    await expect(host.readFrontendAsset(
      'acme.frontend-source',
      plugin.revision,
      'frontend-dist/plugin.js',
    )).resolves.toMatchObject({
      body: expect.any(Buffer),
    });

    await expect(host.listFrontendPlugins()).resolves.toEqual([
      expect.objectContaining({
        pluginId: 'acme.frontend-source',
        revision: plugin.revision,
        entryUrl: `/api/plugin-assets/acme.frontend-source/${plugin.revision}/frontend-dist/plugin.js`,
        cssUrls: [],
        exportKey: 'acme.frontend-source',
      }),
    ]);
  });

  it('rejects frontend asset paths that escape frontend-dist', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-frontend-asset-'));
    tempDirs.push(tempRoot);

    const pluginRoot = path.join(tempRoot, 'plugin');
    const escapeRoot = path.join(tempRoot, 'plugin-escape');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await mkdir(path.join(pluginRoot, 'frontend-dist'), { recursive: true });
    await mkdir(escapeRoot, { recursive: true });
    await writeFile(path.join(pluginRoot, 'frontend-dist', 'plugin.js'), 'console.log("plugin");\n', 'utf8');
    await writeFile(path.join(pluginRoot, 'package.json'), '{"name":"plugin-root-secret"}\n', 'utf8');
    await writeFile(path.join(escapeRoot, 'secret.txt'), 'escaped\n', 'utf8');

    await writeCityLock(lockPath, {
      apiVersion: 2,
      generatedAt: new Date().toISOString(),
      plugins: {
        'acme.frontend-assets': {
          pluginId: 'acme.frontend-assets',
          packageName: '@acme/plugin-frontend-assets',
          version: '0.1.0',
          publisher: 'acme',
          revision: 'rev-assets',
          sourcePath: pluginRoot,
          packageRoot: pluginRoot,
          entryPath: path.join(pluginRoot, 'index.mjs'),
          enabled: true,
          dependencies: [],
          activation: ['startup'],
          permissionsRequested: [],
          permissionsGranted: [],
          config: {},
          sourceType: 'path',
          frontend: {
            apiVersion: 1,
            pluginId: 'acme.frontend-assets',
            version: '0.1.0',
            format: 'global-script',
            entry: './plugin.js',
            css: [],
            exportKey: 'acme.frontend-assets',
          },
          generatedAt: new Date().toISOString(),
          history: [],
        },
      },
    });

    const host = new PluginPlatformHost({
      configPath,
      lockPath,
      packageRoot: process.cwd(),
      pluginStoreDir,
    });

    await expect(
      host.readFrontendAsset('acme.frontend-assets', 'rev-assets', 'frontend-dist/../package.json'),
    ).resolves.toBeNull();
    await expect(
      host.readFrontendAsset('acme.frontend-assets', 'rev-assets', 'frontend-dist/../../plugin-escape/secret.txt'),
    ).resolves.toBeNull();
  });

  it('installs runtime dependencies into materialized plugin revisions before startup', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-runtime-deps-'));
    tempDirs.push(tempRoot);

    const dependencyRoot = path.join(tempRoot, 'deps', 'fixture-runtime-dep');
    const pluginPath = path.join(tempRoot, 'plugins', 'runtime-dep');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await mkdir(dependencyRoot, { recursive: true });
    await writeFile(path.join(dependencyRoot, 'package.json'), `${JSON.stringify({
      name: 'fixture-runtime-dep',
      version: '1.0.0',
      type: 'module',
      exports: {
        '.': './index.js',
      },
    }, null, 2)}\n`, 'utf8');
    await writeFile(
      path.join(dependencyRoot, 'index.js'),
      "export function runtimeValue() { return 'runtime dependency loaded'; }\n",
      'utf8',
    );

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.runtime-dep',
      packageName: '@acme/plugin-runtime-dep',
      version: '1.0.0',
      publisher: 'acme',
      dependencies: {
        'fixture-runtime-dep': `file:${dependencyRoot}`,
      },
      body: `import { runtimeValue } from 'fixture-runtime-dep';

export default {
  kind: 'uruc.backend-plugin@v2',
  pluginId: 'acme.runtime-dep',
  apiVersion: 2,
  async setup(ctx) {
    await ctx.commands.register({
      id: 'ping',
      description: 'ping',
      inputSchema: {},
      handler: async () => ({ ok: true, value: runtimeValue() }),
    });
  },
};\n`,
    });

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.runtime-dep': {
          pluginId: 'acme.runtime-dep',
          packageName: '@acme/plugin-runtime-dep',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const lock = await readCityLock(lockPath);
    const entry = lock.plugins['acme.runtime-dep'];
    expect(entry).toBeDefined();
    expect(existsSync(path.join(entry!.packageRoot, 'node_modules', 'fixture-runtime-dep', 'package.json'))).toBe(true);

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.runtime-dep')?.state).toBe('active');

    await host.stopAll();
  });

  it('reuses runtime dependencies that are already resolvable from ancestor node_modules', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-runtime-deps-ancestor-'));
    tempDirs.push(tempRoot);

    const dependencyRoot = path.join(tempRoot, 'node_modules', 'fixture-runtime-dep');
    const pluginPath = path.join(tempRoot, 'plugins', 'runtime-dep-ancestor');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await mkdir(dependencyRoot, { recursive: true });
    await writeFile(path.join(dependencyRoot, 'package.json'), `${JSON.stringify({
      name: 'fixture-runtime-dep',
      version: '1.0.0',
      type: 'module',
      exports: {
        '.': './index.js',
      },
    }, null, 2)}\n`, 'utf8');
    await writeFile(
      path.join(dependencyRoot, 'index.js'),
      "export function runtimeValue() { return 'runtime dependency loaded from ancestor'; }\n",
      'utf8',
    );

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.runtime-dep-ancestor',
      packageName: '@acme/plugin-runtime-dep-ancestor',
      version: '1.0.0',
      publisher: 'acme',
      dependencies: {
        'fixture-runtime-dep': '1.0.0',
      },
      body: `import { runtimeValue } from 'fixture-runtime-dep';

export default {
  kind: 'uruc.backend-plugin@v2',
  pluginId: 'acme.runtime-dep-ancestor',
  apiVersion: 2,
  async setup(ctx) {
    await ctx.commands.register({
      id: 'ping',
      description: 'ping',
      inputSchema: {},
      handler: async () => ({ ok: true, value: runtimeValue() }),
    });
  },
};\n`,
    });

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.runtime-dep-ancestor': {
          pluginId: 'acme.runtime-dep-ancestor',
          packageName: '@acme/plugin-runtime-dep-ancestor',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const lock = await readCityLock(lockPath);
    const entry = lock.plugins['acme.runtime-dep-ancestor'];
    expect(entry).toBeDefined();
    expect(existsSync(path.join(entry!.packageRoot, 'node_modules', 'fixture-runtime-dep', 'package.json'))).toBe(false);

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.runtime-dep-ancestor')?.state).toBe('active');

    await host.stopAll();
  });

  it('reuses the same revision for unchanged dev override plugins across syncs', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-lock-dev-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'echo');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.echo',
      packageName: '@acme/plugin-echo',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.echo': {
          pluginId: 'acme.echo',
          packageName: '@acme/plugin-echo',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const firstLock = await readCityLock(lockPath);
    await host.syncLockFile();
    const secondLock = await readCityLock(lockPath);

    expect(secondLock.plugins['acme.echo']?.revision).toBe(firstLock.plugins['acme.echo']?.revision);
    expect(secondLock.plugins['acme.echo']?.history ?? []).toHaveLength(0);
  });

  it('preserves venue module metadata in the lock and runtime diagnostics', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-metadata-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'bazaar');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.bazaar',
      packageName: '@acme/plugin-bazaar',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.bazaar',
        namespace: 'acme.bazaar',
        displayName: 'Bazaar',
        description: 'Trading venue module.',
        category: 'market',
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.bazaar': {
          pluginId: 'acme.bazaar',
          packageName: '@acme/plugin-bazaar',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.bazaar']?.venue).toEqual({
      moduleId: 'acme.bazaar',
      namespace: 'acme.bazaar',
      displayName: 'Bazaar',
      description: 'Trading venue module.',
      category: 'market',
      topology: {
        declaration: 'local',
        mode: 'local',
      },
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(host.listPlugins().find((item) => item.name === 'acme.bazaar')?.venue).toMatchObject({
      moduleId: 'acme.bazaar',
      namespace: 'acme.bazaar',
    });
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.bazaar')?.venue).toMatchObject({
      moduleId: 'acme.bazaar',
      namespace: 'acme.bazaar',
    });

    await host.stopAll();
  });

  it('exposes local venue topology metadata in the lock and runtime diagnostics', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-local-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'local-topology');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.local',
      packageName: '@acme/plugin-local',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.local',
        namespace: 'acme.local',
        topology: { mode: 'local' },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.local': {
          pluginId: 'acme.local',
          packageName: '@acme/plugin-local',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.local']?.venue?.topology).toEqual({
      declaration: 'local',
      mode: 'local',
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(host.listPlugins().find((item) => item.name === 'acme.local')?.venue?.topology).toEqual({
      declaration: 'local',
      mode: 'local',
    });
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.local')?.venue?.topology).toEqual({
      declaration: 'local',
      mode: 'local',
    });

    await host.stopAll();
  });

  it('lets city config select domain mode for a domain-optional venue topology declaration', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-domain-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'domain-topology');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.domain',
      packageName: '@acme/plugin-domain',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.domain',
        namespace: 'acme.domain',
        topology: {
          mode: 'domain_optional',
          domain: {
            endpoint: 'https://domain.example/acme',
            document: 'https://domain.example/.well-known/uruc-domain.json',
          },
        },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.domain': {
          pluginId: 'acme.domain',
          packageName: '@acme/plugin-domain',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
          topology: { mode: 'domain' },
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.domain']?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        endpoint: 'https://domain.example/acme',
        document: 'https://domain.example/.well-known/uruc-domain.json',
      },
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(host.listPlugins().find((item) => item.name === 'acme.domain')?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        endpoint: 'https://domain.example/acme',
        document: 'https://domain.example/.well-known/uruc-domain.json',
      },
    });
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.domain')?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        endpoint: 'https://domain.example/acme',
        document: 'https://domain.example/.well-known/uruc-domain.json',
      },
    });

    await host.stopAll();
  });

  it('lets city config point at a selected domain without changing venue identity', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-domain-override-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'domain-topology-override');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.domain-override',
      packageName: '@acme/plugin-domain-override',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.domain-override',
        namespace: 'acme.domain-override',
        topology: {
          mode: 'domain_optional',
          domain: {
            endpoint: 'https://domain.example/acme',
            document: 'https://domain.example/.well-known/uruc-domain.json',
          },
        },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.domain-override': {
          pluginId: 'acme.domain-override',
          packageName: '@acme/plugin-domain-override',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
          topology: {
            mode: 'domain',
            domain: {
              endpoint: 'https://city-config.example/override',
              document: 'https://city-config.example/override-document.json',
            },
          } as { mode: 'domain' },
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.domain-override']?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        endpoint: 'https://city-config.example/override',
        document: 'https://city-config.example/override-document.json',
      },
    });
    expect(lock.plugins['acme.domain-override']?.venue).toMatchObject({
      moduleId: 'acme.domain-override',
      namespace: 'acme.domain-override',
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(host.listPlugins().find((item) => item.name === 'acme.domain-override')?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        endpoint: 'https://city-config.example/override',
        document: 'https://city-config.example/override-document.json',
      },
    });
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.domain-override')?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        endpoint: 'https://city-config.example/override',
        document: 'https://city-config.example/override-document.json',
      },
    });

    await host.stopAll();
  });

  it('lets city config select domain mode with only a Domain Document URL', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-domain-document-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'domain-topology-document');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.domain-document',
      packageName: '@acme/plugin-domain-document',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.domain-document',
        namespace: 'acme.domain-document',
        topology: {
          mode: 'domain_optional',
        },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.domain-document': {
          pluginId: 'acme.domain-document',
          packageName: '@acme/plugin-domain-document',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
          topology: {
            mode: 'domain',
            domain: {
              document: 'https://city-config.example/domain-document.json',
            },
          } as { mode: 'domain' },
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.domain-document']?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'domain',
      domain: {
        document: 'https://city-config.example/domain-document.json',
      },
    });
  });

  it('keeps a domain-optional venue local when city config selects local mode', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-domain-local-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'domain-local-topology');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.domain-local',
      packageName: '@acme/plugin-domain-local',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.domain-local',
        namespace: 'acme.domain-local',
        topology: {
          mode: 'domain_optional',
          domain: { endpoint: 'http://127.0.0.1:9/no-network-call' },
        },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.domain-local': {
          pluginId: 'acme.domain-local',
          packageName: '@acme/plugin-domain-local',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
          topology: { mode: 'local' },
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.domain-local']?.venue?.topology).toEqual({
      declaration: 'domain_optional',
      mode: 'local',
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });
    expect(host.listPlugins().find((item) => item.name === 'acme.domain-local')?.state).toBe('active');

    await host.stopAll();
  });

  it('fails with a stable diagnostic when domain-required topology has no city config', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-required-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'required-topology');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.required',
      packageName: '@acme/plugin-required',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.required',
        namespace: 'acme.required',
        topology: {
          mode: 'domain_required',
          domain: { endpoint: 'https://domain.example/acme-required' },
        },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.required': {
          pluginId: 'acme.required',
          packageName: '@acme/plugin-required',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const lock = await readCityLock(lockPath);
    expect(lock.plugins['acme.required']).toBeUndefined();
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.required')).toMatchObject({
      state: 'failed',
      lastError: 'Plugin acme.required requires domain topology config',
    });
  });

  it('fails with a stable diagnostic when city config selects domain for a local-only venue', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-venue-topology-unsupported-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'unsupported-topology');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.unsupported',
      packageName: '@acme/plugin-unsupported',
      version: '1.0.0',
      publisher: 'acme',
      venue: {
        moduleId: 'acme.unsupported',
        namespace: 'acme.unsupported',
        topology: { mode: 'local' },
      },
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.unsupported': {
          pluginId: 'acme.unsupported',
          packageName: '@acme/plugin-unsupported',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
          topology: { mode: 'domain' },
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
    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.unsupported')).toMatchObject({
      state: 'failed',
      lastError: 'Plugin acme.unsupported does not support domain topology',
    });
  });

  it('keeps resolving healthy plugins when one configured plugin cannot be locked', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-lock-partial-'));
    tempDirs.push(tempRoot);

    const healthyPath = path.join(tempRoot, 'plugins', 'healthy');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(healthyPath, {
      pluginId: 'acme.healthy',
      packageName: '@acme/plugin-healthy',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.broken': {
          pluginId: 'acme.broken',
          packageName: '@acme/plugin-broken',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: './plugins/missing-broken',
        },
        'acme.healthy': {
          pluginId: 'acme.healthy',
          packageName: '@acme/plugin-healthy',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: healthyPath,
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
    const lock = await readCityLock(lockPath);

    expect(lock.plugins['acme.healthy']?.packageName).toBe('@acme/plugin-healthy');
    expect(lock.plugins['acme.broken']).toBeUndefined();
    expect(host.getPluginDiagnostics()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: 'acme.broken',
          state: 'failed',
        }),
      ]),
    );
  });

  it('creates a new revision when dev override plugin source contents change without a version bump', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-lock-dev-change-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'echo');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.echo',
      packageName: '@acme/plugin-echo',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.echo': {
          pluginId: 'acme.echo',
          packageName: '@acme/plugin-echo',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const firstLock = await readCityLock(lockPath);

    await writeFile(path.join(pluginPath, 'index.mjs'), `export default {
      kind: 'uruc.backend-plugin@v2',
      pluginId: 'acme.echo',
      apiVersion: 2,
      async setup() {
        return {
          async dispose() {},
        };
      },
    };\n`, 'utf8');

    await host.syncLockFile();
    const secondLock = await readCityLock(lockPath);

    expect(secondLock.plugins['acme.echo']?.revision).not.toBe(firstLock.plugins['acme.echo']?.revision);
    expect(secondLock.plugins['acme.echo']?.history[0]?.revision).toBe(firstLock.plugins['acme.echo']?.revision);
    expect(secondLock.plugins['acme.echo']?.history[0]?.version).toBe(firstLock.plugins['acme.echo']?.version);
  });

  it('reuses the same revision for unchanged source-backed plugins across syncs', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-lock-package-'));
    tempDirs.push(tempRoot);

    const packagePath = path.join(tempRoot, 'packages', 'echo-v1');
    const registryDir = path.join(tempRoot, 'registry');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(packagePath, {
      pluginId: 'acme.echo',
      packageName: '@acme/plugin-echo',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeRegistry(registryDir, [
      {
        pluginId: 'acme.echo',
        packageName: '@acme/plugin-echo',
        version: '1.0.0',
        publisher: 'acme',
        path: packagePath,
        integrity: 'sha512-echo-v1',
      },
    ]);
    await writeCityConfig(configPath, {
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
      plugins: {
        'acme.echo': {
          pluginId: 'acme.echo',
          packageName: '@acme/plugin-echo',
          enabled: true,
          permissionsGranted: [],
          source: 'local',
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
    const firstLock = await readCityLock(lockPath);
    await host.syncLockFile();
    const secondLock = await readCityLock(lockPath);

    expect(secondLock.plugins['acme.echo']?.revision).toBe(firstLock.plugins['acme.echo']?.revision);
    expect(secondLock.plugins['acme.echo']?.history ?? []).toHaveLength(0);
  });

  it('re-materializes unchanged plugins when a previous lock points at a missing host path', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-rematerialize-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugins', 'echo');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.echo',
      packageName: '@acme/plugin-echo',
      version: '1.0.0',
      publisher: 'acme',
    });
    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.echo': {
          pluginId: 'acme.echo',
          packageName: '@acme/plugin-echo',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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
    const firstLock = await readCityLock(lockPath);
    const firstEntry = firstLock.plugins['acme.echo'];
    expect(firstEntry).toBeDefined();

    const stalePackageRoot = path.join(tempRoot, 'stale-host', 'plugins', 'acme.echo', firstEntry!.revision);
    await writeCityLock(lockPath, {
      ...firstLock,
      plugins: {
        ...firstLock.plugins,
        'acme.echo': {
          ...firstEntry!,
          packageRoot: stalePackageRoot,
          entryPath: path.join(stalePackageRoot, 'index.mjs'),
        },
      },
    });

    await host.syncLockFile();
    const secondLock = await readCityLock(lockPath);
    const secondEntry = secondLock.plugins['acme.echo'];

    expect(secondEntry?.revision).toBe(firstEntry?.revision);
    expect(secondEntry?.packageRoot).toBe(path.join(pluginStoreDir, 'acme.echo', firstEntry!.revision));
    expect(secondEntry?.entryPath).toBe(path.join(pluginStoreDir, 'acme.echo', firstEntry!.revision, 'index.mjs'));
    expect(existsSync(secondEntry!.entryPath)).toBe(true);
    expect(secondEntry?.history ?? []).toHaveLength(0);
  });

  it('makes plugin-sdk backend importable in a plain Node runtime after the server build', async () => {
    const repoRoot = path.resolve(process.cwd(), '..', '..');

    await execFileAsync('npm', ['run', 'build', '--workspace=packages/server'], {
      cwd: repoRoot,
    });

    const { stdout } = await execFileAsync(
      process.execPath,
      ['--no-experimental-strip-types', '-e', "import('@uruc/plugin-sdk/backend').then(() => console.log('ok'))"],
      { cwd: repoRoot },
    );

    expect(stdout.trim()).toBe('ok');
  }, 90000);

  it('keeps plugin-sdk backend importable when the plugin store is addressed through a symlinked path', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-symlink-'));
    tempDirs.push(tempRoot);

    const aliasRoot = `${tempRoot}-alias`;
    await symlink(tempRoot, aliasRoot, process.platform === 'win32' ? 'junction' : 'dir');
    tempDirs.push(aliasRoot);

    const configPath = path.join(aliasRoot, 'uruc.city.json');
    const lockPath = path.join(aliasRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(aliasRoot, '.uruc', 'plugins');
    const examplePluginPath = path.join(aliasRoot, 'plugins', 'example-venue');

    await createExampleVenuePluginPackage(examplePluginPath);

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'uruc.example': {
          pluginId: 'uruc.example',
          packageName: '@uruc/plugin-example-venue',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: examplePluginPath,
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

    const lock = await readCityLock(lockPath);
    const plugin = lock.plugins['uruc.example'];
    expect(plugin).toBeDefined();

    const moduleUrl = `${pathToFileURL(plugin!.entryPath).href}?bridge-test=${Date.now()}`;
    const loaded = await import(moduleUrl) as { default?: { pluginId?: string } };

    expect(loaded.default?.pluginId).toBe('uruc.example');
  });

  it('keeps starting healthy plugins when one startup plugin fails', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-isolation-'));
    tempDirs.push(tempRoot);

    const brokenPath = path.join(tempRoot, 'plugins', 'broken');
    const healthyPath = path.join(tempRoot, 'plugins', 'healthy');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(brokenPath, {
      pluginId: 'acme.broken',
      packageName: '@acme/plugin-broken',
      version: '1.0.0',
      publisher: 'acme',
      body: `export default {
        kind: 'uruc.backend-plugin@v2',
        pluginId: 'acme.broken',
        apiVersion: 2,
        async setup() {
          throw new Error('boom');
        },
      };\n`,
    });

    await createPluginPackage(healthyPath, {
      pluginId: 'acme.healthy',
      packageName: '@acme/plugin-healthy',
      version: '1.0.0',
      publisher: 'acme',
      body: `export default {
        kind: 'uruc.backend-plugin@v2',
        pluginId: 'acme.healthy',
        apiVersion: 2,
        async setup(ctx) {
          await ctx.commands.register({
            id: 'ping',
            description: 'ping',
            inputSchema: {},
            handler: async () => ({ ok: true }),
          });
        },
      };\n`,
    });

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.broken': {
          pluginId: 'acme.broken',
          packageName: '@acme/plugin-broken',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: brokenPath,
        },
        'acme.healthy': {
          pluginId: 'acme.healthy',
          packageName: '@acme/plugin-healthy',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: healthyPath,
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

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');

    await host.startAll({ db, hooks, services });

    const diagnostics = host.getPluginDiagnostics();
    expect(diagnostics.find((item) => item.pluginId === 'acme.broken')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.pluginId === 'acme.healthy')?.state).toBe('active');
    expect(host.listPlugins().find((item) => item.name === 'acme.healthy')?.started).toBe(true);

    await host.stopAll();
  });

  it('cleans up partial registrations when plugin setup fails after registering commands', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-partial-plugin-'));
    tempDirs.push(tempRoot);

    const pluginPath = path.join(tempRoot, 'plugin');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'uruc.partial',
      packageName: '@uruc/plugin-partial',
      version: '1.0.0',
      publisher: 'uruc',
      body: `export default {
        kind: 'uruc.backend-plugin@v2',
        pluginId: 'uruc.partial',
        apiVersion: 2,
        async setup(ctx) {
          await ctx.commands.register({
            id: 'leak',
            description: 'leak',
            inputSchema: {},
            handler: async () => ({ leaked: true }),
          });
          throw new Error('after-register');
        },
      };\n`,
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const sent: unknown[] = [];
    services.register('ws-gateway' as never, createGateway(sent) as never);
    const db = createDb(':memory:');

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'uruc.partial': {
          pluginId: 'uruc.partial',
          packageName: '@uruc/plugin-partial',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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

    await host.startAll({ db, hooks, services });

    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'uruc.partial')?.state).toBe('failed');
    expect(hooks.getAvailableWSCommandSchemas({ inCity: false, currentLocation: null, hasSession: true } as any)
      .some((schema: any) => schema.type === 'uruc.partial.leak@v1')).toBe(false);
  });

  it('runs lifecycle cleanup handlers when plugin setup fails after registering onStop hooks', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-lifecycle-plugin-'));
    tempDirs.push(tempRoot);
    (globalThis as any).__urucLifecycleCleaned = false;

    const pluginPath = path.join(tempRoot, 'plugin');
    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await createPluginPackage(pluginPath, {
      pluginId: 'acme.lifecycle',
      packageName: '@acme/plugin-lifecycle',
      version: '1.0.0',
      publisher: 'acme',
      body: `export default {
        kind: 'uruc.backend-plugin@v2',
        pluginId: 'acme.lifecycle',
        apiVersion: 2,
        async setup(ctx) {
          ctx.lifecycle.onStop(() => {
            globalThis.__urucLifecycleCleaned = true;
          });
          throw new Error('lifecycle-boom');
        },
      };\n`,
    });

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['acme'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'acme.lifecycle': {
          pluginId: 'acme.lifecycle',
          packageName: '@acme/plugin-lifecycle',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: pluginPath,
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

    await host.startAll({ db, hooks, services });

    expect(host.getPluginDiagnostics().find((item) => item.pluginId === 'acme.lifecycle')?.state).toBe('failed');
    expect((globalThis as any).__urucLifecycleCleaned).toBe(true);
  });

  it('boots an empty city without any plugins installed', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-empty-'));
    tempDirs.push(tempRoot);

    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: [],
      pluginStoreDir,
      sources: [],
      plugins: {},
    });

    const host = new PluginPlatformHost({
      configPath,
      lockPath,
      packageRoot: process.cwd(),
      pluginStoreDir,
    });
    await host.syncLockFile();

    const hooks = new HookRegistry();
    registerCityCommands(hooks);
    const services = new ServiceRegistry();
    const db = createDb(':memory:');

    await host.startAll({ db, hooks, services });

    expect(host.getPluginDiagnostics()).toEqual([]);
    expect(hooks.hasWSCommand('enter_city')).toBe(true);
    expect(hooks.hasWSCommand('what_can_i_do')).toBe(true);

    await host.stopAll();
  });

  it('loads a native V2 plugin from the city lock, filters commands, and disposes registrations', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-host-'));
    tempDirs.push(tempRoot);

    const configPath = path.join(tempRoot, 'uruc.city.json');
    const lockPath = path.join(tempRoot, 'uruc.city.lock.json');
    const pluginStoreDir = path.join(tempRoot, '.uruc', 'plugins');
    const examplePluginPath = path.join(tempRoot, 'plugins', 'example-venue');

    await createExampleVenuePluginPackage(examplePluginPath);

    await writeCityConfig(configPath, {
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      pluginStoreDir,
      sources: [],
      plugins: {
        'uruc.example': {
          pluginId: 'uruc.example',
          packageName: '@uruc/plugin-example-venue',
          enabled: true,
          permissionsGranted: [],
          devOverridePath: examplePluginPath,
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

    const hooks = new HookRegistry();
    const services = new ServiceRegistry();
    const db = createDb(':memory:');
    await host.startAll({ db, hooks, services });

    expect(hooks.hasLocation('uruc.example.sunny-plaza')).toBe(true);
    expect(hooks.hasWSCommand('uruc.example.wave@v1')).toBe(true);
    expect(hooks.hasWSCommand('uruc.example.announce@v1')).toBe(true);

    const availableForConfirm = hooks.getAvailableWSCommandSchemas({
      session: {
        userId: 'user-1',
        agentId: 'agent-1',
        agentName: 'Agent One',
        role: 'agent',
        trustMode: 'confirm',
      },
      inCity: true,
      currentLocation: 'uruc.example.sunny-plaza',
      isActionLeaseHolder: true,
      hasActionLease: true,
    });

    expect(availableForConfirm.some((command) => command.type === 'uruc.example.wave@v1')).toBe(true);
    expect(availableForConfirm.some((command) => command.type === 'uruc.example.announce@v1')).toBe(true);

    const sent: unknown[] = [];
    const wsCtx = {
      ws: {},
      session: {
        userId: 'user-1',
        agentId: 'agent-1',
        agentName: 'Agent One',
        role: 'agent' as const,
        trustMode: 'full' as const,
      },
      inCity: true,
      currentLocation: 'uruc.example.sunny-plaza',
      isActionLeaseHolder: true,
      hasActionLease: true,
      currentTable: null,
      gateway: createGateway(sent),
      setLocation() {},
      setInCity() {},
    } as any;

    await hooks.handleWSCommand('uruc.example.wave@v1', wsCtx, {
      id: 'wave-1',
      type: 'uruc.example.wave@v1',
      payload: {},
    });

    expect(sent).toContainEqual({
      id: 'wave-1',
      type: 'result',
      payload: {
        ok: true,
        pluginId: 'uruc.example',
        message: 'hello from sunny plaza',
      },
    });

    await host.disablePlugin('uruc.example');

    expect(hooks.hasLocation('uruc.example.sunny-plaza')).toBe(false);
    expect(hooks.hasWSCommand('uruc.example.wave@v1')).toBe(false);

    await host.enablePlugin('uruc.example');

    expect(hooks.hasLocation('uruc.example.sunny-plaza')).toBe(true);
    expect(hooks.hasWSCommand('uruc.example.wave@v1')).toBe(true);

    await host.stopAll();
  });

  it('exposes resident protocol metadata on command schemas without changing dispatch behavior', async () => {
    const pluginPath = await mkdtemp(path.join(os.tmpdir(), 'uruc-resident-protocol-plugin-'));
    tempDirs.push(pluginPath);

    await createPluginPackage(pluginPath, {
      pluginId: 'uruc.protocol',
      packageName: '@uruc/plugin-protocol',
      version: '0.1.0',
      publisher: 'uruc',
      body: `import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';

export default defineBackendPlugin({
  pluginId: 'uruc.protocol',
  async setup(ctx) {
    await ctx.commands.register({
      id: 'echo',
      description: 'Return a protocol metadata fixture result.',
      inputSchema: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: { type: 'uruc.protocol.echo.request@v1' },
        receipt: { type: 'uruc.protocol.echo.receipt@v1', statuses: ['accepted', 'rejected'] },
        venue: { id: 'uruc.protocol' },
        migration: {
          currentTerm: 'command',
          removalIssue: '#4',
          note: 'Command remains the transport registration term until request declarations land.',
        },
      },
      handler: async () => ({ ok: true }),
    });
  },
});\n`,
    });

    const sent: unknown[] = [];
    const gateway = createGateway(sent);
    const { host, hooks } = await startSinglePluginHost(
      'uruc.protocol',
      '@uruc/plugin-protocol',
      pluginPath,
      (services) => {
        services.register('ws-gateway', gateway as any);
      },
    );

    const schema = hooks.getWSCommandSchema('uruc.protocol.echo@v1');
    expect(schema).toMatchObject({
      type: 'uruc.protocol.echo@v1',
      pluginName: 'uruc.protocol',
      protocol: {
        subject: 'resident',
        request: { type: 'uruc.protocol.echo.request@v1' },
        receipt: { type: 'uruc.protocol.echo.receipt@v1', statuses: ['accepted', 'rejected'] },
        venue: { id: 'uruc.protocol' },
        migration: {
          currentTerm: 'command',
          removalIssue: '#4',
        },
      },
    });

    await hooks.handleWSCommand('uruc.protocol.echo@v1', {
      ws: {},
      session: {
        userId: 'user-1',
        agentId: 'agent-1',
        agentName: 'Agent One',
        role: 'agent' as const,
        trustMode: 'full' as const,
      },
      inCity: true,
      currentLocation: null,
      isActionLeaseHolder: true,
      hasActionLease: true,
      currentTable: null,
      gateway,
      setLocation() {},
      setInCity() {},
    } as any, {
      id: 'echo-1',
      type: 'uruc.protocol.echo@v1',
      payload: {},
    });

    expect(sent.at(-1)).toEqual({
      id: 'echo-1',
      type: 'result',
      payload: { ok: true },
    });

    await host.stopAll();
  });

  it('exposes one required capability for a venue request through command discovery', async () => {
    const pluginPath = await mkdtemp(path.join(os.tmpdir(), 'uruc-capability-plugin-'));
    tempDirs.push(pluginPath);

    await createPluginPackage(pluginPath, {
      pluginId: 'uruc.capability',
      packageName: '@uruc/plugin-capability',
      version: '0.1.0',
      publisher: 'uruc',
      body: `export default {
  kind: 'uruc.backend-plugin@v2',
  pluginId: 'uruc.capability',
  apiVersion: 2,
  async setup(ctx) {
    await ctx.commands.register({
      id: 'send_dm',
      description: 'Send one direct message through the capability fixture.',
      inputSchema: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.capability.dm.send.request@v1',
          requiredCapabilities: ['uruc.capability.dm.send@v1'],
        },
        venue: { id: 'uruc.capability' },
      },
      handler: async () => ({ ok: true }),
    });
  },
};\n`,
    });

    const sent: any[] = [];
    const gateway = createGateway(sent);
    const { host, hooks } = await startSinglePluginHost(
      'uruc.capability',
      '@uruc/plugin-capability',
      pluginPath,
      (services) => {
        services.register('ws-gateway', gateway as any);
      },
    );

    expect(host.getPluginDiagnostics()).toContainEqual(expect.objectContaining({
      pluginId: 'uruc.capability',
      state: 'active',
    }));
    expect(hooks.hasWSCommand('uruc.capability.send_dm@v1')).toBe(true);

    await hooks.handleWSCommand('what_can_i_do', {
      ws: {},
      session: {
        userId: 'user-capability',
        agentId: 'agent-capability',
        agentName: 'Capability Agent',
        role: 'agent' as const,
        trustMode: 'full' as const,
      },
      inCity: true,
      currentLocation: null,
      isActionLeaseHolder: true,
      hasActionLease: true,
      currentTable: null,
      gateway,
      setLocation() {},
      setInCity() {},
    } as any, {
      id: 'discover-capability',
      type: 'what_can_i_do',
      payload: { scope: 'plugin', pluginId: 'uruc.capability' },
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'discover-capability',
      type: 'result',
      payload: {
        level: 'detail',
        commands: [
          expect.objectContaining({
            type: 'uruc.capability.send_dm@v1',
            protocol: expect.objectContaining({
              subject: 'resident',
              request: {
                type: 'uruc.capability.dm.send.request@v1',
                requiredCapabilities: ['uruc.capability.dm.send@v1'],
              },
            }),
          }),
        ],
      },
    });

    await host.stopAll();
  });

  it('exposes multiple required capabilities for one venue request through command schemas', async () => {
    const pluginPath = await mkdtemp(path.join(os.tmpdir(), 'uruc-multi-capability-plugin-'));
    tempDirs.push(pluginPath);

    await createPluginPackage(pluginPath, {
      pluginId: 'uruc.multi',
      packageName: '@uruc/plugin-multi-capability',
      version: '0.1.0',
      publisher: 'uruc',
      body: `export default {
  kind: 'uruc.backend-plugin@v2',
  pluginId: 'uruc.multi',
  apiVersion: 2,
  async setup(ctx) {
    await ctx.commands.register({
      id: 'publish_listing',
      description: 'Publish one listing through the capability fixture.',
      inputSchema: {},
      actionLeasePolicy: { required: false },
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.multi.listing.publish.request@v1',
          requiredCapabilities: [
            'uruc.multi.listing.write@v1',
            'uruc.multi.market.publish@v1',
          ],
        },
        venue: { id: 'uruc.multi' },
      },
      handler: async () => ({ ok: true }),
    });
  },
};\n`,
    });

    const { host, hooks } = await startSinglePluginHost(
      'uruc.multi',
      '@uruc/plugin-multi-capability',
      pluginPath,
    );

    expect(hooks.getWSCommandSchema('uruc.multi.publish_listing@v1')).toMatchObject({
      type: 'uruc.multi.publish_listing@v1',
      protocol: {
        subject: 'resident',
        request: {
          type: 'uruc.multi.listing.publish.request@v1',
          requiredCapabilities: [
            'uruc.multi.listing.write@v1',
            'uruc.multi.market.publish@v1',
          ],
        },
      },
    });

    await host.stopAll();
  });

  it('loads the native V2 social package and serves asset upload/download routes', async () => {
    const socialPluginPath = path.resolve(process.cwd(), '..', 'plugins', 'social');
    const { host, hooks, services, db } = await startSinglePluginHost(
      'uruc.social',
      '@uruc/plugin-social',
      socialPluginPath,
    );

    db.run(sql`
      INSERT INTO users (id, username, password_hash, email, role, banned, created_at)
      VALUES ('user-social', 'social-user', 'hash', 'social@example.com', 'user', 0, ${Date.now()})
    `);
    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-shadow', 'user-social', 'social-user', 'token-shadow', 1, 'full', '[]',
        0, NULL, NULL, 0, 1, ${Date.now() - 1}
      )
    `);
    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-social', 'user-social', 'Social Agent', 'token-social', 0, 'full', '[]',
        0, NULL, NULL, 0, 1, ${Date.now()}
      )
    `);

    const ownedAgentsReq = createHttpRequest(
      'GET',
      '/api/plugins/uruc.social/v1/owned-agents',
    );
    const ownedAgentsRes = createHttpResponse();
    const ownedAgentsHandled = await hooks.handleHttpRequest({
      req: ownedAgentsReq as any,
      res: ownedAgentsRes as any,
      path: '/api/plugins/uruc.social/v1/owned-agents',
      method: 'GET',
      session: { userId: 'user-social', role: 'user' },
      services: services as any,
    });

    expect(ownedAgentsHandled).toBe(true);
    expect(ownedAgentsRes.statusCode).toBe(200);
    expect(JSON.parse(ownedAgentsRes.bodyText)).toMatchObject({
      agents: [
        {
          agentId: 'agent-shadow',
          agentName: 'social-user',
          isShadow: true,
          frozen: false,
        },
        {
          agentId: 'agent-social',
          agentName: 'Social Agent',
          isShadow: false,
          frozen: false,
        },
      ],
    });

    const boundary = '----uruc-social-upload';
    const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const uploadBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="file"; filename="moment.png"\r\n'),
      Buffer.from('Content-Type: image/png\r\n\r\n'),
      imageBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadReq = createHttpRequest(
      'POST',
      '/api/plugins/uruc.social/v1/assets/moments?agentId=agent-social',
      {
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body: uploadBody,
      },
    );
    const uploadRes = createHttpResponse();
    const uploadHandled = await hooks.handleHttpRequest({
      req: uploadReq as any,
      res: uploadRes as any,
      path: '/api/plugins/uruc.social/v1/assets/moments',
      method: 'POST',
      session: { userId: 'user-social', role: 'user' },
      services: services as any,
    });

    expect(uploadHandled).toBe(true);
    expect(uploadRes.statusCode).toBe(200);
    const uploadPayload = JSON.parse(uploadRes.bodyText);
    expect(uploadPayload.asset.assetId).toEqual(expect.any(String));
    expect(uploadPayload.asset.url).toContain('/api/plugins/uruc.social/v1/assets/');

    const assetReq = createHttpRequest(
      'GET',
      `/api/plugins/uruc.social/v1/assets/${uploadPayload.asset.assetId}?agentId=agent-social`,
    );
    const assetRes = createHttpResponse();
    const assetHandled = await hooks.handleHttpRequest({
      req: assetReq as any,
      res: assetRes as any,
      path: `/api/plugins/uruc.social/v1/assets/${uploadPayload.asset.assetId}`,
      method: 'GET',
      session: { userId: 'user-social', role: 'user' },
      services: services as any,
    });

    expect(assetHandled).toBe(true);
    expect(assetRes.statusCode).toBe(200);
    expect(assetRes.headers['Content-Type']).toBe('image/png');
    expect(assetRes.bodyBuffer.equals(imageBytes)).toBe(true);

    await host.stopAll();
  });

  it('exposes agent-friendly command discovery for the locationless social plugin', async () => {
    const socialPluginPath = path.resolve(process.cwd(), '..', 'plugins', 'social');
    const sent: unknown[] = [];
    const agentPushes: Array<{ agentId: string; message: any }> = [];
    const gateway = createGateway(sent, agentPushes);

    const { host, hooks, db } = await startSinglePluginHost(
      'uruc.social',
      '@uruc/plugin-social',
      socialPluginPath,
      (services) => {
        services.register('ws-gateway', gateway as any);
      },
    );

    db.run(sql`
      INSERT INTO users (id, username, password_hash, email, role, banned, created_at)
      VALUES ('user-social-guide', 'social-guide-user', 'hash', 'social-guide@example.com', 'user', 0, ${Date.now()})
    `);
    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-social-guide', 'user-social-guide', 'Social Guide Agent', 'token-social-guide', 1, 'full', '[]',
        1, 'guide runner', NULL, 0, 1, ${Date.now()}
      )
    `);

    const wsCtx = {
      ws: {},
      session: {
        userId: 'user-social-guide',
        agentId: 'agent-social-guide',
        agentName: 'Social Guide Agent',
        role: 'agent' as const,
        trustMode: 'full' as const,
      },
      inCity: true,
      currentLocation: null,
      isActionLeaseHolder: true,
      hasActionLease: true,
      currentTable: null,
      gateway,
      setLocation() {},
      setInCity() {},
    } as any;

    await hooks.runAfterHook('agent.authenticated', {
      session: wsCtx.session,
      ctx: wsCtx,
      bootstrapData: {},
    });

    expect(agentPushes.find((entry) => entry.agentId === 'agent-social-guide' && entry.message.type === 'social_welcome')).toBeUndefined();

    const availableCommands = hooks.getAvailableWSCommandSchemas(wsCtx);
    expect(availableCommands.find((command) => command.type === 'uruc.social.social_intro@v1')).toMatchObject({
      actionLeasePolicy: {
        required: false,
      },
    });
    expect(availableCommands.find((command) => command.type === 'uruc.social.get_usage_guide@v1')).toBeTruthy();
    expect(availableCommands.find((command) => command.type === 'uruc.social.request_data_erasure@v1')).toMatchObject({
      confirmationPolicy: {
        required: true,
      },
    });
    expect(availableCommands.find((command) => command.type === 'uruc.social.send_request@v1')).toMatchObject({
      locationPolicy: {
        scope: 'any',
      },
      params: {
        agentId: expect.objectContaining({
          required: true,
          description: expect.stringContaining('friend'),
        }),
      },
    });
    expect(availableCommands.find((command) => command.type === 'uruc.social.list_moment_comments@v1')).toBeTruthy();
    expect(availableCommands.find((command) => command.type === 'uruc.social.set_moment_like@v1')).toBeTruthy();
    expect(availableCommands.find((command) => command.type === 'uruc.social.create_moment_comment@v1')).toBeTruthy();
    expect(availableCommands.find((command) => command.type === 'uruc.social.delete_moment_comment@v1')).toBeTruthy();
    expect(availableCommands.find((command) => command.type === 'uruc.social.list_moment_notifications@v1')).toBeTruthy();
    expect(availableCommands.find((command) => command.type === 'uruc.social.mark_moment_notifications_read@v1')).toBeTruthy();

    await hooks.handleWSCommand('uruc.social.social_intro@v1', wsCtx, {
      id: 'intro-1',
      type: 'uruc.social.social_intro@v1',
      payload: {},
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'intro-1',
      type: 'result',
      payload: {
        pluginId: 'uruc.social',
        summary: expect.stringContaining('Uruc Social'),
        firstCommands: expect.arrayContaining([
          'uruc.social.list_relationships_page@v1',
          'uruc.social.list_inbox@v1',
        ]),
      },
    });

    await hooks.handleWSCommand('uruc.social.get_usage_guide@v1', wsCtx, {
      id: 'guide-1',
      type: 'uruc.social.get_usage_guide@v1',
      payload: {},
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'guide-1',
      type: 'result',
      payload: {
        pluginId: 'uruc.social',
        guide: expect.objectContaining({
          summary: expect.stringContaining('Uruc Social'),
          coreRules: expect.arrayContaining([
            expect.stringContaining('Direct threads'),
          ]),
          firstSteps: expect.arrayContaining([
            expect.stringContaining('uruc.social.list_relationships@v1'),
          ]),
        }),
      },
    });

    await host.stopAll();
  });

  it('returns hierarchical discovery through what_can_i_do for city and plugin command groups', async () => {
    const socialPluginPath = path.resolve(process.cwd(), '..', 'plugins', 'social');
    const sent: any[] = [];
    const gateway = createGateway(sent);

    const { host, hooks, db } = await startSinglePluginHost(
      'uruc.social',
      '@uruc/plugin-social',
      socialPluginPath,
      (services) => {
        services.register('ws-gateway', gateway as any);
      },
    );

    db.run(sql`
      INSERT INTO users (id, username, password_hash, email, role, banned, created_at)
      VALUES ('user-social-discovery', 'socialdiscovery', 'hash', 'social-discovery@example.com', 'user', 0, ${Date.now()})
    `);
    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-social-discovery', 'user-social-discovery', 'Social Discovery Agent', 'token-social-discovery', 1, 'full', '[]',
        1, 'guide runner', NULL, 0, 1, ${Date.now()}
      )
    `);

    const wsCtx = {
      ws: {},
      session: {
        userId: 'user-social-discovery',
        agentId: 'agent-social-discovery',
        agentName: 'Social Discovery Agent',
        role: 'agent' as const,
        trustMode: 'full' as const,
      },
      inCity: true,
      currentLocation: null,
      isActionLeaseHolder: true,
      hasActionLease: true,
      currentTable: null,
      gateway,
      setLocation() {},
      setInCity() {},
    } as any;

    await hooks.handleWSCommand('what_can_i_do', wsCtx, {
      id: 'discover-root',
      type: 'what_can_i_do',
      payload: {},
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'discover-root',
      type: 'result',
      payload: {
        citytime: expect.any(Number),
        level: 'summary',
        groups: expect.arrayContaining([
          expect.objectContaining({
            scope: 'city',
            label: 'city',
          }),
          expect.objectContaining({
            scope: 'plugin',
            pluginId: 'uruc.social',
            label: 'uruc.social',
          }),
        ]),
        detailQueries: expect.arrayContaining([
          { scope: 'city' },
          { scope: 'plugin', pluginId: 'uruc.social' },
        ]),
      },
    });

    await hooks.handleWSCommand('what_can_i_do', wsCtx, {
      id: 'discover-plugin',
      type: 'what_can_i_do',
      payload: { scope: 'plugin', pluginId: 'uruc.social' },
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'discover-plugin',
      type: 'result',
      payload: {
        citytime: expect.any(Number),
        level: 'detail',
        target: { scope: 'plugin', pluginId: 'uruc.social' },
        commands: expect.arrayContaining([
          expect.objectContaining({
            type: 'uruc.social.social_intro@v1',
          }),
          expect.objectContaining({
            type: 'uruc.social.get_usage_guide@v1',
          }),
        ]),
      },
    });

    await hooks.handleWSCommand('what_can_i_do', wsCtx, {
      id: 'discover-city',
      type: 'what_can_i_do',
      payload: { scope: 'city' },
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'discover-city',
      type: 'result',
      payload: {
        citytime: expect.any(Number),
        level: 'detail',
        target: { scope: 'city' },
        commands: expect.arrayContaining([
          expect.objectContaining({ type: 'what_state_am_i' }),
          expect.objectContaining({ type: 'where_can_i_go' }),
          expect.objectContaining({ type: 'what_can_i_do' }),
          expect.objectContaining({ type: 'acquire_action_lease' }),
        ]),
      },
    });

    await host.stopAll();
  });

  it('searches discoverable social contacts by agentId through the real host search pipeline', async () => {
    const socialPluginPath = path.resolve(process.cwd(), '..', 'plugins', 'social');
    const sent: any[] = [];
    const gateway = createGateway(sent);

    const { host, hooks, db } = await startSinglePluginHost(
      'uruc.social',
      '@uruc/plugin-social',
      socialPluginPath,
      (services) => {
        services.register('ws-gateway', gateway as any);
      },
    );

    db.run(sql`
      INSERT INTO users (id, username, password_hash, email, role, banned, created_at)
      VALUES ('user-searcher', 'searcher', 'hash', 'searcher@example.com', 'user', 0, ${Date.now() - 3})
    `);
    db.run(sql`
      INSERT INTO users (id, username, password_hash, email, role, banned, created_at)
      VALUES ('user-alpha', 'alpha', 'hash', 'alpha@example.com', 'user', 0, ${Date.now() - 2})
    `);
    db.run(sql`
      INSERT INTO users (id, username, password_hash, email, role, banned, created_at)
      VALUES ('user-beta', 'beta', 'hash', 'beta@example.com', 'user', 0, ${Date.now() - 1})
    `);

    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-searcher', 'user-searcher', 'Searcher', 'token-searcher', 1, 'full', '[]',
        1, 'search runner', NULL, 0, 1, ${Date.now() - 3}
      )
    `);
    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-duplicate-alpha', 'user-alpha', 'Mirror', 'token-alpha', 1, 'full', '[]',
        0, 'first mirror', NULL, 0, 1, ${Date.now() - 2}
      )
    `);
    db.run(sql`
      INSERT INTO agents (
        id, user_id, name, token, is_shadow, trust_mode, allowed_locations,
        is_online, description, avatar_path, frozen, searchable, created_at
      ) VALUES (
        'agent-duplicate-beta', 'user-beta', 'Mirror', 'token-beta', 1, 'full', '[]',
        0, 'second mirror', NULL, 0, 1, ${Date.now() - 1}
      )
    `);

    const wsCtx = {
      ws: {},
      session: {
        userId: 'user-searcher',
        agentId: 'agent-searcher',
        agentName: 'Searcher',
        role: 'agent' as const,
        trustMode: 'full' as const,
      },
      inCity: true,
      currentLocation: null,
      isActionLeaseHolder: true,
      hasActionLease: true,
      currentTable: null,
      gateway,
      setLocation() {},
      setInCity() {},
    } as any;

    await hooks.handleWSCommand('uruc.social.search_contacts@v1', wsCtx, {
      id: 'search-1',
      type: 'uruc.social.search_contacts@v1',
      payload: { query: 'agent-duplicate-beta', limit: 10 },
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'search-1',
      type: 'result',
      payload: {
        results: [
          expect.objectContaining({
            agentId: 'agent-duplicate-beta',
            agentName: 'Mirror',
            description: 'second mirror',
          }),
        ],
      },
    });

    await host.stopAll();
  });

});
