import { existsSync } from 'fs';

import type { CommandContext } from '../lib/types.js';
import { prepareCityRuntime } from '../lib/city.js';
import { parseEnvFile } from '../lib/env.js';
import { getRuntimeStatus, restartRuntime } from '../lib/runtime.js';
import { ensureFreshBuildIfNeeded } from './build.js';
import { getCityConfigPath, getCityLockPath, getPackageRoot, getPluginStoreDir, resolveFromRuntimeHome } from '../../runtime-paths.js';

function getRestartSuccessMessage(mode: 'background' | 'systemd', rebuilt: boolean): string {
  if (mode === 'systemd') {
    return rebuilt ? 'Uruc rebuilt and restarted via systemd service.' : 'Uruc restarted via systemd service.';
  }
  return rebuilt ? 'Uruc rebuilt and restarted in background.' : 'Uruc restarted in background.';
}

function resolveConfiguredRuntimePaths(): {
  configPath: string;
  lockPath: string;
  pluginStoreDir: string;
  isDefaultPath: boolean;
} {
  const env = parseEnvFile();
  const defaultCityConfigPath = getCityConfigPath();
  const defaultCityLockPath = getCityLockPath();
  const defaultPluginStoreDir = getPluginStoreDir();
  const rawConfigured = env.CITY_CONFIG_PATH?.trim();
  const rawLockPath = env.CITY_LOCK_PATH?.trim();
  const rawPluginStoreDir = env.PLUGIN_STORE_DIR?.trim();
  if (!rawConfigured) {
    return {
      configPath: defaultCityConfigPath,
      lockPath: rawLockPath ? resolveFromRuntimeHome(rawLockPath) : defaultCityLockPath,
      pluginStoreDir: rawPluginStoreDir ? resolveFromRuntimeHome(rawPluginStoreDir) : defaultPluginStoreDir,
      isDefaultPath: true,
    };
  }

  const resolved = resolveFromRuntimeHome(rawConfigured);
  return {
    configPath: resolved,
    lockPath: rawLockPath ? resolveFromRuntimeHome(rawLockPath) : defaultCityLockPath,
    pluginStoreDir: rawPluginStoreDir ? resolveFromRuntimeHome(rawPluginStoreDir) : defaultPluginStoreDir,
    isDefaultPath: resolved === defaultCityConfigPath,
  };
}

export async function runRestartCommand(context: CommandContext): Promise<void> {
  const status = await getRuntimeStatus();
  if (status.mode === 'stopped' || status.mode === 'unmanaged') {
    throw new Error('Restart only works for managed background or systemd instances. Start Uruc in the background first.');
  }

  const { configPath, lockPath, pluginStoreDir, isDefaultPath } = resolveConfiguredRuntimePaths();
  if (!existsSync(configPath) && !isDefaultPath) {
    throw new Error(`Configured city file does not exist at ${configPath}. Run \`uruc configure\` to create or fix it.`);
  }

  await prepareCityRuntime({
    configPath,
    lockPath,
    packageRoot: getPackageRoot(),
    pluginStoreDir,
    autoCreateDefault: isDefaultPath,
  });

  const rebuilt = await ensureFreshBuildIfNeeded();
  await restartRuntime();

  if (context.json) {
    console.log(JSON.stringify({ restarted: true, rebuilt, mode: status.mode }, null, 2));
    return;
  }
  console.log(getRestartSuccessMessage(status.mode, rebuilt));
}
