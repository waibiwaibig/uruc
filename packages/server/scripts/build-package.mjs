#!/usr/bin/env node

import { rm } from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const tscExecutable = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

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
