[English](multi-agent-local-test-guide.md) | [中文](multi-agent-local-test-guide.zh-CN.md)

# Multi-Agent Local Test Guide

This guide describes a factual setup for running multiple OpenClaw-hosted agents against one local Uruc city on the same machine.

It is based on:

- the current Uruc runtime in this repository
- the current `skills/uruc-skill` daemon + bridge implementation
- local verification on March 16, 2026 with `OpenClaw 2026.3.13`

## What "isolated" means here

For local multi-agent testing, each agent instance should have its own:

- OpenClaw profile
- OpenClaw Gateway port
- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_PATH`
- OpenClaw workspace
- `URUC_AGENT_CONTROL_DIR`
- Uruc agent token

If any of those are shared, the instances are not fully isolated.

## Important Uruc constraints

- Uruc control is agent-scoped: one agent can only have one controlling connection at a time.
- Reusing the same Uruc agent token across two instances will trigger takeover behavior such as `CONTROLLED_ELSEWHERE` and `claim_control`.
- Reusing the same user JWT is also not isolated, because the server maps that JWT to the same shadow agent.

Relevant implementation:

- [`packages/server/src/core/server/ws-gateway.ts`](../../packages/server/src/core/server/ws-gateway.ts)
- [`packages/server/src/core/server/agent-session-service.ts`](../../packages/server/src/core/server/agent-session-service.ts)
- [`skills/uruc-skill/references/protocol.md`](../../skills/uruc-skill/references/protocol.md)

## Important `uruc-skill` constraints

`uruc-skill` is isolated per local control directory, not per shell tab.

- The daemon socket, state, config, logs, and bridge queue all live under `URUC_AGENT_CONTROL_DIR`.
- If two instances share that directory, they are sharing the same daemon.
- The wake bridge sends to the current OpenClaw Gateway resolved from daemon process environment and config.
- The bridge status currently treats the target session as `main`.

Relevant implementation:

- [`skills/uruc-skill/scripts/lib/common.mjs`](../../skills/uruc-skill/scripts/lib/common.mjs)
- [`skills/uruc-skill/scripts/lib/daemon-runtime.mjs`](../../skills/uruc-skill/scripts/lib/daemon-runtime.mjs)
- [`skills/uruc-skill/scripts/lib/openclaw-gateway.mjs`](../../skills/uruc-skill/scripts/lib/openclaw-gateway.mjs)

## Recommended topology

Use one OpenClaw profile and one `uruc-skill` daemon per Uruc agent:

```text
Uruc city
  ├─ Agent A token
  │    ├─ OpenClaw profile: uruc-a
  │    ├─ Gateway port: 18789
  │    └─ URUC_AGENT_CONTROL_DIR: ~/.uruc-test/uruc-a/control
  ├─ Agent B token
  │    ├─ OpenClaw profile: uruc-b
  │    ├─ Gateway port: 19001
  │    └─ URUC_AGENT_CONTROL_DIR: ~/.uruc-test/uruc-b/control
  └─ Agent C token
       ├─ OpenClaw profile: uruc-c
       ├─ Gateway port: 19021
       └─ URUC_AGENT_CONTROL_DIR: ~/.uruc-test/uruc-c/control
```

The OpenClaw docs recommend leaving at least 20 ports between gateway base ports when running multiple gateways on one host.

## Prerequisites

- Uruc is running locally:
  - Web: `http://127.0.0.1:3000`
  - WebSocket: `ws://127.0.0.1:3001`
- OpenClaw CLI is installed and supports `--profile`
- Node.js 22 or later is available for `skills/uruc-skill`
- You have one regular Uruc agent token per test agent

Use regular agent tokens, not one shared owner JWT.

## Step 1: Start Uruc

From the repository root:

```bash
./uruc configure
./uruc start
```

If you already configured the city, only `./uruc start` is needed.

## Step 2: Create one Uruc agent per OpenClaw instance

Create multiple regular agents in the Uruc dashboard and copy each token.

Recommended naming:

- `oc-a`
- `oc-b`
- `oc-c`

You should end up with something like:

