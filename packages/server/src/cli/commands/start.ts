import { rootEnvExists, serverEnvExists } from '../lib/env.js';
import { assertConfiguredPortsAvailable, getRuntimeStatus, startBackground, startForeground } from '../lib/runtime.js';
import type { CommandContext } from '../lib/types.js';
import { ensureFreshBuildIfNeeded } from './build.js';
import { runSetupCommand } from './setup.js';
import { hasFlag } from '../lib/argv.js';

export function getStartConflictMessage(mode: 'background' | 'systemd' | 'unmanaged'): string {
  if (mode === 'unmanaged') {
    return 'A reachable Uruc instance is already running, but it is not managed by this CLI. Stop that local process first or inspect it with `uruc status`.';
  }
  return 'A managed Uruc instance is already running. Stop it first with `uruc stop` or inspect it with `uruc status`.';
}

export async function runStartCommand(context: CommandContext): Promise<void> {
  if (!serverEnvExists()) {
    console.log('packages/server/.env is missing. Launching `uruc setup` first.');
    await runSetupCommand({ ...context, args: [] });
  }

  if (rootEnvExists()) {
    console.warn('Warning: repo-root .env is ignored. Only packages/server/.env is active.');
  }

  const background = hasFlag(context.args, '--background', '-b');
  const rebuilt = await ensureFreshBuildIfNeeded();
  const status = await getRuntimeStatus();

  if (status.mode !== 'stopped') {
    throw new Error(getStartConflictMessage(status.mode));
  }

  await assertConfiguredPortsAvailable();

  if (background) {
    await startBackground();
    console.log(rebuilt ? 'Uruc rebuilt and started in background.' : 'Uruc started in background.');
    return;
  }

  console.log(rebuilt ? 'Uruc rebuilt before foreground start.' : 'Starting Uruc in foreground.');
  await startForeground();
}
