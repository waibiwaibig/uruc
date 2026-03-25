import { existsSync } from 'fs';
import path from 'path';

import { rootEnvExists, serverEnvExists } from '../lib/env.js';
import { DEFAULT_PLUGIN_STORE_DIR, prepareCityRuntime } from '../lib/city.js';
import { parseEnvFile } from '../lib/env.js';
import { assertConfiguredPortsAvailable, getRuntimeStatus, startBackground, startForeground, type ManagedRuntimeMode } from '../lib/runtime.js';
import { getRootEnvPath, getServerEnvPath } from '../lib/state.js';
import type { CommandContext } from '../lib/types.js';
import { ensureFreshBuildIfNeeded } from './build.js';
import { runConfigureCommand } from './configure.js';
import { hasFlag } from '../lib/argv.js';
import { getCityConfigPath, getCityLockPath, getPackageRoot, getPluginStoreDir, resolveFromRuntimeHome } from '../../runtime-paths.js';

export function getStartConflictMessage(mode: 'background' | 'systemd' | 'unmanaged'): string {
  if (mode === 'unmanaged') {
    return 'A reachable Uruc instance is already running, but it is not managed by this CLI. Stop that local process first or inspect it with `uruc status`.';
  }
  return 'A managed Uruc instance is already running. Stop it first with `uruc stop` or inspect it with `uruc status`.';
}

function getManagedStartSuccessMessage(mode: ManagedRuntimeMode, rebuilt: boolean): string {
  if (mode === 'systemd') {
    return rebuilt ? 'Uruc rebuilt and started via systemd service.' : 'Uruc started via systemd service.';
  }
  return rebuilt ? 'Uruc rebuilt and started in background.' : 'Uruc started in background.';
}

function resolveConfiguredCityPath(): { configPath: string; isDefaultPath: boolean } {
  const env = parseEnvFile();
  const defaultCityConfigPath = getCityConfigPath();
  const rawConfigured = env.CITY_CONFIG_PATH?.trim();
  if (!rawConfigured) {
    return { configPath: defaultCityConfigPath, isDefaultPath: true };
  }

  const resolved = resolveFromRuntimeHome(rawConfigured);
  return {
    configPath: resolved,
    isDefaultPath: resolved === defaultCityConfigPath,
  };
}

export async function runStartCommand(context: CommandContext): Promise<void> {
  if (!serverEnvExists()) {
    console.log(`${getServerEnvPath()} is missing. Launching \`uruc configure\` first.`);
    await runConfigureCommand({ ...context, args: [] });
    return;
  }

  if (rootEnvExists()) {
    console.warn(`Warning: ${getRootEnvPath()} is ignored. Only ${getServerEnvPath()} is active.`);
  }

  const background = hasFlag(context.args, '--background', '-b');
  const { configPath, isDefaultPath } = resolveConfiguredCityPath();
  if (!existsSync(configPath) && !isDefaultPath) {
    throw new Error(`Configured city file does not exist at ${configPath}. Run \`uruc configure\` to create or fix it.`);
  }

  const cityState = await prepareCityRuntime({
    configPath,
    lockPath: getCityLockPath(),
    packageRoot: getPackageRoot(),
    pluginStoreDir: getPluginStoreDir(),
    autoCreateDefault: isDefaultPath,
  });
  if (cityState === 'created') {
    console.log(`Initialized default city config at ${configPath}.`);
  }

  const rebuilt = await ensureFreshBuildIfNeeded();
  const status = await getRuntimeStatus();

  if (status.mode !== 'stopped') {
    throw new Error(getStartConflictMessage(status.mode));
  }

  await assertConfiguredPortsAvailable();

  if (background) {
    const managedMode = await startBackground();
    console.log(getManagedStartSuccessMessage(managedMode, rebuilt));
    return;
  }

  console.log(rebuilt ? 'Uruc rebuilt before foreground start.' : 'Starting Uruc in foreground.');
  await startForeground();
}
