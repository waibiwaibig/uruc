import type { ArcadeGameDefinition, ArcadeGameListItem, ArcadeGameManifest } from './types.js';

interface ArcadeGameEntry {
  definition: ArcadeGameDefinition;
  manifest: ArcadeGameManifest;
}

export class ArcadeGameRegistry {
  private games = new Map<string, ArcadeGameEntry>();

  register(definition: ArcadeGameDefinition, manifest: ArcadeGameManifest): void {
    if (this.games.has(definition.id)) {
      throw new Error(`Arcade game '${definition.id}' is already registered`);
    }

    this.games.set(definition.id, {
      definition,
      manifest,
    });
  }

  unregister(id: string): void {
    this.games.delete(id);
  }

  has(id: string): boolean {
    return this.games.has(id);
  }

  get(id: string): ArcadeGameDefinition | undefined {
    return this.games.get(id)?.definition;
  }

  getManifest(id: string): ArcadeGameManifest | undefined {
    return this.games.get(id)?.manifest;
  }

  list(): ArcadeGameListItem[] {
    return Array.from(this.games.values()).map(({ definition, manifest }) => ({
      id: definition.id,
      version: definition.version,
      apiVersion: definition.apiVersion,
      dependencies: definition.dependencies ?? manifest.dependencies ?? [],
      catalog: definition.catalog,
    }));
  }

  entries(): Array<{ definition: ArcadeGameDefinition; manifest: ArcadeGameManifest }> {
    return Array.from(this.games.values());
  }
}

