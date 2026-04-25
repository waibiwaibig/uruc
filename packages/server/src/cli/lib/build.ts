import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

import { getPackageRoot, isWorkspaceLayout } from '../../runtime-paths.js';
import { getRepoRoot, writeBuildState } from './state.js';
import { runOrThrow } from './process.js';
import type { BuildState } from './types.js';

const repoRoot = getRepoRoot();
const packageRoot = getPackageRoot();

const INPUT_PATHS = [
  path.join(repoRoot, 'packages', 'plugin-sdk', 'src'),
  path.join(repoRoot, 'packages', 'plugin-sdk', 'package.json'),
  path.join(repoRoot, 'packages', 'plugin-sdk', 'tsconfig.json'),
  path.join(packageRoot, 'src'),
  path.join(packageRoot, 'package.json'),
  path.join(packageRoot, 'tsconfig.json'),
  path.join(repoRoot, 'packages', 'web', 'src'),
  path.join(repoRoot, 'packages', 'web', 'package.json'),
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'package-lock.json'),
];

const OUTPUT_PATHS = [
  path.join(repoRoot, 'packages', 'plugin-sdk', 'dist', 'index.js'),
  path.join(packageRoot, 'dist', 'index.js'),
  path.join(repoRoot, 'packages', 'web', 'dist', 'index.html'),
];

const INSTALLED_OUTPUT_PATHS = [
  path.join(packageRoot, 'dist', 'index.js'),
  path.join(packageRoot, 'dist', 'cli', 'index.js'),
  path.join(packageRoot, 'public', 'index.html'),
  path.join(packageRoot, 'bundled-plugins', 'chess', 'package.json'),
  path.join(packageRoot, 'bundled-plugins', 'fleamarket', 'package.json'),
  path.join(packageRoot, 'bundled-plugins', 'social', 'package.json'),
];

export interface BuildFreshness {
  stale: boolean;
  reason: string;
  newestInputMtimeMs: number;
  oldestOutputMtimeMs: number;
  outputs: string[];
}

function newestMtime(targetPath: string): number {
  if (!existsSync(targetPath)) return 0;
  const stats = statSync(targetPath);
  if (!stats.isDirectory()) return stats.mtimeMs;

  let newest = stats.mtimeMs;
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtime(path.join(targetPath, entry.name)));
  }
  return newest;
}

function oldestOutputMtime(paths: string[]): number {
  let oldest = Number.POSITIVE_INFINITY;
  for (const targetPath of paths) {
    if (!existsSync(targetPath)) return 0;
    oldest = Math.min(oldest, statSync(targetPath).mtimeMs);
  }
  return Number.isFinite(oldest) ? oldest : 0;
}

export function getBuildFreshness(): BuildFreshness {
  if (!isWorkspaceLayout()) {
    const oldestOutputMtimeMs = oldestOutputMtime(INSTALLED_OUTPUT_PATHS);
    if (oldestOutputMtimeMs === 0) {
      return {
        stale: true,
        reason: 'packaged build artifacts are missing',
        newestInputMtimeMs: 0,
        oldestOutputMtimeMs,
        outputs: INSTALLED_OUTPUT_PATHS,
      };
    }

    return {
      stale: false,
      reason: 'packaged build artifacts are current',
      newestInputMtimeMs: oldestOutputMtimeMs,
      oldestOutputMtimeMs,
      outputs: INSTALLED_OUTPUT_PATHS,
    };
  }

  const newestInputMtimeMs = Math.max(...INPUT_PATHS.map((targetPath) => newestMtime(targetPath)));
  const oldestOutputMtimeMs = oldestOutputMtime(OUTPUT_PATHS);

  if (oldestOutputMtimeMs === 0) {
    return {
      stale: true,
      reason: 'build artifacts are missing',
      newestInputMtimeMs,
      oldestOutputMtimeMs,
      outputs: OUTPUT_PATHS,
    };
  }

  if (newestInputMtimeMs > oldestOutputMtimeMs) {
    return {
      stale: true,
      reason: 'source files are newer than build artifacts',
      newestInputMtimeMs,
      oldestOutputMtimeMs,
      outputs: OUTPUT_PATHS,
    };
  }

  return {
    stale: false,
    reason: 'build artifacts are current',
    newestInputMtimeMs,
    oldestOutputMtimeMs,
    outputs: OUTPUT_PATHS,
  };
}

export async function buildAll(force = false): Promise<BuildFreshness> {
  const freshness = getBuildFreshness();
  if (!isWorkspaceLayout()) {
    if (freshness.stale) {
      throw new Error('This installed Uruc package is missing packaged build artifacts. Reinstall the package or run Uruc from the source workspace.');
    }
    return freshness;
  }

  if (!force && !freshness.stale) return freshness;

  await runOrThrow('npm', ['run', 'build', '--workspace=@uruc/plugin-sdk'], { cwd: repoRoot });
  await runOrThrow('npm', ['run', 'build', '--workspace=packages/server'], { cwd: repoRoot });
  await runOrThrow('npm', ['run', 'build', '--workspace=packages/web'], { cwd: repoRoot });

  const next = getBuildFreshness();
  const state: BuildState = {
    builtAt: new Date().toISOString(),
    newestInputMtimeMs: next.newestInputMtimeMs,
    oldestOutputMtimeMs: next.oldestOutputMtimeMs,
    outputs: next.outputs,
  };
  writeBuildState(state);
  return next;
}
