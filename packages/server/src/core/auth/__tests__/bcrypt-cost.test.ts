import { describe, it, expect } from 'vitest';

describe('bcrypt cost factor', () => {
  it('should use cost factor >= 12', async () => {
    const fs = await import('fs/promises');
    const source = await fs.readFile(
      new URL('../service.ts', import.meta.url).pathname.replace('/__tests__', ''),
      'utf-8',
    );
    const hashCalls = [...source.matchAll(/bcrypt\.hash\([^,]+,\s*(\w+)\)/g)];
    expect(hashCalls.length).toBeGreaterThan(0);
    for (const match of hashCalls) {
      // Should reference BCRYPT_ROUNDS constant, not a literal number
      expect(match[1]).toBe('BCRYPT_ROUNDS');
    }
    // Verify the constant is defined with value >= 12
    expect(source).toMatch(/BCRYPT_ROUNDS\s*=\s*1[2-9]|[2-9]\d/);
  });
});
