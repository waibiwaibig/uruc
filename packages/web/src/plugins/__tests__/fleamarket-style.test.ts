import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const themePath = path.join(repoRoot, 'plugins/fleamarket/frontend/styles/theme.css');

describe('Fleamarket design token isolation', () => {
  it('defines zip design tokens inside the plugin shadow boundary', () => {
    const theme = readFileSync(themePath, 'utf8');

    expect(theme).toMatch(/:root,\s*:host,\s*\[data-uruc-plugin-app-root\],\s*\[data-uruc-plugin-portal-root\]\s*\{/);
    expect(theme).toMatch(/\[data-uruc-plugin-app-root\][^{]*\{[^}]*--radius:\s*0\.625rem/s);
    expect(theme).toMatch(/\[data-uruc-plugin-portal-root\][^{]*\{[^}]*--radius:\s*0\.625rem/s);
  });
});
