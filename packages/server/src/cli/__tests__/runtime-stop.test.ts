import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  commandExists: vi.fn(),
  exec: vi.fn(),
  isPidAlive: vi.fn(),
  killPid: vi.fn(),
  openUrl: vi.fn(),
  runOrThrow: vi.fn(),
  clearManagedProcess: vi.fn(),
  ensureCliDirs: vi.fn(),
  getManagedLogPath: vi.fn(() => '/tmp/uruc.log'),
  getServerEnvPath: vi.fn(() => '/tmp/.env'),
  readCliMeta: vi.fn(() => ({ language: 'zh-CN' })),
  readManagedProcess: vi.fn(() => null) as any,
  writeCliMeta: vi.fn(),
  writeManagedProcess: vi.fn(),
  loadServerEnv: vi.fn(() => process.env),
}));

vi.mock('../lib/process.js', () => ({
  commandExists: mocks.commandExists,
  exec: mocks.exec,
  isPidAlive: mocks.isPidAlive,
  killPid: mocks.killPid,
  openUrl: mocks.openUrl,
  runOrThrow: mocks.runOrThrow,
}));

vi.mock('../lib/state.js', () => ({
  clearManagedProcess: mocks.clearManagedProcess,
  ensureCliDirs: mocks.ensureCliDirs,
  getManagedLogPath: mocks.getManagedLogPath,
  getServerEnvPath: mocks.getServerEnvPath,
  readCliMeta: mocks.readCliMeta,
  readManagedProcess: mocks.readManagedProcess,
  writeCliMeta: mocks.writeCliMeta,
  writeManagedProcess: mocks.writeManagedProcess,
}));

vi.mock('../lib/env.js', () => ({
  loadServerEnv: mocks.loadServerEnv,
}));

import { getRuntimeStatus, stopRuntime } from '../lib/runtime.js';

describe('stopRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed')) as typeof fetch;
    process.env.PORT = '3000';
    process.env.WS_PORT = '3001';
    mocks.commandExists.mockImplementation((cmd: string) => cmd === 'lsof');
    mocks.exec.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== 'lsof') {
        return { status: 1, stdout: '', stderr: '' };
      }
      if (args.join(' ') === '-nP -iTCP:3000 -sTCP:LISTEN -t') {
        return { status: 0, stdout: '4242\n', stderr: '' };
      }
      if (args.join(' ') === '-nP -iTCP:3001 -sTCP:LISTEN -t') {
        return { status: 0, stdout: '4242\n', stderr: '' };
      }
      if (args.join(' ') === '-a -p 4242 -d cwd -Fn') {
        return {
          status: 0,
          stdout: `p4242\nfcwd\nn${process.cwd()}\n`,
          stderr: '',
        };
      }
      return { status: 1, stdout: '', stderr: '' };
    });
    mocks.killPid.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('terminates a recognized local unmanaged process', async () => {
    mocks.isPidAlive.mockReturnValueOnce(true).mockReturnValueOnce(false);

    await stopRuntime();

    expect(mocks.killPid).toHaveBeenCalledWith(4242, 'SIGTERM');
    expect(mocks.clearManagedProcess).not.toHaveBeenCalled();
  });

  it('escalates to SIGKILL when a managed process ignores SIGTERM', async () => {
    mocks.readManagedProcess.mockReturnValue({
      pid: 4242,
      logPath: '/tmp/uruc.log',
      startedAt: '2026-03-11T00:00:00.000Z',
      command: [process.execPath, 'dist/index.js'],
    });

    let lastSignal: NodeJS.Signals | null = null;
    mocks.killPid.mockImplementation((_pid: number, signal: NodeJS.Signals = 'SIGTERM') => {
      lastSignal = signal;
      return true;
    });
    mocks.isPidAlive.mockImplementation(() => lastSignal !== 'SIGKILL');

    const stopPromise = stopRuntime();
    await vi.runAllTimersAsync();
    await stopPromise;

    expect(mocks.killPid).toHaveBeenNthCalledWith(1, 4242, 'SIGTERM');
    expect(mocks.killPid).toHaveBeenNthCalledWith(2, 4242, 'SIGKILL');
    expect(mocks.clearManagedProcess).toHaveBeenCalledTimes(1);
  });

  it('reports unmanaged when the local runtime still owns both ports even if health fails', async () => {
    const status = await getRuntimeStatus();

    expect(status.mode).toBe('unmanaged');
    expect(status.health.ok).toBe(false);
  });
});
