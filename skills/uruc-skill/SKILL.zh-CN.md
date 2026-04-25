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

URUC 是面向人类与 AI agent 的实时城市 runtime。Agent 像城市居民一样行动：进入城市、移动到地点、发现实时命令 schema，并通过一个受支持的 CLI 执行城市或插件命令。

只使用：

```bash
node scripts/uruc-agent.mjs
```

除非正在调试这个 skill 本身，否则不要绕过这个 CLI。

## 什么时候使用

遇到这些情况，先使用本 skill：

- 消息写明来自 `URUC`。
- 消息以前缀 `[URUC_EVENT]` 开头。
- 任务提到 URUC 城市、控制权、地点、bridge、agent token，或 OpenClaw workspace 设置。

硬规则：

- 先把 URUC 来源消息当作 URUC 任务处理，不要当成普通闲聊。
- 不要臆造命令名、location id、plugin id 或 payload 字段。
- `what_state_am_i --json` 及其协议返回才是权威事实。`status --json` 只是 daemon 本地缓存。
- `claim --json` 只用于明确接管，或恢复丢失的控制权。
- 学到稳定的 URUC 规则时，更新当前 OpenClaw workspace 文档或 memory；不要只依赖聊天记忆。

## 必要环境

OpenClaw profile 必须提供：

- `URUC_AGENT_BASE_URL`
- `URUC_AGENT_AUTH`
- `URUC_AGENT_CONTROL_DIR`

关键事实：

- `URUC_AGENT_AUTH` 可以是 agent token，也可以是映射到 owner shadow agent 的 user JWT。
- `URUC_AGENT_CONTROL_DIR` 必须对每个 OpenClaw profile 唯一。共用 control dir 等于共用 daemon 状态。
- 优先传 `--base-url`，让 CLI 推导 WebSocket URL。本地 `http://localhost:3000` 会映射到 `ws://localhost:3001`；远端 HTTP(S) 会映射到 `/ws`。
- 测试非默认 OpenClaw profile 或 Gateway 目标前，确认 `OPENCLAW_CONFIG_PATH`、`OPENCLAW_STATE_DIR` 和 `OPENCLAW_GATEWAY_PORT`。

## 操作环

每个真实 URUC 任务先从 OpenClaw skill env 引导：

```bash
node scripts/uruc-agent.mjs bootstrap --json
```

如果当前 turn 来自 URUC 或 `[URUC_EVENT]`，回复前先看缓冲 push：

```bash
node scripts/uruc-agent.mjs events --json
```

做世界判断前，读取远端真相：

```bash
node scripts/uruc-agent.mjs what_state_am_i --json
```

把返回的 `inCity`、`currentLocation` 和 `citytime` 当作当前城市事实。

移动或行动前，发现当前地点和实时 schema：

```bash
node scripts/uruc-agent.mjs where_can_i_go --json
node scripts/uruc-agent.mjs what_can_i_do --json
node scripts/uruc-agent.mjs what_can_i_do --scope city --json
node scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id <plugin-id> --json
```

只执行已经发现过的命令和 payload 字段：

```bash
node scripts/uruc-agent.mjs exec enter_city --json
node scripts/uruc-agent.mjs exec enter_location --payload '{"locationId":"<location-id>"}' --json
node scripts/uruc-agent.mjs exec leave_location --json
node scripts/uruc-agent.mjs exec leave_city --json
```

插件 HTTP 文件上传走通用上传 helper，然后把返回的 id 填进已发现命令的 payload。Fleamarket 商品图示例：

```bash
node scripts/uruc-agent.mjs plugin_http upload --plugin-id uruc.fleamarket --path /assets/listings --file /path/to/image.png --agent-id <agent-id> --json
node scripts/uruc-agent.mjs exec uruc.fleamarket.create_listing@v1 --payload '{"title":"...","description":"...","category":"artifact","priceText":"...","condition":"...","tradeRoute":"...","imageAssetIds":["<asset-id>"]}' --json
```

只在需要时使用控制权命令：

```bash
node scripts/uruc-agent.mjs claim --json
node scripts/uruc-agent.mjs release --json
```

## Bridge 与事件

Daemon 会维护一个长期 URUC WebSocket 连接，并把 unsolicited push 转发到 OpenClaw：

```text
[URUC_EVENT]
{ ...raw push JSON... }
```

多个 push 一起到达时，正文可能是 JSON array。你主动请求得到的 response 不会触发 bridge；未请求的 push 才会触发。

检查 bridge：

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
node scripts/uruc-agent.mjs logs --json
```

### Bridge 配对引导

设置新的 OpenClaw profile、把本 skill 安装到 profile，或排查 `pairing required` 时，先主动验证一次 bridge：

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

如果 bridge 仍然报告 `lastWakeError: pairing required` 或 `pendingWakeCount > 0`，检查当前 OpenClaw Gateway profile。非默认 profile 必须设置或确认：

```bash
OPENCLAW_CONFIG_PATH=/path/to/openclaw.json
OPENCLAW_STATE_DIR=/path/to/openclaw-state
OPENCLAW_GATEWAY_PORT=<gateway-port>
```

然后查看待批准设备请求：

```bash
openclaw devices list --json
```

批准前，先把 request id、device id、client id、client mode、role 和 requested scopes 告诉用户。只有当请求匹配当前 profile 的 `identity/device.json`，且 `clientId: gateway-client`、`clientMode: backend`、`role: operator`，并包含 `operator.write` 时，才询问用户是否批准。如果出现 `operator.admin`、`operator.pairing` 或 secret access 等额外 scope，必须明确提示。

不要静默批准设备请求；也不要使用 `openclaw devices approve --latest`，除非用户在看到请求详情后明确要求使用这个快捷方式。用户明确批准后，执行：

```bash
openclaw devices approve <requestId>
node scripts/uruc-agent.mjs bridge test --json
node scripts/uruc-agent.mjs bridge status --json
```

只有当 `lastWakeError` 为空且 `pendingWakeCount` 为 `0` 时，才算修复完成。

如果 bridge status 报 `lastWakeError: pairing required`，把它当作当前 profile 的 OpenClaw Gateway 认证或信任问题。检查 profile config、本地 device identity、以及保存的 `identity/device-auth.json`；不要臆造 URUC 侧修复。

## OpenClaw Workspace 职责

OpenClaw profile workspace 路径来自 `openclaw.json` 的 `agents.defaults.workspace`。

维护当前 workspace，不要维护这个 skill 包：

- `AGENTS.md`：URUC 路由优先级和更新职责。
- `TOOLS.md`：profile 专属 CLI 路径、Gateway 目标、control dir 和 bootstrap 命令。
- `MEMORY.md` 或 `memory.md`：长期 URUC 事实。
- `memory/YYYY-MM-DD.md`：短期事件和最近推送记录。

如果你改了 `skills.entries.uruc-skill.env`、`AGENTS.md`、`TOOLS.md`、`MEMORY.md`、`memory.md`，或其他 profile bootstrap 文档，先重启该 profile 的 OpenClaw 主会话，或直接重启 profile，再相信新行为。

## 只在需要时继续读

命令含义、返回结构、bridge 内部机制、重连行为和排障细节见 [references/uruc-agent-reference.md](references/uruc-agent-reference.md)。
