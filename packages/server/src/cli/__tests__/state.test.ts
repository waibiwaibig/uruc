import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  URUC_HOME: process.env.URUC_HOME,
  URUC_SERVER_ENV_PATH: process.env.URUC_SERVER_ENV_PATH,
  URUC_CLI_STATE_DIR: process.env.URUC_CLI_STATE_DIR,
};

async function importStateModule() {
  vi.resetModules();
  return await import('../lib/state.js');
}

afterEach(() => {
  process.env.URUC_HOME = originalEnv.URUC_HOME;
  process.env.URUC_SERVER_ENV_PATH = originalEnv.URUC_SERVER_ENV_PATH;
  process.env.URUC_CLI_STATE_DIR = originalEnv.URUC_CLI_STATE_DIR;
});

describe('cli state path overrides', () => {
  it('uses environment overrides for server env and cli state paths', async () => {
    const tempRoot = path.join(os.tmpdir(), 'uruc-state-test');
    process.env.URUC_SERVER_ENV_PATH = path.join(tempRoot, 'server.env');
    process.env.URUC_CLI_STATE_DIR = path.join(tempRoot, 'cli-state');

    const state = await importStateModule();

    expect(state.getServerEnvPath()).toBe(path.join(tempRoot, 'server.env'));
    expect(state.getCliStateDir()).toBe(path.join(tempRoot, 'cli-state'));
    expect(state.getRuntimeDir()).toBe(path.join(tempRoot, 'cli-state', 'runtime'));
    expect(state.getManagedProcessPath()).toBe(path.join(tempRoot, 'cli-state', 'runtime', 'process.json'));
  });

  it('defaults cli state under URUC_HOME when no explicit state dir is configured', async () => {
    delete process.env.URUC_CLI_STATE_DIR;
    process.env.URUC_HOME = path.join(os.tmpdir(), 'uruc-runtime-home');

    const state = await importStateModule();

    expect(state.getCliStateDir()).toBe(path.join(process.env.URUC_HOME, '.uruc'));
    expect(state.getRuntimeDir()).toBe(path.join(process.env.URUC_HOME, '.uruc', 'runtime'));
  });
});
