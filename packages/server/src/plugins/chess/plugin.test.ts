import { describe, expect, it, vi } from 'vitest';

import { createDb } from '../../core/database/index.js';
import ChessPlugin from './index.js';
import { ChessService } from './service.js';

describe('ChessPlugin commands', () => {
  it('registers chess bootstrap and waiting-room commands', async () => {
    const registerWSCommand = vi.fn();
    const plugin = new ChessPlugin();

    await plugin.init({
      db: createDb(':memory:'),
      services: {
        tryGet: () => undefined,
      } as any,
      hooks: {
        registerLocation: vi.fn(),
        registerWSCommand,
        before: vi.fn(),
        after: vi.fn(),
      } as any,
    });

    const commandTypes = registerWSCommand.mock.calls.map((call) => call[0]);
    expect(commandTypes).toContain('chess_leave_match');
    expect(commandTypes).toContain('chess_bootstrap');
  });

  it('routes chess_bootstrap to bootstrap instead of joinMatch', async () => {
    const send = vi.fn();
    const registerWSCommand = vi.fn();
    const bootstrap = vi.spyOn(ChessService.prototype, 'bootstrap').mockResolvedValue({
      ok: true,
      data: {
        currentMatch: null,
        joinableMatches: [],
        lobbyVersion: 0,
        rating: { rating: 1500, wins: 0, losses: 0, draws: 0, totalGames: 0, updatedAt: new Date(0).toISOString() },
        leaderboard: [],
      },
    } as any);
    const joinMatch = vi.spyOn(ChessService.prototype, 'joinMatch').mockReturnValue({
      ok: true,
      data: { matchId: 'should-not-be-called' },
    } as any);

    const plugin = new ChessPlugin();

    await plugin.init({
      db: createDb(':memory:'),
      services: {
        tryGet: () => undefined,
      } as any,
      hooks: {
        registerLocation: vi.fn(),
        registerWSCommand,
        before: vi.fn(),
        after: vi.fn(),
      } as any,
    });

    const bootstrapRegistration = registerWSCommand.mock.calls.find((call) => call[0] === 'chess_bootstrap');
    expect(bootstrapRegistration).toBeTruthy();
    if (!bootstrapRegistration) return;

    const handler = bootstrapRegistration[1] as (wsCtx: any, msg: any) => Promise<void>;
    await handler(
      {
        session: { userId: 'user-1', agentId: 'agent-1', agentName: 'Alpha', role: 'agent' },
        currentLocation: 'chess-club',
        ws: {},
        gateway: { send },
      },
      { id: 'msg-1', type: 'chess_bootstrap', payload: { limit: 10 } },
    );

    expect(bootstrap).toHaveBeenCalledWith('agent-1', 'user-1', 10);
    expect(joinMatch).not.toHaveBeenCalled();
  });
});
