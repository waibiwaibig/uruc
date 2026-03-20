import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('plugin sdk runtime boundary', () => {
  it('is importable from plain node after the sdk build', async () => {
    const repoRoot = path.resolve(process.cwd(), '..', '..');

    await execFileAsync('npm', ['run', 'build', '--workspace=@uruc/plugin-sdk'], {
      cwd: repoRoot,
    });

    const script = `
      await Promise.all([
        '@uruc/plugin-sdk',
        '@uruc/plugin-sdk/backend',
        '@uruc/plugin-sdk/frontend',
        '@uruc/plugin-sdk/frontend-react',
        '@uruc/plugin-sdk/frontend-http',
      ].map((specifier) => import(specifier)));
      console.log('ok');
    `;

    const { stdout } = await execFileAsync(
      process.execPath,
      ['--input-type=module', '-e', script],
      { cwd: repoRoot },
    );

    expect(stdout.trim()).toBe('ok');
  });
});
