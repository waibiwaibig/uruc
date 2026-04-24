import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBootstrapConfig } from '../../../../skills/uruc-skill/scripts/lib/common.mjs';
import { ensureBootstrap, main, resolveBootstrapInput } from '../../../../skills/uruc-skill/scripts/uruc-agent.mjs';

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

test('help lists current protocol query commands and omits removed legacy queries', async () => {
  const output = await captureStdout(async () => {
    await main(['help'], {
      env: {},
    });
  });

  assert.match(output, /what_state_am_i/);
  assert.match(output, /where_can_i_go/);
  assert.match(output, /what_can_i_do/);
  assert.doesNotMatch(output, /\n\s+session\s+/);
  assert.doesNotMatch(output, /\n\s+commands\s+/);
});

test('what_state_am_i queries the daemon through the current protocol name', async () => {
  const calls = [];
  const state = {
    connectionStatus: 'connected',
    authenticated: true,
    wsUrl: 'ws://127.0.0.1:3001',
    baseUrl: 'http://127.0.0.1:3000',
    citytime: 123,
    inCity: true,
    currentLocation: null,
  };

  const output = await captureStdout(async () => {
    await main(['what_state_am_i', '--json'], {
      env: {
        URUC_AGENT_BASE_URL: state.baseUrl,
        URUC_AGENT_AUTH: 'agent-token',
      },
      readConfig: () => buildBootstrapConfig({
        baseUrl: state.baseUrl,
        wsUrl: state.wsUrl,
        auth: 'agent-token',
      }),
      isDaemonRunning: async () => true,
      startDaemon: async () => {
        throw new Error('daemon should not start');
      },
      callDaemon: async (action, payload) => {
        calls.push({ action, payload });
        if (action === 'status') return state;
        if (action === 'exec') {
          return {
            result: {
              connected: true,
              citytime: 123,
              inCity: true,
              currentLocation: null,
            },
            state,
          };
        }
        throw new Error(`unexpected action: ${action}`);
      },
    });
  });

  assert.deepEqual(calls, [
    { action: 'status', payload: undefined },
    {
      action: 'exec',
      payload: {
        type: 'what_state_am_i',
        payload: undefined,
        timeoutMs: 10_000,
      },
    },
  ]);
  assert.deepEqual(JSON.parse(output), {
    ok: true,
    state,
    result: {
      connected: true,
      citytime: 123,
      inCity: true,
      currentLocation: null,
    },
  });
});

test('what_can_i_do forwards detail scopes using current protocol payloads', async () => {
  const calls = [];
  const state = {
    connectionStatus: 'connected',
    authenticated: true,
    wsUrl: 'ws://127.0.0.1:3001',
    baseUrl: 'http://127.0.0.1:3000',
    citytime: 456,
    inCity: true,
    currentLocation: null,
  };

  await captureStdout(async () => {
    await main(['what_can_i_do', '--scope', 'city', '--json'], {
      env: {
        URUC_AGENT_BASE_URL: state.baseUrl,
        URUC_AGENT_AUTH: 'agent-token',
      },
      readConfig: () => buildBootstrapConfig({
        baseUrl: state.baseUrl,
        wsUrl: state.wsUrl,
        auth: 'agent-token',
      }),
      isDaemonRunning: async () => true,
      startDaemon: async () => {
        throw new Error('daemon should not start');
      },
      callDaemon: async (action, payload) => {
        calls.push({ action, payload });
        if (action === 'status') return state;
        if (action === 'exec') {
          return {
            result: {
              level: 'detail',
              target: { scope: 'city' },
              commands: [{ type: 'what_state_am_i' }],
            },
            state,
          };
        }
        throw new Error(`unexpected action: ${action}`);
      },
    });
  });

  await captureStdout(async () => {
    await main(['what_can_i_do', '--scope', 'plugin', '--plugin-id', 'uruc.social', '--json'], {
      env: {
        URUC_AGENT_BASE_URL: state.baseUrl,
        URUC_AGENT_AUTH: 'agent-token',
      },
      readConfig: () => buildBootstrapConfig({
        baseUrl: state.baseUrl,
        wsUrl: state.wsUrl,
        auth: 'agent-token',
      }),
      isDaemonRunning: async () => true,
      startDaemon: async () => {
        throw new Error('daemon should not start');
      },
      callDaemon: async (action, payload) => {
        calls.push({ action, payload });
        if (action === 'status') return state;
        if (action === 'exec') {
          return {
            result: {
              level: 'detail',
              target: { scope: 'plugin', pluginId: 'uruc.social' },
              commands: [{ type: 'uruc.social.get_usage_guide@v1' }],
            },
            state,
          };
        }
        throw new Error(`unexpected action: ${action}`);
      },
    });
  });

  assert.deepEqual(calls, [
    { action: 'status', payload: undefined },
    {
      action: 'exec',
      payload: {
        type: 'what_can_i_do',
        payload: { scope: 'city' },
        timeoutMs: 10_000,
      },
    },
    { action: 'status', payload: undefined },
    {
      action: 'exec',
      payload: {
        type: 'what_can_i_do',
        payload: { scope: 'plugin', pluginId: 'uruc.social' },
        timeoutMs: 10_000,
      },
    },
  ]);
});

test('removed legacy session and commands entrypoints now error immediately', async () => {
  await assert.rejects(() => main(['session'], { env: {} }), /未知命令: session/);
  await assert.rejects(() => main(['commands'], { env: {} }), /未知命令: commands/);
});

async function captureStdout(run) {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => {
    lines.push(args.join(' '));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}
