#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const urucEntrypoint = path.join(repoRoot, 'uruc');
const permissionSmoke = {
  command: 'uruc.social.get_private_profile@v1',
  capability: 'uruc.social.private-profile.read@v1',
  requestType: 'uruc.social.private-profile.read.request@v1',
};

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env,
    input: options.input,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const rendered = [
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
    ].filter(Boolean).join('\n\n');
    throw new Error(rendered);
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to reserve a port'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForHealth(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for health endpoint: ${url}`);
}

async function postJson(url, body, options = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { response, payload };
}

function extractCookieHeader(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  const cookie = setCookies.map((value) => value.split(';')[0]).filter(Boolean).join('; ');
  if (!cookie) throw new Error('Login response did not include a session cookie');
  return cookie;
}

async function withWebSocket(url, callback) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  try {
    return await callback(ws);
  } finally {
    ws.close();
  }
}

async function sendWsMessage(ws, message) {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for WebSocket response to ${message.id}`));
    }, 10000);
    const onMessage = (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      if (parsed.id !== message.id) return;
      cleanup();
      resolve(parsed);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('error', onError);
    };
    ws.on('message', onMessage);
    ws.on('error', onError);
    ws.send(JSON.stringify(message));
  });
}

function assertPermissionSmokeDiscovery(payload) {
  const command = payload.commands?.find((item) => item.type === permissionSmoke.command);
  if (!command) {
    throw new Error(`Discovery did not expose ${permissionSmoke.command}`);
  }
  const requiredCapabilities = command.protocol?.request?.requiredCapabilities ?? [];
  if (!requiredCapabilities.includes(permissionSmoke.capability)) {
    throw new Error(`Discovery did not expose required capability ${permissionSmoke.capability}: ${JSON.stringify(command)}`);
  }
  if (command.protocol?.request?.type !== permissionSmoke.requestType) {
    throw new Error(`Discovery exposed unexpected request type: ${JSON.stringify(command.protocol?.request)}`);
  }
}

function assertPermissionRequiredReceipt(envelope) {
  if (envelope.type !== 'error') {
    throw new Error(`Expected permission-required error envelope, got ${JSON.stringify(envelope)}`);
  }
  const payload = envelope.payload ?? {};
  const details = payload.details ?? {};
  if (
    payload.code !== 'PERMISSION_REQUIRED'
    || payload.text !== 'Permission required for this request.'
    || payload.nextAction !== 'require_approval'
    || details.requestType !== permissionSmoke.requestType
    || !details.requiredCapabilities?.includes(permissionSmoke.capability)
    || !details.missingCapabilities?.includes(permissionSmoke.capability)
  ) {
    throw new Error(`Unexpected permission-required receipt: ${JSON.stringify(envelope)}`);
  }
}

function assertGrantedReceipt(envelope, agentId) {
  if (envelope.type !== 'result') {
    throw new Error(`Expected granted result envelope, got ${JSON.stringify(envelope)}`);
  }
  if (envelope.payload?.subject?.agentId !== agentId) {
    throw new Error(`Granted result did not describe the smoke resident: ${JSON.stringify(envelope)}`);
  }
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-local-smoke-'));
const envPath = path.join(tempRoot, 'server.env');
const stateDir = path.join(tempRoot, 'state');
const cityConfigPath = path.join(tempRoot, 'custom.city.json');
const cityLockPath = path.join(tempRoot, 'custom.city.lock.json');
const dbPath = path.join(tempRoot, 'custom.db');
const publicDir = path.join(tempRoot, 'public');
const uploadsDir = path.join(tempRoot, 'uploads');
const pluginStoreDir = path.join(tempRoot, 'plugin-store');
const httpPort = await reservePort();
const wsPort = await reservePort();
const baseEnv = {
  ...process.env,
  URUC_SERVER_ENV_PATH: envPath,
  URUC_CLI_STATE_DIR: stateDir,
  CITY_LOCK_PATH: cityLockPath,
};

await mkdir(publicDir, { recursive: true });
await mkdir(uploadsDir, { recursive: true });
await mkdir(path.dirname(cityConfigPath), { recursive: true });
await writeFile(cityConfigPath, `${JSON.stringify({
  apiVersion: 2,
  approvedPublishers: ['uruc'],
  pluginStoreDir,
  sources: [],
  plugins: {},
}, null, 2)}\n`, 'utf8');
await writeFile(envPath, [
  'URUC_CLI_LANG=en',
  'URUC_CITY_REACHABILITY=local',
  'URUC_PURPOSE=test',
  'BIND_HOST=127.0.0.1',
  `PORT=${httpPort}`,
  `WS_PORT=${wsPort}`,
  `BASE_URL=http://127.0.0.1:${httpPort}`,
  'ADMIN_USERNAME=smoke-admin',
  'ADMIN_PASSWORD=smoke-secret',
  'ADMIN_EMAIL=smoke@example.com',
  'JWT_SECRET=smoke-jwt-secret',
  `DB_PATH=${dbPath}`,
  `CITY_CONFIG_PATH=${cityConfigPath}`,
  `PUBLIC_DIR=${publicDir}`,
  `UPLOADS_DIR=${uploadsDir}`,
  `ALLOWED_ORIGINS=http://127.0.0.1:${httpPort},http://localhost:${httpPort},http://localhost:5173`,
].join('\n') + '\n', 'utf8');

