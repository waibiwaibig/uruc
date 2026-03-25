#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import { parseCommandContext } from './lib/argv.js';

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { command, context } = parseCommandContext(argv);

  try {
    switch (command) {
      case undefined:
      case 'help':
      case '--help':
      case '-h': {
        const { runHelpCommand } = await import('./commands/help.js');
        await runHelpCommand(context);
        return 0;
      }
      case 'configure': {
        const { runConfigureCommand } = await import('./commands/configure.js');
        await runConfigureCommand(context);
        return 0;
      }
      case 'build': {
        const { runBuildCommand } = await import('./commands/build.js');
        await runBuildCommand(context);
        return 0;
      }
      case 'start': {
        const { runStartCommand } = await import('./commands/start.js');
        await runStartCommand(context);
        return 0;
      }
      case 'stop': {
        const { runStopCommand } = await import('./commands/stop.js');
        await runStopCommand(context);
        return 0;
      }
      case 'restart': {
        const { runRestartCommand } = await import('./commands/restart.js');
        await runRestartCommand(context);
        return 0;
      }
      case 'status': {
        const { runStatusCommand } = await import('./commands/status.js');
        await runStatusCommand(context);
        return 0;
      }
      case 'logs': {
        const { runLogsCommand } = await import('./commands/logs.js');
        await runLogsCommand(context);
        return 0;
      }
      case 'dashboard': {
        const { runDashboardCommand } = await import('./commands/dashboard.js');
        await runDashboardCommand(context);
        return 0;
      }
      case 'doctor': {
        const { runDoctorCommand } = await import('./commands/doctor.js');
        await runDoctorCommand(context);
        return 0;
      }
      case 'admin': {
        const { runAdminCommand } = await import('./commands/admin.js');
        await runAdminCommand(context);
        return 0;
      }
      case 'plugin': {
        const { runPluginCommand } = await import('./plugin-manager.js');
        await runPluginCommand(context);
        return 0;
      }
      case 'source':
        throw new Error('`uruc source` was removed. Use `uruc plugin source ...`.');
      case 'city': {
        const { runCityCommand } = await import('./city-manager.js');
        await runCityCommand(context.args);
        return 0;
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
    return 1;
  }
}

function isDirectExecution(): boolean {
  const entryPath = process.argv[1];
  if (!entryPath) return false;
  return path.resolve(entryPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  void runCli()
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.exit(1);
    });
}
