import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('design tokens stylesheet', () => {
  it('does not import remote Google Fonts under the site CSP', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(css).not.toContain('fonts.googleapis.com');
  });
});
