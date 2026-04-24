import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(TEST_DIR, '..', '..', '..', 'skills', 'uruc-skill');

test('SKILL.md declares OpenClaw metadata requirements', () => {
  const content = readFileSync(path.join(ROOT_DIR, 'SKILL.md'), 'utf8');
  assert.match(content, /skillKey:\s*"uruc-skill"/);
  assert.match(content, /-\s*"node"|-\s*node/);
  assert.doesNotMatch(content, /-\s*"openclaw"|-\s*openclaw/);
  assert.match(content, /URUC_AGENT_BASE_URL/);
  assert.match(content, /URUC_AGENT_AUTH/);
  assert.match(content, /URUC_AGENT_CONTROL_DIR/);
  assert.match(content, /OpenClaw Gateway/);
  assert.match(content, /agents\.defaults\.workspace/);
  assert.match(content, /device-auth\.json/);
  assert.match(content, /pairing required/);
  assert.match(content, /memory/i);
  assert.match(content, /TOOLS\.md/);
  assert.match(content, /restart/i);
});

test('SKILL docs are concise entrypoints that disclose detailed reference on demand', () => {
  const english = readFileSync(path.join(ROOT_DIR, 'SKILL.md'), 'utf8');
  const chinese = readFileSync(path.join(ROOT_DIR, 'SKILL.zh-CN.md'), 'utf8');
  const referencePath = path.join(ROOT_DIR, 'references', 'uruc-agent-reference.md');
  const reference = readFileSync(referencePath, 'utf8');

  const docs = [
    {
      content: english,
      headingPatterns: [/## When To Use/, /## Operating Loop/, /## Read More Only When Needed/],
    },
    {
      content: chinese,
      headingPatterns: [/## 什么时候使用/, /## 操作环/, /## 只在需要时继续读/],
    },
  ];

  for (const { content, headingPatterns } of docs) {
    assert.ok(content.split(/\r?\n/).length <= 180);
    assert.match(content, /references\/uruc-agent-reference\.md/);
    assert.doesNotMatch(content, /## What Each Command Means/);
    assert.doesNotMatch(content, /## 每个命令是什么意思/);
    assert.doesNotMatch(content, /## Bridge Model/);
    assert.doesNotMatch(content, /## Bridge 模型/);
    for (const pattern of headingPatterns) {
      assert.match(content, pattern);
    }
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

  assert.ok(existsSync(referencePath));
  assert.match(reference, /## Command Reference/);
  assert.match(reference, /## Bridge Model/);
  assert.match(reference, /## Reconnect Facts/);
  assert.match(reference, /pairing required/);
  assert.match(reference, /device-auth\.json/);
});

test('agents/openai.yaml reflects local bootstrap usage', () => {
  const content = readFileSync(path.join(ROOT_DIR, 'agents', 'openai.yaml'), 'utf8');
  assert.match(content, /display_name:\s*"Uruc Skill"/);
  assert.match(content, /Use \$uruc-skill for URUC or \[URUC_EVENT\] work/);
  assert.match(content, /bootstrap, events, what_state_am_i/);
  assert.match(content, /what_state_am_i/);
  assert.match(content, /where_can_i_go/);
  assert.match(content, /what_can_i_do/);
  assert.match(content, /references\/uruc-agent-reference\.md/);
  assert.doesNotMatch(content, /\bsession\b/);
  assert.match(content, /allow_implicit_invocation:\s*true/);
});
