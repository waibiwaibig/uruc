import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const emailSource = readFileSync(
  resolve(__dirname, '..', 'email.ts'),
  'utf-8',
);

describe('email template PII check', () => {
  it('should not contain hardcoded personal email 1311738628@qq.com', () => {
    expect(emailSource).not.toContain('1311738628@qq.com');
  });

  it('should not contain hardcoded personal email waibiwaibigzy@sjtu.edu.cn', () => {
    expect(emailSource).not.toContain('waibiwaibigzy@sjtu.edu.cn');
  });
});
