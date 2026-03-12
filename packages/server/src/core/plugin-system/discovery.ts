import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import type { Plugin } from './plugin-interface.js';

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Entry point file relative to plugin dir (e.g. 'index.js') */
  main: string;
  dependencies?: string[];
  category?: string;
  tags?: string[];
  /** Absolute path to the plugin directory (populated during discovery) */
  absolutePath?: string;
}

export interface PluginConfig {
  enabled: boolean;
  autoLoad: boolean;
}

export interface DiscoveryConfig {
  enabled: boolean;
  paths: string[];
  exclude: string[];
}

export interface PluginsConfigFile {
  plugins: Record<string, PluginConfig>;
  discovery: DiscoveryConfig;
}

export function getDefaultPluginConfigFilename(env: string = process.env.NODE_ENV ?? 'development'): string {
  return env === 'production' ? 'plugins.prod.json' : 'plugins.dev.json';
}

export function getDefaultPluginConfigPath(rootDir: string = process.cwd()): string {
  return path.join(path.resolve(rootDir), getDefaultPluginConfigFilename());
}

export class PluginDiscovery {
  private configPath: string;
  private pluginsConfig: Map<string, PluginConfig> = new Map();
  private discoveryConfig: DiscoveryConfig = {
    enabled: true,
    paths: ['./src/plugins'],
    exclude: ['__tests__', 'node_modules'],
  };
  private rootDir: string;

  constructor(configPath: string = getDefaultPluginConfigPath(), rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    this.configPath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(this.rootDir, configPath);
  }

  async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const config: PluginsConfigFile = JSON.parse(content);

      this.pluginsConfig.clear();
      for (const [name, pluginConfig] of Object.entries(config.plugins)) {
        this.pluginsConfig.set(name, pluginConfig);
      }

