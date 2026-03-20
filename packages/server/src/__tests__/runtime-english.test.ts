import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[\u4e00-\u9fff]/u;

const TARGETS = [
  'core/auth/auth-routes.ts',
  'core/auth/dashboard-routes.ts',
  'core/auth/email.ts',
  'core/auth/oauth.ts',
  'core/auth/service.ts',
  'core/admin/routes.ts',
  'core/admin/service.ts',
  'core/city/commands.ts',
  'core/server/http-server.ts',
  'core/server/ws-gateway.ts',
] as const;
const ALLOWLIST: Partial<Record<(typeof TARGETS)[number], RegExp[]>> = {};

function readNormalized(relativePath: (typeof TARGETS)[number]): string {
  const absolutePath = path.join(SRC_ROOT, relativePath);
  let content = readFileSync(absolutePath, 'utf8');
  for (const pattern of ALLOWLIST[relativePath] ?? []) {
    content = content.replace(pattern, '');
  }
  return content;
}

describe('backend runtime english regression', () => {
  it('keeps targeted runtime sources free of Chinese literals', () => {
    for (const relativePath of TARGETS) {
      const content = readNormalized(relativePath);
      expect(content, `${relativePath} should not contain Chinese literals`).not.toMatch(CJK);
    }
  });
});
