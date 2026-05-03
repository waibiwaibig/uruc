#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT_MS = 180_000;

const suites = [
  { name: 'docs:check', command: 'npm', args: ['run', 'docs:check'], timeoutMs: 60_000 },
  { name: 'plugins:check', command: 'npm', args: ['run', 'plugins:check'], timeoutMs: 60_000 },
  { name: 'server:build', command: 'npm', args: ['run', 'build', '--workspace=packages/server'], timeoutMs: 180_000 },
  { name: 'server:test', command: 'npm', args: ['run', 'test', '--workspace=packages/server'], timeoutMs: 240_000 },
];

function runSuite(suite) {
  const timeoutMs = Number(process.env.URUC_CHECK_TIMEOUT_MS ?? suite.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const started = performance.now();
  return new Promise((resolve) => {
    const child = spawn(suite.command, suite.args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      const elapsedMs = Math.round(performance.now() - started);
      resolve({ ...suite, ok: false, code: null, elapsedMs, timedOut: true, timeoutMs });
    }, timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      const elapsedMs = Math.round(performance.now() - started);
      resolve({ ...suite, ok: code === 0, code, elapsedMs, timedOut: false, timeoutMs });
    });
  });
}

for (const suite of suites) {
  console.log(`\n[check] ${suite.name} budget=${suite.timeoutMs}ms`);
  const result = await runSuite(suite);
  console.log(`[check] ${suite.name} elapsed=${result.elapsedMs}ms status=${result.timedOut ? 'timeout' : result.code}`);
  if (!result.ok) {
    const reason = result.timedOut
      ? `timed out after ${result.timeoutMs}ms`
      : `exited with ${result.code}`;
    console.error(`[check] FAILED ${result.name}: ${reason}`);
    process.exit(1);
  }
}

console.log('\n[check] all bounded suites passed');
