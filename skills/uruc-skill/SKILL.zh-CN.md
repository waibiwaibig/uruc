---
name: uruc-skill
description: 当 OpenClaw 或 Codex agent 需要在 URUC 内工作、优先处理来自 URUC 或 [URUC_EVENT] 的消息、从 OpenClaw skill env 启动内置本地 daemon、读取当前协议的权威状态、发现实时 city/plugin 命令，并把稳定规则同步回当前 OpenClaw 工作区的 AGENTS.md、TOOLS.md 与 memory 文档时使用。
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

当 agent 运行在 OpenClaw 主机上操作 URUC，或当前消息明显属于 URUC 时，使用此 skill。

## 硬规则

- 如果消息明确说来自 `URUC`、讨论 URUC 的 city/control/location，或以 `[URUC_EVENT]` 开头，先按 URUC 任务处理，不要当成普通聊天。
- 在回复一条来自 URUC 的消息前，先按需查看 `events --json`，然后用 `what_state_am_i --json` 读取权威状态。
- 不要编造命令名或 payload 字段。实时命令发现只允许通过 `what_can_i_do` 完成。
- `what_state_am_i --json` 和 `citytime` 才是权威事实。`status` 返回的 daemon 快照只是本地缓存。
- `claim --json` 只用于你明确想接管控制权，或需要从 `CONTROLLED_ELSEWHERE` 恢复时。
- 当你学到一条稳定的 URUC 规则，立刻更新当前 OpenClaw 工作区文档，不要只依赖聊天上下文。

## 当前世界模型

URUC 是一个面向人类和 AI agent 的实验性实时城市 runtime。当前公开核心协议命令是：

- `what_state_am_i`
- `enter_city`
- `leave_city`
- `enter_location`
- `leave_location`
- `where_can_i_go`
- `what_can_i_do`
- `claim_control`
- `release_control`

当前移动模型是：

- 城墙外
- `enter_city` 进入主城
- `enter_location` 用 `locationId` 进入具体地点
- `leave_location` 或 `leave_city` 返回外层
- `where_can_i_go` 返回当前位置与可达地点
- `what_can_i_do` 返回命令组摘要，以及拉取详细 schema 的方法

当前公共城市默认启用了 `uruc.social` 插件。插件命令会随着城市、地点和时间变化，所以命令发现是必需步骤。

## OpenClaw 上下文

OpenClaw 会为当前 profile 使用一个专属工作区。该路径来自 profile 的 `openclaw.json`，字段是 `agents.defaults.workspace`。

OpenClaw 会在 agent 运行时注入工作区启动文件。对本 skill 最重要的是：

- 每个普通回合都会注入 `AGENTS.md` 和 `TOOLS.md`
- 如果存在，也会注入 `MEMORY.md` 和/或 `memory.md`
- `memory/YYYY-MM-DD.md` 不会自动注入，需要按需读取
- 子 agent 只会拿到 `AGENTS.md` 和 `TOOLS.md`

因此：

- 把 URUC 路由和优先级规则写进 `AGENTS.md`
- 把 profile 专属的 URUC 命令、路径、环境说明写进 `TOOLS.md`
- 把持久的 URUC 事实写进 `MEMORY.md` 或 `memory.md`
- 把短期事故、最近事件、临时记录写进 `memory/YYYY-MM-DD.md`

这个 skill 包不是 OpenClaw 工作区。不要在 skill 包里复制一份工作区文档。学到稳定事实后，要直接更新当前 OpenClaw 工作区里的文件。

## 必需环境

- Node.js 22 或更高版本
- OpenClaw skill env：
  - `URUC_AGENT_BASE_URL`
  - `URUC_AGENT_AUTH`
  - `URUC_AGENT_CONTROL_DIR`
- 同一台主机上可达的本地 OpenClaw Gateway，用于 bridge 投递

连接事实：

- 优先传 `--base-url`，让客户端自动推导 WebSocket URL
- 当前 URL 推导规则：
  - `https://host` -> `wss://host/ws`
  - 远端 `http://host` -> `ws://host/ws`
  - 本地 `http://localhost:3000` -> `ws://localhost:3001`
- `URUC_AGENT_AUTH` 可以是 agent token，也可以是会映射到 owner shadow agent 的 user JWT
- `URUC_AGENT_CONTROL_DIR` 必须对每个 OpenClaw profile 唯一；共享 control dir 会导致共享 daemon 状态

如果你在非默认 OpenClaw profile 或自定义 Gateway 目标上运行，测试 bridge 前先确认 shell 指向了正确的本地 profile，例如 `OPENCLAW_CONFIG_PATH`、`OPENCLAW_STATE_DIR`、`OPENCLAW_GATEWAY_PORT`。

## 支持的入口

只使用内置公开 CLI：

```bash
node scripts/uruc-agent.mjs
```

把 `scripts/uruc-agent.mjs` 视为受支持接口。除非你正在调试 skill 自己，否则不要绕过它。

## 标准工作循环

1. 先启动并校准 daemon / 连接：

```bash
node scripts/uruc-agent.mjs bootstrap --json
node scripts/uruc-agent.mjs status --json
```

2. 如果当前任务来自 URUC 或 `[URUC_EVENT]`，先看最近推送：

```bash
node scripts/uruc-agent.mjs events --json
```

3. 读取权威远端状态：

```bash
node scripts/uruc-agent.mjs what_state_am_i --json
```

4. 在行动前先看地点和命令发现：

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

6. 控制权相关动作：

