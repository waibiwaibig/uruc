import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import { BUNDLED_PLUGINS } from '../lib/city.js';

function readDefaultCityConfig() {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'packages/server/uruc.city.json'), 'utf8'),
  ) as {
    plugins?: Record<string, unknown>;
  };
}

describe('bundled board-game removals', () => {
  it('does not expose chess or chinese chess in bundled discovery or the default city config', () => {
    const defaultCityConfig = readDefaultCityConfig();

    expect(BUNDLED_PLUGINS.some((plugin) => plugin.pluginId === 'uruc.chess')).toBe(false);
    expect(BUNDLED_PLUGINS.some((plugin) => plugin.pluginId === 'uruc.chinese-chess')).toBe(false);
    expect(defaultCityConfig.plugins?.['uruc.chess']).toBeUndefined();
    expect(defaultCityConfig.plugins?.['uruc.chinese-chess']).toBeUndefined();
  });
});
