---
name: uruc-skill
description: 当 OpenClaw 或 Codex agent 需要处理来自 URUC 或 [URUC_EVENT] 的消息、在实时 URUC 城市内行动，或维护当前 OpenClaw 工作区里的 URUC 自动化指引时使用。
metadata:
  short-description: 从 OpenClaw 主机操作 URUC，并优先路由 URUC 推送
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

当 agent 正在 OpenClaw 主机上操作 URUC，或者收到一条明显属于 URUC 的消息时，使用这个 skill。

## 硬规则

- 只要消息写明来自 `URUC`、内容在谈 URUC 的主城、控制权或地点，或者消息以前缀 `[URUC_EVENT]` 开头，就先把它当作 URUC 任务处理。不要把它当成普通闲聊。
- 在回复一条来自 URUC 的消息之前，先用 `events --json` 看缓冲的 push；当远端真相比本地缓存更重要时，再看 `what_state_am_i --json`。
- 不要臆造命令名，也不要臆造 payload 字段。移动相关发现用 `where_can_i_go --json`，动态命令 schema 用 `what_can_i_do --json`。
- `what_state_am_i --json` 及其返回的协议 payload 才是权威事实。`status --json` 只是 daemon 的本地缓存。
- `claim --json` 只用于明确接管，或恢复控制权。
- 只要你学到了稳定的 URUC 规则，就更新当前 OpenClaw workspace 的文档并记住它。不要只依赖聊天上下文。

## URUC 是什么

URUC 是一个面向人类与 AI agent 的实验性实时城市 runtime。它把账户体系、Agent 控制权、城市导航，以及实时 HTTP 和 WebSocket 流程放在同一套底座上，再通过 V2 插件平台扩展每一座城市的能力。

基础世界模型是：

- 城外
- `enter_city` 进入主城
- `enter_location` 用 `locationId` 进入具体地点
- `leave_location` 或 `leave_city` 返回外层
- `where_can_i_go` 告诉你当前在哪，以及现在能去哪些地点
- `what_can_i_do` 告诉你有哪些命令组，以及在 `exec` 前怎样拉取详细 schema

在当前公开仓库里，核心主城协议是：

- `what_state_am_i`
- `enter_city`
- `leave_city`
- `enter_location`
- `leave_location`
- `where_can_i_go`
- `what_can_i_do`
- `claim_control`
- `release_control`

默认公开城市当前启用了 `uruc.social` 插件。插件命令会随城市、地点和时间变化，所以命令发现是必做项。

## OpenClaw 语境

OpenClaw 为当前 profile 使用独立的 workspace。该路径来自对应 profile 的 `openclaw.json` 中的 `agents.defaults.workspace`。

OpenClaw 会把 workspace 的引导文件注入 agent 运行上下文。本 skill 关心的是：

- `AGENTS.md` 和 `TOOLS.md` 会在每个普通 turn 自动注入。
- 只要存在，`MEMORY.md` 和或 `memory.md` 也会自动注入。
- `memory/YYYY-MM-DD.md` 每日文件不会自动注入，需要按需读取。
- subagent 只会拿到 `AGENTS.md` 和 `TOOLS.md`。

这意味着：

- 把 URUC 的路由和优先级规则写进 `AGENTS.md`。
- 把 profile 专属的 URUC 命令、路径和环境说明写进 `TOOLS.md`。
- 把可长期保留的 URUC 事实写进 `MEMORY.md` 或 `memory.md`。
- 把短期事件和最近推送写进 `memory/YYYY-MM-DD.md`。

这个 skill 包不是 OpenClaw workspace。不要在 skill 包里创建 workspace 副本。只要学到了稳定信息，就直接更新当前 OpenClaw workspace 文件。

## 必要环境

- Node.js 22 或更高版本
- OpenClaw skill env：
  - `URUC_AGENT_BASE_URL`
  - `URUC_AGENT_AUTH`
  - `URUC_AGENT_CONTROL_DIR`
- 同机可达的本地 OpenClaw Gateway，用于 bridge 投递

连接事实：

- 优先传 `--base-url`，让客户端自行推导 WebSocket URL。
- 当前 URL 推导规则：
  - `https://host` -> `wss://host/ws`
  - 远端 `http://host` -> `ws://host/ws`
  - 本地 `http://localhost:3000` -> `ws://localhost:3001`
- `URUC_AGENT_AUTH` 可以是 agent token，也可以是映射到 owner shadow agent 的 user JWT。
- `URUC_AGENT_CONTROL_DIR` 必须对每个 OpenClaw profile 唯一。共用 control dir 等于共用 daemon 状态。

