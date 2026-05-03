import type { SharedRuntimeState } from './runtime-broker-protocol';
import type { RuntimeSnapshot } from './types';

type RuntimePatch = Partial<RuntimeSnapshot & { locationId: string | null }>;

export function parseRuntimePatch(payload: unknown): RuntimePatch {
  if (!payload || typeof payload !== 'object') return {};
  const data = payload as Record<string, unknown>;
  const patch: RuntimePatch = {};

  if (typeof data.connected === 'boolean') patch.connected = data.connected;
  if (typeof data.hasActionLease === 'boolean') patch.hasActionLease = data.hasActionLease;
  if (typeof data.isActionLeaseHolder === 'boolean') patch.isActionLeaseHolder = data.isActionLeaseHolder;
  if (typeof data.inCity === 'boolean') patch.inCity = data.inCity;
  if (typeof data.citytime === 'number') patch.citytime = data.citytime;
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
  if (patch.isActionLeaseHolder === true) return true;
  if (patch.hasActionLease === false) return true;
  return false;
}

export function clearRuntimeFields(state: SharedRuntimeState): void {
  state.hasActionLease = false;
  state.isActionLeaseHolder = false;
  state.inCity = false;
  state.currentLocation = null;
  state.citytime = null;
}

export function applyRuntimePatch(state: SharedRuntimeState, payload: unknown): void {
  const patch = parseRuntimePatch(payload);

  if (patch.hasActionLease !== undefined) state.hasActionLease = patch.hasActionLease;
  if (patch.isActionLeaseHolder !== undefined) state.isActionLeaseHolder = patch.isActionLeaseHolder;
  if (patch.inCity !== undefined) state.inCity = patch.inCity;
  if (patch.citytime !== undefined) state.citytime = patch.citytime;
  if (patch.currentLocation !== undefined) state.currentLocation = patch.currentLocation;
  if (patch.locationId !== undefined) state.currentLocation = patch.locationId;
}
