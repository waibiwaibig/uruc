import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

import { buildBootstrapConfig } from '../lib/common.mjs';
import { AgentDaemon } from '../lib/daemon-runtime.mjs';

class RecordingWakeDaemon extends AgentDaemon {
  constructor() {
    super();
    this.sentMessages = [];
  }

  async sendLocalWakeText(text, options = {}) {
    this.sentMessages.push({ text, options });
  }
}

class FailingWakeDaemon extends AgentDaemon {
  async sendLocalWakeText() {
    throw new Error('missing openclaw');
  }
}

function withTempControlDir(t) {
  const previous = process.env.URUC_AGENT_CONTROL_DIR;
  const controlDir = mkdtempSync(path.join(os.tmpdir(), 'uruc-skill-test-'));
  process.env.URUC_AGENT_CONTROL_DIR = controlDir;
  t.after(() => {
    if (typeof previous === 'string') {
      process.env.URUC_AGENT_CONTROL_DIR = previous;
    } else {
      delete process.env.URUC_AGENT_CONTROL_DIR;
    }
    rmSync(controlDir, { recursive: true, force: true });
  });
  return controlDir;
}

test('unsolicited Uruc push queues a local OpenClaw chat.send message', async (t) => {
  withTempControlDir(t);
  const daemon = new RecordingWakeDaemon();
  daemon.config = buildBootstrapConfig({
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  }, null, { coalesceWindowMs: 50 });
  daemon.state = {
    ...daemon.state,
    authenticated: true,
    connectionStatus: 'connected',
    agentSession: {
      agentId: 'agent-1',
      agentName: 'Agent One',
    },
  };

  const message = {
    type: 'chess_room_updated',
    payload: {
      state: {
        serverTimestamp: 123,
        currentLocation: 'uruc.chess.chess-club',
      },
    },
  };

  daemon.handleUnsolicitedMessage(message);

  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(daemon.sentMessages.length, 1);
  assert.equal(daemon.sentMessages[0].options.sessionKey, 'main');
  assert.equal(typeof daemon.sentMessages[0].options.idempotencyKey, 'string');
  assert.ok(daemon.sentMessages[0].options.idempotencyKey.length > 0);
  assert.ok(daemon.sentMessages[0].text.startsWith('[URUC_EVENT]\n'));
  const body = JSON.parse(daemon.sentMessages[0].text.slice('[URUC_EVENT]\n'.length));
  assert.deepEqual(body, message);
  daemon.clearBridgeTimers();
});

test('queued wake batches forward the batch id as chat.send idempotencyKey', async (t) => {
  withTempControlDir(t);
  const daemon = new RecordingWakeDaemon();
  daemon.config = buildBootstrapConfig({
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  });
  daemon.state = {
    ...daemon.state,
    authenticated: true,
    connectionStatus: 'connected',
    agentSession: {
      agentId: 'agent-1',
      agentName: 'Agent One',
    },
  };

  daemon.queueWakeBatch({
    id: 'batch-1',
    createdAt: new Date().toISOString(),
    messages: [
      {
        type: 'bridge_test',
        payload: { manual: true, mode: 'local' },
      },
    ],
  });

  await daemon.processWakeQueue();

  assert.equal(daemon.sentMessages.length, 1);
  assert.equal(daemon.sentMessages[0].options.sessionKey, 'main');
  assert.equal(daemon.sentMessages[0].options.idempotencyKey, 'batch-1');
  assert.equal(daemon.sentMessages[0].text, '[URUC_EVENT]\n{"type":"bridge_test","payload":{"manual":true,"mode":"local"}}');
  daemon.clearBridgeTimers();
});

test('local wake failure keeps the queued batch for retry', async (t) => {
  withTempControlDir(t);
  const daemon = new FailingWakeDaemon();
  daemon.config = buildBootstrapConfig({
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  });
  daemon.state = {
    ...daemon.state,
    authenticated: true,
    connectionStatus: 'connected',
    agentSession: {
      agentId: 'agent-1',
      agentName: 'Agent One',
    },
  };

  daemon.queueWakeBatch({
    id: 'batch-1',
    createdAt: new Date().toISOString(),
    messages: [
      {
        type: 'bridge_test',
        payload: { manual: true, mode: 'local' },
      },
    ],
  });

  await daemon.processWakeQueue();

  assert.equal(daemon.bridgeQueue.batches.length, 1);
  assert.match(daemon.state.lastWakeError, /missing openclaw/);
  daemon.clearBridgeTimers();
});

test('coalesced pushes wake with a raw message array', async (t) => {
  withTempControlDir(t);
  const daemon = new RecordingWakeDaemon();
  daemon.config = buildBootstrapConfig({
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  }, null, { coalesceWindowMs: 50 });
  daemon.state = {
    ...daemon.state,
    authenticated: true,
    connectionStatus: 'connected',
    agentSession: {
      agentId: 'agent-1',
      agentName: 'Agent One',
    },
  };

  const first = { type: 'arcade_table_event', payload: { tableId: 't-1' } };
  const second = { type: 'arcade_table_closed', payload: { tableId: 't-1' } };

  daemon.handleUnsolicitedMessage(first);
  daemon.handleUnsolicitedMessage(second);

  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(daemon.sentMessages.length, 1);
  assert.equal(daemon.sentMessages[0].options.sessionKey, 'main');
  assert.ok(daemon.sentMessages[0].options.idempotencyKey);
  const body = JSON.parse(daemon.sentMessages[0].text.slice('[URUC_EVENT]\n'.length));
  assert.deepEqual(body, [first, second]);
  daemon.clearBridgeTimers();
});

test('legacy bridge queue envelopes are discarded on boot', (t) => {
  const controlDir = withTempControlDir(t);
  writeFileSync(path.join(controlDir, 'bridge-queue.json'), JSON.stringify({
    batches: [
      {
        id: 'legacy-batch',
        source: 'uruc-bridge',
        bridgeVersion: 1,
        events: [{ type: 'legacy_event', payload: { old: true } }],
      },
    ],
  }));

  const daemon = new AgentDaemon();
  assert.deepEqual(daemon.bridgeQueue, { batches: [] });
});
