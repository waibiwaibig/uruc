import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  createInterface: vi.fn(),
  question: vi.fn(),
}));

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

vi.mock('readline/promises', () => ({
  createInterface: mocks.createInterface,
}));

import { promptInput } from '../lib/ui.js';

describe('promptInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInterface.mockReturnValue({
      question: mocks.question,
      close: mocks.close,
    });
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalStdinIsTTY });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: originalStdoutIsTTY });
  });

  it('keeps an existing secret when the operator presses enter', async () => {
    mocks.question.mockResolvedValueOnce('');

    await expect(promptInput('Site access password', 'existing-secret', { secret: true })).resolves.toBe('existing-secret');
    expect(mocks.question).toHaveBeenCalledWith('Site access password (hidden default preserved): ');
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('clears an existing secret when the operator enters the configured clear token', async () => {
    mocks.question.mockResolvedValueOnce('-');

    await expect(promptInput(
      'Site access password',
      'existing-secret',
      { secret: true, clearTokens: ['-'], clearHint: 'type - to clear' } as any,
    )).resolves.toBe('');
    expect(mocks.question).toHaveBeenCalledWith('Site access password (hidden default preserved; type - to clear): ');
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});
