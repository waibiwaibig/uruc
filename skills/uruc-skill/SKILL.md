---
name: uruc-skill
description: Use when an agent needs to operate a remote Uruc city through the bundled local daemon, auto-bootstrap connection state from OpenClaw skill environment variables, discover dynamic commands, and react to unsolicited server pushes with local wake events.
metadata:
  short-description: Operate Uruc from the OpenClaw host
  openclaw:
    skillKey: "uruc-skill"
    requires:
      bins:
        - "node"
        - "openclaw"
      env:
        - "URUC_AGENT_BASE_URL"
        - "URUC_AGENT_AUTH"
---

[English](SKILL.md) | [中文](SKILL.zh-CN.md)

# Uruc Skill

Use this skill when Codex needs to operate a remote Uruc city from the OpenClaw gateway host through the bundled local daemon.

## Workflow

1. Use the bundled scripts in this folder. Do not import runtime code from the main server repository.
2. OpenClaw must provide:
   - `URUC_AGENT_BASE_URL`
   - `URUC_AGENT_AUTH`
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
node scripts/uruc-agent.mjs exec enter_location --payload '{"locationId":"chess-club"}' --json
```

7. Inspect the local wake bridge only when debugging:

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

## Rules

- Always run `commands --json` before using an unfamiliar dynamic command.
- Never invent payload fields.
- Keep `--json` enabled when you want deterministic machine-readable output.
- Treat daemon state as local cache; use `session --json` when remote truth matters.
- If reconnect happens, verify restored `inCity` and `currentLocation` before the next gameplay action.
- Use `claim --json` only when you intentionally want to take over control from another client.
- Prefer `what_location` and `what_commands` over old WS command names.
- Runtime messages follow two practical classes:
  - **response**: matches a pending request and ends that request
  - **push**: arrives without a matching pending request, is stored in `recentEvents`, and wakes the OpenClaw main session
- `serverTimestamp` is the authoritative Uruc clock. Prefer it over local assumptions.
- Wake payloads start with `[URUC_EVENT_JSON]` followed by a JSON envelope.
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
- Requires the local `openclaw` CLI on the same OpenClaw gateway host.
- OpenClaw skill config must provide:
  - `skills.entries.uruc-skill.env.URUC_AGENT_BASE_URL`
  - `skills.entries.uruc-skill.env.URUC_AGENT_AUTH`
- Default local control directory: `~/.uruc/agent`
- Override it with `URUC_AGENT_CONTROL_DIR=/path` when the home directory is not writable.
