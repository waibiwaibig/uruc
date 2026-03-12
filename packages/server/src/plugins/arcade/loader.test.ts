import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { ArcadeGameDiscovery } from './discovery.js';
import { ArcadeGameLoader } from './loader.js';
import { ArcadeGameRegistry } from './registry.js';

const createdDirs: string[] = [];

async function createTempArcadeRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arcade-loader-'));
  createdDirs.push(dir);
  await fs.mkdir(path.join(dir, 'games'), { recursive: true });
  return dir;
}

async function writeGame(
  rootDir: string,
  id: string,
  options?: {
    baseDir?: string;
    dependencies?: string[];
    apiVersion?: string;
    version?: string;
    exportCode?: string;
  },
): Promise<void> {
  const gameDir = path.join(rootDir, options?.baseDir ?? 'games', id);
  await fs.mkdir(gameDir, { recursive: true });
  await fs.writeFile(
    path.join(gameDir, 'game.json'),
    JSON.stringify({
      id,
      name: id,
      version: options?.version ?? '1.0.0',
      description: `${id} game`,
      main: './index.js',
      apiVersion: options?.apiVersion ?? '1.0.0',
      dependencies: options?.dependencies ?? [],
    }),
    'utf-8',
  );
  await fs.writeFile(
    path.join(gameDir, 'index.js'),
    options?.exportCode ?? `
export default class ${id[0].toUpperCase()}${id.slice(1)}Game {
  constructor() {
    this.id = '${id}';
    this.version = '${options?.version ?? '1.0.0'}';
    this.apiVersion = '1.0.0';
    this.dependencies = ${JSON.stringify(options?.dependencies ?? [])};
    this.catalog = {
      name: '${id}',
      description: '${id}',
      minPlayers: 1,
      maxPlayers: 2,
      tags: [],
      capabilities: {
        reconnect: false,
        reconnectGraceMs: 0,
        minPlayersToContinue: 1,
        spectators: false,
        midGameJoin: false
      }
    };
  }
  init() {
    globalThis.__arcadeInitOrder = [...(globalThis.__arcadeInitOrder ?? []), '${id}'];
  }
  start() {
    globalThis.__arcadeStartOrder = [...(globalThis.__arcadeStartOrder ?? []), '${id}'];
  }
  createSession() {
    return {
      status: 'waiting',
      onJoin() { return { ok: true }; },
      onLeave() { return { keepSlot: false }; },
      onAction() { return { ok: true, data: {} }; },
      getState() { return { status: 'waiting', players: [] }; },
      getActionSchema() { return []; },
      dispose() {}
    };
  }
}
`,
    'utf-8',
  );
}

afterEach(async () => {
  delete (globalThis as any).__arcadeInitOrder;
  delete (globalThis as any).__arcadeStartOrder;
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

describe('ArcadeGameLoader', () => {
  it('loads games in dependency order', async () => {
    const rootDir = await createTempArcadeRoot();
    await writeGame(rootDir, 'base');
    await writeGame(rootDir, 'dependent', { dependencies: ['base'] });

    await fs.writeFile(
      path.join(rootDir, 'games.dev.json'),
      JSON.stringify({
        games: {
          base: { enabled: true, autoLoad: true },
          dependent: { enabled: true, autoLoad: true },
        },
        discovery: {
          enabled: true,
          paths: ['./games'],
          exclude: [],
        },
      }),
      'utf-8',
    );

    const registry = new ArcadeGameRegistry();
    const loader = new ArcadeGameLoader(
      new ArcadeGameDiscovery(path.join(rootDir, 'games.dev.json'), rootDir),
      registry,
    );

    await loader.discoverAndLoadAll({
      logger: { async log() {} },
      clock: {
        now: () => Date.now(),
        setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
        clearTimeout: (timer) => {
          if (timer) clearTimeout(timer);
        },
      },
    });

    expect(registry.list().map((item) => item.id)).toEqual(['base', 'dependent']);
    expect((globalThis as any).__arcadeInitOrder).toEqual(['base', 'dependent']);
    expect(loader.getDiagnostics().every((item) => item.state === 'started')).toBe(true);
  });

  it('isolates invalid and circular games without crashing the loader', async () => {
    const rootDir = await createTempArcadeRoot();
    await writeGame(rootDir, 'good');
    await writeGame(rootDir, 'broken', {
      exportCode: `export default { id: 'broken', version: '1.0.0', apiVersion: '1.0.0', catalog: { name: 'broken' } };`,
    });
    await writeGame(rootDir, 'cycle-a', { dependencies: ['cycle-b'] });
    await writeGame(rootDir, 'cycle-b', { dependencies: ['cycle-a'] });

    await fs.writeFile(
      path.join(rootDir, 'games.dev.json'),
      JSON.stringify({
        games: {
          good: { enabled: true, autoLoad: true },
          broken: { enabled: true, autoLoad: true },
          'cycle-a': { enabled: true, autoLoad: true },
          'cycle-b': { enabled: true, autoLoad: true },
        },
        discovery: {
          enabled: true,
          paths: ['./games'],
          exclude: [],
        },
      }),
      'utf-8',
    );

    const registry = new ArcadeGameRegistry();
    const loader = new ArcadeGameLoader(
      new ArcadeGameDiscovery(path.join(rootDir, 'games.dev.json'), rootDir),
      registry,
    );

    await loader.discoverAndLoadAll({
      logger: { async log() {} },
      clock: {
        now: () => Date.now(),
        setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
        clearTimeout: (timer) => {
          if (timer) clearTimeout(timer);
        },
      },
    });

    const diagnostics = loader.getDiagnostics();
    expect(diagnostics.find((item) => item.name === 'good')?.state).toBe('started');
    expect(diagnostics.find((item) => item.name === 'broken')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.name === 'cycle-a')?.state).toBe('failed');
    expect(diagnostics.find((item) => item.name === 'cycle-b')?.state).toBe('failed');
  });

  it('prefers the first configured discovery path for duplicate game ids', async () => {
    const rootDir = await createTempArcadeRoot();
    await fs.mkdir(path.join(rootDir, 'dist-games'), { recursive: true });

    await writeGame(rootDir, 'blackjack', {
      baseDir: 'dist-games',
      version: '9.9.9',
    });
    await writeGame(rootDir, 'blackjack', {
      baseDir: 'games',
      version: '1.0.0',
    });

    await fs.writeFile(
      path.join(rootDir, 'games.dev.json'),
      JSON.stringify({
        games: {
          blackjack: { enabled: true, autoLoad: true },
        },
        discovery: {
          enabled: true,
          paths: ['./dist-games', './games'],
          exclude: [],
        },
      }),
      'utf-8',
    );

    const registry = new ArcadeGameRegistry();
    const loader = new ArcadeGameLoader(
      new ArcadeGameDiscovery(path.join(rootDir, 'games.dev.json'), rootDir),
      registry,
    );

    await loader.discoverAndLoadAll({
      logger: { async log() {} },
      clock: {
        now: () => Date.now(),
        setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
        clearTimeout: (timer) => {
          if (timer) clearTimeout(timer);
        },
      },
    });

    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.version).toBe('9.9.9');
    expect(loader.getDiagnostics().find((item) => item.name === 'blackjack')?.state).toBe('started');
  });
});
