import { afterEach, describe, expect, it, vi } from 'vitest';

import { isPidAlive } from '../lib/process.js';

describe('isPidAlive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats EPERM from signal 0 as an alive process', () => {
    vi.spyOn(process, 'kill').mockImplementation((() => {
      const error = new Error('operation not permitted') as NodeJS.ErrnoException;
      error.code = 'EPERM';
      throw error;
    }) as typeof process.kill);

    expect(isPidAlive(1234)).toBe(true);
  });

  it('treats ESRCH from signal 0 as a missing process', () => {
    vi.spyOn(process, 'kill').mockImplementation((() => {
      const error = new Error('no such process') as NodeJS.ErrnoException;
      error.code = 'ESRCH';
      throw error;
    }) as typeof process.kill);

    expect(isPidAlive(1234)).toBe(false);
  });
});
