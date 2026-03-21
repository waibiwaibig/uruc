import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('agent console stylesheet', () => {
  it('keeps the page wide, lets registry metadata wrap, and keeps feedback floating', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/console.css'), 'utf8');

    expect(css).toMatch(/\.agent-console-page\s*\{[\s\S]*width:\s*min\(1440px,\s*calc\(100%\s*-\s*\(var\(--space-3\)\s*\*\s*2\)\)\);/);
    expect(css).toMatch(/\.console-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*360px\)\s+minmax\(0,\s*1fr\);/);
    expect(css).toMatch(/\.registry-card__row\s*\{[\s\S]*align-items:\s*flex-start;[\s\S]*flex-wrap:\s*wrap;[\s\S]*flex-direction:\s*row;/);
    expect(css).toMatch(/\.registry-card__meta\s*\{[\s\S]*flex-wrap:\s*wrap;[\s\S]*flex:\s*1\s+1\s+100%;/);
    expect(css).toMatch(/\.agent-console-toast-stack\s*\{[\s\S]*position:\s*fixed;/);
  });
});
