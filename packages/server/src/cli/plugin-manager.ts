import dotenv from 'dotenv';

import { PluginDiscovery } from '../core/plugin-system/discovery.js';
import { getEnvPath, getPackageRoot, getPluginConfigPath } from '../runtime-paths.js';

dotenv.config({ path: getEnvPath(), quiet: true });

const discovery = new PluginDiscovery(getPluginConfigPath(), getPackageRoot());

export async function runPluginCommand(args: string[]): Promise<void> {
  const command = args[0];

  try {
    await discovery.loadConfig();

    switch (command) {
      case 'list':
        await listPlugins();
        break;
      case 'enable':
        await enablePlugin(args[1]);
        break;
      case 'disable':
        await disablePlugin(args[1]);
        break;
      case 'install':
        await installPlugin(args[1]);
        break;
      case 'uninstall':
        await uninstallPlugin(args[1], args.includes('--hard'));
        break;
      case 'discover':
        await discoverPlugins();
        break;
      default:
        showHelp();
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function listPlugins() {
  console.log('\n=== Configured Plugins ===\n');
  const configs = discovery.getAllConfigs();

  if (configs.size === 0) {
    console.log('No plugins configured.');
    return;
  }

  for (const [name, config] of configs.entries()) {
    const status = config.enabled ? '✓ enabled' : '✗ disabled';
    const autoLoad = config.autoLoad ? '[auto-load]' : '[manual]';
    console.log(`  ${name.padEnd(20)} ${status.padEnd(12)} ${autoLoad}`);
  }

  console.log('\n=== Discovered Plugins ===\n');
  const discovered = await discovery.discoverPlugins();

  if (discovered.size === 0) {
    console.log('No plugins discovered.');
    return;
  }

  for (const [name, metadata] of discovered.entries()) {
    const configured = configs.has(name);
    const status = configured ? 'configured' : 'not configured';
    console.log(`  ${name.padEnd(20)} v${metadata.version.padEnd(8)} ${status}`);
    if (metadata.description) {
      console.log(`    ${metadata.description}`);
    }
    if (metadata.dependencies && metadata.dependencies.length > 0) {
      console.log(`    Dependencies: ${metadata.dependencies.join(', ')}`);
    }
  }
  console.log();
}

async function enablePlugin(name: string) {
  if (!name) {
    console.error('Please specify a plugin name');
    process.exit(1);
  }

  await discovery.setEnabled(name, true);
  console.log(`✓ Plugin "${name}" enabled`);
}

async function disablePlugin(name: string) {
  if (!name) {
    console.error('Please specify a plugin name');
    process.exit(1);
  }

  await discovery.setEnabled(name, false);
  console.log(`✓ Plugin "${name}" disabled`);
}

async function installPlugin(sourcePath: string) {
  if (!sourcePath) {
    console.error('Please specify a source path');
    process.exit(1);
  }

  const targetPath = await discovery.installPlugin(sourcePath);
  console.log(`✓ Plugin installed to: ${targetPath}`);
}

async function uninstallPlugin(name: string, hard: boolean) {
  if (!name) {
    console.error('Please specify a plugin name');
    process.exit(1);
  }

  if (hard) {
    console.log('⚠ Hard uninstall will delete the plugin directory');
  }

  await discovery.uninstallPlugin(name, hard);

  if (hard) {
    console.log(`✓ Plugin "${name}" uninstalled (hard)`);
  } else {
    console.log(`✓ Plugin "${name}" disabled (soft uninstall)`);
  }
}

async function discoverPlugins() {
  console.log('\n=== Discovering Plugins ===\n');
  const discovered = await discovery.discoverPlugins();

  console.log(`Found ${discovered.size} plugin(s):\n`);

  for (const [name, metadata] of discovered.entries()) {
    console.log(`  ${name} v${metadata.version}`);
    if (metadata.description) {
      console.log(`    ${metadata.description}`);
    }
  }
  console.log();
}

function showHelp() {
  console.log(`
Plugin Manager

Usage:
  uruc plugin <command> [options]

Commands:
  list                    List all configured and discovered plugins
  enable <name>           Enable a plugin
  disable <name>          Disable a plugin (soft uninstall)
  install <path>          Install a plugin from a directory
  uninstall <name>        Disable a plugin (soft uninstall)
  uninstall <name> --hard Delete a plugin (hard uninstall)
  discover                Discover all plugins in configured paths
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runPluginCommand(process.argv.slice(2));
}
