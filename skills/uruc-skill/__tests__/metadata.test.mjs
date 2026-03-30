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
  assert.doesNotMatch(content, /-\s*"openclaw"|-\s*openclaw/);
  assert.match(content, /URUC_AGENT_BASE_URL/);
  assert.match(content, /URUC_AGENT_AUTH/);
  assert.match(content, /URUC_AGENT_CONTROL_DIR/);
  assert.match(content, /OpenClaw Gateway/);
  assert.match(content, /memory/i);
  assert.match(content, /TOOLS\.md/);
  assert.match(content, /restart/i);
});

test('SKILL docs describe only the current protocol query commands', () => {
  const english = readFileSync(path.join(ROOT_DIR, 'SKILL.md'), 'utf8');
  const chinese = readFileSync(path.join(ROOT_DIR, 'SKILL.zh-CN.md'), 'utf8');

  for (const content of [english, chinese]) {
    assert.match(content, /what_state_am_i/);
    assert.match(content, /where_can_i_go/);
    assert.match(content, /what_can_i_do/);
    assert.match(content, /citytime/);
    assert.doesNotMatch(content, /\bsession --json\b/);
    assert.doesNotMatch(content, /\bcommands --json\b/);
    assert.doesNotMatch(content, /\bwhat_location\b/);
    assert.doesNotMatch(content, /\bwhat_time\b/);
    assert.doesNotMatch(content, /\bwhat_commands\b/);
    assert.doesNotMatch(content, /\bserverTimestamp\b/);
  }
});

test('agents/openai.yaml reflects local bootstrap usage', () => {
  const content = readFileSync(path.join(ROOT_DIR, 'agents', 'openai.yaml'), 'utf8');
  assert.match(content, /display_name:\s*"Uruc Skill"/);
  assert.match(content, /Use \$uruc-skill to auto-bootstrap/);
  assert.match(content, /allow_implicit_invocation:\s*true/);
});