      if (config.discovery) {
        this.discoveryConfig = config.discovery;
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`Plugin config file not found: ${this.configPath}, using defaults`);
      } else {
        throw new Error(`Failed to load plugin config: ${error.message}`);
      }
    }
  }

  async saveConfig(): Promise<void> {
    const config: PluginsConfigFile = {
      plugins: Object.fromEntries(this.pluginsConfig),
      discovery: this.discoveryConfig,
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Discover all plugins by scanning configured directories for plugin.json files.
   * Each discovered plugin has its absolutePath populated.
   */
  async discoverPlugins(): Promise<Map<string, PluginMetadata>> {
    const discovered = new Map<string, PluginMetadata>();

    if (!this.discoveryConfig.enabled) {
      return discovered;
    }

    for (const absolutePath of this.getResolvedSearchPaths()) {
      if (!existsSync(absolutePath)) {
        console.warn(`⚠ Plugin search path does not exist: ${absolutePath}`);
        continue;
      }

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (this.discoveryConfig.exclude.includes(entry.name)) continue;

        const pluginDir = path.join(absolutePath, entry.name);
        const metadataPath = path.join(pluginDir, 'plugin.json');

        if (existsSync(metadataPath)) {
          try {
            const content = await fs.readFile(metadataPath, 'utf-8');
            const metadata: PluginMetadata = JSON.parse(content);
            metadata.absolutePath = pluginDir;
            discovered.set(metadata.name, metadata);
          } catch (error: any) {
            console.error(`Failed to read plugin metadata from ${metadataPath}: ${error.message}`);
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Dynamically import and instantiate a plugin from its metadata.
   * The plugin module must have a default export class or a named export that implements Plugin.
   */
  async loadPluginInstance(metadata: PluginMetadata): Promise<Plugin> {
    if (!metadata.absolutePath) {
      throw new Error(`Plugin '${metadata.name}' has no absolutePath — was it discovered?`);
    }
    if (!metadata.main || typeof metadata.main !== 'string') {
      throw new Error(`Plugin '${metadata.name}' is missing required 'main' in plugin.json`);
    }

    let mainPath = path.join(metadata.absolutePath, metadata.main);

    // Dev/prod fallback: try swapping .ts ↔ .js if exact path doesn't exist
    if (!existsSync(mainPath)) {
      const alt = mainPath.endsWith('.ts')
        ? mainPath.replace(/\.ts$/, '.js')
        : mainPath.endsWith('.js')
          ? mainPath.replace(/\.js$/, '.ts')
          : null;
      if (alt && existsSync(alt)) {
        mainPath = alt;
      } else {
        throw new Error(`Plugin entry point not found: ${mainPath}` +
          (alt ? ` (also tried ${path.basename(alt)})` : ''));
      }
    }

    const module = await import(mainPath);

    // Try default export first, then any named export that looks like a Plugin class
    const PluginClass = module.default || findPluginClass(module);

    if (!PluginClass) {
      throw new Error(
        `Plugin '${metadata.name}' at ${mainPath} does not export a Plugin class. ` +
        `Expected a default export or a named export with init() and name properties.`
      );
    }

    // Instantiate — support both class constructors and factory functions
    if (typeof PluginClass === 'function') {
      try {
        const instance = new PluginClass();
        if (isPlugin(instance)) return instance;
      } catch {
        // Not a constructor — try as factory
        const instance = PluginClass();
        if (isPlugin(instance)) return instance;
      }
    }

    // Maybe the export IS the plugin instance already
    if (isPlugin(PluginClass)) return PluginClass;

    throw new Error(
      `Plugin '${metadata.name}' at ${mainPath}: exported value is not a valid Plugin ` +
      `(must have name, version, and init function)`
    );
  }

  /**
   * Check if a plugin is enabled.
   * Plugins not in config are enabled by default (discovered = enabled).
   */
  isEnabled(pluginName: string): boolean {
    const config = this.pluginsConfig.get(pluginName);
    // Default: enabled if not explicitly configured
    return config?.enabled ?? true;
  }

  shouldAutoLoad(pluginName: string): boolean {
    const config = this.pluginsConfig.get(pluginName);
    return config?.autoLoad ?? true;
  }

  async setEnabled(pluginName: string, enabled: boolean): Promise<void> {
    const existing = this.pluginsConfig.get(pluginName) || { enabled: false, autoLoad: true };
    this.pluginsConfig.set(pluginName, { ...existing, enabled });
    await this.saveConfig();
  }

  async setAutoLoad(pluginName: string, autoLoad: boolean): Promise<void> {
    const existing = this.pluginsConfig.get(pluginName) || { enabled: true, autoLoad: false };
    this.pluginsConfig.set(pluginName, { ...existing, autoLoad });
    await this.saveConfig();
  }

  async installPlugin(sourcePath: string, targetDir?: string): Promise<string> {
    const metadataPath = path.join(sourcePath, 'plugin.json');

    if (!existsSync(metadataPath)) {
      throw new Error(`No plugin.json found in ${sourcePath}`);
    }

    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata: PluginMetadata = JSON.parse(content);

    const target = targetDir || this.discoveryConfig.paths[0];
    const targetPath = path.resolve(this.rootDir, target, metadata.name);

    if (existsSync(targetPath)) {
      throw new Error(`Plugin ${metadata.name} already exists at ${targetPath}`);
    }

    await this.copyDirectory(sourcePath, targetPath);

    // 添加到配置
    this.pluginsConfig.set(metadata.name, { enabled: true, autoLoad: true });
    await this.saveConfig();

    return targetPath;
  }

  async uninstallPlugin(pluginName: string, hard: boolean = false): Promise<void> {
    if (hard) {
      for (const searchPath of this.discoveryConfig.paths) {
        const pluginPath = path.resolve(this.rootDir, searchPath, pluginName);
        if (existsSync(pluginPath)) {
          await fs.rm(pluginPath, { recursive: true, force: true });
          console.log(`Deleted plugin directory: ${pluginPath}`);
        }
      }
      this.pluginsConfig.delete(pluginName);
    } else {
      await this.setEnabled(pluginName, false);
    }

    await this.saveConfig();
  }

  getAllConfigs(): Map<string, PluginConfig> {
    return new Map(this.pluginsConfig);
  }

  getConfiguredPluginNames(): string[] {
    return Array.from(this.pluginsConfig.keys());
  }

  getResolvedSearchPaths(): string[] {
    return this.discoveryConfig.paths.map((searchPath) => this.resolveSearchPath(searchPath));
  }

  getStaleConfiguredPlugins(discovered: Map<string, PluginMetadata>): string[] {
    const stale: string[] = [];
    for (const name of this.pluginsConfig.keys()) {
      if (!discovered.has(name)) stale.push(name);
    }
    return stale;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private resolveSearchPath(searchPath: string): string {
    const resolved = path.resolve(this.rootDir, searchPath);
    const distCandidate = maybeResolveDistPluginPath(this.rootDir, resolved);
    if (distCandidate) return distCandidate;
    return resolved;
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

// =============================================
// Helpers
// =============================================

function isPlugin(obj: any): obj is Plugin {
  return obj &&
    typeof obj.name === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.init === 'function';
}

function findPluginClass(module: Record<string, any>): any {
  for (const key of Object.keys(module)) {
    const val = module[key];
    if (typeof val === 'function') {
      // Heuristic: class prototype with init method
      const proto = val.prototype;
      if (proto && typeof proto.init === 'function') return val;
    }
  }
  return null;
}

function runningCompiledRuntime(): boolean {
  const override = process.env.URUC_PLUGIN_RUNTIME;
  if (override === 'dist') return true;
  if (override === 'src') return false;
  return fileURLToPath(import.meta.url).includes(`${path.sep}dist${path.sep}`);
}

function maybeResolveDistPluginPath(rootDir: string, resolvedPath: string): string | null {
  if (!runningCompiledRuntime()) return null;

  const srcPluginsRoot = path.join(rootDir, 'src', 'plugins');
  const relative = path.relative(srcPluginsRoot, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

  const distCandidate = path.join(rootDir, 'dist', 'plugins', relative);
  return existsSync(distCandidate) ? distCandidate : null;
}
