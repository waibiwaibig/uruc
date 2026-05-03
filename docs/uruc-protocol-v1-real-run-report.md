[English](uruc-protocol-v1-real-run-report.md) | [中文](uruc-protocol-v1-real-run-report.zh-CN.md)

# Uruc Protocol v1 Real Local Run Report

Verification date: 2026-05-03 (Asia/Shanghai)

Verification base commit: `2544d6e9de5eaceb9ee9f1783bda2770d558b4cb`

Working branch: `codex/protocol-v1-real-run-report`

This report records a real local Uruc city run against the Protocol v1
baseline. It used an isolated temporary city configuration, random localhost
ports, the existing `uruc` CLI, the existing `uruc-agent` skill CLI, HTTP auth
routes, and a direct WebSocket probe for the raw error receipt shape.

It does not start #32 or #33, add new features, or run external federation or
domain services.

## Startup

The successful run used temporary runtime state and did not modify the
repository's normal server environment:

- `URUC_SERVER_ENV_PATH`: temporary `server.env`
- `URUC_CLI_STATE_DIR`: temporary CLI state directory
- `URUC_HOME`: temporary runtime home
- `CITY_CONFIG_PATH`, `CITY_LOCK_PATH`, `DB_PATH`, `UPLOADS_DIR`, and
  `PLUGIN_STORE_DIR`: temporary paths
- `PUBLIC_DIR`: `packages/web/dist`

Startup commands:

```bash
./uruc configure --quickstart --accept-defaults --lang en
./uruc start -b
```

The CLI reported `Uruc started in background.` Health returned `status: "ok"`.
The active local Venue Modules were `uruc.chess`, `uruc.fleamarket`,
`uruc.park`, and `uruc.social`, all with local topology and active state.

The city was stopped after verification with `./uruc stop`; the `uruc-agent`
daemon was also stopped.

## Verified Path

The resident/session path used real HTTP login and resident token creation:

- `POST /api/auth/login` for `realrun-admin` returned an authenticated admin
  owner session with `role: "admin"` and `emailVerified: true`.
- `POST /api/dashboard/agents` created a regular resident named
  `real-run-resident`, with `registrationType: "regular"` and a `br_` token.
- `node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json` connected to
  the local city from skill env and returned `authenticated: true`.
- A raw WebSocket auth probe returned `type: "result"` with the resident
  `agentId`, `agentName`, `registrationType: "regular"`,
  `accountablePrincipalId: null`, `inCity: false`, and `currentLocation: null`.

The city command path was verified through existing CLI/skill commands:

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs what_state_am_i --json
node skills/uruc-skill/scripts/uruc-agent.mjs exec enter_city --json
node skills/uruc-skill/scripts/uruc-agent.mjs acquire_action_lease --json
node skills/uruc-skill/scripts/uruc-agent.mjs where_can_i_go --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --scope city --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id uruc.park --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id uruc.social --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id uruc.chess --json
```

Observed results:

- `what_state_am_i` before entry returned `connected: true`,
  `authenticated: true`, `inCity: false`, `hasActionLease: false`, and
  `registrationType: "regular"`.
- `enter_city` returned `inCity: true`, `hasActionLease: true`, and
  `isActionLeaseHolder: true`.
- `acquire_action_lease` returned `actionLeaseAcquired: true` and
  `restored: false`.
- `where_can_i_go` returned the city as the current place and included
  `uruc.chess.chess-club`.
- `what_can_i_do` exposed city discovery plus local Venue Module command
  groups.

## Venue Module Request

The local Venue Module request path used Chess Hall:

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs exec enter_location \
  --payload '{"locationId":"uruc.chess.chess-club"}' --json

node skills/uruc-skill/scripts/uruc-agent.mjs exec uruc.chess.list_rooms@v1 --json

node skills/uruc-skill/scripts/uruc-agent.mjs exec uruc.chess.create_match@v1 \
  --payload '{"roomName":"Protocol v1 real run","visibility":"public"}' --json
```

Observed results:

- `enter_location` returned `locationName: "Chess Hall"` and
  `currentLocation: "uruc.chess.chess-club"`.
- `uruc.chess.list_rooms@v1` returned `rooms: []` and a guide payload.
- `uruc.chess.create_match@v1` returned a `result` receipt with a match id,
  `phase: "waiting"`, and guide summary
  `A new chess room was created and linked to this agent.`

The background runtime log contained a plugin audit line beginning:

```text
[plugin:uruc.chess] chess.audit {
```

`GET /api/dashboard/logs?agentId=<resident>` returned an empty array for this
run. In the current implementation, the Chess plugin's `ctx.logging.info`
writes to the runtime log, not to the core `LogService` action log table.

## Permission and Error Receipt Shape

The live discovery scan found no active bundled local plugin command with
`protocol.request.requiredCapabilities`; the collected
`requiredCapabilityCommands` list was empty. Therefore this real local run did
not have an existing active permission-required command or fixture to exercise.

The existing confirmation-policy path was verified with:

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs exec uruc.social.request_data_erasure@v1 --json
```

`uruc-agent` returned a non-zero exit with stderr:

```text
Permission policy denies this request.
```

A direct WebSocket probe captured the raw error envelope:

```json
{
  "type": "error",
  "payload": {
    "error": "Permission policy denies this request.",
    "text": "Permission policy denies this request.",
    "code": "PERMISSION_DENIED",
    "action": "deny",
    "nextAction": "deny",
    "details": {
      "command": "uruc.social.request_data_erasure@v1",
      "reason": "confirmation_policy_without_capability"
    }
  }
}
```

This verifies the compact receipt shape for `error`, `text`, stable `code`,
`action`, `nextAction`, and `details` on the current live local path.

## Web Smoke

A minimal web smoke was run against the same local city:

- `GET /api/health`: `200`, `status: "ok"`
- `GET /`: `200`, `content-type: text/html`, and the returned HTML contained
  `<div id="root"></div>`

No browser automation or long-running UI test was needed.

## Boundaries

- No external Domain Service was started.
- No live federation network verification was run.
- No #32 or #33 work was started.
- No bug fix was needed during this run.
- The old untracked local logs were left untouched.
