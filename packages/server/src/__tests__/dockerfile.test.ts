import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dockerfilePath = path.resolve(__dirname, '../../Dockerfile');
const dockerComposePath = path.resolve(__dirname, '../../../../docker-compose.yml');
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
const dockerCompose = fs.readFileSync(dockerComposePath, 'utf8');

describe('packages/server/Dockerfile', () => {
  it('materializes the checked-in city lock instead of copying a source .uruc directory', () => {
    expect(dockerfile).toContain('syncCityLock');
    expect(dockerfile).not.toContain('COPY --from=builder /app/packages/server/.uruc ./.uruc');
    expect(dockerfile).not.toContain('COPY packages/server/.uruc');
  });

  it('installs workspace manifests needed by the monorepo build', () => {
    expect(dockerfile).toContain('COPY package-lock.json');
    expect(dockerfile).toContain('COPY packages/plugin-sdk/package.json packages/plugin-sdk/');
    expect(dockerfile).toContain('COPY packages/plugins/park/package.json packages/plugins/park/');
    expect(dockerfile).toContain('COPY packages/plugins/social/package.json packages/plugins/social/');
  });
});

describe('docker-compose.yml', () => {
  it('points the city config, lock, and plugin store at the packaged server paths', () => {
    expect(dockerCompose).toContain('CITY_CONFIG_PATH=/app/packages/server/uruc.city.json');
    expect(dockerCompose).toContain('CITY_LOCK_PATH=/app/packages/server/uruc.city.lock.json');
    expect(dockerCompose).toContain('PLUGIN_STORE_DIR=/app/packages/server/.uruc/plugins');
  });
});
