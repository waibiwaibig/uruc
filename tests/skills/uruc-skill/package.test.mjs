import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const ROOT_DIR = path.join(REPO_ROOT, 'skills', 'uruc-skill');
const PACKAGE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'package-skill.mjs');

test('skill source tree does not import code outside the skill package', () => {
  const offenders = [];
  collectJavaScriptFiles(ROOT_DIR, [], offenders);
  assert.deepEqual(offenders, []);
});

test('copied skill directory can run the CLI help without the repo root', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'uruc-skill-copy-'));
  const copiedRoot = path.join(tempDir, 'uruc-skill');
  try {
    cpSync(ROOT_DIR, copiedRoot, { recursive: true });
    execFileSync(process.execPath, ['scripts/uruc-agent.mjs', 'help'], {
      cwd: copiedRoot,
      stdio: 'pipe',
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('packaged skill zip excludes tests and remains runnable when extracted', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'uruc-skill-package-'));
  const zipPath = path.join(tempDir, 'uruc-skill.zip');
  const unpackDir = path.join(tempDir, 'unpacked');

  try {
    execFileSync(process.execPath, [PACKAGE_SCRIPT, 'uruc-skill', '--output', zipPath], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);

    assert.deepEqual(listing.sort(), [
      'uruc-skill/',
      'uruc-skill/SKILL.md',
      'uruc-skill/SKILL.zh-CN.md',
      'uruc-skill/agents/',
      'uruc-skill/agents/openai.yaml',
      'uruc-skill/references/',
      'uruc-skill/references/uruc-agent-reference.md',
      'uruc-skill/scripts/',
      'uruc-skill/scripts/lib/',
      'uruc-skill/scripts/lib/client.mjs',
      'uruc-skill/scripts/lib/common.mjs',
      'uruc-skill/scripts/lib/daemon-runtime.mjs',
      'uruc-skill/scripts/lib/openclaw-gateway.mjs',
      'uruc-skill/scripts/uruc-agent-daemon.mjs',
      'uruc-skill/scripts/uruc-agent.mjs',
    ]);
    assert.ok(!listing.some((entry) => entry.includes('__tests__/')));
    assert.ok(!listing.some((entry) => /\.test\.mjs$/.test(entry)));

    execFileSync('unzip', ['-q', zipPath, '-d', unpackDir], { stdio: 'pipe' });
    const extractedRoot = path.join(unpackDir, 'uruc-skill');
    execFileSync(process.execPath, ['scripts/uruc-agent.mjs', 'help'], {
      cwd: extractedRoot,
      stdio: 'pipe',
    });

    const offenders = [];
    collectJavaScriptFiles(extractedRoot, [], offenders);
    assert.deepEqual(offenders, []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function collectJavaScriptFiles(rootDir, nested, offenders) {
  const currentDir = path.join(rootDir, ...nested);
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const nextNested = [...nested, entry.name];
    const nextPath = path.join(rootDir, ...nextNested);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(rootDir, nextNested, offenders);
      continue;
    }
    if (!entry.name.endsWith('.mjs')) continue;

    const content = readFileSync(nextPath, 'utf8');
    const specifiers = extractSpecifiers(content);
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(nextPath), specifier);
      if (!resolved.startsWith(rootDir)) {
        offenders.push(`${path.relative(rootDir, nextPath)} -> ${specifier}`);
      }
    }
  }
}

function extractSpecifiers(content) {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?\s+from\s+["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}
