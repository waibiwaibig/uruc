import path from 'path';
import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

async function readJson<T>(targetPath: string): Promise<T> {
  return JSON.parse(await readFile(targetPath, 'utf8')) as T;
}

async function packDryRun(packageDir: string): Promise<Array<{
  files: Array<{ path: string }>;
}>> {
  const { stdout } = await execFileAsync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageDir,
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  const match = stdout.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  if (!match) {
    throw new Error(`Could not find trailing npm pack JSON in output:\n${stdout}`);
  }
  return JSON.parse(match[1]) as Array<{ files: Array<{ path: string }> }>;
}

describe('publishable package metadata', () => {
  it('exposes the public cli, server, sdk, social plugin, and park plugin packages for npm publishing', async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

    const cliPkg = await readJson<{
      name: string;
      license?: string;
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'cli', 'package.json'));
    const serverPkg = await readJson<{
      name: string;
      license?: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'server', 'package.json'));
    const sdkPkg = await readJson<{
      name: string;
      license?: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'plugin-sdk', 'package.json'));
    const socialPkg = await readJson<{
      name: string;
      license?: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'plugins', 'social', 'package.json'));
    const parkPkg = await readJson<{
      name: string;
      license?: string;
      private?: boolean;
      publishConfig?: { access?: string };
      files?: string[];
    }>(path.join(repoRoot, 'packages', 'plugins', 'park', 'package.json'));

    expect(cliPkg.name).toBe('uruc');
    expect(cliPkg.license).toBe('Apache-2.0');
    expect(cliPkg.bin?.uruc).toBeDefined();
    expect(cliPkg.dependencies?.['@uruc/server']).toBeDefined();

    expect(serverPkg.name).toBe('@uruc/server');
    expect(serverPkg.license).toBe('Apache-2.0');
    expect(serverPkg.private).not.toBe(true);
    expect(serverPkg.publishConfig?.access).toBe('public');
    expect(serverPkg.files).toEqual(expect.arrayContaining(['dist', 'public', 'bundled-plugins']));

    expect(sdkPkg.name).toBe('@uruc/plugin-sdk');
    expect(sdkPkg.license).toBe('Apache-2.0');
    expect(sdkPkg.private).not.toBe(true);
    expect(sdkPkg.publishConfig?.access).toBe('public');
    expect(sdkPkg.files).toEqual(expect.arrayContaining(['dist']));

    expect(socialPkg.name).toBe('@uruc/plugin-social');
    expect(socialPkg.license).toBe('Apache-2.0');
    expect(socialPkg.private).not.toBe(true);
    expect(socialPkg.publishConfig?.access).toBe('public');
    expect(socialPkg.files).toEqual(expect.arrayContaining(['index.mjs', 'service.mjs', 'service.d.mts', 'frontend-dist']));

    expect(parkPkg.name).toBe('@uruc/plugin-park');
    expect(parkPkg.license).toBe('Apache-2.0');
    expect(parkPkg.private).not.toBe(true);
    expect(parkPkg.publishConfig?.access).toBe('public');
    expect(parkPkg.files).toEqual(expect.arrayContaining([
      'index.mjs',
      'service.mjs',
      'service.d.mts',
      'frontend-dist',
      'README.md',
      'README.zh-CN.md',
      'GUIDE.md',
      'GUIDE.zh-CN.md',
    ]));
  });

  it('excludes removed build artifacts from the published server tarball', async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const [packResult] = await packDryRun(path.join(repoRoot, 'packages', 'server'));
    const packedFiles = packResult.files.map((entry) => entry.path);

    expect(packedFiles).not.toContain('dist/cli/source-manager.js');
    expect(packedFiles).not.toContain('dist/plugins/chess/index.js');
    expect(packedFiles).not.toContain('dist/plugins/arcade/index.js');
  }, 30000);
});