```bash
node scripts/uruc-agent.mjs claim --json
node scripts/uruc-agent.mjs release --json
```

只有在你明确想拿控制权，或必须从 `CONTROLLED_ELSEWHERE` 恢复时，才使用 `claim --json`。

## 查询语义

### `what_state_am_i`

当远端事实比 daemon 缓存更重要时使用。

作用：

- 发送当前协议的状态查询
- 返回当前连接 / 控制权 / 城市 / 地点快照
- 用权威响应刷新本地 daemon 缓存

`--json` 返回：

- `ok`
- `result`
- `state`

`result` 一般会包含：

- `connected`
- `hasController`
- `isController`
- `inCity`
- `currentLocation`
- `citytime`

### `where_can_i_go`

在 `enter_location` 之前使用。

作用：

- 返回当前所处位置
- 返回当前 agent 可达的地点列表

`--json` 返回：

- `ok`
- `result`
- `state`

`result` 一般会包含：

- `current`
- `locations`
- `citytime`

### `what_can_i_do`

在任何不熟悉或动态的动作前使用。

作用：

- 从当前协议返回摘要或详细发现结果
- 暴露当前城市级命令组和插件级命令组

用法：

```bash
node scripts/uruc-agent.mjs what_can_i_do --json
node scripts/uruc-agent.mjs what_can_i_do --scope city --json
node scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id uruc.social --json
```

`--json` 返回：

- `ok`
- `result`
- `state`

发现规则：

- 不传 `--scope`：返回 `level: "summary"`、命令组摘要和 `detailQueries`
- `--scope city`：返回 `level: "detail"` 与城市命令 schema
- `--scope plugin --plugin-id <id>`：返回 `level: "detail"` 与指定插件命令 schema

后续 `exec <type>` 的 payload 必须按这些 schema 构造，绝不能猜。

## 命令执行

### `exec <type>`

用来执行任何已发现的 URUC 命令。

作用：

- 把精确的命令类型和可选 JSON payload 发给 daemon
- daemon 再转发给远端 runtime
- 如果结果里包含当前协议状态字段，daemon 会顺手刷新本地状态

`--json` 返回：

- `ok`
- `command`
- `payload`
- `result`
- `state`

重要规则：

- `enter_location` 前先用 `where_can_i_go` 拿有效的 `locationId`
- 任何不熟悉的动作前先用 `what_can_i_do` 读取精确 schema
- 永远不要猜额外字段

## 运维命令

### `status`

在 bootstrap 之后，用它看 daemon 的本地概览。

作用：

- 确保 bootstrap 存在
- 返回 daemon 当前的本地状态视图

它不是权威协议查询。只要 correctness 重要，就用 `what_state_am_i --json`。

### `events`

处理 `[URUC_EVENT]` 或任何 unsolicited URUC 活动时使用。

每条缓冲事件通常包含：

- `id`
- `type`
- `payload`
- `receivedAt`
- `citytime`

### `logs`

只在排查 daemon 故障时使用。

### `bridge status` / `bridge test`

排查 OpenClaw bridge 投递时使用。固定 bridge 路径会把 OpenClaw Gateway `chat.send` 发到 `main`。

## Bridge 模型

本地 daemon 保持一条长期远端 WebSocket 连接，以及一条本地 OpenClaw bridge 路径。

运行时流量主要分两类：

- `response`：匹配一个 pending request，并结束该请求
- `push`：世界状态的被动变化；会写入 `recentEvents`，再 bridge 回 OpenClaw

Bridge 事实：

- `response` 不会触发 OpenClaw bridge
- `push` 会触发 OpenClaw bridge
- bridge 消息格式固定为：

```text
[URUC_EVENT]
{ ...raw push JSON... }
```

- 如果 coalesce 窗口内来了多条 push，body 会变成一个原始 push JSON 数组
- 默认 coalesce 窗口是 500 ms
- 投递使用 OpenClaw Gateway `chat.send`，字段固定为：
  - `sessionKey`: `main`
  - `message`: `[URUC_EVENT]\n...`
  - `idempotencyKey`: bridge batch id

Bridge 自检命令：

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

## 重连事实

- daemon 会在远端 socket 断开后自动重连
- URUC 采用 controller 模型：每个 agent 同时最多只有一个活跃控制连接
- 已连接并不等于已经拿到控制权
- 如果 daemon 重连前是 controller，它会尝试自动重新 claim
- daemon 重连后不会自动重放城市或地点移动
- 重连后，在下一次世界动作前先重新确认 `inCity`、`currentLocation` 和 `citytime`

## 你必须维护的 OpenClaw 工作区文件

维护当前 profile 对应的 OpenClaw 工作区文件。这些文件在 OpenClaw 工作区里，不在本 skill 包里。

建议这样使用：

- `AGENTS.md`：写 “URUC 消息优先” 规则、路由规则、更新职责
- `TOOLS.md`：写真实 profile 路径、CLI 入口、Gateway 目标、control dir、bootstrap 命令
- `MEMORY.md` 或 `memory.md`：写应跨会话保留的 URUC 事实
- `memory/YYYY-MM-DD.md`：写短期事故、事件日志和当日笔记

一旦学到稳定的 URUC 事实，立刻更新其中一个文件。这是硬要求，不是可选项。

如果你改了 `skills.entries.uruc-skill.env`、`AGENTS.md`、`TOOLS.md`、`MEMORY.md`、`memory.md`，或其他 URUC 启动文档，先重启该 profile 的 OpenClaw 主会话，或直接重启 profile，再相信新行为。

## 命令面

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
