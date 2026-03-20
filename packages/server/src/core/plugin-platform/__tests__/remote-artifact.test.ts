import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { createServer, type Server } from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { promisify } from 'util';

import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];
const servers: Server[] = [];
const execFileAsync = promisify(execFile);

async function createPluginPackage(root: string, options: {
  pluginId: string;
  packageName: string;
  version: string;
  publisher: string;
}) {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify({
    name: options.packageName,
    version: options.version,
    type: 'module',
    urucPlugin: {
      pluginId: options.pluginId,
      apiVersion: 2,
      kind: 'backend',
      entry: './index.mjs',
      publisher: options.publisher,
      displayName: options.pluginId,
      permissions: [],
      dependencies: [],
      activation: ['startup'],
    },
  }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(root, 'index.mjs'), `export default {
    kind: 'uruc.backend-plugin@v2',
    pluginId: '${options.pluginId}',
    apiVersion: 2,
    async setup() {},
  };\n`, 'utf8');
}

async function packDirectoryWithNpm(packageRoot: string): Promise<{
  tarballPath: string;
  integrity: string;
}> {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-remote-artifact-pack-'));
  tempDirs.push(outputDir);
  const { stdout } = await execFileAsync('npm', ['pack', packageRoot], { cwd: outputDir });
  const tarballName = stdout.trim().split('\n').filter(Boolean).at(-1);
  if (!tarballName) {
    throw new Error(`npm pack did not create a tarball for ${packageRoot}`);
  }
  const tarballPath = path.join(outputDir, tarballName);
  const tarball = await readFile(tarballPath);
  return {
    tarballPath,
    integrity: `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
  };
}

async function packDirectoryWithTar(sourceDir: string): Promise<string> {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-remote-artifact-malformed-'));
  tempDirs.push(outputDir);
  const tarballPath = path.join(outputDir, 'malformed.tgz');
  await execFileAsync('tar', ['-czf', tarballPath, '-C', sourceDir, '.']);
  return tarballPath;
}

async function startArtifactServer(tarballPath: string): Promise<string> {
  const tarball = await readFile(tarballPath);
  const server = createServer((req, res) => {
    if (req.url === '/plugin.tgz') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(tarball);
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('artifact server did not bind to an address');
  }
  return `http://127.0.0.1:${address.port}/plugin.tgz`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('remote plugin artifact installer', () => {
  it('normalizes npm-style package tarballs to a package root', async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-remote-artifact-plugin-'));
    tempDirs.push(pluginRoot);
    await createPluginPackage(pluginRoot, {
      pluginId: 'uruc.chess',
      packageName: '@uruc/plugin-chess',
      version: '0.1.0',
      publisher: 'uruc',
    });
    const { tarballPath, integrity } = await packDirectoryWithNpm(pluginRoot);
    const artifactUrl = await startArtifactServer(tarballPath);
    const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-remote-artifact-staging-'));
    tempDirs.push(stagingRoot);

    const { downloadAndExtractPluginArtifact } = await import('../remote-artifact.js');
    const result = await downloadAndExtractPluginArtifact({
      artifactUrl,
      integrity,
      stagingRoot,
    });

    expect(await readFile(path.join(result.packageRoot, 'package.json'), 'utf8')).toContain('"name": "@uruc/plugin-chess"');
  });

  it('rejects tarballs that do not resolve to exactly one package root', async () => {
    const malformedRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-remote-artifact-malformed-src-'));
    tempDirs.push(malformedRoot);
    await writeFile(path.join(malformedRoot, 'README.md'), '# malformed\n', 'utf8');
    const tarballPath = await packDirectoryWithTar(malformedRoot);
    const artifactUrl = await startArtifactServer(tarballPath);
    const tarball = await readFile(tarballPath);
    const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
    const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-remote-artifact-bad-staging-'));
    tempDirs.push(stagingRoot);

    const { downloadAndExtractPluginArtifact } = await import('../remote-artifact.js');
    await expect(downloadAndExtractPluginArtifact({
      artifactUrl,
      integrity,
      stagingRoot,
    })).rejects.toThrow(/package root/i);
  });
});
