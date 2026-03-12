import type { ArcadeGameDefinition, ArcadeGameDiagnostic, ArcadeGameHostContext, ArcadeGameManifest } from './types.js';
import { ArcadeGameDiscovery } from './discovery.js';
import { ArcadeGameRegistry } from './registry.js';

interface GameEntry {
  definition: ArcadeGameDefinition;
  initialized: boolean;
  started: boolean;
  manifest: ArcadeGameManifest;
}

export class ArcadeGameLoader {
  private readonly games = new Map<string, GameEntry>();
  private readonly diagnostics = new Map<string, ArcadeGameDiagnostic>();
  private initOrder: string[] = [];

  constructor(
    private readonly discovery: ArcadeGameDiscovery,
    private readonly registry: ArcadeGameRegistry,
  ) {}

  register(definition: ArcadeGameDefinition, manifest: ArcadeGameManifest): void {
    if (this.games.has(definition.id)) {
      throw new Error(`Arcade game '${definition.id}' is already registered`);
    }

    this.games.set(definition.id, {
      definition,
      initialized: false,
      started: false,
      manifest,
    });
    this.registry.register(definition, manifest);
    this.setDiagnostic(definition.id, {
      name: definition.id,
      version: definition.version,
      state: 'loaded',
    });
  }

  async discoverAndRegisterAll(): Promise<string[]> {
    await this.discovery.loadConfig();
    const discovered = await this.discovery.discoverGames();
    const loaded: string[] = [];

    for (const stale of this.discovery.getStaleConfiguredGames(discovered)) {
      this.setDiagnostic(stale, {
        name: stale,
        state: 'skipped',
        reason: 'configured but not found on disk',
      });
    }

    for (const [id, manifest] of discovered) {
      if (!this.discovery.isEnabled(id)) {
        this.setDiagnostic(id, {
          name: id,
          version: manifest.version,
          state: 'skipped',
          reason: 'disabled in config',
        });
        continue;
      }

      if (!this.discovery.shouldAutoLoad(id)) {
        this.setDiagnostic(id, {
          name: id,
          version: manifest.version,
          state: 'skipped',
          reason: 'autoLoad=false in config',
        });
        continue;
      }

      if (this.games.has(id)) {
        this.setDiagnostic(id, {
          name: id,
          version: manifest.version,
          state: 'skipped',
          reason: 'already registered',
        });
        continue;
      }

      try {
        const definition = await this.discovery.loadGameInstance(manifest);
        if (definition.id !== manifest.id) {
          throw new Error(`manifest id '${manifest.id}' does not match exported id '${definition.id}'`);
        }
        if (definition.apiVersion !== manifest.apiVersion) {
          throw new Error(
            `manifest apiVersion '${manifest.apiVersion}' does not match exported apiVersion '${definition.apiVersion}'`,
          );
        }
        this.register(definition, manifest);
        loaded.push(id);
      } catch (error: any) {
        this.setDiagnostic(id, {
          name: id,
          version: manifest.version,
          state: 'failed',
          reason: `load failed: ${error.message}`,
        });
      }
    }

    return loaded;
  }

  async discoverAndLoadAll(ctx: ArcadeGameHostContext): Promise<void> {
    await this.discoverAndRegisterAll();
    await this.initAll(ctx);
    await this.startAll();
  }

