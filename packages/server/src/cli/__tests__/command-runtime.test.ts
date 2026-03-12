import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRuntimeStatus: vi.fn(),
  stopRuntime: vi.fn(),
  startBackground: vi.fn(),
  startForeground: vi.fn(),
  assertConfiguredPortsAvailable: vi.fn(),
  ensureFreshBuildIfNeeded: vi.fn(),
  runConfigureCommand: vi.fn(),
  hasFlag: vi.fn((args: string[], ...flags: string[]) => args.some((arg) => flags.includes(arg))),
  rootEnvExists: vi.fn(() => false),
  serverEnvExists: vi.fn(() => true),
}));

vi.mock('../lib/runtime.js', () => ({
  getRuntimeStatus: mocks.getRuntimeStatus,
  stopRuntime: mocks.stopRuntime,
  startBackground: mocks.startBackground,
  startForeground: mocks.startForeground,
  assertConfiguredPortsAvailable: mocks.assertConfiguredPortsAvailable,
}));

vi.mock('../lib/env.js', () => ({
  rootEnvExists: mocks.rootEnvExists,
  serverEnvExists: mocks.serverEnvExists,
}));

vi.mock('../lib/argv.js', () => ({
  hasFlag: mocks.hasFlag,
}));

vi.mock('../commands/build.js', () => ({
  ensureFreshBuildIfNeeded: mocks.ensureFreshBuildIfNeeded,
}));

vi.mock('../commands/configure.js', () => ({
  runConfigureCommand: mocks.runConfigureCommand,
}));

import { getStartConflictMessage, runStartCommand } from '../commands/start.js';
import { getStopFailureMessage, runStopCommand } from '../commands/stop.js';

describe('CLI runtime command messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureFreshBuildIfNeeded.mockResolvedValue(false);
    mocks.stopRuntime.mockResolvedValue(undefined);
    mocks.assertConfiguredPortsAvailable.mockResolvedValue(undefined);
    mocks.startBackground.mockResolvedValue(undefined);
    mocks.startForeground.mockResolvedValue(undefined);
  });

  it('explains unmanaged reachable instances on start', async () => {
    mocks.getRuntimeStatus.mockResolvedValue({ mode: 'unmanaged' });

    await expect(runStartCommand({ args: [], json: false })).rejects.toThrow(
      getStartConflictMessage('unmanaged'),
    );
    expect(mocks.assertConfiguredPortsAvailable).not.toHaveBeenCalled();
  });

  it('fails stop when the instance is still reachable afterwards', async () => {
    mocks.getRuntimeStatus
      .mockResolvedValueOnce({ mode: 'unmanaged' })
      .mockResolvedValueOnce({ mode: 'unmanaged' });

    await expect(runStopCommand({ args: [], json: false })).rejects.toThrow(
      getStopFailureMessage('unmanaged'),
    );
  });

  it('prints success only after stop reaches the stopped state', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.getRuntimeStatus
      .mockResolvedValueOnce({ mode: 'background' })
      .mockResolvedValueOnce({ mode: 'stopped' });

    await runStopCommand({ args: [], json: false });

    expect(mocks.stopRuntime).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Stopped Uruc (background).');
    log.mockRestore();
  });
});
