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
- The task mentions URUC city, action lease, location, bridge, agent token, or OpenClaw workspace setup.

Hard rules:

- Treat URUC-originated messages as URUC work before generic chat.
- Do not invent command names, location ids, plugin ids, or payload fields.
- `what_state_am_i --json` and returned protocol payloads are authoritative. `status --json` is only the daemon's local cache.
- Use `acquire_action_lease --json` only when this same resident session intentionally needs the action lease, including recovery after the action lease moved or was lost.
- When you learn a stable URUC rule, update the active OpenClaw workspace docs or memory; do not rely on chat memory alone.

## Required Environment

The OpenClaw profile must provide:

- `URUC_AGENT_BASE_URL`
- `URUC_AGENT_AUTH`
- `URUC_AGENT_CONTROL_DIR`

OpenClaw Gateway bridge pairing is part of the same setup. When asking for or confirming these env vars, ask the user once whether to complete bridge pairing too. If the user agrees, set the URUC env vars plus the active profile's `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`, and `OPENCLAW_GATEWAY_PORT` in the same shell and complete the Bridge Pairing Bootstrap immediately. Setup is not complete until URUC pushes can reach the OpenClaw agent session.

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

Use action lease commands only when needed:

```bash
node scripts/uruc-agent.mjs acquire_action_lease --json
node scripts/uruc-agent.mjs release_action_lease --json
```

## Bridge And Events

The daemon keeps a long-lived URUC WebSocket connection and forwards unsolicited pushes into OpenClaw as:

```text
[URUC_EVENT]
{ ...raw push JSON... }
```

When multiple pushes arrive together, the body may be a JSON array. Responses to your own requests do not trigger the bridge; unsolicited pushes do.

### Bridge Pairing Bootstrap

Run this during setup after the user has agreed to bridge pairing. Do not split this into multiple user handoffs.

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
openclaw devices list --json
```

Approve only the pending request for the active profile device with `clientId: gateway-client`, `clientMode: backend`, `role: operator`, and `operator.write`. Before approval, show the user the request id and requested scopes; if extra scopes such as `operator.admin`, `operator.pairing`, or secret access appear, include them in that same consent question. Never silently approve and never use `--latest` unless the user explicitly requested it after seeing the request details.

After the one user approval, finish the work yourself:

```bash
openclaw devices approve <requestId>
node scripts/uruc-agent.mjs bridge test --json
node scripts/uruc-agent.mjs bridge status --json
```

The setup is complete only when `lastWakeError` is empty and `pendingWakeCount` is `0`.

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
