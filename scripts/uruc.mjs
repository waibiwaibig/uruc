#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import { ensureBetterSqlite3Ready } from './lib/uruc-bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const serverRoot = path.join(repoRoot, 'packages', 'server');
const cliEntrypoint = path.join(serverRoot, 'dist', 'cli', 'index.js');

const inputPaths = [
  path.join(serverRoot, 'src'),
  path.join(serverRoot, 'package.json'),
  path.join(serverRoot, 'tsconfig.json'),
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'package-lock.json'),
];

function newestMtime(targetPath) {
  if (!existsSync(targetPath)) return 0;
  const stats = statSync(targetPath);
  if (!stats.isDirectory()) return stats.mtimeMs;
  let newest = stats.mtimeMs;
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtime(path.join(targetPath, entry.name)));
  }
  return newest;
}

function cliNeedsBuild() {
  if (!existsSync(cliEntrypoint)) return true;
  const outputMtime = statSync(cliEntrypoint).mtimeMs;
  const newestInput = Math.max(...inputPaths.map((target) => newestMtime(target)));
  return newestInput > outputMtime;
}

function run(command, args, cwd = repoRoot, stdio = 'inherit') {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    if (stdio === 'pipe') {
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      };
    }
    process.exit(result.status ?? 1);
  }
  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function ensureNodeVersion() {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (!Number.isFinite(major) || major < 20) {
    console.error(`[uruc] Node.js >= 20 is required. Current version: ${process.version}`);
    process.exit(1);
  }
}

function dependenciesReady() {
  const required = [
    path.join(repoRoot, 'node_modules', 'typescript', 'package.json'),
    path.join(repoRoot, 'node_modules', 'tsx', 'package.json'),
    path.join(repoRoot, 'node_modules', 'dotenv', 'package.json'),
    path.join(repoRoot, 'node_modules', 'better-sqlite3', 'package.json'),
  ];
  return required.every((target) => existsSync(target));
}

function ensureDependencies() {
  if (dependenciesReady()) return;
  console.log('[uruc] workspace dependencies are missing; running npm install first.');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
}

function probeBetterSqlite3() {
  const script = [
    "import Database from 'better-sqlite3';",
    "const db = new Database(':memory:');",
    "db.prepare('select 1 as ok').get();",
    'db.close();',
  ].join(' ');
  return run(process.execPath, ['--input-type=module', '-e', script], repoRoot, 'pipe');
}

ensureNodeVersion();
ensureDependencies();
ensureBetterSqlite3Ready({
  probeBetterSqlite3,
  runCommand: run,
});

if (cliNeedsBuild()) {
  run('npm', ['run', 'build', '--workspace=packages/server']);
}

run(process.execPath, [cliEntrypoint, ...process.argv.slice(2)], repoRoot);
