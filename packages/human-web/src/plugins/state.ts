import type { HealthResponse } from '../lib/types';

export function resolveEnabledPluginIds(health: HealthResponse | null): Set<string> {
  const started = health?.plugins?.filter((plugin) => plugin.started).map((plugin) => plugin.pluginId ?? plugin.name);
  return new Set(started ?? []);
}
