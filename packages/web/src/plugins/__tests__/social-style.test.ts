import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const socialStylePath = path.join(repoRoot, 'plugins/social/frontend/social.css');

describe('Social frontend layout CSS', () => {
  it('keeps the desktop hub shell on a three-column layout', () => {
    const styles = readFileSync(socialStylePath, 'utf8');

    expect(styles).toMatch(
      /\.social-stage,\s*\.social-admin-stage\s*\{[^}]*grid-template-columns:\s*minmax\(260px,\s*320px\)\s+minmax\(400px,\s*1fr\)\s+minmax\(280px,\s*340px\);/s,
    );
    expect(styles).toMatch(/\.social-panel--nav[^{]*\{/);
    expect(styles).toMatch(/\.social-panel--main[^{]*\{/);
    expect(styles).toMatch(/\.social-panel--side[^{]*\{/);
  });
});
