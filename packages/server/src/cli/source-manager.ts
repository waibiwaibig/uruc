import dotenv from 'dotenv';

import { readCityConfig, writeCityConfig } from '../core/plugin-platform/config.js';
import { getEnvPath, getCityConfigPath } from '../runtime-paths.js';

dotenv.config({ path: getEnvPath(), quiet: true });

const cityConfigPath = getCityConfigPath();

export async function runSourceCommand(args: string[]): Promise<void> {
  const command = args[0] ?? 'list';
  const config = await readCityConfig(cityConfigPath);

  switch (command) {
    case 'list':
      console.log(JSON.stringify(config.sources, null, 2));
      return;
    case 'add': {
      const [id, registry] = [args[1], args[2]];
      if (!id || !registry) {
        throw new Error('Usage: uruc source add <id> <registry>');
      }
      config.sources = config.sources.filter((source) => source.id !== id);
      config.sources.push({ id, type: 'npm', registry });
      await writeCityConfig(cityConfigPath, config);
      console.log(`✓ Added source ${id}`);
      return;
    }
    case 'remove': {
      const id = args[1];
      if (!id) {
        throw new Error('Usage: uruc source remove <id>');
      }
      config.sources = config.sources.filter((source) => source.id !== id);
      await writeCityConfig(cityConfigPath, config);
      console.log(`✓ Removed source ${id}`);
      return;
    }
    default:
      throw new Error(`Unknown source command: ${command}`);
  }
}
