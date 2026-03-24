import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readStylesheet() {
  return readFileSync(resolve(process.cwd(), 'packages/plugins/chinese-chess/frontend/chinese-chess.css'), 'utf8');
}

describe('chinese chess board layout css', () => {
  it('uses a Xiangqi line board instead of an inherited 8x8 chess grid', () => {
    const css = readStylesheet();

    expect(css).not.toContain('grid-template-columns: repeat(8, minmax(0, 1fr));');
    expect(css).not.toContain('grid-template-rows: repeat(8, minmax(0, 1fr));');
    expect(css).not.toContain('.chinese-chess-square');
    expect(css).toContain('.chinese-chess-board-grid');
    expect(css).toContain('.chinese-chess-board-intersection');
    expect(css).toContain('.chinese-chess-board-frame');
    expect(css).toContain('.chinese-chess-piece-image');
    expect(css).toContain('drop-shadow');
    expect(css).toContain('.chinese-chess-board-player-badge');
    expect(css).toContain('--chinese-chess-rail-width: min(430px, calc(100vw - 48px));');
    expect(css).toContain('width: min(100%, calc(var(--chinese-chess-stage-width) + var(--chinese-chess-rail-width) + 16px));');
    expect(css).toContain('grid-template-columns: minmax(0, var(--chinese-chess-stage-width)) minmax(0, var(--chinese-chess-rail-width));');
    expect(css).toContain('margin-inline: auto;');
    expect(css).toContain('.chinese-chess-right-rail > *');
    expect(css).toContain('width: 100%;');
    expect(css).not.toContain('.chinese-chess-seat-card');
  });
});
