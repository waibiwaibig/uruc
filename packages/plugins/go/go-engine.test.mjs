import { describe, expect, it } from 'vitest';
import { createGoGame } from './go-engine.mjs';

describe('createGoGame', () => {
  it('rejects moves on occupied intersections', () => {
    const game = createGoGame();

    game.play('B', { x: 3, y: 3 });

    expect(() => game.play('W', { x: 3, y: 3 })).toThrow(/occupied/i);
  });

  it('captures surrounded stones', () => {
    const game = createGoGame();

    game.play('B', { x: 1, y: 1 });
    game.play('W', { x: 0, y: 1 });
    game.play('B', { x: 10, y: 10 });
    game.play('W', { x: 1, y: 0 });
    game.play('B', { x: 11, y: 10 });
    game.play('W', { x: 2, y: 1 });
    game.play('B', { x: 12, y: 10 });
    const result = game.play('W', { x: 1, y: 2 });

    expect(result.captures.white).toBe(1);
    expect(result.board[1][1]).toBe(null);
  });

  it('rejects suicide moves', () => {
    const game = createGoGame();

    game.play('B', { x: 0, y: 1 });
    game.play('W', { x: 10, y: 10 });
    game.play('B', { x: 1, y: 0 });
    game.play('W', { x: 11, y: 10 });
    game.play('B', { x: 2, y: 1 });
    game.play('W', { x: 12, y: 10 });
    game.play('B', { x: 1, y: 2 });

    expect(() => game.play('W', { x: 1, y: 1 })).toThrow(/suicide/i);
  });

  it('rejects immediate ko recapture', () => {
    const game = createGoGame();

    game.play('B', { x: 4, y: 5 });
    game.play('W', { x: 4, y: 4 });
    game.play('B', { x: 6, y: 5 });
    game.play('W', { x: 6, y: 4 });
    game.play('B', { x: 5, y: 6 });
    game.play('W', { x: 5, y: 5 });
    game.play('B', { x: 5, y: 4 });

    expect(() => game.play('W', { x: 5, y: 5 })).toThrow(/ko/i);
  });

  it('ends after two consecutive passes', () => {
    const game = createGoGame();

    game.play('B', { x: 3, y: 3 });
    game.play('W', { x: 15, y: 15 });
    game.pass('B');
    const result = game.pass('W');

    expect(result.finished).toBe(true);
    expect(result.result).not.toBeNull();
    expect(result.consecutivePasses).toBe(2);
  });
});