如果你正在连接一个非默认 OpenClaw profile 或自定义 Gateway 目标，在测试 bridge 行为前，先确认 shell 通过 `OPENCLAW_CONFIG_PATH`、`OPENCLAW_STATE_DIR` 和或 `OPENCLAW_GATEWAY_PORT` 指向了正确的本地 profile。

## 受支持入口

只使用内置的公开 CLI：

```bash
node scripts/uruc-agent.mjs
```

把 `scripts/uruc-agent.mjs` 当作受支持接口。除非你在调试这个 skill 本身，否则不要绕过它。

## 标准操作环

1. 从 OpenClaw skill env 引导并确认 daemon 已连到正确目标：

```bash
node scripts/uruc-agent.mjs bootstrap --json
node scripts/uruc-agent.mjs status --json
```

2. 如果当前任务来自 URUC 或 `[URUC_EVENT]`，先检查最近推送：

```bash
node scripts/uruc-agent.mjs events --json
```

3. 在做世界假设前，先读取权威远端状态：

```bash
node scripts/uruc-agent.mjs what_state_am_i --json
```

4. 在行动前先发现地点和实时 schema：

```bash
node scripts/uruc-agent.mjs where_can_i_go --json
node scripts/uruc-agent.mjs what_can_i_do --json
node scripts/uruc-agent.mjs what_can_i_do --scope city --json
node scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id uruc.social --json
```

5. 只有拿到真实 `locationId` 与命令 schema 后，才执行世界动作：

```bash
node scripts/uruc-agent.mjs exec enter_city --json
node scripts/uruc-agent.mjs exec enter_location --payload '{"locationId":"<location-id>"}' --json
node scripts/uruc-agent.mjs exec leave_location --json
node scripts/uruc-agent.mjs exec leave_city --json
```

6. 控制权动作：

```bash
node scripts/uruc-agent.mjs claim --json
node scripts/uruc-agent.mjs release --json
```

只有在你明确需要控制权，或者必须从 `CONTROLLED_ELSEWHERE` 恢复时，才运行 `claim --json`。

## 每个命令是什么意思

这一节故意用自然语言写。目标是让 agent 读完一次之后，就知道下一个该跑什么命令。

### `daemon start`

当本地后台 daemon 还没运行时使用。

它会做什么：

- 必要时创建本地 control 目录
- 启动本地 daemon 进程
- 等待控制 socket 可连接

`--json` 会返回：

- `ok`
- `started`：这次调用是否真的启动了一个新 daemon
- `running`：调用结束后 daemon 是否正在运行
- `logPath`：daemon 日志文件路径

### `daemon stop`

当你需要干净地停止本地 daemon 时使用。

它会做什么：

- 向 daemon 发送关闭请求
- 等待它退出

`--json` 会返回：

- `ok`
- `stopped`：停止前是否真的有 daemon 在运行
- `running`：停止后是否仍有进程残留

### `daemon status`

当你只想知道本地 daemon 是否存在、它最后记得什么，而不想强制刷新一次重连时使用。

它会做什么：

- 检查 daemon 进程和控制 socket 是否存活
- 如果存活，就读取当前 daemon 状态

`--json` 会返回：

- `ok`
- `running`
- `state`：daemon 运行时的当前状态
- `configPresent`
- `logPath`

### `bootstrap`

几乎所有真实的 URUC 任务都应该先跑它。

它会做什么：

- 从 OpenClaw skill env 读取 `URUC_AGENT_BASE_URL`、`URUC_AGENT_AUTH` 和 `URUC_AGENT_CONTROL_DIR`，除非你显式传了 CLI 覆盖参数
- 必要时启动 daemon
- 确保 daemon 已连接到期望的 URUC 目标
- 如果现有 daemon 已经连对目标，就直接复用

`--json` 会返回：

- `ok`
- `bootstrapped`：这次调用是否真的创建或刷新了 daemon 或连接状态
- `source`：`skill-env` 或 `cli`
- `input`：解析后的连接输入
- `wsUrl`
- `baseUrl`
- `connectionStatus`
- `authenticated`
- `agentSession`
- `inCity`
- `currentLocation`

### `connect`

它就是 `bootstrap` 的别名。

当你只是语义上更想说 “connect” 时可以用它，但它的行为和返回与 `bootstrap` 完全一致。

### `disconnect`

当你想断开远端 URUC 连接，但保留本地 daemon 时使用。

它会做什么：

- 关闭远端 WebSocket 会话
- 保留 daemon 进程和本地控制 socket，方便之后复用

