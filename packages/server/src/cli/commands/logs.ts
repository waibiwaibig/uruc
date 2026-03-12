import { hasFlag } from '../lib/argv.js';
import { printLogs } from '../lib/runtime.js';
import type { CommandContext } from '../lib/types.js';

export async function runLogsCommand(context: CommandContext): Promise<void> {
  const follow = !hasFlag(context.args, '--no-follow');
  await printLogs(follow);
}
