import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  openSync: vi.fn(),
  closeSync: vi.fn(),
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
  readManagedProcess: vi.fn(() => null),
  writeCliMeta: vi.fn(),
  writeManagedProcess: vi.fn(),
  loadServerEnv: vi.fn(() => process.env),
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('fs', () => ({
  closeSync: mocks.closeSync,
  existsSync: vi.fn(() => false),
  openSync: mocks.openSync,
  readFileSync: vi.fn(() => ''),
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

import { startBackground } from '../lib/runtime.js';

describe('startBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commandExists.mockReturnValue(false);
    mocks.openSync.mockReturnValueOnce(11).mockReturnValueOnce(12);
    mocks.spawn.mockReturnValue({
      pid: 4242,
      unref: vi.fn(),
    });
  });

  it('detaches the child while letting it write logs directly to file descriptors', async () => {
    await expect(startBackground()).resolves.toBe('background');

    expect(mocks.openSync).toHaveBeenNthCalledWith(1, '/tmp/uruc.log', 'a');
    expect(mocks.openSync).toHaveBeenNthCalledWith(2, '/tmp/uruc.log', 'a');
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      ['dist/index.js'],
      expect.objectContaining({
        detached: true,
        stdio: ['ignore', 11, 12],
      }),
    );
    expect(mocks.closeSync).toHaveBeenCalledWith(11);
    expect(mocks.closeSync).toHaveBeenCalledWith(12);
    expect(mocks.writeManagedProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        pid: 4242,
        logPath: '/tmp/uruc.log',
      }),
    );
  });

  it('delegates background start to systemd when the service is installed', async () => {
    mocks.commandExists.mockReturnValue(true);
    mocks.exec.mockReturnValue({ status: 0, stdout: 'uruc.service loaded', stderr: '' });

    await expect(startBackground()).resolves.toBe('systemd');

    expect(mocks.runOrThrow).toHaveBeenCalledWith('systemctl', ['start', 'uruc']);
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.writeManagedProcess).not.toHaveBeenCalled();
  });

  it('falls back to the cli-managed background runtime when the systemd unit is missing', async () => {
    mocks.commandExists.mockReturnValue(true);
    mocks.exec.mockReturnValue({
      status: 4,
      stdout: '',
      stderr: 'Unit uruc.service could not be found.',
    });

    await expect(startBackground()).resolves.toBe('background');

    expect(mocks.runOrThrow).not.toHaveBeenCalled();
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      ['dist/index.js'],
      expect.objectContaining({
        detached: true,
        stdio: ['ignore', 11, 12],
      }),
    );
    expect(mocks.writeManagedProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        pid: 4242,
        logPath: '/tmp/uruc.log',
      }),
    );
  });
});
