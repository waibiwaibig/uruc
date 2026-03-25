import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

async function readJson<T>(targetPath: string): Promise<T> {
  return JSON.parse(await readFile(targetPath, 'utf8')) as T;
}

describe('publishable package metadata', () => {
  it('exposes the public cli, server, sdk, and social plugin packages for npm publishing', async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

    const cliPkg = await readJson<{
      name: string;
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'cli', 'package.json'));
    const serverPkg = await readJson<{
      name: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'server', 'package.json'));
    const sdkPkg = await readJson<{
      name: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'plugin-sdk', 'package.json'));
    const socialPkg = await readJson<{
      name: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'plugins', 'social', 'package.json'));

    expect(cliPkg.name).toBe('uruc');
    expect(cliPkg.bin?.uruc).toBeDefined();
    expect(cliPkg.dependencies?.['@uruc/server']).toBeDefined();

    expect(serverPkg.name).toBe('@uruc/server');
    expect(serverPkg.private).not.toBe(true);
    expect(serverPkg.publishConfig?.access).toBe('public');
    expect(serverPkg.files).toEqual(expect.arrayContaining(['dist', 'public', 'bundled-plugins']));

    expect(sdkPkg.name).toBe('@uruc/plugin-sdk');
    expect(sdkPkg.private).not.toBe(true);
    expect(sdkPkg.publishConfig?.access).toBe('public');
    expect(sdkPkg.files).toEqual(expect.arrayContaining(['dist']));

    expect(socialPkg.name).toBe('@uruc/plugin-social');
    expect(socialPkg.private).not.toBe(true);
    expect(socialPkg.publishConfig?.access).toBe('public');
    expect(socialPkg.files).toEqual(expect.arrayContaining(['index.mjs', 'service.mjs', 'service.d.mts', 'frontend-dist']));
  });
});
