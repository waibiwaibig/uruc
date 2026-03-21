import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRuntimeStatus: vi.fn(),
  stopRuntime: vi.fn(),
  startBackground: vi.fn(),
  startForeground: vi.fn(),
  restartRuntime: vi.fn(),
  assertConfiguredPortsAvailable: vi.fn(),
  ensureFreshBuildIfNeeded: vi.fn(),
  prepareCityRuntime: vi.fn(),
  runConfigureCommand: vi.fn(),
  hasFlag: vi.fn((args: string[], ...flags: string[]) => args.some((arg) => flags.includes(arg))),
  rootEnvExists: vi.fn(() => false),
  serverEnvExists: vi.fn(() => true),
  parseEnvFile: vi.fn(() => ({})),
}));

vi.mock('../lib/runtime.js', () => ({
  getRuntimeStatus: mocks.getRuntimeStatus,
  stopRuntime: mocks.stopRuntime,
  startBackground: mocks.startBackground,
  startForeground: mocks.startForeground,
  restartRuntime: mocks.restartRuntime,
  assertConfiguredPortsAvailable: mocks.assertConfiguredPortsAvailable,
}));

vi.mock('../lib/env.js', () => ({
  rootEnvExists: mocks.rootEnvExists,
  serverEnvExists: mocks.serverEnvExists,
  parseEnvFile: mocks.parseEnvFile,
}));

vi.mock('../lib/city.js', () => ({
  DEFAULT_PLUGIN_PRESET: 'custom',
  prepareCityRuntime: mocks.prepareCityRuntime,
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
import { runRestartCommand } from '../commands/restart.js';
import { getStopFailureMessage, runStopCommand } from '../commands/stop.js';

describe('CLI runtime command messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureFreshBuildIfNeeded.mockResolvedValue(false);
    mocks.prepareCityRuntime.mockResolvedValue('synced');
    mocks.stopRuntime.mockResolvedValue(undefined);
    mocks.assertConfiguredPortsAvailable.mockResolvedValue(undefined);
    mocks.startBackground.mockResolvedValue('background');
    mocks.startForeground.mockResolvedValue(undefined);
    mocks.restartRuntime.mockResolvedValue(undefined);
  });

  it('explains unmanaged reachable instances on start', async () => {
    mocks.getRuntimeStatus.mockResolvedValue({ mode: 'unmanaged' });

    await expect(runStartCommand({ args: [], json: false })).rejects.toThrow(
      getStartConflictMessage('unmanaged'),
    );
    expect(mocks.assertConfiguredPortsAvailable).not.toHaveBeenCalled();
  });

  it('auto-prepares the default city before starting', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.parseEnvFile.mockReturnValue({});
    mocks.getRuntimeStatus.mockResolvedValue({ mode: 'stopped' });
    mocks.prepareCityRuntime.mockResolvedValue('created');

    await runStartCommand({ args: [], json: false });

    expect(mocks.prepareCityRuntime).toHaveBeenCalledWith(expect.objectContaining({
      defaultPreset: 'custom',
      autoCreateDefault: true,
    }));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Initialized default city config'));
    log.mockRestore();
  });

  it('fails clearly when a custom city config path is missing', async () => {
    mocks.parseEnvFile.mockReturnValue({ CITY_CONFIG_PATH: './missing-custom.city.json' });

    await expect(runStartCommand({ args: [], json: false })).rejects.toThrow(
      'Run `uruc configure --section plugins` to create or fix it.',
    );
    expect(mocks.prepareCityRuntime).not.toHaveBeenCalled();
  });

  it('reports systemd when start -b delegates to the service manager', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.parseEnvFile.mockReturnValue({});
    mocks.getRuntimeStatus.mockResolvedValue({ mode: 'stopped' });
    mocks.startBackground.mockResolvedValue('systemd');

    await runStartCommand({ args: ['--background'], json: false });

    expect(log).toHaveBeenCalledWith('Uruc started via systemd service.');
    log.mockRestore();
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

  it('prints a systemd-specific restart message', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.parseEnvFile.mockReturnValue({});
    mocks.getRuntimeStatus.mockResolvedValue({ mode: 'systemd' });

    await runRestartCommand({ args: [], json: false });

    expect(mocks.prepareCityRuntime).toHaveBeenCalledWith(expect.objectContaining({
      defaultPreset: 'custom',
      autoCreateDefault: true,
    }));
    expect(mocks.restartRuntime).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Uruc restarted via systemd service.');
    log.mockRestore();
  });
});
