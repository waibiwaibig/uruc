export const BETTER_SQLITE3_REBUILD_NOTICE =
  '[uruc] better-sqlite3 is not ready yet. Rebuilding the native module once. This can take a minute on first run.';

export const BETTER_SQLITE3_REBUILD_SUCCESS =
  '[uruc] better-sqlite3 native module rebuilt successfully.';

export const BETTER_SQLITE3_REBUILD_ARGS = [
  'rebuild',
  'better-sqlite3',
  '--build-from-source',
  '--ignore-scripts=false',
];

export function ensureBetterSqlite3Ready({
  probeBetterSqlite3,
  runCommand,
  log = console.log,
  error = console.error,
  exit = (code) => process.exit(code),
}) {
  const probe = probeBetterSqlite3();
  if (probe.status === 0) return;

  log(BETTER_SQLITE3_REBUILD_NOTICE);
  runCommand('npm', BETTER_SQLITE3_REBUILD_ARGS);

  const finalProbe = probeBetterSqlite3();
  if (finalProbe.status !== 0) {
    error('[uruc] better-sqlite3 still failed after rebuild.');
    if (finalProbe.stderr.trim()) {
      error(finalProbe.stderr.trim());
    }
    exit(finalProbe.status || 1);
    return;
  }

  log(BETTER_SQLITE3_REBUILD_SUCCESS);
}
