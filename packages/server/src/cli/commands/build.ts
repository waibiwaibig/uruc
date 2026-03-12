import { buildAll, getBuildFreshness } from '../lib/build.js';
import { hasFlag } from '../lib/argv.js';
import type { CommandContext } from '../lib/types.js';

export async function runBuildCommand(context: CommandContext): Promise<void> {
  const force = hasFlag(context.args, '--force');
  const result = await buildAll(force);
  if (context.json) {
    console.log(JSON.stringify({ force, ...result }, null, 2));
    return;
  }
  console.log(force ? 'Build completed with --force.' : 'Build completed.');
  console.log(`Freshness: ${result.reason}`);
}

export async function ensureFreshBuildIfNeeded(): Promise<boolean> {
  const freshness = getBuildFreshness();
  if (!freshness.stale) return false;
  await buildAll(false);
  return true;
}
