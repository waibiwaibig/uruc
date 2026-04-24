#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const skillName = argv[0];

if (!skillName || skillName.startsWith('-')) {
  fail('Usage: node scripts/package-skill.mjs <skill-name> --output <zip-path>');
}

let outputPath = null;
for (let index = 1; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '--output') {
    outputPath = argv[index + 1] ?? null;
    index += 1;
    continue;
  }
  fail(`Unknown argument: ${arg}`);
}

if (!outputPath) {
  fail('--output is required');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const skillsRoot = path.join(repoRoot, 'skills');
const sourceDir = path.join(skillsRoot, skillName);
const outputFile = path.resolve(repoRoot, outputPath);

if (!existsSync(sourceDir)) {
  fail(`Skill not found: ${sourceDir}`);
}

const stagingRoot = mkdtempSync(path.join(os.tmpdir(), `package-skill-${skillName}-`));
const stagedSkillDir = path.join(stagingRoot, skillName);

try {
  cpSync(sourceDir, stagedSkillDir, {
    recursive: true,
    filter: (src) => shouldInclude(sourceDir, src),
  });

  mkdirSync(path.dirname(outputFile), { recursive: true });
  rmSync(outputFile, { force: true });
  execFileSync('zip', ['-qr', outputFile, skillName], {
    cwd: stagingRoot,
    stdio: 'pipe',
  });
  process.stdout.write(`${outputFile}\n`);
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}

function shouldInclude(rootDir, candidatePath) {
  const relPath = path.relative(rootDir, candidatePath);
  if (!relPath) return true;

  const normalized = relPath.split(path.sep).join('/');
  const parts = normalized.split('/');

  if (parts.some((part) => part === '__tests__' || part === 'node_modules')) {
    return false;
  }

  if (parts.some((part) => part.startsWith('.'))) {
    return false;
  }

  if (path.basename(rootDir) === 'uruc-skill') {
    return shouldIncludeUrucSkill(normalized);
  }

  return true;
}

function shouldIncludeUrucSkill(normalized) {
  const allowedDirs = new Set([
    'agents',
    'references',
    'scripts',
    'scripts/lib',
  ]);
  if (allowedDirs.has(normalized)) return true;

  if (normalized === 'SKILL.md' || normalized === 'SKILL.zh-CN.md') return true;
  if (normalized === 'agents/openai.yaml') return true;
  if (normalized === 'references/uruc-agent-reference.md') return true;
  if (/^scripts\/[^/]+\.mjs$/.test(normalized)) return true;
  if (/^scripts\/lib\/[^/]+\.mjs$/.test(normalized)) return true;

  return false;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
