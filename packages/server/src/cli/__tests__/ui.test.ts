import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import readline from 'readline';

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

import { promptChoice, promptInput } from '../lib/ui.js';

describe('cli ui prompts', () => {
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

  it('keeps numeric selection support in non-tty mode', async () => {
    mocks.question.mockResolvedValueOnce('2');

    await expect(promptChoice(
      'Which section?',
      [
        { value: 'runtime', label: 'runtime' },
        { value: 'plugins', label: 'plugins' },
      ],
      'runtime',
      'en',
    )).resolves.toBe('plugins');
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('renders dot markers and follows arrow-key selection in tty mode', async () => {
    const originalNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdin, 'isPaused', { configurable: true, value: vi.fn(() => false) });
    Object.defineProperty(process.stdin, 'resume', { configurable: true, value: vi.fn() });
    Object.defineProperty(process.stdin, 'pause', { configurable: true, value: vi.fn() });
    Object.defineProperty(process.stdin, 'setRawMode', { configurable: true, value: vi.fn() });

    const output: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      output.push(String(chunk));
      return true;
    });
    const moveCursorSpy = vi.spyOn(readline, 'moveCursor');

    const selectionPromise = promptChoice(
      'Choose section',
      [
        { value: 'runtime', label: 'runtime', description: 'Edit runtime settings' },
        { value: 'plugins', label: 'plugins', description: 'Manage installed plugins' },
      ],
      'runtime',
      'en',
    );

    process.stdin.emit('keypress', '', { name: 'down' });
    process.stdin.emit('keypress', '', { name: 'return' });

    await expect(selectionPromise).resolves.toBe('plugins');
    expect(output.join('')).toContain('●');
    expect(output.join('')).toContain('○');
    expect(moveCursorSpy).toHaveBeenCalledWith(process.stdout, 0, -8);

    writeSpy.mockRestore();
    moveCursorSpy.mockRestore();
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
  });
});
