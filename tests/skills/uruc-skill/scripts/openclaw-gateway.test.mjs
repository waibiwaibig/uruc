import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';

import {
  callOpenClawGateway,
  resolveOpenClawGatewayTarget,
  sendOpenClawSystemEventText,
} from '../../../../skills/uruc-skill/scripts/lib/openclaw-gateway.mjs';

function withTempOpenClawConfig(t, config) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'openclaw-gateway-test-'));
  const configPath = path.join(dir, 'openclaw.json');
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, configPath };
}

function deriveDeviceId(publicKeyPem) {
  const spki = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  const raw = spki.length === prefix.length + 32 && spki.subarray(0, prefix.length).equals(prefix)
    ? spki.subarray(prefix.length)
    : spki;
  return createHash('sha256').update(raw).digest('hex');
}

function writeDeviceIdentity(dir) {
  const identityDir = path.join(dir, 'identity');
  mkdirSync(identityDir, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const identity = {
    version: 1,
    deviceId: deriveDeviceId(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
    createdAtMs: 1,
  };
  writeFileSync(path.join(identityDir, 'device.json'), `${JSON.stringify(identity, null, 2)}\n`);
  return identity;
}

function writeDeviceAuth(dir, deviceId, role = 'operator', token = 'device-token-123', scopes = ['operator.write']) {
  const identityDir = path.join(dir, 'identity');
  mkdirSync(identityDir, { recursive: true });
  writeFileSync(path.join(identityDir, 'device-auth.json'), `${JSON.stringify({
    version: 1,
    deviceId,
    tokens: {
      [role]: {
        token,
        role,
        scopes,
        updatedAtMs: 1,
      },
    },
  }, null, 2)}\n`);
}

function withGatewayServer(t, callbacks = {}) {
  const OriginalWebSocket = globalThis.WebSocket;

  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.CONNECTING;
      queueMicrotask(() => {
        this.readyState = FakeWebSocket.OPEN;
        this.onmessage?.({
          data: JSON.stringify({
            event: 'connect.challenge',
            payload: { nonce: 'nonce-1' },
            seq: 1,
          }),
        });
      });
    }

    send(raw) {
      const message = JSON.parse(String(raw));
      if (message.type !== 'req') return;

      if (message.method === 'connect') {
        callbacks.onConnect?.(message.params, this.url);
        this.onmessage?.({
          data: JSON.stringify({
            type: 'res',
            id: message.id,
            ok: true,
            payload: {
              auth: { role: 'operator', scopes: ['operator.write'] },
              features: { methods: ['chat.send'] },
            },
          }),
        });
        return;
      }

      if (message.method === 'chat.send') {
        callbacks.onChatSend?.(message.params, this.url);
        this.onmessage?.({
          data: JSON.stringify({
            type: 'res',
            id: message.id,
            ok: true,
            payload: { status: 'ok' },
          }),
        });
      }
    }

    close(code = 1000, reason = '') {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.({ code, reason });
    }
  }

  globalThis.WebSocket = FakeWebSocket;
  t.after(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });
}

test('callOpenClawGateway performs the gateway handshake and sends chat.send', async (t) => {
  let seenChatSend = null;
  let seenConnect = null;
  withGatewayServer(t, {
    onConnect: (params) => {
      seenConnect = params;
    },
    onChatSend: (params) => {
      seenChatSend = params;
    },
  });

  const result = await callOpenClawGateway('chat.send', {
    sessionKey: 'main',
    message: '[URUC_EVENT]\n{"hello":true}',
    idempotencyKey: 'wake-batch-1',
  }, {
    url: 'ws://127.0.0.1:19001',
    token: 'token-123',
  });

  assert.deepEqual(result, { status: 'ok' });
  assert.equal(seenConnect.auth.token, 'token-123');
  assert.equal(seenConnect.client.id, 'gateway-client');
  assert.equal(seenConnect.client.mode, 'backend');
  assert.ok(!Object.hasOwn(seenConnect, 'nonce'));
  assert.deepEqual(seenChatSend, {
    sessionKey: 'main',
    message: '[URUC_EVENT]\n{"hello":true}',
    idempotencyKey: 'wake-batch-1',
  });
});

