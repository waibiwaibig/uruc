import { closeSync, existsSync, openSync, readFileSync } from 'fs';
import net from 'net';
import { spawn } from 'child_process';
import path from 'path';

import { getPackageRoot, getPublicDir, getDbPath, getCityConfigPath } from '../../runtime-paths.js';
import { commandExists, exec, isPidAlive, killPid, openUrl, runOrThrow } from './process.js';
import { buildHealthUrl, buildPublicWsUrl } from './network.js';
import {
  clearManagedProcess,
  ensureCliDirs,
  getManagedLogPath,
  getServerEnvPath,
  readCliMeta,
  readManagedProcess,
  writeManagedProcess,
} from './state.js';
import { loadServerEnv } from './env.js';
import type { HealthStatus, ManagedProcessState } from './types.js';

const packageRoot = getPackageRoot();
const GRACEFUL_EXIT_WAIT_MS = 3200;
const FORCE_EXIT_WAIT_MS = 1200;
const PID_POLL_INTERVAL_MS = 100;

export interface RuntimeStatus {
  mode: 'stopped' | 'background' | 'systemd' | 'unmanaged';
  serviceName: string;
  envPath: string;
  reachability: 'local' | 'lan' | 'server';
  bindHost: string;
  siteUrl: string;
  healthUrl: string;
  wsUrl: string;
  dbPath: string;
  cityConfigPath: string;
  publicDir: string;
  adminUsername: string;
  managedProcess: ManagedProcessState | null;
  health: HealthStatus;
}

export type ManagedRuntimeMode = 'background' | 'systemd';

export function getServiceName(): string {
  return readCliMeta().serviceName ?? 'uruc';
}

export function hasSystemd(): boolean {
  return commandExists('systemctl');
}

export function isSystemdInstalled(): boolean {
  const serviceName = getServiceName();
  if (!hasSystemd()) return false;
  const result = exec('systemctl', ['status', serviceName]);
  const combinedOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (combinedOutput.includes(`${serviceName}.service could not be found`)) {
    return false;
  }
  return result.status === 0 || result.stderr.includes(`${serviceName}.service`) || result.stdout.includes(`${serviceName}.service`);
}

export function isSystemdActive(): boolean {
  const serviceName = getServiceName();
  if (!hasSystemd()) return false;
  const result = exec('systemctl', ['is-active', serviceName]);
  return result.status === 0 && result.stdout.trim() === 'active';
}

export async function fetchHealth(url: string): Promise<HealthStatus> {
  try {
    const res = await fetch(url);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    return { ok: res.ok, statusCode: res.status, url, body };
  } catch (error) {
    return { ok: false, url, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  loadServerEnv();

  const httpPort = process.env.PORT ?? '3000';
  const wsPort = process.env.WS_PORT ?? '3001';
  const bindHost = process.env.BIND_HOST ?? '127.0.0.1';
  const reachability = process.env.URUC_CITY_REACHABILITY === 'lan' || process.env.URUC_CITY_REACHABILITY === 'server'
    ? process.env.URUC_CITY_REACHABILITY
    : 'local';
  const baseUrl = process.env.BASE_URL && process.env.BASE_URL.trim() !== ''
    ? process.env.BASE_URL
    : `http://127.0.0.1:${httpPort}`;
  const wsUrl = buildPublicWsUrl(baseUrl, wsPort);
  const healthUrl = buildHealthUrl(bindHost, httpPort);
  const managed = getLiveManagedProcess();
  const localUnmanaged = managed ? null : findLocalUnmanagedProcess();
  const systemd = isSystemdActive();
  const health = await fetchHealth(healthUrl);

  let mode: RuntimeStatus['mode'] = 'stopped';
  if (systemd) mode = 'systemd';
  else if (managed) mode = 'background';
  else if (localUnmanaged) mode = 'unmanaged';
  else if (health.ok) mode = 'unmanaged';

  return {
    mode,
    serviceName: getServiceName(),
    envPath: getServerEnvPath(),
    reachability,
    bindHost,
    siteUrl: baseUrl,
    healthUrl,
    wsUrl,
    dbPath: getDbPath(),
    cityConfigPath: getCityConfigPath(),
    publicDir: getPublicDir(),
    adminUsername: process.env.ADMIN_USERNAME ?? '',
    managedProcess: managed,
    health,
  };
}

async function isPortAvailable(port: number): Promise<boolean> {
  if (!Number.isFinite(port) || port <= 0) return false;
  return await new Promise<boolean>((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      });
    tester.listen(port, '0.0.0.0');
  });
}

export async function assertConfiguredPortsAvailable(): Promise<void> {
  loadServerEnv();
  const ports = [process.env.PORT ?? '3000', process.env.WS_PORT ?? '3001'];
  for (const rawPort of ports) {
    const port = Number.parseInt(rawPort, 10);
    if (!Number.isFinite(port)) {
      throw new Error(`Invalid port: ${rawPort}`);
    }
    const free = await isPortAvailable(port);
    if (!free) {
      throw new Error(`Port ${port} is already in use.`);
    }
  }
}

export function getLiveManagedProcess(): ManagedProcessState | null {
  const current = readManagedProcess();
  if (!current) return null;
  if (!isPidAlive(current.pid)) {
    clearManagedProcess();
    return null;
  }
  return current;
}

