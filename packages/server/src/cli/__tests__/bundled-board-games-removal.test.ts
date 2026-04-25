import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import { BUNDLED_PLUGINS } from '../lib/city.js';
import { getPackageRoot } from '../../runtime-paths.js';

function readDefaultCityConfig() {
  return JSON.parse(
    readFileSync(resolve(getPackageRoot(), 'uruc.city.json'), 'utf8'),
  ) as {
    plugins?: Record<string, unknown>;
  };
}

describe('bundled board-game plugins', () => {
  it('exposes chess but keeps chinese chess out of bundled discovery and the default city config', () => {
    const defaultCityConfig = readDefaultCityConfig();

    expect(BUNDLED_PLUGINS.some((plugin) => plugin.pluginId === 'uruc.chess')).toBe(true);
    expect(BUNDLED_PLUGINS.some((plugin) => plugin.pluginId === 'uruc.chinese-chess')).toBe(false);
    expect(defaultCityConfig.plugins?.['uruc.chess']).toEqual(expect.objectContaining({
      pluginId: 'uruc.chess',
      packageName: '@uruc/plugin-chess',
      enabled: true,
      devOverridePath: '../plugins/chess',
    }));
    expect(defaultCityConfig.plugins?.['uruc.chinese-chess']).toBeUndefined();
  });
});