test('sendOpenClawSystemEventText resolves local gateway config without the CLI', async (t) => {
  let seenChatSend = null;
  withGatewayServer(t, {
    onChatSend: (params) => {
      seenChatSend = params;
    },
  });
  const { configPath } = withTempOpenClawConfig(t, {
    gateway: {
      port: 19002,
      bind: 'loopback',
      auth: {
        mode: 'token',
        token: 'token-123',
      },
    },
  });

  const env = {
    ...process.env,
    OPENCLAW_CONFIG_PATH: configPath,
  };
  const target = resolveOpenClawGatewayTarget(env);

  assert.equal(target.url, 'ws://127.0.0.1:19002');
  assert.equal(target.token, 'token-123');

  await sendOpenClawSystemEventText('[URUC_EVENT]\n{"bridge":true}', {
    env,
    idempotencyKey: 'bridge-batch-1',
  });

  assert.deepEqual(seenChatSend, {
    sessionKey: 'main',
    message: '[URUC_EVENT]\n{"bridge":true}',
    idempotencyKey: 'bridge-batch-1',
  });
});

test('sendOpenClawSystemEventText includes local device identity and stored device token when present', async (t) => {
  let seenConnect = null;
  withGatewayServer(t, {
    onConnect: (params) => {
      seenConnect = params;
    },
  });
  const { dir, configPath } = withTempOpenClawConfig(t, {
    gateway: {
      port: 19003,
      bind: 'loopback',
      auth: {
        mode: 'token',
        token: 'token-123',
      },
    },
  });
  const identity = writeDeviceIdentity(dir);
  writeDeviceAuth(dir, identity.deviceId, 'operator', 'device-token-123', ['operator.read', 'operator.write']);

  const env = {
    ...process.env,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_STATE_DIR: dir,
  };

  await sendOpenClawSystemEventText('[URUC_EVENT]\n{"bridge":true}', {
    env,
    idempotencyKey: 'bridge-batch-2',
  });

  assert.equal(seenConnect.auth.token, 'token-123');
  assert.equal(seenConnect.auth.deviceToken, 'device-token-123');
  assert.equal(seenConnect.device.id, identity.deviceId);
  assert.equal(seenConnect.client.id, 'gateway-client');
  assert.equal(seenConnect.client.mode, 'backend');
  assert.deepEqual(seenConnect.scopes, ['operator.write']);
  assert.equal(typeof seenConnect.device.signature, 'string');
  assert.ok(seenConnect.device.signature.length > 0);
  assert.equal(typeof seenConnect.device.signedAt, 'number');
  assert.equal(seenConnect.device.nonce, 'nonce-1');
  assert.notEqual(seenConnect.device.publicKey, identity.publicKeyPem);
});

test('sendOpenClawSystemEventText can use stored device token when shared gateway token is absent', async (t) => {
  let seenConnect = null;
  withGatewayServer(t, {
    onConnect: (params) => {
      seenConnect = params;
    },
  });
  const { dir, configPath } = withTempOpenClawConfig(t, {
    gateway: {
      port: 19004,
      bind: 'loopback',
      auth: {
        mode: 'token',
      },
    },
  });
  const identity = writeDeviceIdentity(dir);
  writeDeviceAuth(dir, identity.deviceId, 'operator', 'device-token-only', ['operator.write']);

  const env = {
    ...process.env,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_STATE_DIR: dir,
  };

  await sendOpenClawSystemEventText('[URUC_EVENT]\n{"deviceOnly":true}', {
    env,
    idempotencyKey: 'bridge-batch-3',
  });

  assert.equal(seenConnect.auth.token, undefined);
  assert.equal(seenConnect.auth.deviceToken, 'device-token-only');
  assert.equal(seenConnect.device.id, identity.deviceId);
});
