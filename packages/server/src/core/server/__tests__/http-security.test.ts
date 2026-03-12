import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE = readFileSync(
  resolve(__dirname, '..', 'http-server.ts'),
  'utf-8',
);

describe('http-server security hardening', () => {
  it('uses timingSafeEqual for site password comparison', () => {
    expect(SOURCE).toContain('timingSafeEqual');
  });

  it('does not silently reject new IPs when rate bucket map is full', () => {
    // The old pattern: `rateBuckets.size >= MAX_RATE_BUCKETS) return false`
    const rejectPattern = /rateBuckets\.size\s*>=\s*MAX_RATE_BUCKETS\)\s*return\s*false/;
    expect(SOURCE).not.toMatch(rejectPattern);
  });
});
