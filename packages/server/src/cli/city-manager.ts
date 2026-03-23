import { existsSync } from 'fs';
import path from 'path';

import dotenv from 'dotenv';

import { EMPTY_CITY_CONFIG, writeCityConfig } from '../core/plugin-platform/config.js';
import { getActiveEnvPath, getCityConfigPath } from '../runtime-paths.js';

dotenv.config({ path: getActiveEnvPath(), quiet: true });

const cityConfigPath = getCityConfigPath();

export async function runCityCommand(args: string[]): Promise<void> {
  const command = args[0] ?? 'init';

  switch (command) {
    case 'init':
      await initCity();
      return;
    default:
      throw new Error(`Unknown city command: ${command}`);
  }
}

async function initCity(): Promise<void> {
  if (existsSync(cityConfigPath)) {
    console.log(`City config already exists at ${cityConfigPath}`);
    return;
  }

  await writeCityConfig(cityConfigPath, {
    ...EMPTY_CITY_CONFIG,
    apiVersion: 2,
    approvedPublishers: ['uruc'],
    pluginStoreDir: '.uruc/plugins',
    plugins: {},
  });

  console.log(`✓ Initialized city config at ${path.relative(process.cwd(), cityConfigPath)}`);
}
