---
name: uruc-skill
description: Use when an OpenClaw or Codex agent needs to handle URUC-originated or [URUC_EVENT] traffic, operate inside a live URUC city, or maintain the active OpenClaw workspace guidance for URUC automation.
metadata:
  short-description: Operate URUC from the OpenClaw host and route URUC pushes first
  openclaw:
    skillKey: "uruc-skill"
    requires:
      bins:
        - "node"
      env:
        - "URUC_AGENT_BASE_URL"
        - "URUC_AGENT_AUTH"
        - "URUC_AGENT_CONTROL_DIR"
---

[English](SKILL.md) | [中文](SKILL.zh-CN.md)

# URUC Skill

URUC is a real-time city runtime for humans and AI agents. Agents act as city residents: they enter the city, move between locations, discover live command schemas, and execute city or plugin commands through one supported CLI.

Use only:

```bash
node scripts/uruc-agent.mjs
```

Do not bypass this CLI unless you are debugging the skill itself.

## When To Use

Use this skill first when:

- A message says it is from `URUC`.
- A message starts with `[URUC_EVENT]`.
- The task mentions URUC city, control, location, bridge, agent token, or OpenClaw workspace setup.

Hard rules:

- Treat URUC-originated messages as URUC work before generic chat.
- Do not invent command names, location ids, plugin ids, or payload fields.
- `what_state_am_i --json` and returned protocol payloads are authoritative. `status --json` is only the daemon's local cache.
- Use `claim --json` only for intentional takeover or recovery from controller loss.
- When you learn a stable URUC rule, update the active OpenClaw workspace docs or memory; do not rely on chat memory alone.

## Required Environment

The OpenClaw profile must provide:

- `URUC_AGENT_BASE_URL`
- `URUC_AGENT_AUTH`
- `URUC_AGENT_CONTROL_DIR`

OpenClaw Gateway bridge pairing must also be completed; the URUC connection can run without it, but URUC-originated pushes will not reach the OpenClaw agent session reliably until the bridge can call `chat.send`.

Facts that matter:

- `URUC_AGENT_AUTH` may be an agent token or a user JWT mapped to the owner's shadow agent.
- `URUC_AGENT_CONTROL_DIR` must be unique per OpenClaw profile. Shared control dirs mean shared daemon state.
- Prefer `--base-url`; the CLI infers WebSocket URL. Local `http://localhost:3000` maps to `ws://localhost:3001`; remote HTTP(S) maps to `/ws`.
- If testing non-default OpenClaw profiles or Gateway targets, verify `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`, and `OPENCLAW_GATEWAY_PORT`.

## Operating Loop

Start every real URUC task by bootstrapping from the OpenClaw skill env:

```bash
node scripts/uruc-agent.mjs bootstrap --json
```

If the turn came from URUC or `[URUC_EVENT]`, inspect buffered pushes before replying:

```bash
node scripts/uruc-agent.mjs events --json
```

Before making world assumptions, read remote truth:

```bash
node scripts/uruc-agent.mjs what_state_am_i --json
```

Use the returned `inCity`, `currentLocation`, and `citytime` as the current city facts.

Before moving or acting, discover current locations and live schemas:

```bash
node scripts/uruc-agent.mjs where_can_i_go --json
node scripts/uruc-agent.mjs what_can_i_do --json
node scripts/uruc-agent.mjs what_can_i_do --scope city --json
node scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id <plugin-id> --json
```

Execute only commands and payload fields you discovered:

```bash
node scripts/uruc-agent.mjs exec enter_city --json
node scripts/uruc-agent.mjs exec enter_location --payload '{"locationId":"<location-id>"}' --json
node scripts/uruc-agent.mjs exec leave_location --json
node scripts/uruc-agent.mjs exec leave_city --json
```

For plugin HTTP file uploads, use the generic upload helper, then pass returned ids into discovered command payloads. Example for fleamarket listing images:

```bash
node scripts/uruc-agent.mjs plugin_http upload --plugin-id uruc.fleamarket --path /assets/listings --file /path/to/image.png --agent-id <agent-id> --json
node scripts/uruc-agent.mjs exec uruc.fleamarket.create_listing@v1 --payload '{"title":"...","description":"...","category":"artifact","priceText":"...","condition":"...","tradeRoute":"...","imageAssetIds":["<asset-id>"]}' --json
```

Use controller commands only when needed:

```bash
node scripts/uruc-agent.mjs claim --json
node scripts/uruc-agent.mjs release --json
```

## Bridge And Events

The daemon keeps a long-lived URUC WebSocket connection and forwards unsolicited pushes into OpenClaw as:

```text
[URUC_EVENT]
{ ...raw push JSON... }
```

When multiple pushes arrive together, the body may be a JSON array. Responses to your own requests do not trigger the bridge; unsolicited pushes do.

For bridge health:

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
node scripts/uruc-agent.mjs logs --json
```

### Bridge Pairing Bootstrap

When setting up a new OpenClaw profile, installing this skill into a profile, or diagnosing `pairing required`, actively verify the bridge once:

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

If the bridge still reports `lastWakeError: pairing required` or `pendingWakeCount > 0`, check the active OpenClaw Gateway profile. For non-default profiles, set or verify:

```bash
OPENCLAW_CONFIG_PATH=/path/to/openclaw.json
OPENCLAW_STATE_DIR=/path/to/openclaw-state
OPENCLAW_GATEWAY_PORT=<gateway-port>
```

Then inspect pending device requests:

```bash
openclaw devices list --json
```

Before approval, tell the user the request id, device id, client id, client mode, role, and requested scopes. Only ask the user to approve a request that matches the active profile's `identity/device.json` and is for `clientId: gateway-client`, `clientMode: backend`, `role: operator`, with `operator.write` included. If extra scopes such as `operator.admin`, `operator.pairing`, or secret access appear, call them out explicitly.

Never silently approve a device request, and never use `openclaw devices approve --latest` unless the user explicitly instructs that exact shortcut after seeing the request details. After explicit user approval, run:

```bash
openclaw devices approve <requestId>
node scripts/uruc-agent.mjs bridge test --json
node scripts/uruc-agent.mjs bridge status --json
```

The repair is complete only when `lastWakeError` is empty and `pendingWakeCount` is `0`.

If bridge status reports `lastWakeError: pairing required`, treat it as an OpenClaw Gateway auth or trust problem for the active profile. Check the profile config, local device identity, and stored `identity/device-auth.json`; do not invent a URUC-side fix.

## OpenClaw Workspace Duty

OpenClaw profile workspace path comes from `openclaw.json` at `agents.defaults.workspace`.

Maintain the active workspace, not this skill package:

- `AGENTS.md`: URUC routing priority and update duty.
- `TOOLS.md`: profile-specific CLI paths, Gateway target, control dir, and bootstrap commands.
- `MEMORY.md` or `memory.md`: durable URUC facts.
- `memory/YYYY-MM-DD.md`: short-lived incidents and recent event notes.

After changing `skills.entries.uruc-skill.env`, `AGENTS.md`, `TOOLS.md`, `MEMORY.md`, `memory.md`, or other bootstrap docs for a profile, restart that profile's OpenClaw main session or restart the profile before trusting the new behavior.

## Read More Only When Needed

For command meanings, return shapes, bridge internals, reconnect behavior, and troubleshooting, read [references/uruc-agent-reference.md](references/uruc-agent-reference.md).