  async initAll(ctx: ArcadeGameHostContext): Promise<void> {
    const dependencyBlocked = this.resolveDependencyBlocks();
    for (const [name, reason] of dependencyBlocked) {
      const entry = this.games.get(name);
      this.setDiagnostic(name, {
        name,
        version: entry?.definition.version,
        state: 'failed',
        reason,
      });
    }

    const candidates = Array.from(this.games.keys()).filter((name) => !dependencyBlocked.has(name));
    this.initOrder = this.topologicalSort(candidates);

    for (const name of this.initOrder) {
      const entry = this.games.get(name);
      if (!entry || entry.initialized) continue;

      const dependency = (entry.definition.dependencies ?? []).find((dep) => !this.games.get(dep)?.initialized);
      if (dependency) {
        this.setDiagnostic(name, {
          name,
          version: entry.definition.version,
          state: 'failed',
          reason: `dependency '${dependency}' not initialized`,
        });
        continue;
      }

      try {
        await entry.definition.init(ctx);
        entry.initialized = true;
        this.setDiagnostic(name, {
          name,
          version: entry.definition.version,
          state: 'initialized',
        });
      } catch (error: any) {
        this.setDiagnostic(name, {
          name,
          version: entry.definition.version,
          state: 'failed',
          reason: `init failed: ${error.message}`,
        });
      }
    }
  }

  async startAll(): Promise<void> {
    for (const name of this.initOrder) {
      const entry = this.games.get(name);
      if (!entry || !entry.initialized || entry.started) continue;

      try {
        await entry.definition.start?.();
        entry.started = true;
        this.setDiagnostic(name, {
          name,
          version: entry.definition.version,
          state: 'started',
        });
      } catch (error: any) {
        this.setDiagnostic(name, {
          name,
          version: entry.definition.version,
          state: 'failed',
          reason: `start failed: ${error.message}`,
        });
      }
    }
  }

  async stopAll(): Promise<void> {
    const reversed = [...this.initOrder].reverse();
    for (const name of reversed) {
      const entry = this.games.get(name);
      if (!entry?.started) continue;
      try {
        await entry.definition.stop?.();
      } finally {
        entry.started = false;
      }
    }
  }

  async destroyAll(): Promise<void> {
    await this.stopAll();
    const reversed = [...this.initOrder].reverse();
    for (const name of reversed) {
      const entry = this.games.get(name);
      if (!entry) continue;
      try {
        await entry.definition.destroy?.();
      } finally {
        this.registry.unregister(name);
        this.games.delete(name);
      }
    }
    this.initOrder = [];
  }

  getDiagnostics(): ArcadeGameDiagnostic[] {
    return Array.from(this.diagnostics.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private setDiagnostic(name: string, diagnostic: ArcadeGameDiagnostic): void {
    this.diagnostics.set(name, diagnostic);
  }

  private resolveDependencyBlocks(): Map<string, string> {
    const blocked = new Map<string, string>();
    const state = new Map<string, 'visiting' | 'ok' | 'blocked'>();

    const visit = (name: string, trail: string[]): boolean => {
      const currentState = state.get(name);
      if (currentState === 'ok') return true;
      if (currentState === 'blocked') return false;
      if (currentState === 'visiting') {
        const cycle = [...trail, name].join(' -> ');
        blocked.set(name, `circular dependency detected: ${cycle}`);
        state.set(name, 'blocked');
        return false;
      }

      const entry = this.games.get(name);
      if (!entry) {
        blocked.set(name, 'game not registered');
        state.set(name, 'blocked');
        return false;
      }

      state.set(name, 'visiting');
      for (const dependency of entry.definition.dependencies ?? []) {
        if (!this.games.has(dependency)) {
          blocked.set(name, `missing dependency '${dependency}'`);
          state.set(name, 'blocked');
          return false;
        }
        const dependencyOk = visit(dependency, [...trail, name]);
        if (!dependencyOk) {
          const reason = blocked.get(dependency) ?? `dependency '${dependency}' failed`;
          blocked.set(name, `dependency '${dependency}' blocked: ${reason}`);
          state.set(name, 'blocked');
          return false;
        }
      }

      state.set(name, 'ok');
      return true;
    };

    for (const name of this.games.keys()) {
      visit(name, []);
    }

    return blocked;
  }

  private topologicalSort(names: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name) || visiting.has(name)) return;
      visiting.add(name);
      const entry = this.games.get(name);
      for (const dependency of entry?.definition.dependencies ?? []) {
        visit(dependency);
      }
      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const name of names) {
      visit(name);
    }

    return result;
  }
}