let started = false;

try {
  run(urucEntrypoint, ['configure', '--quickstart', '--accept-defaults', '--lang', 'en'], {
    env: baseEnv,
  });

  const configuredEnv = parseEnv(await readFile(envPath, 'utf8'));
  if (configuredEnv.DB_PATH !== dbPath) {
    throw new Error(`QuickStart did not preserve DB_PATH. Expected ${dbPath}, got ${configuredEnv.DB_PATH ?? '(missing)'}`);
  }
  if (configuredEnv.CITY_CONFIG_PATH !== cityConfigPath) {
    throw new Error(`QuickStart did not preserve CITY_CONFIG_PATH. Expected ${cityConfigPath}, got ${configuredEnv.CITY_CONFIG_PATH ?? '(missing)'}`);
  }
  if (configuredEnv.PUBLIC_DIR !== publicDir) {
    throw new Error(`QuickStart did not preserve PUBLIC_DIR. Expected ${publicDir}, got ${configuredEnv.PUBLIC_DIR ?? '(missing)'}`);
  }
  if (configuredEnv.UPLOADS_DIR !== uploadsDir) {
    throw new Error(`QuickStart did not preserve UPLOADS_DIR. Expected ${uploadsDir}, got ${configuredEnv.UPLOADS_DIR ?? '(missing)'}`);
  }

  const configuredCity = JSON.parse(await readFile(cityConfigPath, 'utf8'));
  if (configuredCity.pluginStoreDir !== pluginStoreDir) {
    throw new Error(`QuickStart did not preserve pluginStoreDir. Expected ${pluginStoreDir}, got ${configuredCity.pluginStoreDir ?? '(missing)'}`);
  }

  run(urucEntrypoint, ['start', '-b'], { env: baseEnv });
  started = true;

  const healthUrl = `http://127.0.0.1:${httpPort}/api/health`;
  const health = await waitForHealth(healthUrl);
  if (health.status !== 'ok') {
    throw new Error(`Unexpected health payload: ${JSON.stringify(health)}`);
  }

  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const login = await postJson(`${baseUrl}/api/auth/login`, {
    username: 'smoke-admin',
    password: 'smoke-secret',
  });
  const cookie = extractCookieHeader(login.response);
  const agentResult = await postJson(`${baseUrl}/api/dashboard/agents`, {
    name: 'permission-smoke-resident',
  }, { cookie });
  const agent = agentResult.payload.agent;
  if (!agent?.id || !agent?.token) {
    throw new Error(`Dashboard agent creation did not return id and token: ${JSON.stringify(agentResult.payload)}`);
  }

  await withWebSocket(`ws://127.0.0.1:${wsPort}`, async (ws) => {
    const auth = await sendWsMessage(ws, {
      id: 'auth-permission-smoke',
      type: 'auth',
      payload: agent.token,
    });
    if (auth.type !== 'result' || auth.payload?.agentId !== agent.id) {
      throw new Error(`WebSocket auth failed for permission smoke resident: ${JSON.stringify(auth)}`);
    }

    const discovery = await sendWsMessage(ws, {
      id: 'discover-permission-smoke',
      type: 'what_can_i_do',
      payload: { scope: 'plugin', pluginId: 'uruc.social' },
    });
    if (discovery.type !== 'result') {
      throw new Error(`Social command discovery failed: ${JSON.stringify(discovery)}`);
    }
    assertPermissionSmokeDiscovery(discovery.payload ?? {});

    const denied = await sendWsMessage(ws, {
      id: 'permission-smoke-denied',
      type: permissionSmoke.command,
      payload: {},
    });
    assertPermissionRequiredReceipt(denied);

    await postJson(`${baseUrl}/api/dashboard/permission-approvals`, {
      residentId: agent.id,
      capabilities: [permissionSmoke.capability],
    }, { cookie });

    const granted = await sendWsMessage(ws, {
      id: 'permission-smoke-granted',
      type: permissionSmoke.command,
      payload: {},
    });
    assertGrantedReceipt(granted, agent.id);
  });

  const doctor = run(urucEntrypoint, ['doctor', '--json'], { env: baseEnv });
  const doctorReport = JSON.parse(doctor.stdout);
  if (!Array.isArray(doctorReport.pluginChecks)) {
    throw new Error('Doctor JSON did not include a pluginChecks array');
  }
  if (doctorReport.pluginChecks.some((item) => item.status === 'fail')) {
    throw new Error(`Doctor reported failing plugin checks: ${JSON.stringify(doctorReport.pluginChecks)}`);
  }

  run(urucEntrypoint, ['stop'], { env: baseEnv });
  started = false;

  console.log('Uruc local smoke verification passed.');
} finally {
  if (started) {
    try {
      run(urucEntrypoint, ['stop'], { env: baseEnv });
    } catch {
      // best effort cleanup
    }
  }
  await rm(tempRoot, { recursive: true, force: true });
}
