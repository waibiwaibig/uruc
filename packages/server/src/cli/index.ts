#!/usr/bin/env node

import { parseCommandContext } from './lib/argv.js';

async function main(): Promise<void> {
  const { command, context } = parseCommandContext(process.argv.slice(2));

  try {
    switch (command) {
      case undefined:
      case 'help':
      case '--help':
      case '-h': {
        const { runHelpCommand } = await import('./commands/help.js');
        await runHelpCommand(context);
        return;
      }
      case 'configure': {
        const { runConfigureCommand } = await import('./commands/configure.js');
        await runConfigureCommand(context);
        return;
      }
      case 'build': {
        const { runBuildCommand } = await import('./commands/build.js');
        await runBuildCommand(context);
        return;
      }
      case 'start': {
        const { runStartCommand } = await import('./commands/start.js');
        await runStartCommand(context);
        return;
      }
      case 'stop': {
        const { runStopCommand } = await import('./commands/stop.js');
        await runStopCommand(context);
        return;
      }
      case 'restart': {
        const { runRestartCommand } = await import('./commands/restart.js');
        await runRestartCommand(context);
        return;
      }
      case 'status': {
        const { runStatusCommand } = await import('./commands/status.js');
        await runStatusCommand(context);
        return;
      }
      case 'logs': {
        const { runLogsCommand } = await import('./commands/logs.js');
        await runLogsCommand(context);
        return;
      }
      case 'dashboard': {
        const { runDashboardCommand } = await import('./commands/dashboard.js');
        await runDashboardCommand(context);
        return;
      }
      case 'doctor': {
        const { runDoctorCommand } = await import('./commands/doctor.js');
        await runDoctorCommand(context);
        return;
      }
      case 'admin': {
        const { runAdminCommand } = await import('./commands/admin.js');
        await runAdminCommand(context);
        return;
      }
      case 'plugin': {
        const { runPluginCommand } = await import('./plugin-manager.js');
        await runPluginCommand(context.args);
        return;
      }
      case 'source': {
        const { runSourceCommand } = await import('./source-manager.js');
        await runSourceCommand(context.args);
        return;
      }
      case 'city': {
        const { runCityCommand } = await import('./city-manager.js');
        await runCityCommand(context.args);
        return;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (context.json) {
      console.log(JSON.stringify({ error: message }, null, 2));
    } else {
      console.error(message);
    }
    process.exit(1);
  }
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
