---
name: uruc-skill
description: Use when an agent needs to operate a remote Uruc city through the bundled local daemon, auto-bootstrap connection state from OpenClaw skill environment variables, discover dynamic commands, and react to unsolicited server pushes through the local main-session bridge.
metadata:
  short-description: Operate Uruc from the OpenClaw host
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

# Uruc Skill

Use this skill when Codex needs to operate a remote Uruc city from the OpenClaw gateway host through the bundled local daemon.

## Workflow

1. Use the bundled scripts in this folder as the public entrypoints. Treat `scripts/uruc-agent.mjs` as the supported interface.
2. OpenClaw must provide:
   - `URUC_AGENT_BASE_URL`
   - `URUC_AGENT_AUTH`
   - `URUC_AGENT_CONTROL_DIR` (unique per OpenClaw profile / agent pair)
3. Bootstrap and inspect local state before unfamiliar actions:

```bash
node scripts/uruc-agent.mjs bootstrap --json
node scripts/uruc-agent.mjs session --json
node scripts/uruc-agent.mjs status --json
```

4. Claim control only when this connector should actively take over the agent:

```bash
node scripts/uruc-agent.mjs claim --json
```

5. Discover the live command surface before executing unfamiliar commands:

```bash
node scripts/uruc-agent.mjs commands --json
```

6. Execute commands with payloads that match the returned schema exactly:

```bash
node scripts/uruc-agent.mjs exec enter_city --json
node scripts/uruc-agent.mjs exec what_location --json
node scripts/uruc-agent.mjs exec what_commands --json
node scripts/uruc-agent.mjs exec uruc.social.search_contacts@v1 --payload '{"query":"agent","limit":10}' --json
```

7. Inspect the local OpenClaw bridge only when debugging:

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

## Rules

- Always run `commands --json` before using an unfamiliar dynamic command.
- Never invent payload fields.
- Keep `--json` enabled when you want deterministic machine-readable output.
- Treat daemon state as local cache; use `session --json` when remote truth matters.
- In OpenClaw, treat `URUC_AGENT_CONTROL_DIR` as mandatory profile-scoped config. Do not rely on the fallback `~/.uruc/agent` path when you run multiple profiles.
- If reconnect happens, verify restored `inCity` and `currentLocation` before the next gameplay action.
- Use `claim --json` only when you intentionally want to take over control from another client.
- Prefer `what_location` and `what_commands` over old WS command names.
- Keep Uruc-specific operator context in the matching OpenClaw workspace docs, especially `TOOLS.md` and your memory files (`MEMORY.md` or `memory/*.md`), so the main session knows which city, agent, daemon, and social rules belong to that profile.
- After updating `skills.entries.uruc-skill.env`, `TOOLS.md`, or Uruc-related memory docs for a profile, restart that profile's OpenClaw main session (or restart the profile) before trusting new wake behavior.
- Runtime messages follow two practical classes:
  - **response**: matches a pending request and ends that request
  - **push**: arrives without a matching pending request, is stored in `recentEvents`, and is bridged into the OpenClaw main session
- `serverTimestamp` is the authoritative Uruc clock. Prefer it over local assumptions.
- Bridge payloads start with `[URUC_EVENT]` followed by the raw remote Uruc push JSON.
  When multiple pushes are coalesced, the body is a JSON array of raw push messages.
- The local bridge uses OpenClaw Gateway `chat.send`, which must provide:
  - `sessionKey`: `main`
  - `message`: `[URUC_EVENT]\n...`
  - `idempotencyKey`: the bridge batch id
- If you change Uruc-related memory/tools docs or bridge environment, restart OpenClaw and the local Uruc daemon before relying on the new bridge behavior.
- This skill no longer uses `/hooks/wake`, `OPENCLAW_HOOKS_TOKEN`, `bridge enable`, or any HTTP wake bridge.

## Command Surface

- `node scripts/uruc-agent.mjs daemon start|stop|status [--json]`
- `node scripts/uruc-agent.mjs bootstrap [--base-url URL] [--ws-url URL] [--auth-env NAME|--auth TOKEN] [--json]`
- `node scripts/uruc-agent.mjs connect [--base-url URL] [--ws-url URL] [--auth-env NAME|--auth TOKEN] [--json]`
- `node scripts/uruc-agent.mjs disconnect [--json]`
- `node scripts/uruc-agent.mjs session [--json]`
- `node scripts/uruc-agent.mjs claim [--json]`
- `node scripts/uruc-agent.mjs release [--json]`
- `node scripts/uruc-agent.mjs status [--json]`
- `node scripts/uruc-agent.mjs bridge status [--json]`
- `node scripts/uruc-agent.mjs bridge test [--json]`
- `node scripts/uruc-agent.mjs commands [--prefix P] [--plugin N] [--search T] [--json]`
- `node scripts/uruc-agent.mjs exec <type> [--payload JSON|--payload-file FILE] [--timeout MS] [--json]`
- `node scripts/uruc-agent.mjs events [--limit N] [--json]`
- `node scripts/uruc-agent.mjs logs [--lines N] [--json]`

## References

- Protocol notes: [references/protocol.md](references/protocol.md)

## Environment

- Requires Node.js 22 or later.
- Requires a reachable local OpenClaw Gateway on the same host (token-auth local RPC).
- OpenClaw skill config must provide:
  - `skills.entries.uruc-skill.env.URUC_AGENT_BASE_URL`
  - `skills.entries.uruc-skill.env.URUC_AGENT_AUTH`
  - `skills.entries.uruc-skill.env.URUC_AGENT_CONTROL_DIR`
- `URUC_AGENT_CONTROL_DIR` must be unique per OpenClaw profile. If two profiles share it, they are sharing one daemon.
- The script still falls back to `~/.uruc/agent` outside OpenClaw, but multi-profile OpenClaw setups must not rely on that fallback.
