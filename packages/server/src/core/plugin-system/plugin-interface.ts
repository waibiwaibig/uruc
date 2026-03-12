import type { ServiceRegistry } from './service-registry.js';
import type { HookRegistry } from './hook-registry.js';
import type { UrucDb } from '../database/index.js';

/**
 * Plugins register these to declare "places" agents can visit.
 * Core tracks agent positions and checks allowedLocations.
 */
export interface LocationDef {
  id: string;
  name: string;
  description?: string;
  pluginName?: string;
}

export interface PluginContext {
  db: UrucDb;
  services: ServiceRegistry;
  hooks: HookRegistry;
}

export interface Plugin {
  name: string;
  version: string;
  dependencies?: string[];
  init(ctx: PluginContext): Promise<void> | void;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
}
