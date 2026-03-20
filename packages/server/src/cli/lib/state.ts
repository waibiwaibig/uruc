import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

import { getPackageRoot, getEnvPath } from '../../runtime-paths.js';
import type { BuildState, CliMeta, ManagedProcessState } from './types.js';

const packageRoot = getPackageRoot();
const repoRoot = path.resolve(packageRoot, '..', '..');
const cliStateDir = process.env.URUC_CLI_STATE_DIR?.trim()
  ? path.resolve(process.env.URUC_CLI_STATE_DIR)
  : path.join(repoRoot, '.uruc');
const runtimeDir = path.join(cliStateDir, 'runtime');

export function getRepoRoot(): string {
  return repoRoot;
}

export function getServerEnvPath(): string {
  if (process.env.URUC_SERVER_ENV_PATH?.trim()) {
    return path.resolve(process.env.URUC_SERVER_ENV_PATH);
  }
  return getEnvPath();
}

export function getRootEnvPath(): string {
  return path.join(repoRoot, '.env');
}

export function getCliStateDir(): string {
  return cliStateDir;
}

export function getRuntimeDir(): string {
  return runtimeDir;
}

export function getCliMetaPath(): string {
  return path.join(cliStateDir, 'cli.json');
}

export function getBuildStatePath(): string {
  return path.join(cliStateDir, 'build-state.json');
}

export function getManagedProcessPath(): string {
  return path.join(runtimeDir, 'process.json');
}

export function getManagedLogPath(): string {
  return path.join(runtimeDir, 'uruc.log');
}

export function ensureCliDirs(): void {
  mkdirSync(cliStateDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });
}

function readJsonFile<T>(targetPath: string): T | null {
  if (!existsSync(targetPath)) return null;
  try {
    return JSON.parse(readFileSync(targetPath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(targetPath: string, value: unknown): void {
  const dir = path.dirname(targetPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readCliMeta(): CliMeta {
  return readJsonFile<CliMeta>(getCliMetaPath()) ?? { language: 'zh-CN' };
}

export function writeCliMeta(next: CliMeta): void {
  ensureCliDirs();
  writeJsonFile(getCliMetaPath(), next);
}

export function readBuildState(): BuildState | null {
  return readJsonFile<BuildState>(getBuildStatePath());
}

export function writeBuildState(state: BuildState): void {
  ensureCliDirs();
  writeJsonFile(getBuildStatePath(), state);
}

export function readManagedProcess(): ManagedProcessState | null {
  return readJsonFile<ManagedProcessState>(getManagedProcessPath());
}

export function writeManagedProcess(state: ManagedProcessState): void {
  ensureCliDirs();
  writeJsonFile(getManagedProcessPath(), state);
}

export function clearManagedProcess(): void {
  const targetPath = getManagedProcessPath();
  if (!existsSync(targetPath)) return;
  try {
    unlinkSync(targetPath);
  } catch {
    // no-op
  }
}