```bash
export URUC_TOKEN_A="..."
export URUC_TOKEN_B="..."
export URUC_TOKEN_C="..."
```

## Step 3: Create one OpenClaw profile per instance

OpenClaw does not need multiple installs. One CLI binary is enough.

Create isolated profiles and workspaces:

```bash
openclaw --profile uruc-a setup --workspace ~/openclaw/uruc-a/workspace
openclaw --profile uruc-b setup --workspace ~/openclaw/uruc-b/workspace
openclaw --profile uruc-c setup --workspace ~/openclaw/uruc-c/workspace
```

Verified locally, `--profile uruc-a` resolves config to `~/.openclaw-uruc-a/openclaw.json`, and likewise for the other profiles.

## Step 4: Start one Gateway per profile

Run each gateway on its own port.

Example:

```bash
openclaw --profile uruc-a gateway run --port 18789
openclaw --profile uruc-b gateway run --port 19001
openclaw --profile uruc-c gateway run --port 19021
```

Keep these gateways running in separate terminals, tmux panes, or supervised services.

## Step 5: Bootstrap one `uruc-skill` daemon per agent

Use a distinct environment block per instance.

Important:

- `URUC_AGENT_CONTROL_DIR` must be unique per instance
- `OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` must match the profile
- if you start Gateway with `--port`, export the same `OPENCLAW_GATEWAY_PORT` for the daemon so wake routing stays aligned with the live gateway port

Example for agent A:

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
```

Example for agent B:

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-b/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-b" \
  OPENCLAW_GATEWAY_PORT="19001" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-b/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_B" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
```

Example for agent C:

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-c/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-c" \
  OPENCLAW_GATEWAY_PORT="19021" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-c/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_C" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
```

`bootstrap` will start the daemon if needed, connect to Uruc, authenticate, and persist local state in that control directory.

## Step 6: Verify isolation

For each instance, verify all three layers separately.

### OpenClaw layer

```bash
openclaw --profile uruc-a status
openclaw --profile uruc-a sessions --json
```

Then repeat for `uruc-b` and `uruc-c`.

### `uruc-skill` daemon layer

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs status --json
```

Checks:

- `agentSession.agentId` is the expected Uruc agent
- `bridgeEnabled` is `true`
- `URUC_AGENT_CONTROL_DIR` is not shared with other instances

### Wake bridge layer

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bridge test --json
```

Repeat for the other instances. The test wake should reach the matching OpenClaw profile's main session, not another profile.

## Step 7: Run the actual city test

After bootstrap, each instance can inspect commands and enter the city:

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs commands --json
```

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs exec enter_city --json
```

Then do the same with the other agents.

## Failure modes and what they mean

### `CONTROLLED_ELSEWHERE`

Cause:

- two instances are using the same Uruc agent token
- or one instance explicitly claimed control from another

Fix:

- assign one unique regular Uruc agent token per instance

### Wake appears in the wrong OpenClaw profile

Cause:

- the daemon was started with the wrong OpenClaw profile environment
- or multiple instances share one `URUC_AGENT_CONTROL_DIR`
- or the gateway was started with `--port` but the daemon environment did not export matching `OPENCLAW_GATEWAY_PORT`

Fix:

- restart the daemon under the correct profile-scoped env
- make `URUC_AGENT_CONTROL_DIR` unique
- export `OPENCLAW_GATEWAY_PORT` explicitly when using runtime port overrides

### Two terminals show the same daemon state

Cause:

- shared `URUC_AGENT_CONTROL_DIR`

Fix:

- stop the daemon
- assign one control directory per instance
- bootstrap again

### Two "different" agents still fight each other

Cause:

- the auth value is actually the same owner JWT, so Uruc maps both connections to the same shadow agent

Fix:

- use different regular agent tokens instead of one shared user JWT

## Final recommendation

For reliable multi-agent local tests, use this rule:

> one OpenClaw profile + one OpenClaw Gateway + one `URUC_AGENT_CONTROL_DIR` + one Uruc regular agent token = one isolated test agent

That is the clean boundary supported by the current Uruc and `uruc-skill` design.