function getConfiguredPort(key: 'PORT' | 'WS_PORT', fallback: string): number {
  loadServerEnv();
  const rawPort = process.env[key] ?? fallback;
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid ${key}: ${rawPort}`);
  }
  return port;
}

function getListeningPids(port: number): number[] {
  if (!commandExists('lsof')) return [];

  const result = exec('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  if (result.status !== 0) return [];

  return Array.from(
    new Set(
      result.stdout
        .split(/\r?\n/)
        .map((line) => Number.parseInt(line.trim(), 10))
        .filter((pid) => Number.isFinite(pid) && pid > 0),
    ),
  );
}

function getProcessCwd(pid: number): string | null {
  if (!commandExists('lsof')) return null;

  const result = exec('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
  if (result.status !== 0) return null;

  const cwdLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith('n') && line.length > 1);

  return cwdLine ? cwdLine.slice(1).trim() : null;
}

function findLocalUnmanagedProcess(): ManagedProcessState | null {
  const httpPort = getConfiguredPort('PORT', '3000');
  const wsPort = getConfiguredPort('WS_PORT', '3001');

  const httpPids = new Set(getListeningPids(httpPort));
  const wsPids = new Set(getListeningPids(wsPort));
  const candidatePids = Array.from(httpPids).filter((pid) => wsPids.has(pid));
  const expectedCwd = path.resolve(packageRoot);

  for (const pid of candidatePids) {
    const cwd = getProcessCwd(pid);
    if (!cwd) continue;
    if (path.resolve(cwd) !== expectedCwd) continue;
    return {
      pid,
      logPath: '',
      startedAt: '',
      command: [],
    };
  }

  return null;
}

async function waitForPidExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isPidAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, PID_POLL_INTERVAL_MS));
  }
  return !isPidAlive(pid);
}

async function terminatePid(pid: number, label: string): Promise<void> {
  if (!isPidAlive(pid)) return;
  if (!killPid(pid, 'SIGTERM')) {
    if (!isPidAlive(pid)) return;
    throw new Error(`Failed to signal ${label} process ${pid}.`);
  }
  const exitedGracefully = await waitForPidExit(pid, GRACEFUL_EXIT_WAIT_MS);
  if (exitedGracefully) return;

  if (!killPid(pid, 'SIGKILL')) {
    if (!isPidAlive(pid)) return;
    throw new Error(`Failed to force-kill ${label} process ${pid}.`);
  }

  const exitedAfterKill = await waitForPidExit(pid, FORCE_EXIT_WAIT_MS);
  if (!exitedAfterKill) {
    throw new Error(`Timed out waiting for ${label} process ${pid} to exit after SIGKILL.`);
  }
}

export async function startForeground(): Promise<void> {
  loadServerEnv();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: packageRoot,
      env: process.env,
      stdio: 'inherit',
    });

    const stopChild = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };

    process.on('SIGINT', stopChild);
    process.on('SIGTERM', stopChild);

    child.on('exit', (code) => {
      process.off('SIGINT', stopChild);
      process.off('SIGTERM', stopChild);
      if (code === 0) resolve();
      else reject(new Error(`uruc foreground exited with code ${code ?? 1}`));
    });
    child.on('error', reject);
  });
}

export async function startBackground(): Promise<ManagedRuntimeMode> {
  loadServerEnv();
  ensureCliDirs();

  if (isSystemdInstalled()) {
    await runOrThrow('systemctl', ['start', getServiceName()]);
    return 'systemd';
  }

  const logPath = getManagedLogPath();
  const stdoutFd = openSync(logPath, 'a');
  const stderrFd = openSync(logPath, 'a');

  let child;
  try {
    child = spawn(process.execPath, ['dist/index.js'], {
      cwd: packageRoot,
      env: process.env,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
    });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }

  child.unref();

  writeManagedProcess({
    pid: child.pid ?? 0,
    logPath,
    startedAt: new Date().toISOString(),
    command: [process.execPath, 'dist/index.js'],
  });
  return 'background';
}

export async function stopRuntime(): Promise<void> {
  if (isSystemdActive()) {
    await runOrThrow('systemctl', ['stop', getServiceName()]);
    return;
  }

  const managed = getLiveManagedProcess();
  if (managed) {
    try {
      await terminatePid(managed.pid, 'managed Uruc');
    } finally {
      clearManagedProcess();
    }
    return;
  }

  const unmanaged = findLocalUnmanagedProcess();
  if (unmanaged) {
    await terminatePid(unmanaged.pid, 'local Uruc');
  }
}

export async function restartRuntime(): Promise<void> {
  if (isSystemdActive()) {
    await runOrThrow('systemctl', ['restart', getServiceName()]);
    return;
  }
  await stopRuntime();
  await startBackground();
}

export async function printLogs(follow = true): Promise<void> {
  if (isSystemdActive()) {
    const args = ['-u', getServiceName()];
    if (follow) args.push('-f');
    else args.push('-n', '200', '--no-pager');
    await runOrThrow('journalctl', args, { stdio: 'inherit' });
    return;
  }

  const logPath = getManagedLogPath();
  if (!existsSync(logPath)) {
    console.log('No managed runtime log file found.');
    return;
  }

  if (follow) {
    await runOrThrow('tail', ['-f', logPath], { stdio: 'inherit' });
    return;
  }

  console.log(readFileSync(logPath, 'utf8'));
}

export async function openDashboard(): Promise<boolean> {
  const status = await getRuntimeStatus();
  if (!status.health.ok) return false;
  return openUrl(status.siteUrl);
}
