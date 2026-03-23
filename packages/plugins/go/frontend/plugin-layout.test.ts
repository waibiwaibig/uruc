import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPluginSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function extractLocationCoordinates(source: string) {
  const xMatch = source.match(/\bx:\s*(\d+),/);
  const yMatch = source.match(/\by:\s*(\d+),/);
  if (!xMatch || !yMatch) {
    throw new Error('Unable to locate plugin map coordinates.');
  }
  return {
    x: Number.parseInt(xMatch[1], 10),
    y: Number.parseInt(yMatch[1], 10),
  };
}

function hasSafeMapGap(
  candidate: { x: number; y: number },
  neighbor: { x: number; y: number },
) {
  return Math.abs(candidate.x - neighbor.x) >= 12 || Math.abs(candidate.y - neighbor.y) >= 14;
}

describe('go location placement', () => {
  it('keeps the go venue separated from the existing board game venues on the city map', () => {
    const goCoordinates = extractLocationCoordinates(readPluginSource('packages/plugins/go/frontend/plugin.ts'));
    const chessCoordinates = extractLocationCoordinates(readPluginSource('packages/plugins/chess/frontend/plugin.ts'));
    const chineseChessCoordinates = extractLocationCoordinates(readPluginSource('packages/plugins/chinese-chess/frontend/plugin.ts'));

    expect(hasSafeMapGap(goCoordinates, chessCoordinates)).toBe(true);
    expect(hasSafeMapGap(goCoordinates, chineseChessCoordinates)).toBe(true);
  });
});
