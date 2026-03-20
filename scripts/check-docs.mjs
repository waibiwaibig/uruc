#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const REQUIRED_ENGLISH_DOCS = [
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'progress.md',
  'LICENSE',
  'NOTICE',
  'docs/deployment/cli-command-reference.md',
  'docs/deployment/cli-deployment-guide.md',
  'docs/deployment/multi-agent-local-test-guide.md',
  'docs/server/CITY_ARCHITECTURE.md',
  'docs/server/CITY_INTRO.md',
  'docs/server/core-architecture.md',
  'docs/server/plugin-development.md',
  'docs/server/security-hardening.md',
  'packages/server/README.md',
  'packages/plugins/social/README.md',
  'packages/plugins/social/GUIDE.md',
  'skills/uruc-skill/SKILL.md',
  'skills/uruc-skill/references/protocol.md',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
];

const DOC_LINK_CHECK_SET = new Set([
  ...REQUIRED_ENGLISH_DOCS,
  ...REQUIRED_ENGLISH_DOCS.map(toChineseCompanion),
]);

const PUBLIC_SCAN_ROOTS = ['.', '.github', 'docs', 'packages', 'skills'];

const errors = [];

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function exists(filePath) {
  return fs.existsSync(path.join(root, filePath));
}

function toChineseCompanion(filePath) {
  if (filePath === 'LICENSE') return 'LICENSE.zh-CN.md';
  if (filePath === 'NOTICE') return 'NOTICE.zh-CN.md';
  if (!filePath.endsWith('.md')) return `${filePath}.zh-CN.md`;
  return filePath.replace(/\.md$/, '.zh-CN.md');
}

function listFiles(startPath) {
  const full = path.join(root, startPath);
  if (!exists(startPath)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [startPath];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const rel = path.join(startPath, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rel));
    else out.push(rel);
  }
  return out;
}

function normalizeLinkTarget(baseFile, rawTarget) {
  const [target] = rawTarget.split('#', 1);
  if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) {
    return null;
  }
  return path.normalize(path.join(path.dirname(baseFile), target));
}

for (const file of REQUIRED_ENGLISH_DOCS) {
  if (!exists(file)) errors.push(`Missing required English doc: ${file}`);
  const zh = toChineseCompanion(file);
  if (!exists(zh)) errors.push(`Missing Chinese companion doc: ${zh}`);
}

for (const scanRoot of PUBLIC_SCAN_ROOTS) {
  for (const file of listFiles(scanRoot)) {
    if (!file.endsWith('.md')) continue;
    if (file.includes('node_modules')) continue;
    if (file.endsWith('.en.md')) errors.push(`Public docs must not use .en.md naming: ${file}`);
  }
}

for (const file of DOC_LINK_CHECK_SET) {
  if (!exists(file)) continue;
  const content = read(file);
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content))) {
    const normalized = normalizeLinkTarget(file, match[1]);
    if (!normalized) continue;
    if (!exists(normalized)) errors.push(`Broken local doc link in ${file}: ${match[1]} -> ${normalized}`);
  }
}

const rootPackage = JSON.parse(read('package.json'));
const serverPackage = JSON.parse(read('packages/server/package.json'));
const webPackage = JSON.parse(read('packages/human-web/package.json'));

for (const [label, pkg] of [
  ['root package.json', rootPackage],
  ['packages/server/package.json', serverPackage],
  ['packages/human-web/package.json', webPackage],
]) {
  if (pkg.license !== 'Apache-2.0') errors.push(`${label} must declare Apache-2.0`);
}

const licenseText = read('LICENSE');
if (!licenseText.includes('Apache License') || !licenseText.includes('Version 2.0')) {
  errors.push('LICENSE must contain the Apache License 2.0 text');
}

const rootReadme = read('README.md');
if (!rootReadme.includes('Apache License 2.0')) {
  errors.push('README.md must reference Apache License 2.0');
}

if (errors.length > 0) {
  console.error('Documentation validation failed:\n');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('Documentation validation passed.');
