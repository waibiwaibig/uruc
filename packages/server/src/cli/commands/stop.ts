import type { CommandContext } from '../lib/types.js';
import { getRuntimeStatus, stopRuntime } from '../lib/runtime.js';

export function getStopFailureMessage(mode: 'background' | 'systemd' | 'unmanaged'): string {
  if (mode === 'unmanaged') {
    return 'Uruc is still reachable after `uruc stop`. This local instance is not managed by the CLI and could not be stopped safely.';
  }
  return 'Uruc is still running after `uruc stop`. Wait a moment, then re-run `uruc status`.';
}

export async function runStopCommand(context: CommandContext): Promise<void> {
  const before = await getRuntimeStatus();
  if (before.mode === 'stopped') {
    if (context.json) {
      console.log(JSON.stringify({ stopped: false, reason: 'already_stopped' }, null, 2));
      return;
    }
    console.log('Uruc is not running.');
    return;
  }

  await stopRuntime();
  const after = await getRuntimeStatus();
  if (after.mode !== 'stopped') {
    throw new Error(getStopFailureMessage(after.mode));
  }

  if (context.json) {
    console.log(JSON.stringify({ stopped: true, previousMode: before.mode }, null, 2));
    return;
  }
  console.log(`Stopped Uruc (${before.mode}).`);
}
