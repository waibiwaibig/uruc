import { describe, expect, it, vi } from 'vitest';

import { createDb } from '../../core/database/index.js';
import ArcadePlugin from './index.js';

describe('ArcadePlugin commands', () => {
  it('registers the arcade command surface', async () => {
    const registerWSCommand = vi.fn();
    const plugin = new ArcadePlugin();

    await plugin.init({
      db: createDb(':memory:'),
      services: {
        tryGet: () => undefined,
      } as never,
      hooks: {
        registerLocation: vi.fn(),
        registerWSCommand,
        before: vi.fn(),
        after: vi.fn(),
      } as never,
    });

    const commandTypes = registerWSCommand.mock.calls.map((call) => call[0]);
    expect(commandTypes).toContain('arcade_lobby');
    expect(commandTypes).toContain('arcade_create_table');
    expect(commandTypes).toContain('arcade_game_action');
    expect(commandTypes).toContain('arcade_leaderboard');
  });
});

