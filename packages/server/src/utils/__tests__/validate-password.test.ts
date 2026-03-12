import { describe, it, expect } from 'vitest';
import { assertPassword } from '../validate.js';

describe('assertPassword', () => {
  it('should reject passwords shorter than 8 chars', () => {
    expect(() => assertPassword('short')).toThrow();
  });
  it('should reject passwords without a digit', () => {
    expect(() => assertPassword('abcdefgh')).toThrow();
  });
  it('should reject passwords without a letter', () => {
    expect(() => assertPassword('12345678')).toThrow();
  });
  it('should accept valid passwords', () => {
    expect(assertPassword('myPass123')).toBe('myPass123');
  });
});