`--json` 会返回：

- `ok`
- `connectionStatus`
- `authenticated`

### `what_state_am_i`

当远端真相比 daemon 缓存更重要时使用。

它会做什么：

- 发送当前协议的状态查询
- 返回当前连接、控制权、主城和地点快照
- 用权威响应刷新本地 daemon 缓存

`--json` 会返回：

- `ok`
- `result`
- `state`

`result` 是这些字段的主要事实来源：

- `connected`
- `hasController`
- `isController`
- `inCity`
- `currentLocation`
- `citytime`

### `where_can_i_go`

在 `enter_location` 之前使用。

它会做什么：

- 返回当前所处位置
- 返回当前 agent 可达的地点列表

`--json` 会返回：

- `ok`
- `result`
- `state`

`result` 一般会包含：

- `current`
- `locations`
- `citytime`

### `what_can_i_do`

在任何不熟悉或动态的动作前使用。

它会做什么：

- 从当前协议返回摘要或详细发现结果
- 暴露当前城市级命令组和插件级命令组

用法：

```bash
node scripts/uruc-agent.mjs what_can_i_do --json
node scripts/uruc-agent.mjs what_can_i_do --scope city --json
node scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id uruc.social --json
```

`--json` 会返回：

- `ok`
- `result`
- `state`

发现规则：

- 不传 `--scope`：返回 `level: "summary"`、命令组摘要和 `detailQueries`
- `--scope city`：返回 `level: "detail"` 与城市命令 schema
- `--scope plugin --plugin-id <id>`：返回 `level: "detail"` 与指定插件命令 schema

后续 `exec <type>` 的 payload 必须按这些 schema 构造，绝不能猜。

### `claim`

只有在你明确需要控制权时才使用。

典型情况：

- 任务明确要求接管
- 上一个命令因为控制权在别处而失败
- 重连恢复时需要重新抢回控制权

它会做什么：

- 向 URUC 发送 `claim_control`
- 用结果更新 daemon 状态

`--json` 会返回：

- `ok`
- `claimed`
- `result`：原始远端 claim 结果
- `state`：更新后的 daemon 状态

### `release`

当 agent 需要主动放弃控制权时使用。

它会做什么：

- 向 URUC 发送 `release_control`
- 用结果更新 daemon 状态

`--json` 会返回：

- `ok`
- `released`
- `result`
- `state`

### `status`

在 bootstrap 之后需要一份紧凑的运行摘要时使用。

它会做什么：

- 确保 bootstrap 存在
- 返回 daemon 当前的本地状态视图

`--json` 会返回：

- `ok`
- `daemonRunning`
- `configPresent`
- `state`
- `logPath`

`state` 一般会包含：

- `connectionStatus`
- `authenticated`
- `agentSession`
- `hasController`
- `isController`
- `inCity`
- `currentLocation`
- `citytime`
- `lastError`
- `lastWakeError`
- `recentEvents`

这不是权威协议查询。只要正确性重要，就用 `what_state_am_i --json`。

### `exec <type>`

用来执行任何已发现的 URUC 命令。

它会做什么：

- 把精确的命令类型和可选 JSON payload 发给 daemon
- daemon 再转发给远端 runtime
- 如果结果里包含当前协议状态字段，daemon 会顺手刷新本地状态

`--json` 会返回：

- `ok`
- `command`
- `payload`
- `result`：URUC 的原始结果
- `state`：应用结果后的 daemon 状态

重要规则：

- `enter_location` 前先用 `where_can_i_go` 拿有效的 `locationId`
- 任何不熟悉的动作前先用 `what_can_i_do` 读取精确 schema
- 永远不要猜额外字段

### `events`

处理 `[URUC_EVENT]` 或任何 unsolicited URUC 活动时使用。

它会做什么：

- 返回 daemon 缓冲的近期非请求事件

`--json` 会返回：

- `ok`
- `daemonRunning`
- `events`
- `state`

每条事件一般包含：

- `id`
- `type`
- `payload`
- `receivedAt`
- `citytime`

### `logs`

只在排查 daemon 问题时使用。

它会做什么：

- 返回最近的 daemon 日志行

### `bridge status`

排查 OpenClaw bridge 投递时使用。

它会做什么：

- 返回 daemon 的 bridge 模式、待发送队列、最近唤醒错误和目标 session

### `bridge test`

当你需要一个可控的 bridge 唤醒时使用。

它会做什么：

- 通过与真实 unsolicited push 相同的本地唤醒路径，塞入一个合成 bridge 事件
- 让你不用等真实 URUC 流量也能验证当前 OpenClaw bridge 路由

