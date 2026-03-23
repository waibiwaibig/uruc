import { describe, expect, it } from 'vitest';
import {
  createChineseChessEngine,
  DEFAULT_POSITION_FEN,
} from './chinese-chess-engine.mjs';

describe('createChineseChessEngine', () => {
  it('starts from the standard initial position', () => {
    const engine = createChineseChessEngine();

    expect(engine.snapshot().positionFen).toBe(DEFAULT_POSITION_FEN);
    expect(engine.snapshot().sideToMove).toBe('red');
    expect(engine.snapshot().legalMoves.length).toBeGreaterThan(0);
  });

  it('blocks horse moves when the horse leg is occupied', () => {
    const engine = createChineseChessEngine({
      positionFen: '4k4/9/9/9/9/9/9/3P5/4N4/4K4 w - - 0 1',
    });

    const moves = engine.snapshot().legalMoves.map((move) => move.iccs);

    expect(moves).not.toContain('e1c2');
    expect(moves).not.toContain('e1g2');
  });

  it('prevents elephants from crossing the river', () => {
    const engine = createChineseChessEngine({
      positionFen: '4k4/9/9/9/4p4/9/3B5/9/9/4K4 w - - 0 1',
    });

    const moves = engine.snapshot().legalMoves.map((move) => move.iccs);

    expect(moves).toContain('d3b1');
    expect(moves).toContain('d3f1');
    expect(moves).not.toContain('d3b5');
    expect(moves).not.toContain('d3f5');
    expect(moves).not.toContain('d3b7');
    expect(moves).not.toContain('d3f7');
  });

  it('restricts advisors and generals to the palace', () => {
    const engine = createChineseChessEngine({
      positionFen: '4k4/9/9/9/4p4/9/9/9/4A4/4K4 w - - 0 1',
    });

    const moves = engine.snapshot().legalMoves.map((move) => move.iccs);

    expect(moves).toContain('e1d2');
    expect(moves).toContain('e1f2');
    expect(moves).not.toContain('e1c3');
    expect(moves).not.toContain('e1g3');
  });

  it('requires a screen for cannon captures', () => {
    const engine = createChineseChessEngine({
      positionFen: '4k4/4r4/9/9/4C4/4P4/9/9/9/4K4 w - - 0 1',
    });

    const moves = engine.snapshot().legalMoves;
    const capture = moves.find((move) => move.iccs === 'e5e9');

    expect(capture).toMatchObject({
      iccs: 'e5e9',
      isCapture: true,
    });
    expect(moves.map((move) => move.iccs)).not.toContain('e5e8');
  });

  it('detects flying general attacks', () => {
    const engine = createChineseChessEngine({
      positionFen: '4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1',
    });

    expect(engine.snapshot().inCheck).toBe(true);
  });

  it('rejects moves that leave the current side in check', () => {
    const engine = createChineseChessEngine({
      positionFen: '4k4/9/9/9/9/9/9/4R4/9/4K4 w - - 0 1',
    });

    expect(() => engine.play('e2f2')).toThrow(/illegal/i);
  });

  it('reports checkmate when the side to move has no legal escape', () => {
    const engine = createChineseChessEngine({
      positionFen: '3RkR3/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1',
    });

    const snapshot = engine.snapshot();

    expect(snapshot.inCheck).toBe(true);
    expect(snapshot.result).toMatchObject({
      result: 'red_win',
      reason: 'checkmate',
    });
  });

  it('replays stored move history and exposes Chinese display text', () => {
    const engine = createChineseChessEngine({
      moveHistory: ['h2e2', 'h9g7'],
    });

    const snapshot = engine.snapshot();

    expect(snapshot.moveHistory).toHaveLength(2);
    expect(snapshot.positionFen).not.toBe(DEFAULT_POSITION_FEN);
    expect(snapshot.moveHistory[0]).toMatchObject({
      iccs: 'h2e2',
    });
    expect(typeof snapshot.moveHistory[0].display).toBe('string');
    expect(snapshot.moveHistory[0].display.length).toBeGreaterThan(0);
  });
});
