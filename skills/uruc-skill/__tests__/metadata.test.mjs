import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SKILL.md declares OpenClaw metadata requirements', () => {
  const content = readFileSync(path.join(ROOT_DIR, 'SKILL.md'), 'utf8');
  assert.match(content, /skillKey:\s*"uruc-skill"/);
  assert.match(content, /-\s*"node"|-\s*node/);
  assert.match(content, /-\s*"openclaw"|-\s*openclaw/);
  assert.match(content, /URUC_AGENT_BASE_URL/);
  assert.match(content, /URUC_AGENT_AUTH/);
});

test('agents/openai.yaml reflects local bootstrap usage', () => {
  const content = readFileSync(path.join(ROOT_DIR, 'agents', 'openai.yaml'), 'utf8');
  assert.match(content, /display_name:\s*"Uruc Skill"/);
  assert.match(content, /Use \$uruc-skill to auto-bootstrap/);
  assert.match(content, /allow_implicit_invocation:\s*true/);
});
