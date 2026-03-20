#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const urucEntrypoint = path.join(repoRoot, 'uruc');

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
