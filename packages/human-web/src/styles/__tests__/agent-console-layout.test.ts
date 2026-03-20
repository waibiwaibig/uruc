import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('agent console stylesheet', () => {
  it('keeps the page wide and the registry rows compact', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/console.css'), 'utf8');

    expect(css).toMatch(/\.agent-console-page\s*\{[\s\S]*width:\s*min\(1440px,\s*calc\(100%\s*-\s*\(var\(--space-3\)\s*\*\s*2\)\)\);/);
    expect(css).toMatch(/\.registry-card__row\s*\{[\s\S]*align-items:\s*center;[\s\S]*flex-direction:\s*row;/);
  });
});
