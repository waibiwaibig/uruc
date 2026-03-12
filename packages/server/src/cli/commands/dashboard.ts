import type { CommandContext } from '../lib/types.js';
import { getRuntimeStatus, openDashboard } from '../lib/runtime.js';

export async function runDashboardCommand(context: CommandContext): Promise<void> {
  const status = await getRuntimeStatus();
  if (!status.health.ok) {
    const payload = {
      opened: false,
      message: 'Uruc is not reachable. Start it with `uruc start` or `uruc start -b` first.',
      siteUrl: status.siteUrl,
      healthUrl: status.healthUrl,
    };
    if (context.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(payload.message);
    console.log(`Site:   ${status.siteUrl}`);
    console.log(`Health: ${status.healthUrl}`);
    return;
  }

  const opened = await openDashboard();
  if (context.json) {
    console.log(JSON.stringify({ opened, siteUrl: status.siteUrl }, null, 2));
    return;
  }
  if (opened) {
    console.log(`Opened ${status.siteUrl}`);
  } else {
    console.log(`Open this URL manually: ${status.siteUrl}`);
  }
}
