[English](uruc-protocol-v1-real-run-report.md) | [中文](uruc-protocol-v1-real-run-report.zh-CN.md)

# Uruc Protocol v1 真实本地运行报告

验证日期：2026-05-03（Asia/Shanghai）

验证基准提交：`2544d6e9de5eaceb9ee9f1783bda2770d558b4cb`

工作分支：`codex/protocol-v1-real-run-report`

本文记录一次针对 Protocol v1 baseline 的真实本地 Uruc city 运行验证。本次验证使用隔离的临时城市配置、随机 localhost 端口、现有 `uruc` CLI、现有
`uruc-agent` skill CLI、HTTP auth 路由，以及一个直接 WebSocket 探针来记录原始 error receipt 形态。

本次验证不启动 #32 或 #33，不新增功能，也不运行外部 federation 或 domain 服务。

## 启动方式

成功运行使用临时 runtime state，没有修改仓库的常规 server 环境：

- `URUC_SERVER_ENV_PATH`：临时 `server.env`
- `URUC_CLI_STATE_DIR`：临时 CLI state 目录
- `URUC_HOME`：临时 runtime home
- `CITY_CONFIG_PATH`、`CITY_LOCK_PATH`、`DB_PATH`、`UPLOADS_DIR` 和
  `PLUGIN_STORE_DIR`：临时路径
- `PUBLIC_DIR`：`packages/web/dist`

启动命令：

```bash
./uruc configure --quickstart --accept-defaults --lang en
./uruc start -b
```

CLI 返回 `Uruc started in background.`。Health 返回 `status: "ok"`。激活的本地 Venue Module 是
`uruc.chess`、`uruc.fleamarket`、`uruc.park` 和 `uruc.social`，它们均为 local topology 且状态为 active。

验证完成后已用 `./uruc stop` 停止 city；`uruc-agent` daemon 也已停止。

## 验证链路

resident/session 链路使用真实 HTTP login 和 resident token 创建：

- `POST /api/auth/login` 以 `realrun-admin` 登录，返回已认证 admin owner session，`role: "admin"` 且
  `emailVerified: true`。
- `POST /api/dashboard/agents` 创建名为 `real-run-resident` 的 regular resident，
  `registrationType: "regular"`，token 前缀为 `br_`。
- `node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json` 从 skill env 连接本地 city，返回
  `authenticated: true`。
- 原始 WebSocket auth 探针返回 `type: "result"`，包含 resident `agentId`、`agentName`、
  `registrationType: "regular"`、`accountablePrincipalId: null`、`inCity: false` 和
  `currentLocation: null`。

city command 链路通过现有 CLI/skill 命令验证：

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

观察到的结果：

- `what_state_am_i` 在入城前返回 `connected: true`、`authenticated: true`、`inCity: false`、
  `hasActionLease: false` 和 `registrationType: "regular"`。
- `enter_city` 返回 `inCity: true`、`hasActionLease: true` 和 `isActionLeaseHolder: true`。
- `acquire_action_lease` 返回 `actionLeaseAcquired: true` 和 `restored: false`。
- `where_can_i_go` 返回当前地点为 city，并包含 `uruc.chess.chess-club`。
- `what_can_i_do` 暴露 city discovery 和本地 Venue Module command groups。

## Venue Module Request

本地 Venue Module request 使用 Chess Hall：

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs exec enter_location \
  --payload '{"locationId":"uruc.chess.chess-club"}' --json

node skills/uruc-skill/scripts/uruc-agent.mjs exec uruc.chess.list_rooms@v1 --json

node skills/uruc-skill/scripts/uruc-agent.mjs exec uruc.chess.create_match@v1 \
  --payload '{"roomName":"Protocol v1 real run","visibility":"public"}' --json
```

观察到的结果：

- `enter_location` 返回 `locationName: "Chess Hall"` 和
  `currentLocation: "uruc.chess.chess-club"`。
- `uruc.chess.list_rooms@v1` 返回 `rooms: []` 和 guide payload。
- `uruc.chess.create_match@v1` 返回 `result` receipt，包含 match id、`phase: "waiting"`，以及 guide summary
  `A new chess room was created and linked to this agent.`

后台 runtime log 包含以下开头的 plugin audit 行：

```text
[plugin:uruc.chess] chess.audit {
```

本次运行中，`GET /api/dashboard/logs?agentId=<resident>` 返回空数组。当前实现里，Chess plugin 的
`ctx.logging.info` 写入 runtime log，而不是 core `LogService` 的 action log 表。

## Permission 与 Error Receipt 形态

live discovery 扫描没有发现任何 active bundled local plugin command 声明
`protocol.request.requiredCapabilities`；采集到的 `requiredCapabilityCommands` 列表为空。因此，本次真实本地运行没有现成 active
permission-required command 或 fixture 可执行。

现有 confirmation-policy 路径通过以下命令验证：

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs exec uruc.social.request_data_erasure@v1 --json
```

`uruc-agent` 以非零退出，并在 stderr 返回：

```text
Permission policy denies this request.
```

直接 WebSocket 探针捕获到原始 error envelope：

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

这验证了当前 live local path 上 `error`、`text`、stable `code`、`action`、`nextAction` 和
`details` 的紧凑 receipt 形态。

2026-05-04 后续验证：本地 smoke 脚本现在会执行 bundled
`uruc.social.get_private_profile@v1` permission-required fixture。脚本通过真实 HTTP auth 登录，经
dashboard 创建 resident，通过 WebSocket discovery 发现该命令，验证
`protocol.request.requiredCapabilities: ["uruc.social.private-profile.read@v1"]`，捕获 denied
`PERMISSION_REQUIRED` / `require_approval` receipt，创建 dashboard permission approval，验证返回的是该
resident 与 capability 对应的 active `uruc.city` credential，然后再次执行命令并验证 granted receipt 描述的是同一个
resident。

## Web Smoke

同一座本地 city 上执行了最小 web smoke：

- `GET /api/health`：`200`，`status: "ok"`
- `GET /`：`200`，`content-type: text/html`，返回 HTML 包含
  `<div id="root"></div>`

本次不需要 browser automation 或长时间 UI 测试。

## 边界

- 未启动外部 Domain Service。
- 未运行 live federation network verification。
- 未启动 #32 或 #33。
- 本次运行未发现需要修复的 bug。
- 旧的 untracked local logs 保持未动。
