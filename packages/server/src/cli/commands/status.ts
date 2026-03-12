import type { CommandContext } from '../lib/types.js';
import { getRuntimeStatus } from '../lib/runtime.js';

export async function runStatusCommand(context: CommandContext): Promise<void> {
  const status = await getRuntimeStatus();
  if (context.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`Mode:          ${status.mode}`);
  console.log(`Reachability:  ${status.reachability}`);
  console.log(`Bind host:     ${status.bindHost}`);
  console.log(`Service:       ${status.serviceName}`);
  console.log(`Config:        ${status.envPath}`);
  console.log(`Site:          ${status.siteUrl}`);
  console.log(`Health:        ${status.healthUrl}`);
  console.log(`WS:            ${status.wsUrl}`);
  console.log(`DB:            ${status.dbPath}`);
  console.log(`Plugin config: ${status.pluginConfigPath}`);
  console.log(`Public dir:    ${status.publicDir}`);
  console.log(`Admin user:    ${status.adminUsername || '(not set)'}`);
  if (status.managedProcess) {
    console.log(`Managed PID:   ${status.managedProcess.pid}`);
    console.log(`Managed log:   ${status.managedProcess.logPath}`);
  }
  if (status.health.ok) {
    console.log(`Health state:  ok (${status.health.statusCode})`);
  } else {
    console.log(`Health state:  fail${status.health.statusCode ? ` (${status.health.statusCode})` : ''}`);
    if (status.health.error) console.log(`Health error:  ${status.health.error}`);
  }
}
