#!/usr/bin/env node

import { spawn } from 'child_process';
import { closeSync, openSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { callDaemon, isDaemonRunning } from './lib/client.mjs';
import {
  ensureNodeVersion,
  ensureControlDir,
  formatJson,
  getLogPath,
  isBootstrapConfigSatisfied,
  parsePayloadArg,
  readConfig,
  readLogTail,
  resolveConnectInput,
  resolveSkillConnectInput,
  sleep,
} from './lib/common.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DAEMON_ENTRY = path.join(SCRIPT_DIR, 'uruc-agent-daemon.mjs');
const BOOTSTRAP_TIMEOUT_MS = 20_000;

export function createCliDeps(overrides = {}) {
  return {
    env: process.env,
    callDaemon,
    isDaemonRunning,
    readConfig,
    startDaemon,
    resolveConnectInput,
    resolveSkillConnectInput,
    ...overrides,
  };
}

export async function main(args = process.argv.slice(2), deps = createCliDeps()) {
  ensureNodeVersion(22);

  const command = args[0];
  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    case 'daemon':
      await handleDaemon(args.slice(1), deps);
      return;
    case 'bootstrap':
      await handleBootstrap(args.slice(1), deps);
      return;
    case 'connect':
      await handleConnect(args.slice(1), deps);
      return;
    case 'disconnect':
      await handleDisconnect(args.slice(1), deps);
      return;
    case 'what_state_am_i':
      await handleWhatStateAmI(args.slice(1), deps);
      return;
    case 'claim':
      await handleClaim(args.slice(1), deps);
      return;
    case 'release':
      await handleRelease(args.slice(1), deps);
      return;
    case 'bridge':
      await handleBridge(args.slice(1), deps);
      return;
    case 'status':
      await handleStatus(args.slice(1), deps);
      return;
    case 'where_can_i_go':
      await handleWhereCanIGo(args.slice(1), deps);
      return;
    case 'what_can_i_do':
      await handleWhatCanIDo(args.slice(1), deps);
      return;
    case 'exec':
      await handleExec(args.slice(1), deps);
      return;
    case 'events':
      await handleEvents(args.slice(1), deps);
      return;
    case 'logs':
      await handleLogs(args.slice(1), deps);
      return;
    default:
      throw new Error(`未知命令: ${command}`);
  }
}

async function handleDaemon(args, deps) {
  const subcommand = args[0];
  const options = parseOptions(args.slice(1), { booleans: ['json'] });

  switch (subcommand) {
    case 'start': {
      const started = await deps.startDaemon();
      const output = {
        ok: true,
        started,
        running: await deps.isDaemonRunning(),
        logPath: getLogPath(),
      };
      if (options.json) {
        printJson(output);
        return;
      }
      console.log(started ? 'uruc-agent daemon 已启动' : 'uruc-agent daemon 已在运行');
      console.log(`log: ${output.logPath}`);
      return;
    }
    case 'stop': {
      const wasRunning = await deps.isDaemonRunning();
      if (wasRunning) {
        await deps.callDaemon('shutdown', undefined, 5000);
        await waitFor(async () => !(await deps.isDaemonRunning(300)), 5000, 150);
      }
      const output = {
        ok: true,
        stopped: wasRunning,
        running: await deps.isDaemonRunning(300),
      };
      if (options.json) {
        printJson(output);
        return;
      }
      console.log(wasRunning ? 'uruc-agent daemon 已停止' : 'uruc-agent daemon 当前未运行');
      return;
    }
    case 'status': {
      const running = await deps.isDaemonRunning(300);
      const state = running ? await deps.callDaemon('status', undefined, 3000) : null;
      const output = {
        ok: true,
        running,
        state,
        configPresent: Boolean(deps.readConfig()),
        logPath: getLogPath(),
      };
      if (options.json) {
        printJson(output);
        return;
      }
      console.log(`daemon: ${running ? 'running' : 'stopped'}`);
      if (state) {
        console.log(`connection: ${state.connectionStatus}`);
        console.log(`authenticated: ${state.authenticated ? 'yes' : 'no'}`);
        console.log(`controller: ${state.isController ? 'yes' : state.hasController ? 'other connection' : 'no'}`);
      }
      console.log(`log: ${output.logPath}`);
      return;
    }
    default:
      throw new Error('用法: uruc-agent daemon <start|stop|status> [--json]');
  }
}

