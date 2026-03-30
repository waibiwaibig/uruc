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

class RecordingRemoteDaemon extends AgentDaemon {
  constructor() {
    super();
    this.remoteCalls = [];
  }

  bindRemoteSocket(socket) {
    this.remoteSocket = socket;
  }

  async disconnectRemote({ clearSession }) {
    this.remoteSocket = null;
    this.state = {
      ...this.state,
      connectionStatus: 'idle',
      authenticated: false,
      agentSession: clearSession ? null : this.state.agentSession,
    };
  }

  async sendRemote(type, payload) {
    this.remoteCalls.push({ type, payload });
    if (type === 'auth') {
      return {
        agentId: 'agent-1',
        agentName: 'Agent One',
      };
    }
    if (type === 'what_state_am_i') {
      return {
        connected: true,
        hasController: true,
        isController: true,
        inCity: true,
        currentLocation: 'uruc.chess.chess-club',
        citytime: 789,
      };
    }
    throw new Error(`unexpected remote call: ${type}`);
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

test('connectRemote refreshes authoritative state via what_state_am_i after auth', async (t) => {
  const OriginalWebSocket = globalThis.WebSocket;

  class FakeWebSocket {
    static OPEN = 1;

    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.OPEN;
      queueMicrotask(() => {
        this.onopen?.();
      });
    }

    close() {
      this.readyState = 3;
      this.onclose?.({ code: 1000, reason: '' });
    }
  }

  globalThis.WebSocket = FakeWebSocket;
  t.after(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  const daemon = new RecordingRemoteDaemon();
  await daemon.connectRemote(buildBootstrapConfig({
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  }));

  assert.deepEqual(daemon.remoteCalls, [
    { type: 'auth', payload: 'agent-token' },
    { type: 'what_state_am_i', payload: undefined },
  ]);
  assert.equal(daemon.state.citytime, 789);
  assert.equal(daemon.state.currentLocation, 'uruc.chess.chess-club');
});

test('passive session_state pushes update local state using citytime', () => {
  const daemon = new AgentDaemon();
  daemon.handleUnsolicitedMessage({
    type: 'session_state',
    payload: {
      connected: true,
      hasController: true,
      isController: false,
      inCity: true,
      currentLocation: 'uruc.chess.chess-club',
      citytime: 321,
    },
  });

  assert.equal(daemon.state.inCity, true);
  assert.equal(daemon.state.currentLocation, 'uruc.chess.chess-club');
  assert.equal(daemon.state.citytime, 321);
});

test('where_can_i_go results do not create removed discovery caches in daemon state', async () => {
  const daemon = new AgentDaemon();
  daemon.remoteSocket = {
    readyState: WebSocket.OPEN,
    send() {},
  };
  daemon.sendRemote = async (type) => {
    assert.equal(type, 'where_can_i_go');
    return {
      current: {
        place: 'city',
        locationId: null,
        locationName: null,
      },
      locations: [
        {
          id: 'uruc.chess.chess-club',
          name: '国际象棋馆',
        },
      ],
      citytime: 654,
    };
  };

  const response = await daemon.handleRequest({
    id: 'where-1',
    action: 'exec',
    payload: {
      type: 'where_can_i_go',
      payload: undefined,
      timeoutMs: 10_000,
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.data.state.citytime, 654);
  assert.equal('availableCommands' in response.data.state, false);
  assert.equal('availableLocations' in response.data.state, false);
});
