import { createHash } from 'crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import * as tar from 'tar';

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function isFileUrl(value: string): boolean {
  return value.startsWith('file://');
}

async function readArtifactBytes(artifactUrl: string): Promise<Buffer> {
  if (isHttpUrl(artifactUrl)) {
    const response = await fetch(artifactUrl);
    if (!response.ok) {
      throw new Error(`Failed to download plugin artifact (${response.status} ${response.statusText})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const localPath = isFileUrl(artifactUrl) ? fileURLToPath(artifactUrl) : artifactUrl;
  return readFile(localPath);
}

function verifyArtifactIntegrity(artifact: Buffer, integrity?: string): void {
  if (!integrity) {
    return;
  }

  const separatorIndex = integrity.indexOf('-');
  if (separatorIndex <= 0 || separatorIndex === integrity.length - 1) {
    throw new Error(`Invalid plugin artifact integrity string: ${integrity}`);
  }

  const algorithm = integrity.slice(0, separatorIndex);
  const expected = integrity.slice(separatorIndex + 1);
  let actual: string;
  try {
    actual = createHash(algorithm).update(artifact).digest('base64');
  } catch {
    throw new Error(`Unsupported plugin artifact integrity algorithm: ${algorithm}`);
  }

  if (actual !== expected) {
    throw new Error('Plugin artifact integrity does not match the advertised digest');
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function resolvePackageRoot(extractRoot: string): Promise<string> {
  const npmPackageRoot = path.join(extractRoot, 'package');
  if (await pathExists(path.join(npmPackageRoot, 'package.json'))) {
    return npmPackageRoot;
  }

  const candidates: string[] = [];
  if (await pathExists(path.join(extractRoot, 'package.json'))) {
    candidates.push(extractRoot);
  }

  const entries = await readdir(extractRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidateRoot = path.join(extractRoot, entry.name);
    if (await pathExists(path.join(candidateRoot, 'package.json'))) {
      candidates.push(candidateRoot);
    }
  }

  if (candidates.length !== 1) {
    throw new Error(`Plugin artifact must resolve to exactly one package root, found ${candidates.length}`);
  }

  return candidates[0]!;
}

export async function downloadAndExtractPluginArtifact(options: {
  artifactUrl: string;
  integrity?: string;
  stagingRoot: string;
}): Promise<{
  artifactPath: string;
  extractRoot: string;
  packageRoot: string;
}> {
  await mkdir(options.stagingRoot, { recursive: true });

  const artifact = await readArtifactBytes(options.artifactUrl);
  verifyArtifactIntegrity(artifact, options.integrity);

  const artifactPath = path.join(options.stagingRoot, 'plugin.tgz');
  const extractRoot = path.join(options.stagingRoot, 'package');
  await writeFile(artifactPath, artifact);
  await mkdir(extractRoot, { recursive: true });
  await tar.x({
    file: artifactPath,
    cwd: extractRoot,
    strict: true,
  });

  return {
    artifactPath,
    extractRoot,
    packageRoot: await resolvePackageRoot(extractRoot),
  };
}
