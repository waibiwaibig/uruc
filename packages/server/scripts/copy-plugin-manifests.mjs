#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const srcPluginsDir = path.join(packageRoot, 'src', 'plugins');
const distPluginsDir = path.join(packageRoot, 'dist', 'plugins');
const COPIED_FILES = new Set(['plugin.json', 'game.json', 'games.dev.json', 'games.prod.json']);

await removeStaleManifests(distPluginsDir);
await copyPluginManifests(srcPluginsDir, distPluginsDir);

async function removeStaleManifests(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeStaleManifests(entryPath);
      return;
    }
    if (entry.isFile() && COPIED_FILES.has(entry.name)) {
      await fs.unlink(entryPath);
    }
  }));
}

async function copyPluginManifests(srcDir, destDir) {
  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (!entry.isDirectory()) return;

    await Promise.all(Array.from(COPIED_FILES).map(async (filename) => {
      const sourceFilePath = path.join(sourcePath, filename);
      try {
        const manifest = await fs.readFile(sourceFilePath, 'utf8');
        await fs.mkdir(destPath, { recursive: true });
        await fs.writeFile(path.join(destPath, filename), manifest, 'utf8');
      } catch (error) {
        if (error && error.code !== 'ENOENT') throw error;
      }
    }));

    await copyPluginManifests(sourcePath, destPath);
  }));
}
