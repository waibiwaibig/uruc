import type { Plugin, PluginContext } from './plugin-interface.js';
import { PluginDiscovery, type PluginMetadata } from './discovery.js';

interface PluginEntry {
  plugin: Plugin;
  initialized: boolean;
  started: boolean;
  metadata?: PluginMetadata;
}

export type PluginDiagnosticState = 'loaded' | 'initialized' | 'started' | 'skipped' | 'failed';

export interface PluginDiagnostic {
  name: string;
  version?: string;
  state: PluginDiagnosticState;
  reason?: string;
}

export class PluginLoader {
  private plugins = new Map<string, PluginEntry>();
  private diagnostics = new Map<string, PluginDiagnostic>();
  private discovery?: PluginDiscovery;
  private initOrder: string[] = [];

  constructor(discovery?: PluginDiscovery) {
    this.discovery = discovery;
  }

  /**
   * Manual registration (backward compat).
   */
  register(plugin: Plugin, metadata?: PluginMetadata): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this.plugins.set(plugin.name, {
      plugin,
      initialized: false,
      started: false,
      metadata,
    });
    this.setDiagnostic(plugin.name, {
      name: plugin.name,
      version: plugin.version,
      state: 'loaded',
    });
  }

  /**
   * Auto-discover, load, and register all enabled plugins from the file system.
   * This replaces manual imports and register() calls.
   */
  async discoverAndRegisterAll(): Promise<string[]> {
    if (!this.discovery) {
      throw new Error('PluginLoader: no PluginDiscovery instance provided');
    }

    await this.discovery.loadConfig();
    const discovered = await this.discovery.discoverPlugins();
    const loaded: string[] = [];

    for (const staleName of this.discovery.getStaleConfiguredPlugins(discovered)) {
      this.setDiagnostic(staleName, {
        name: staleName,
        state: 'skipped',
        reason: 'configured but not found on disk',
      });
      console.warn(`  ⚠ Plugin '${staleName}' is configured but missing on disk`);
    }

    for (const [name, metadata] of discovered) {
      // Skip disabled plugins
      if (!this.discovery.isEnabled(name)) {
        this.setDiagnostic(name, {
          name,
          version: metadata.version,
          state: 'skipped',
          reason: 'disabled in config',
        });
        console.log(`  ⏭ Plugin '${name}' is disabled, skipping`);
        continue;
      }

      // Skip plugins with autoLoad: false (they must be loaded manually)
      if (!this.discovery.shouldAutoLoad(name)) {
        this.setDiagnostic(name, {
          name,
          version: metadata.version,
          state: 'skipped',
          reason: 'autoLoad=false in config',
        });
        console.log(`  ⏭ Plugin '${name}' has autoLoad disabled, skipping`);
        continue;
      }

      // Skip already registered (manual registration takes precedence)
      if (this.plugins.has(name)) {
        this.setDiagnostic(name, {
          name,
          version: metadata.version,
          state: 'skipped',
          reason: 'already registered',
        });
        console.log(`  ⏭ Plugin '${name}' already registered, skipping discovery`);
        continue;
      }

      try {
        const plugin = await this.discovery.loadPluginInstance(metadata);
        this.register(plugin, metadata);
        loaded.push(name);
        console.log(`  ✓ Plugin '${name}' v${metadata.version} loaded`);
      } catch (error: any) {
        this.setDiagnostic(name, {
          name,
          version: metadata.version,
          state: 'failed',
          reason: `load failed: ${error.message}`,
        });
        console.error(`  ✗ Failed to load plugin '${name}': ${error.message}`);
      }
    }

    return loaded;
  }

  /**
   * Auto-discover, register, init all, and start all plugins.
   * One-shot convenience method for the entry point.
   */
  async discoverAndLoadAll(ctx: PluginContext): Promise<void> {
    console.log('🔌 Discovering plugins...');
    const loaded = await this.discoverAndRegisterAll();
    console.log(`   Found ${loaded.length} plugin(s) loaded into runtime\n`);

    console.log('🔌 Initializing plugins...');
    await this.initAll(ctx);
    console.log('   Plugin initialization phase complete\n');

    console.log('🔌 Starting plugins...');
    await this.startAll();
    console.log('   Plugin start phase complete\n');

    const failed = this.getPluginDiagnostics().filter((d) => d.state === 'failed');
    if (failed.length > 0) {
      console.warn(`⚠ ${failed.length} plugin(s) failed: ${failed.map((item) => item.name).join(', ')}`);
    }
  }

  /**
   * Initialize all registered plugins in dependency order.
   */
  async initAll(ctx: PluginContext): Promise<void> {
    const dependencyBlocked = this.resolveDependencyBlocks();
    for (const [name, reason] of dependencyBlocked.entries()) {
      this.setDiagnostic(name, {
        name,
        version: this.plugins.get(name)?.plugin.version,
        state: 'failed',
        reason,
      });
      console.error(`  ✗ Skipping '${name}': ${reason}`);
    }

    const candidates = Array.from(this.plugins.keys()).filter((name) => !dependencyBlocked.has(name));
    const sorted = this.topologicalSort(candidates);
    this.initOrder = sorted;

    for (const name of sorted) {
      const entry = this.plugins.get(name)!;
      if (entry.initialized) continue;

      // Verify dependencies are initialized
      const deps = entry.plugin.dependencies || [];
      const unmet = deps.find((dep) => !this.plugins.get(dep)?.initialized);
      if (unmet) {
        const reason = `dependency '${unmet}' not initialized`;
        this.setDiagnostic(name, {
          name,
          version: entry.plugin.version,
          state: 'failed',
          reason,
        });
        console.error(`  ✗ Skipping '${name}': ${reason}`);
        continue;
      }

      try {
        await entry.plugin.init(ctx);
        entry.initialized = true;
        this.setDiagnostic(name, {
          name,
          version: entry.plugin.version,
          state: 'initialized',
        });
        console.log(`  ✓ ${name} initialized`);
      } catch (error: any) {
        this.setDiagnostic(name, {
          name,
          version: entry.plugin.version,
          state: 'failed',
          reason: `init failed: ${error.message}`,
        });
        console.error(`  ✗ Failed to init '${name}': ${error.message}`);
      }
    }
  }

  /**
   * Start all initialized plugins.
   */
  async startAll(): Promise<void> {
    for (const name of this.initOrder) {
      const entry = this.plugins.get(name)!;
      if (!entry.initialized || entry.started) continue;

      if (entry.plugin.start) {
        try {
          await entry.plugin.start();
          entry.started = true;
          this.setDiagnostic(name, {
            name,
            version: entry.plugin.version,
            state: 'started',
          });
          console.log(`  ✓ ${name} started`);
        } catch (error: any) {
          this.setDiagnostic(name, {
            name,
            version: entry.plugin.version,
            state: 'failed',
            reason: `start failed: ${error.message}`,
          });
          console.error(`  ✗ Failed to start '${name}': ${error.message}`);
        }
      } else {
        entry.started = true;
        this.setDiagnostic(name, {
          name,
          version: entry.plugin.version,
          state: 'started',
        });
      }
    }
  }

  /**
   * Stop all started plugins (reverse order).
   */
  async stopAll(): Promise<void> {
    const reversed = [...this.initOrder].reverse();
    for (const name of reversed) {
      const entry = this.plugins.get(name);
      if (!entry?.started) continue;

      if (entry.plugin.stop) {
        try {
          await entry.plugin.stop();
        } catch (error: any) {
          console.error(`Failed to stop '${name}': ${error.message}`);
        }
      }
      entry.started = false;
    }
  }

  /**
   * Destroy all plugins (reverse order).
   */
  async destroyAll(): Promise<void> {
    const reversed = [...this.initOrder].reverse();
    for (const name of reversed) {
      const entry = this.plugins.get(name);
      if (!entry?.initialized) continue;

      if (entry.plugin.destroy) {
        try {
          await entry.plugin.destroy();
        } catch (error: any) {
          console.error(`Failed to destroy '${name}': ${error.message}`);
        }
      }
      entry.initialized = false;
    }
  }

  /**
   * Get a registered plugin by name.
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * List all registered plugins with their status.
   */
  listPlugins(): Array<{
    name: string; version: string; initialized: boolean; started: boolean;
    dependencies?: string[]; description?: string;
  }> {
    const result = [];
    for (const [, entry] of this.plugins) {
      result.push({
        name: entry.plugin.name,
        version: entry.plugin.version,
        initialized: entry.initialized,
        started: entry.started,
        dependencies: entry.plugin.dependencies,
        description: entry.metadata?.description,
      });
    }
    return result;
  }

  getPluginDiagnostics(): PluginDiagnostic[] {
    return Array.from(this.diagnostics.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private setDiagnostic(name: string, next: PluginDiagnostic): void {
    const previous = this.diagnostics.get(name);
    if (!previous) {
      this.diagnostics.set(name, next);
      return;
    }
    this.diagnostics.set(name, {
      ...previous,
      ...next,
      version: next.version ?? previous.version,
    });
  }

  private resolveDependencyBlocks(): Map<string, string> {
    const blocked = new Map<string, string>();
    const state = new Map<string, 'visiting' | 'ok' | 'blocked'>();

    const visit = (name: string, trail: string[]): boolean => {
      const currentState = state.get(name);
      if (currentState === 'ok') return true;
      if (currentState === 'blocked') return false;

      if (currentState === 'visiting') {
        const cycleStart = trail.indexOf(name);
        const cycle = [...trail.slice(cycleStart), name];
        const cycleReason = `circular dependency: ${cycle.join(' -> ')}`;
        for (const member of cycle.slice(0, -1)) {
          blocked.set(member, cycleReason);
          state.set(member, 'blocked');
        }
        return false;
      }

      const entry = this.plugins.get(name);
      if (!entry) {
        blocked.set(name, `plugin '${name}' is not registered`);
        state.set(name, 'blocked');
        return false;
      }

      state.set(name, 'visiting');
      for (const dependency of entry.plugin.dependencies || []) {
        if (!this.plugins.has(dependency)) {
          blocked.set(name, `missing dependency '${dependency}'`);
          state.set(name, 'blocked');
          return false;
        }

        const dependencyOk = visit(dependency, [...trail, name]);
        if (!dependencyOk) {
          const dependencyReason = blocked.get(dependency) ?? `dependency '${dependency}' unavailable`;
          blocked.set(name, `dependency '${dependency}' unavailable: ${dependencyReason}`);
          state.set(name, 'blocked');
          return false;
        }
      }

      state.set(name, 'ok');
      return true;
    };

    for (const name of this.plugins.keys()) {
      visit(name, []);
    }

    return blocked;
  }

  // === Topological sort for dependency resolution ===

  private topologicalSort(candidates: string[]): string[] {
    const candidateSet = new Set(candidates);
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: string[] = [];

    const visit = (name: string) => {
      if (!candidateSet.has(name)) return;
      if (visited.has(name)) return;
      if (visiting.has(name)) return;

      visiting.add(name);
      const entry = this.plugins.get(name);
      if (!entry) return;

      const deps = entry.plugin.dependencies || [];
      for (const dep of deps) {
        if (!candidateSet.has(dep)) continue;
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of candidates) {
      visit(name);
    }

    return sorted;
  }
}
