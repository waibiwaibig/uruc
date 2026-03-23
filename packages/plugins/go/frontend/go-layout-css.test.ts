import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readStylesheet() {
  return readFileSync(resolve(process.cwd(), 'packages/plugins/go/frontend/go.css'), 'utf8');
}

describe('go board layout css', () => {
  it('keeps the board column in flow instead of collapsing behind the right rail', () => {
    const css = readStylesheet();

    expect(css).not.toContain('grid-template-columns: fit-content(840px) minmax(360px, 540px);');
    expect(css).not.toContain('.go-board-stage__surface {\n  position: absolute;');
    expect(css).not.toContain('.go-board-shell {\n  position: absolute;');
    expect(css).not.toContain('.go-board-wrap {\n  position: absolute;');
  });
});
