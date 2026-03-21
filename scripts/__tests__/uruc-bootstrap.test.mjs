import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BETTER_SQLITE3_REBUILD_NOTICE,
  BETTER_SQLITE3_REBUILD_SUCCESS,
  ensureBetterSqlite3Ready,
} from '../lib/uruc-bootstrap.mjs';

test('ensureBetterSqlite3Ready shows a friendly rebuild notice without dumping the initial probe stack when recovery succeeds', () => {
  const logs = [];
  const errors = [];
  const commands = [];
  let probeCount = 0;

  ensureBetterSqlite3Ready({
    probeBetterSqlite3: () => {
      probeCount += 1;
      if (probeCount === 1) {
        return {
          status: 1,
          stdout: '',
          stderr: 'Error: Could not locate the bindings file.',
        };
      }
      return {
        status: 0,
        stdout: '',
        stderr: '',
      };
    },
    runCommand: (command, args) => {
      commands.push([command, args]);
      return { status: 0, stdout: '', stderr: '' };
    },
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
    exit: (code) => {
      throw new Error(`unexpected exit ${code}`);
    },
  });

  assert.deepEqual(commands, [
    ['npm', ['rebuild', 'better-sqlite3', '--build-from-source']],
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(logs, [
    BETTER_SQLITE3_REBUILD_NOTICE,
    BETTER_SQLITE3_REBUILD_SUCCESS,
  ]);
});

test('ensureBetterSqlite3Ready preserves detailed stderr only after rebuild ultimately fails', () => {
  const logs = [];
  const errors = [];
  let probeCount = 0;
  let exitCode = null;

  assert.throws(() => {
    ensureBetterSqlite3Ready({
      probeBetterSqlite3: () => {
        probeCount += 1;
        return {
          status: 1,
          stdout: '',
          stderr: probeCount === 1
            ? 'Error: initial probe failed.'
            : 'Error: final probe failed after rebuild.',
        };
      },
      runCommand: () => ({ status: 0, stdout: '', stderr: '' }),
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
      exit: (code) => {
        exitCode = code;
        throw new Error(`exit ${code}`);
      },
    });
  }, /exit 1/);

  assert.equal(exitCode, 1);
  assert.deepEqual(logs, [BETTER_SQLITE3_REBUILD_NOTICE]);
  assert.deepEqual(errors, [
    '[uruc] better-sqlite3 still failed after rebuild.',
    'Error: final probe failed after rebuild.',
  ]);
});
