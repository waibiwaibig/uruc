import { accessSync, constants, existsSync } from 'fs';
import { spawn, spawnSync } from 'child_process';
import os from 'os';

export interface ExecResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function commandExists(command: string): boolean {
  try {
    accessSync(command, constants.X_OK);
    return true;
  } catch {
    // fall through
  }

  const pathValue = process.env.PATH ?? '';
  for (const part of pathValue.split(process.platform === 'win32' ? ';' : ':')) {
    if (!part) continue;
    const candidate = `${part}/${command}`;
    if (existsSync(candidate)) return true;
    if (process.platform === 'win32' && existsSync(`${candidate}.cmd`)) return true;
  }
  return false;
}

export function exec(command: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv): ExecResult {
  const result = spawnSync(command, args, {
    cwd,
    env: env ?? process.env,
    encoding: 'utf8',
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export async function runOrThrow(command: string, args: string[], opts: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: 'inherit' | 'pipe';
} = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: opts.stdio ?? 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 1}`));
    });
    child.on('error', reject);
  });
}

export async function openUrl(url: string): Promise<boolean> {
  const candidates: Array<{ cmd: string; args: string[] }> = [];

  if (process.platform === 'darwin') {
    candidates.push({ cmd: 'open', args: [url] });
  } else if (process.platform === 'win32') {
    candidates.push({ cmd: 'cmd', args: ['/c', 'start', '', url] });
  } else {
    candidates.push({ cmd: 'xdg-open', args: [url] });
  }

  for (const candidate of candidates) {
    if (!commandExists(candidate.cmd)) continue;
    try {
      const child = spawn(candidate.cmd, candidate.args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function isRootUser(): boolean {
  return typeof process.getuid === 'function' ? process.getuid() === 0 : false;
}

export function currentNodeMajor(): number {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  return Number.isFinite(major) ? major : 0;
}

export function killPid(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function platformLabel(): string {
  return `${os.platform()} ${os.release()}`;
}
