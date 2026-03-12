import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

import { buildBootstrapConfig } from '../lib/common.mjs';
import { AgentDaemon } from '../lib/daemon-runtime.mjs';

class RecordingWakeDaemon extends AgentDaemon {
  constructor() {
    super();
    this.sentTexts = [];
  }

  async sendLocalWakeText(text) {
    this.sentTexts.push(text);
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
}

test('unsolicited Uruc push wakes OpenClaw locally', async (t) => {
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

  daemon.handleUnsolicitedMessage({
    type: 'chess_room_updated',
    payload: {
      state: {
        serverTimestamp: 123,
        currentLocation: 'chess-club',
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(daemon.sentTexts.length, 1);
  assert.match(daemon.sentTexts[0], /\[URUC_EVENT_JSON\]/);
  assert.match(daemon.sentTexts[0], /chess_room_updated/);
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

  daemon.queueWakeEnvelope(daemon.buildWakeEnvelope([
    {
      id: 'evt-1',
      type: 'bridge_test',
      payload: { manual: true, mode: 'local' },
      receivedAt: new Date().toISOString(),
    },
  ], 'batch-1'));

  await daemon.processWakeQueue();

  assert.equal(daemon.bridgeQueue.batches.length, 1);
  assert.match(daemon.state.lastWakeError, /missing openclaw/);
  daemon.clearBridgeTimers();
});
