#!/usr/bin/env node

import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';
import { createHash } from 'crypto';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const lockId = createHash('sha256').update(packageRoot).digest('hex').slice(0, 16);
const lockDir = path.join(os.tmpdir(), `uruc-server-build-${lockId}.lock`);
const staleLockMs = 5 * 60 * 1000;
const ownerWriteGraceMs = 5_000;
const pollMs = 100;
const tscExecutable = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function parseOwner(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function acquireBuildLock() {
  while (true) {
    try {
      await mkdir(lockDir, { mode: 0o700 });
      await writeFile(path.join(lockDir, 'owner.json'), `${JSON.stringify({
        pid: process.pid,
        packageRoot,
        createdAt: new Date().toISOString(),
      })}\n`);
      return async () => {
        await rm(lockDir, { recursive: true, force: true });
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }

    try {
      const current = await stat(lockDir);
      const ageMs = Date.now() - current.mtimeMs;
      const ownerText = await readFile(path.join(lockDir, 'owner.json'), 'utf8').catch(() => '');
      const owner = ownerText ? parseOwner(ownerText) : null;
      const ownerMatchesPackage = owner?.packageRoot === packageRoot;
      const ownerIsAlive = ownerMatchesPackage && isProcessAlive(owner.pid);
      const ownerMissingAfterGrace = !owner && ageMs > ownerWriteGraceMs;
      const ownerDead = ownerMatchesPackage && !ownerIsAlive;
      const ownerStale = ageMs > staleLockMs;

      if (ownerMissingAfterGrace || ownerDead || ownerStale) {
        await rm(lockDir, { recursive: true, force: true });
        console.warn(`Removed stale server build lock${ownerText ? `: ${ownerText.trim()}` : ''}`);
        continue;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      continue;
    }

    await sleep(pollMs);
  }
}

const releaseBuildLock = await acquireBuildLock();

try {
  await rm(path.join(packageRoot, 'dist'), { recursive: true, force: true });
  execFileSync(tscExecutable, [], {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  });
  execFileSync(process.execPath, [path.join(packageRoot, 'scripts', 'copy-plugin-manifests.mjs')], {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  });
} finally {
  await releaseBuildLock();
}
