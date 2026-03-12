import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBootstrapConfig } from '../lib/common.mjs';
import { ensureBootstrap, resolveBootstrapInput } from '../uruc-agent.mjs';

test('resolveBootstrapInput reads OpenClaw skill env by default', () => {
  const input = resolveBootstrapInput({}, {
    URUC_AGENT_BASE_URL: 'http://127.0.0.1:3000',
    URUC_AGENT_AUTH: 'agent-token',
  });

  assert.deepEqual(input, {
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  });
});

test('ensureBootstrap starts daemon and bootstraps on fresh state', async () => {
  let running = false;
  let startCount = 0;
  const bootstrapCalls = [];
  const targetState = {
    connectionStatus: 'connected',
    authenticated: true,
    wsUrl: 'ws://127.0.0.1:3001',
    baseUrl: 'http://127.0.0.1:3000',
    agentSession: null,
    inCity: false,
    currentLocation: null,
  };

  const result = await ensureBootstrap({}, {
    env: {
      URUC_AGENT_BASE_URL: 'http://127.0.0.1:3000',
      URUC_AGENT_AUTH: 'agent-token',
    },
    readConfig: () => null,
    isDaemonRunning: async () => running,
    startDaemon: async () => {
      startCount += 1;
      running = true;
      return true;
    },
    callDaemon: async (action, payload) => {
      assert.equal(action, 'bootstrap');
      bootstrapCalls.push(payload);
      return targetState;
    },
  });

  assert.equal(startCount, 1);
  assert.equal(bootstrapCalls.length, 1);
  assert.equal(result.bootstrapped, true);
  assert.deepEqual(result.state, targetState);
});

test('ensureBootstrap is a no-op when daemon and config already match', async () => {
  let bootstrapCount = 0;
  const input = {
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'agent-token',
  };
  const config = buildBootstrapConfig(input);
  const state = {
    connectionStatus: 'connected',
    authenticated: true,
    wsUrl: input.wsUrl,
    baseUrl: input.baseUrl,
  };

  const result = await ensureBootstrap({}, {
    env: {
      URUC_AGENT_BASE_URL: input.baseUrl,
      URUC_AGENT_AUTH: input.auth,
    },
    readConfig: () => config,
    isDaemonRunning: async () => true,
    startDaemon: async () => {
      throw new Error('daemon should not start');
    },
    callDaemon: async (action) => {
      if (action === 'status') {
        return state;
      }
      if (action === 'bootstrap') {
        bootstrapCount += 1;
        return state;
      }
      throw new Error(`unexpected action: ${action}`);
    },
  });

  assert.equal(bootstrapCount, 0);
  assert.equal(result.bootstrapped, false);
  assert.deepEqual(result.state, state);
});

test('ensureBootstrap reconfigures when auth drifts', async () => {
  let bootstrapPayload = null;
  const oldInput = {
    baseUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3001',
    auth: 'old-token',
  };
  const nextInput = {
    ...oldInput,
    auth: 'new-token',
  };

  const result = await ensureBootstrap({}, {
    env: {
      URUC_AGENT_BASE_URL: nextInput.baseUrl,
      URUC_AGENT_AUTH: nextInput.auth,
    },
    readConfig: () => buildBootstrapConfig(oldInput),
    isDaemonRunning: async () => true,
    startDaemon: async () => {
      throw new Error('daemon should not start');
    },
    callDaemon: async (action, payload) => {
      if (action === 'bootstrap') {
        bootstrapPayload = payload;
        return {
          connectionStatus: 'connected',
          authenticated: true,
          wsUrl: nextInput.wsUrl,
          baseUrl: nextInput.baseUrl,
        };
      }
      throw new Error(`unexpected action: ${action}`);
    },
  });

  assert.deepEqual(bootstrapPayload, nextInput);
  assert.equal(result.bootstrapped, true);
});
