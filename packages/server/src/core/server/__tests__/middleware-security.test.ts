import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const middlewareSrc = readFileSync(
  resolve(__dirname, '..', 'middleware.ts'),
  'utf-8',
);

describe('middleware.ts security invariants', () => {
  it('does NOT contain the predictable JWT fallback string', () => {
    expect(middlewareSrc).not.toContain('uruc-dev-secret');
  });

  it('does NOT contain a CORS wildcard Allow-Origin header', () => {
    expect(middlewareSrc).not.toMatch(/Allow-Origin.*\*/);
  });

  it('uses randomBytes for ephemeral JWT secret generation', () => {
    expect(middlewareSrc).toContain('randomBytes');
  });
});