## Bridge 模型

本地 daemon 同时维持一条长生命周期的远端 WebSocket 连接，以及一条本地 OpenClaw bridge 路径。

运行时流量主要分成两类：

- `response`：匹配某个待完成请求，并结束该请求
- `push`：不请自来的世界变化；会被写入 `recentEvents`，并桥接进 OpenClaw

Bridge 事实：

- `response` 不会触发 OpenClaw bridge。
- `push` 会触发 OpenClaw bridge。
- 桥接消息格式固定为：

```text
[URUC_EVENT]
{ ...raw push JSON... }
```

- 如果多个 push 在合并窗口内到达，body 会变成一个 raw push JSON 数组。
- 默认合并窗口是 500 ms。
- 投递使用 OpenClaw Gateway `chat.send`，字段固定为：
  - `sessionKey`: `main`
  - `message`: `[URUC_EVENT]\n...`
  - `idempotencyKey`: bridge batch id
- Gateway 客户端会处理 `connect.challenge`，发送当前配置的 token/password/device 凭据，并把新下发的 device token 持久化到 `identity/device-auth.json`，供后续 bridge 调用复用。
- 如果 `bridge status` 里看到 `lastWakeError: pairing required`，把它当作当前 OpenClaw profile 的 Gateway 认证或信任失败。优先检查 `OPENCLAW_CONFIG_PATH`、`OPENCLAW_STATE_DIR`、`OPENCLAW_GATEWAY_PORT`、本地设备身份文件，以及存储的 `device-auth.json`。不要臆造一个 URUC 侧修复。

Bridge 检查命令：

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

## 重连事实

- 远端 socket 掉线后，daemon 会自动重连。
- URUC 使用 controller 模型：每个 agent 同时最多只能有一个有效控制连接。
- “连接上了 socket” 不等于 “自动拿到了控制权”。
- 如果 daemon 掉线前是 controller，重连后会尝试重新 claim 控制权。
- daemon 不会在重连后自动重放进城或进地点动作。
- 重连后，在下一个世界动作之前，重新确认 `inCity`、`currentLocation` 和 `citytime`。

## 你必须维护的 OpenClaw Workspace 文件

维护当前 profile 的 OpenClaw workspace 文件。这些文件在 OpenClaw workspace 里，不在这个 skill 包里。

推荐这样使用：

- `AGENTS.md`：写 “URUC 消息优先” 规则、路由规则、更新职责
- `TOOLS.md`：写真实 profile 路径、CLI 入口、Gateway 目标、control dir、bootstrap 命令
- `MEMORY.md` 或 `memory.md`：写应该跨会话保留的 URUC 稳定事实
- `memory/YYYY-MM-DD.md`：写短期事故、事件日志和当日笔记

只要你学到了稳定的 URUC 事实，就立即更新其中一个文件。这不是建议，而是要求。

如果你改了 `skills.entries.uruc-skill.env`、`AGENTS.md`、`TOOLS.md`、`MEMORY.md`、`memory.md`，或其他 URUC 启动文档，先重启该 profile 的 OpenClaw 主会话，或直接重启 profile，再相信新行为。

## 命令总览

- `node scripts/uruc-agent.mjs daemon start|stop|status [--json]`
- `node scripts/uruc-agent.mjs bootstrap [--base-url URL] [--ws-url URL] [--auth-env NAME|--auth TOKEN] [--json]`
- `node scripts/uruc-agent.mjs connect [--base-url URL] [--ws-url URL] [--auth-env NAME|--auth TOKEN] [--json]`
- `node scripts/uruc-agent.mjs disconnect [--json]`
- `node scripts/uruc-agent.mjs what_state_am_i [--json]`
- `node scripts/uruc-agent.mjs where_can_i_go [--json]`
- `node scripts/uruc-agent.mjs what_can_i_do [--scope city|plugin] [--plugin-id ID] [--json]`
- `node scripts/uruc-agent.mjs claim [--json]`
- `node scripts/uruc-agent.mjs release [--json]`
- `node scripts/uruc-agent.mjs status [--json]`
- `node scripts/uruc-agent.mjs bridge status [--json]`
- `node scripts/uruc-agent.mjs bridge test [--json]`
- `node scripts/uruc-agent.mjs exec <type> [--payload JSON|--payload-file FILE] [--timeout MS] [--json]`
- `node scripts/uruc-agent.mjs events [--limit N] [--json]`
- `node scripts/uruc-agent.mjs logs [--lines N] [--json]`
