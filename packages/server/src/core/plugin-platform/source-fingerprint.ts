import { createHash } from 'crypto';
import { readdir, readFile, readlink } from 'fs/promises';
import path from 'path';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function normalizeRelativePath(targetPath: string): string {
  return targetPath.split(path.sep).join('/');
}

async function hashDirectory(rootPath: string, currentPath: string, hash: ReturnType<typeof createHash>): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue;
    }
    if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(currentPath, entry.name);
    const relativePath = normalizeRelativePath(path.relative(rootPath, entryPath));

    if (entry.isDirectory()) {
      hash.update(`dir:${relativePath}\n`);
      await hashDirectory(rootPath, entryPath, hash);
      continue;
    }

    if (entry.isFile()) {
      hash.update(`file:${relativePath}\n`);
      hash.update(await readFile(entryPath));
      hash.update('\n');
      continue;
    }

    if (entry.isSymbolicLink()) {
      hash.update(`symlink:${relativePath}\n`);
      hash.update(await readlink(entryPath));
      hash.update('\n');
    }
  }
}

export function formatIntegrityFingerprint(integrity: string): string {
  return `integrity:${integrity}`;
}

export async function createSourceFingerprint(sourcePath: string, integrity?: string): Promise<string> {
  if (typeof integrity === 'string' && integrity.trim() !== '') {
    return formatIntegrityFingerprint(integrity.trim());
  }

  const hash = createHash('sha256');
  hash.update('uruc-plugin-source-fingerprint/v1\n');
  await hashDirectory(sourcePath, sourcePath, hash);
  return `sha256:${hash.digest('hex')}`;
}
