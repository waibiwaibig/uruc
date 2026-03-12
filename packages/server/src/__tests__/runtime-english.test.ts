import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[一-鿿]/u;

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
  'plugins/arcade/index.ts',
  'plugins/arcade/service.ts',
  'plugins/chess/index.ts',
  'plugins/chess/service.ts',
  'plugins/arcade/games/blackjack/index.ts',
  'plugins/arcade/games/texas-holdem/index.ts',
  'plugins/arcade/games/uno/index.ts',
  'plugins/arcade/games/love-letter/index.ts',
  'plugins/arcade/plugin.json',
  'plugins/chess/plugin.json',
  'plugins/arcade/games/blackjack/game.json',
  'plugins/arcade/games/texas-holdem/game.json',
  'plugins/arcade/games/uno/game.json',
  'plugins/arcade/games/love-letter/game.json',
] as const;

function readNormalized(relativePath: (typeof TARGETS)[number]): string {
  return readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

describe('backend runtime english regression', () => {
  it('keeps targeted runtime sources free of Chinese literals', () => {
    for (const relativePath of TARGETS) {
      const content = readNormalized(relativePath);
      expect(content, `${relativePath} should not contain Chinese literals`).not.toMatch(CJK);
    }
  });
});
