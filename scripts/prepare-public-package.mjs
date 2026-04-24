#!/usr/bin/env node

import { existsSync } from 'fs';
import { cp, mkdir, readdir, rm } from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = process.cwd();
const packageKey = path.relative(repoRoot, packageRoot).split(path.sep).join('/');

async function copyLegalFiles(targetRoot) {
  for (const filename of ['LICENSE', 'NOTICE']) {
    await cp(path.join(repoRoot, filename), path.join(targetRoot, filename), { force: true });
  }
}

async function buildPluginFrontend(pluginRoot) {
  await execFileAsync('node', [
    path.join(repoRoot, 'scripts', 'build-plugin-frontend.mjs'),
    '--plugin',
    pluginRoot,
    '--out',
    path.join(pluginRoot, 'frontend-dist'),
  ], {
    cwd: repoRoot,
    env: process.env,
  });
}

function isCompiledTestFile(entryName) {
  return /\.test\.(?:[cm]?js(?:\.map)?|d\.[cm]?ts)$/.test(entryName);
}

async function pruneCompiledTests(targetDir) {
  if (!existsSync(targetDir)) {
    return;
  }

  const entries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        await rm(entryPath, { recursive: true, force: true });
        continue;
      }
      await pruneCompiledTests(entryPath);
      continue;
    }

    if (isCompiledTestFile(entry.name)) {
      await rm(entryPath, { force: true });
    }
  }
}

async function prepareServerPackage() {
  await pruneCompiledTests(path.join(packageRoot, 'dist'));

  const publicSourceDir = path.join(repoRoot, 'packages', 'web', 'dist');
  if (!existsSync(path.join(publicSourceDir, 'index.html'))) {
    throw new Error('packages/web/dist/index.html is missing. Run the web build before packing @uruc/server.');
  }

  await rm(path.join(packageRoot, 'public'), { recursive: true, force: true });
  await cp(publicSourceDir, path.join(packageRoot, 'public'), { recursive: true });

  const bundledPluginsDir = path.join(packageRoot, 'bundled-plugins');
  await rm(bundledPluginsDir, { recursive: true, force: true });
  await mkdir(bundledPluginsDir, { recursive: true });

  for (const pluginDir of ['fleamarket', 'social']) {
    const bundledPluginSource = path.join(repoRoot, 'packages', 'plugins', pluginDir);
    if (pluginDir === 'social') {
      await buildPluginFrontend(bundledPluginSource);
    }
    await cp(bundledPluginSource, path.join(bundledPluginsDir, pluginDir), {
      recursive: true,
      filter: (sourcePath) => !sourcePath.includes(`${path.sep}node_modules${path.sep}`),
    });
  }
}

async function main() {
  await copyLegalFiles(packageRoot);

  if (packageKey === 'packages/server') {
    await prepareServerPackage();
    return;
  }

  if (packageKey === 'packages/plugins/social') {
    await buildPluginFrontend(packageRoot);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
