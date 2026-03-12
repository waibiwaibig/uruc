import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

import { getPackageRoot } from '../../runtime-paths.js';
import type {
  ArcadeGameConfig,
  ArcadeGameDefinition,
  ArcadeGameDiscoveryConfig,
  ArcadeGameManifest,
  ArcadeGamesConfigFile,
} from './types.js';

export function getArcadeGameConfigFilename(env: string = process.env.NODE_ENV ?? 'development'): string {
  return env === 'production' ? 'games.prod.json' : 'games.dev.json';
}

function getArcadePluginRoot(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

export function getArcadeGameConfigPath(
  pluginRoot: string = getArcadePluginRoot(),
  packageRoot: string = getPackageRoot(),
): string {
  const override = process.env.ARCADE_GAME_CONFIG_PATH;
  if (override && override.trim() !== '') {
    return path.isAbsolute(override) ? override : path.resolve(packageRoot, override);
  }
  return path.join(pluginRoot, getArcadeGameConfigFilename());
}

function defaultDiscoveryConfig(): ArcadeGameDiscoveryConfig {
  return {
    enabled: true,
    paths: ['./games'],
    exclude: ['__tests__', 'node_modules', '*.test.ts', '*.spec.ts', '*.test.js', '*.spec.js'],
  };
}

export class ArcadeGameDiscovery {
  private readonly packageRoot: string;
  private readonly configPath: string;
  private readonly configDir: string;
  private readonly gameConfigs = new Map<string, ArcadeGameConfig>();
  private discoveryConfig: ArcadeGameDiscoveryConfig = defaultDiscoveryConfig();

  constructor(configPath: string = getArcadeGameConfigPath(), packageRoot: string = getPackageRoot()) {
    this.packageRoot = path.resolve(packageRoot);
    this.configPath = path.isAbsolute(configPath) ? configPath : path.resolve(this.packageRoot, configPath);
    this.configDir = path.dirname(this.configPath);
  }

  async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(content) as ArcadeGamesConfigFile;

      this.gameConfigs.clear();
      for (const [id, gameConfig] of Object.entries(config.games ?? {})) {
        this.gameConfigs.set(id, gameConfig);
      }

      if (config.discovery) {
        this.discoveryConfig = config.discovery;
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw new Error(`Failed to load arcade game config: ${error.message}`);
    }
  }

  isEnabled(gameId: string): boolean {
    return this.gameConfigs.get(gameId)?.enabled ?? true;
  }

  shouldAutoLoad(gameId: string): boolean {
    return this.gameConfigs.get(gameId)?.autoLoad ?? true;
  }

  getResolvedSearchPaths(): string[] {
    return this.discoveryConfig.paths.map((entry) =>
      path.isAbsolute(entry) ? entry : path.resolve(this.configDir, entry),
    );
  }

  async discoverGames(): Promise<Map<string, ArcadeGameManifest>> {
    const discovered = new Map<string, ArcadeGameManifest>();
    if (!this.discoveryConfig.enabled) {
      return discovered;
    }

    for (const searchPath of this.getResolvedSearchPaths()) {
      if (!existsSync(searchPath)) {
        continue;
      }

      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (this.discoveryConfig.exclude.includes(entry.name)) continue;

        const absolutePath = path.join(searchPath, entry.name);
        const manifestPath = path.join(absolutePath, 'game.json');
        if (!existsSync(manifestPath)) continue;

        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(content) as ArcadeGameManifest;
          manifest.absolutePath = absolutePath;
          if (discovered.has(manifest.id)) {
            continue;
          }
          discovered.set(manifest.id, manifest);
        } catch (error: any) {
          throw new Error(`Failed to read game manifest from ${manifestPath}: ${error.message}`);
        }
      }
    }

    return discovered;
  }

  getStaleConfiguredGames(discovered: Map<string, ArcadeGameManifest>): string[] {
    return Array.from(this.gameConfigs.keys()).filter((name) => !discovered.has(name));
  }

  async loadGameInstance(manifest: ArcadeGameManifest): Promise<ArcadeGameDefinition> {
    if (!manifest.absolutePath) {
      throw new Error(`Game '${manifest.id}' has no absolute path`);
    }

    let mainPath = path.join(manifest.absolutePath, manifest.main);
    if (!existsSync(mainPath)) {
      const alternate = mainPath.endsWith('.ts')
        ? mainPath.replace(/\.ts$/, '.js')
        : mainPath.endsWith('.js')
          ? mainPath.replace(/\.js$/, '.ts')
          : null;
      if (alternate && existsSync(alternate)) {
        mainPath = alternate;
      } else {
        throw new Error(`Game entry point not found: ${mainPath}`);
      }
    }

    const module = await import(mainPath);
    const exported = module.default ?? this.findGameExport(module);

    const instance = typeof exported === 'function'
      ? this.instantiateExport(exported)
      : exported;

    if (!isArcadeGameDefinition(instance)) {
      throw new Error(
        `Game '${manifest.id}' does not export a valid game definition ` +
        `(must expose id, version, apiVersion, catalog, init, createSession)`,
      );
    }

    return instance;
  }

  private instantiateExport(exported: (...args: never[]) => unknown): unknown {
    try {
      return new (exported as unknown as new () => unknown)();
    } catch {
      return exported();
    }
  }

  private findGameExport(module: Record<string, unknown>): unknown {
    for (const key of Object.keys(module)) {
      const value = module[key];
      if (isArcadeGameDefinition(value)) return value;
      if (typeof value === 'function' && (key.includes('Game') || key.includes('Machine'))) {
        return value;
      }
    }
    return undefined;
  }
}

function isArcadeGameDefinition(value: unknown): value is ArcadeGameDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArcadeGameDefinition>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.version === 'string' &&
    typeof candidate.apiVersion === 'string' &&
    typeof candidate.init === 'function' &&
    typeof candidate.createSession === 'function' &&
    !!candidate.catalog &&
    typeof candidate.catalog.name === 'string'
  );
}
