import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({
    isDirectory: () => false,
    mtimeMs: 100,
  })),
  writeBuildState: vi.fn(),
  runOrThrow: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
  readdirSync: mocks.readdirSync,
  statSync: mocks.statSync,
}));

vi.mock('../lib/state.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/state.js')>('../lib/state.js');
  return {
    ...actual,
    writeBuildState: mocks.writeBuildState,
  };
});

vi.mock('../lib/process.js', () => ({
  runOrThrow: mocks.runOrThrow,
}));

import { buildAll } from '../lib/build.js';

describe('buildAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds plugin-sdk before server and human-web when forced', async () => {
    await buildAll(true);

    expect(mocks.runOrThrow).toHaveBeenNthCalledWith(
      1,
      'npm',
      ['run', 'build', '--workspace=@uruc/plugin-sdk'],
      expect.anything(),
    );
    expect(mocks.runOrThrow).toHaveBeenNthCalledWith(
      2,
      'npm',
      ['run', 'build', '--workspace=packages/server'],
      expect.anything(),
    );
    expect(mocks.runOrThrow).toHaveBeenNthCalledWith(
      3,
      'npm',
      ['run', 'build', '--workspace=packages/human-web'],
      expect.anything(),
    );
  });
});