async function handleBootstrap(args, deps) {
  const options = parseOptions(args, {
    strings: ['base-url', 'ws-url', 'auth', 'auth-env'],
    booleans: ['json'],
  });
  const { bootstrapped, input, state } = await ensureBootstrap(options, deps);
  const output = {
    ok: true,
    bootstrapped,
    source: hasExplicitConnectOptions(options) ? 'cli' : 'skill-env',
    input,
    wsUrl: state.wsUrl,
    baseUrl: state.baseUrl,
    connectionStatus: state.connectionStatus,
    authenticated: state.authenticated,
    agentSession: state.agentSession,
    inCity: state.inCity,
    currentLocation: state.currentLocation,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log(bootstrapped ? 'uruc-agent bootstrap 已完成' : 'uruc-agent bootstrap 已就绪');
  console.log(`ws: ${output.wsUrl}`);
  if (output.agentSession) {
    console.log(`agent: ${output.agentSession.agentName} (${output.agentSession.agentId})`);
  }
}

async function handleConnect(args, deps) {
  await handleBootstrap(args, deps);
}

async function handleDisconnect(args, deps) {
  const options = parseOptions(args, { booleans: ['json'] });
  await ensureDaemonStarted(deps);
  const state = await deps.callDaemon('disconnect', undefined, 10_000);
  const output = {
    ok: true,
    connectionStatus: state.connectionStatus,
    authenticated: state.authenticated,
  };
  if (options.json) {
    printJson(output);
    return;
  }
  console.log('已断开远程 Uruc 连接');
}

async function handleClaim(args, deps) {
  const options = parseOptions(args, { booleans: ['json'] });
  await ensureBootstrap(undefined, deps);
  const response = await deps.callDaemon('exec', { type: 'claim_control', payload: undefined, timeoutMs: 10_000 }, 12_000);
  const output = {
    ok: true,
    claimed: true,
    result: response.result,
    state: response.state,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log('已接管当前 Agent 控制权');
  console.log(formatJson(output.result));
}

async function handleRelease(args, deps) {
  const options = parseOptions(args, { booleans: ['json'] });
  await ensureBootstrap(undefined, deps);
  const response = await deps.callDaemon('exec', { type: 'release_control', payload: undefined, timeoutMs: 10_000 }, 12_000);
  const output = {
    ok: true,
    released: true,
    result: response.result,
    state: response.state,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log('已释放当前 Agent 控制权');
  console.log(formatJson(output.result));
}

async function handleWhatStateAmI(args, deps) {
  await handleProtocolQuery(args, deps, {
    type: 'what_state_am_i',
    timeoutMs: 10_000,
    label: 'what_state_am_i',
  });
}

async function handleWhereCanIGo(args, deps) {
  await handleProtocolQuery(args, deps, {
    type: 'where_can_i_go',
    timeoutMs: 10_000,
    label: 'where_can_i_go',
  });
}

async function handleWhatCanIDo(args, deps) {
  const options = parseOptions(args, {
    strings: ['scope', 'plugin-id'],
    booleans: ['json'],
  });
  const payload = {};

  if (options.scope) {
    payload.scope = options.scope;
  }
  if (options['plugin-id']) {
    payload.pluginId = options['plugin-id'];
  }
  if (payload.scope === 'plugin' && !payload.pluginId) {
    throw new Error('scope=plugin 时必须提供 --plugin-id');
  }

  await handleProtocolQuery(args, deps, {
    type: 'what_can_i_do',
    timeoutMs: 10_000,
    label: 'what_can_i_do',
    options,
    payload: Object.keys(payload).length === 0 ? undefined : payload,
  });
}

async function handleBridge(args, deps) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'status': {
      const options = parseOptions(args.slice(1), { booleans: ['json'] });
      const { state } = await ensureBootstrap(undefined, deps);
      const bridge = await deps.callDaemon('bridge_status', undefined, 5000);
      const output = {
        ok: true,
        daemonRunning: true,
        bridge,
        state,
      };
      if (options.json) {
        printJson(output);
        return;
      }
      console.log(`bridge: ${bridge.mode}`);
      console.log(`session: ${bridge.targetSession}`);
      console.log(`coalesceWindowMs: ${bridge.coalesceWindowMs}`);
      console.log(`pendingWakeCount: ${bridge.pendingWakeCount}`);
      if (bridge.lastWakeAt) console.log(`lastWakeAt: ${bridge.lastWakeAt}`);
      if (bridge.lastWakeError) console.log(`lastWakeError: ${bridge.lastWakeError}`);
      return;
    }
    case 'test': {
      const options = parseOptions(args.slice(1), { booleans: ['json'] });
      await ensureBootstrap(undefined, deps);
      const bridge = await deps.callDaemon('bridge_test', undefined, 15_000);
      const output = { ok: true, bridge };
      if (options.json) {
        printJson(output);
        return;
      }
      console.log('已发送本地 bridge 测试');
      console.log(formatJson(bridge));
      return;
    }
    default:
      throw new Error('用法: uruc-agent bridge <status|test> [--json]');
  }
}

async function handleStatus(args, deps) {
  const options = parseOptions(args, { booleans: ['json'] });
  const { state } = await ensureBootstrap(undefined, deps);
  const output = {
    ok: true,
    daemonRunning: true,
    configPresent: Boolean(deps.readConfig()),
    state,
    logPath: getLogPath(),
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log('daemon: running');
  console.log(`connection: ${state.connectionStatus}`);
  console.log(`authenticated: ${state.authenticated ? 'yes' : 'no'}`);
  if (state.agentSession) {
    console.log(`agent: ${state.agentSession.agentName} (${state.agentSession.agentId})`);
  }
  console.log(`controller: ${state.isController ? 'yes' : state.hasController ? 'other connection' : 'no'}`);
  console.log(`inCity: ${state.inCity ? 'yes' : 'no'}`);
  console.log(`currentLocation: ${state.currentLocation ?? 'none'}`);
  if (typeof state.citytime === 'number') {
    console.log(`citytime: ${state.citytime}`);
  }
  console.log('authoritative: use `what_state_am_i --json`');
  console.log(`bridge: ${state.bridgeEnabled ? 'local' : 'disabled'}`);
  console.log(`pendingWakeCount: ${state.pendingWakeCount ?? 0}`);
  if (state.lastError) {
    console.log(`lastError: ${state.lastError}`);
  }
  if (state.lastWakeError) {
    console.log(`lastWakeError: ${state.lastWakeError}`);
  }
}

async function handleExec(args, deps) {
  const options = parseOptions(args, {
    strings: ['payload', 'payload-file', 'timeout'],
    booleans: ['json'],
  });
  const type = options._[0];
  if (!type) {
    throw new Error('缺少命令类型。用法: uruc-agent exec <type> [--payload JSON] [--payload-file FILE]');
  }

  const payload = loadPayload(options);
  const timeoutMs = options.timeout ? Number(options.timeout) : 20_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeout 必须是正整数毫秒值');
  }

  await ensureBootstrap(undefined, deps);
  const response = await deps.callDaemon('exec', { type, payload, timeoutMs }, timeoutMs + 2000);
  const output = {
    ok: true,
    command: type,
    payload,
    result: response.result,
    state: response.state,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log(`command: ${type}`);
  console.log(formatJson(response.result));
}

async function handleEvents(args, deps) {
  const options = parseOptions(args, {
    strings: ['limit'],
    booleans: ['json'],
  });
  const limit = options.limit ? Number(options.limit) : 20;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('limit 必须是正整数');
  }

  await ensureBootstrap(undefined, deps);
  const data = await deps.callDaemon('events', { limit }, 5000);
  const output = {
    ok: true,
    daemonRunning: true,
    events: data.events ?? [],
    state: data.state ?? null,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  for (const event of output.events) {
    const timeSuffix = typeof event.citytime === 'number' ? ` citytime=${event.citytime}` : '';
    console.log(`[${event.receivedAt}] ${event.type}${timeSuffix}`);
    console.log(formatJson(event.payload));
  }
}

async function handleLogs(args, deps) {
  const options = parseOptions(args, {
    strings: ['lines'],
    booleans: ['json'],
  });
  const lines = options.lines ? Number(options.lines) : 40;
  if (!Number.isFinite(lines) || lines <= 0) {
    throw new Error('lines 必须是正整数');
  }
  await ensureBootstrap(undefined, deps);
  const log = readLogTail(lines);
  const output = {
    ok: true,
    logPath: getLogPath(),
    lines,
    content: log,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log(log || '(no logs)');
}

export function resolveBootstrapInput(options = {}, env = process.env, deps = {}) {
  if (hasExplicitConnectOptions(options)) {
    const resolveInput = deps.resolveConnectInput ?? resolveConnectInput;
    return resolveInput({
      baseUrl: options['base-url'],
      wsUrl: options['ws-url'],
      auth: options.auth,
      authEnv: options['auth-env'],
    }, env);
  }
  const resolveSkillInput = deps.resolveSkillConnectInput ?? resolveSkillConnectInput;
  return resolveSkillInput(env);
}

export async function ensureBootstrap(options = {}, deps = createCliDeps()) {
  const env = deps.env ?? process.env;
  const input = resolveBootstrapInput(options, env, deps);
  const currentConfig = deps.readConfig();
  let state = null;
  let bootstrapped = false;

  if (!(await deps.isDaemonRunning(300))) {
    await deps.startDaemon();
    bootstrapped = true;
  }

  if (!isBootstrapConfigSatisfied(currentConfig, input)) {
    bootstrapped = true;
  } else {
    try {
      state = await deps.callDaemon('status', undefined, 3000);
      if (!isBootstrappedState(state, input)) {
        bootstrapped = true;
      }
    } catch {
      bootstrapped = true;
    }
  }

  if (bootstrapped) {
    state = await deps.callDaemon('bootstrap', input, BOOTSTRAP_TIMEOUT_MS);
  }

  return { bootstrapped, input, state };
}

async function ensureDaemonStarted(deps) {
  if (await deps.isDaemonRunning(300)) return;
  await deps.startDaemon();
}

async function startDaemon() {
  if (await isDaemonRunning(300)) return false;

  ensureControlDir();
  const logFd = openSync(getLogPath(), 'a');
  try {
    const child = spawn(process.execPath, [DAEMON_ENTRY], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });
    child.unref();
  } finally {
    closeSync(logFd);
  }

  try {
    await waitFor(async () => await isDaemonRunning(300), 8000, 200);
  } catch (error) {
    const tail = readLogTail(40);
    throw new Error(
      `daemon 启动失败: ${error instanceof Error ? error.message : String(error)}\n${tail}`.trim(),
    );
  }
  return true;
}

function isBootstrappedState(state, input) {
  if (!state || typeof state !== 'object') return false;
  const stateBaseUrl = typeof state.baseUrl === 'string' ? state.baseUrl : undefined;
  return state.connectionStatus === 'connected'
    && state.authenticated === true
    && state.wsUrl === input.wsUrl
    && stateBaseUrl === input.baseUrl;
}

function hasExplicitConnectOptions(options = {}) {
  return Boolean(
    options['base-url']
      || options['ws-url']
      || options.auth
      || options['auth-env'],
  );
}

function loadPayload(options) {
  if (options['payload-file']) {
    const content = readFileSync(path.resolve(process.cwd(), options['payload-file']), 'utf8');
    return parsePayloadArg(content);
  }
  return parsePayloadArg(options.payload);
}

function parseOptions(args, spec) {
  const strings = new Set(spec.strings ?? []);
  const booleans = new Set(spec.booleans ?? []);
  const values = { _: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      values._.push(arg);
      continue;
    }

    const option = arg.slice(2);
    const [key, inlineValue] = option.split('=', 2);
    if (booleans.has(key)) {
      values[key] = inlineValue ? inlineValue !== 'false' : true;
      continue;
    }

    if (!strings.has(key)) {
      throw new Error(`未知参数: --${key}`);
    }

    if (typeof inlineValue === 'string') {
      values[key] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`参数 --${key} 缺少值`);
    }
    values[key] = next;
    index += 1;
  }

  return values;
}

