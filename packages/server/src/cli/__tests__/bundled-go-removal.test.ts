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

describe('bundled go removal', () => {
  it('does not expose the go venue in bundled discovery or the default city config', () => {
    const defaultCityConfig = readDefaultCityConfig();

    expect(BUNDLED_PLUGINS.some((plugin) => plugin.pluginId === 'uruc.go')).toBe(false);
    expect(defaultCityConfig.plugins?.['uruc.go']).toBeUndefined();
  });
});
