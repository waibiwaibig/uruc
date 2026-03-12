import type { CommandContext } from '../lib/types.js';
import { getRuntimeStatus, restartRuntime } from '../lib/runtime.js';
import { ensureFreshBuildIfNeeded } from './build.js';

export async function runRestartCommand(context: CommandContext): Promise<void> {
  const status = await getRuntimeStatus();
  if (status.mode === 'stopped' || status.mode === 'unmanaged') {
    throw new Error('Restart only works for managed background or systemd instances. Start Uruc in the background first.');
  }

  const rebuilt = await ensureFreshBuildIfNeeded();
  await restartRuntime();

  if (context.json) {
    console.log(JSON.stringify({ restarted: true, rebuilt, mode: status.mode }, null, 2));
    return;
  }
  console.log(rebuilt ? 'Uruc rebuilt and restarted.' : 'Uruc restarted.');
}