async function waitFor(check, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(intervalMs);
  }
  throw new Error('timed out');
}

function printHelp() {
  console.log(`uruc-agent

Usage:
  node /path/to/uruc-agent/scripts/uruc-agent.mjs bootstrap --json
  node /path/to/uruc-agent/scripts/uruc-agent.mjs what_state_am_i --json
  node /path/to/uruc-agent/scripts/uruc-agent.mjs where_can_i_go --json
  node /path/to/uruc-agent/scripts/uruc-agent.mjs what_can_i_do --json
  node /path/to/uruc-agent/scripts/uruc-agent.mjs claim --json
  node /path/to/uruc-agent/scripts/uruc-agent.mjs bridge status --json
  node /path/to/uruc-agent/scripts/uruc-agent.mjs exec enter_city --json

Commands:
  daemon start|stop|status   Manage the local background daemon
  bootstrap                  Bootstrap from OpenClaw skill env and ensure daemon/connection
  connect                    Alias of bootstrap; optional explicit override for recovery
  disconnect                 Disconnect the remote Uruc connection but keep daemon alive
  what_state_am_i            Fetch the authoritative remote agent state snapshot
  claim                      Claim control of the current Agent
  release                    Release control of the current Agent
  bridge status|test         Inspect or test the fixed local OpenClaw bridge path
  status                     Show the local daemon snapshot (not the authoritative protocol query)
  where_can_i_go             Fetch the current place and reachable locations
  what_can_i_do              Fetch command discovery summary or detail payloads
  exec <type>                Execute any discovered Uruc command
  events                     Show recent unsolicited events buffered by the daemon
  logs                       Show recent daemon log lines

Common flags:
  --json                     Emit machine-readable JSON
  --base-url URL             Infer ws URL from the Uruc base URL
  --ws-url URL               Explicit ws/wss endpoint
  --auth TOKEN               JWT or agent token
  --auth-env NAME            Read auth token from an env var
  --scope NAME               Discovery scope for what_can_i_do (city|plugin)
  --plugin-id ID             Plugin id for what_can_i_do --scope plugin
  --payload JSON             JSON payload for exec
  --payload-file FILE        Read exec payload JSON from a file
`);
}

async function handleProtocolQuery(args, deps, config) {
  const options = config.options ?? parseOptions(args, { booleans: ['json'] });
  await ensureBootstrap(undefined, deps);
  const response = await deps.callDaemon('exec', {
    type: config.type,
    payload: config.payload,
    timeoutMs: config.timeoutMs,
  }, config.timeoutMs + 2000);
  const output = {
    ok: true,
    state: response.state,
    result: response.result,
  };

  if (options.json) {
    printJson(output);
    return;
  }

  console.log(`${config.label}:`);
  console.log(formatJson(output.result));
}

function printJson(value) {
  console.log(formatJson(value));
}

function isDirectExecution() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
