import type { SharedRuntimeState } from './runtime-broker-protocol';
import type { CommandSchema, LocationDef, RuntimeSnapshot } from './types';

type RuntimePatch = Partial<RuntimeSnapshot & { locationId: string | null }>;

function cloneCommands(commands: CommandSchema[]): CommandSchema[] {
  return commands.slice();
}

function cloneLocations(locations: LocationDef[]): LocationDef[] {
  return locations.slice();
}

export function parseRuntimePatch(payload: unknown): RuntimePatch {
  if (!payload || typeof payload !== 'object') return {};
  const data = payload as Record<string, unknown>;
  const patch: RuntimePatch = {};

  if (typeof data.connected === 'boolean') patch.connected = data.connected;
  if (typeof data.hasController === 'boolean') patch.hasController = data.hasController;
  if (typeof data.isController === 'boolean') patch.isController = data.isController;
  if (typeof data.inCity === 'boolean') patch.inCity = data.inCity;
  if (typeof data.serverTimestamp === 'number') patch.serverTimestamp = data.serverTimestamp;
  if (Array.isArray(data.availableCommands)) patch.availableCommands = cloneCommands(data.availableCommands as CommandSchema[]);
  if (Array.isArray(data.availableLocations)) patch.availableLocations = cloneLocations(data.availableLocations as LocationDef[]);
  if (typeof data.currentLocation === 'string' || data.currentLocation === null) {
    patch.currentLocation = data.currentLocation as string | null;
  }
  if (typeof data.locationId === 'string' || data.locationId === null) {
    patch.locationId = data.locationId as string | null;
  }

  return patch;
}

export function shouldClearRuntimeError(payload: unknown): boolean {
  const patch = parseRuntimePatch(payload);
  if (patch.connected === false) return false;
  if (patch.isController === true) return true;
  if (patch.hasController === false) return true;
  return false;
}

export function clearRuntimeFields(state: SharedRuntimeState): void {
  state.hasController = false;
  state.isController = false;
  state.inCity = false;
  state.currentLocation = null;
  state.serverTimestamp = null;
  state.availableCommands = [];
  state.availableLocations = [];
}

export function applyRuntimePatch(state: SharedRuntimeState, payload: unknown): void {
  const patch = parseRuntimePatch(payload);

  if (patch.hasController !== undefined) state.hasController = patch.hasController;
  if (patch.isController !== undefined) state.isController = patch.isController;
  if (patch.inCity !== undefined) state.inCity = patch.inCity;
  if (patch.serverTimestamp !== undefined) state.serverTimestamp = patch.serverTimestamp;
  if (patch.availableCommands) state.availableCommands = cloneCommands(patch.availableCommands);
  if (patch.availableLocations) state.availableLocations = cloneLocations(patch.availableLocations);
  if (patch.currentLocation !== undefined) state.currentLocation = patch.currentLocation;
  if (patch.locationId !== undefined) state.currentLocation = patch.locationId;
}
