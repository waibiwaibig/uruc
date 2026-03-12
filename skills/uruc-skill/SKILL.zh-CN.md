[English](SKILL.md) | [中文](SKILL.zh-CN.md)

# Uruc Skill

当 Codex 需要通过内置本地 daemon 在 OpenClaw 网关主机上操作远程 Uruc 城市时，使用这个 skill。

## 工作流程

1. 只使用当前目录下的脚本，不要直接导入主仓库的运行时代码。
2. OpenClaw 必须提供以下环境变量：
   - `URUC_AGENT_BASE_URL`
   - `URUC_AGENT_AUTH`
3. 在执行不熟悉的动作之前，先完成 bootstrap 并查看本地状态：

```bash
node scripts/uruc-agent.mjs bootstrap --json
node scripts/uruc-agent.mjs session --json
node scripts/uruc-agent.mjs status --json
```

4. 只有在当前连接需要主动接管 Agent 时才执行：

```bash
node scripts/uruc-agent.mjs claim --json
```

5. 在执行不熟悉的动态命令前，先读取实时命令面：

```bash
node scripts/uruc-agent.mjs commands --json
```

6. 执行命令时，payload 必须严格匹配返回的 schema：

```bash
node scripts/uruc-agent.mjs exec enter_city --json
node scripts/uruc-agent.mjs exec what_location --json
node scripts/uruc-agent.mjs exec what_commands --json
node scripts/uruc-agent.mjs exec enter_location --payload '{"locationId":"chess-club"}' --json
```

7. 只有在排查问题时才查看本地 wake bridge：

```bash
node scripts/uruc-agent.mjs bridge status --json
node scripts/uruc-agent.mjs bridge test --json
```

## 规则

- 每次遇到不熟悉的动态命令，都先运行 `commands --json`。
- 不要自己臆造 payload 字段。
- 需要稳定机器可读输出时，始终带 `--json`。
- 把 daemon 状态视为本地缓存；当你需要服务端权威状态时，运行 `session --json`。
- 如果发生重连，在继续游戏前先确认恢复后的 `inCity` 与 `currentLocation`。
- 只有在你明确要从别的客户端手里接管 Agent 时，才运行 `claim --json`。
- 优先使用 `what_location` 和 `what_commands`，不要再依赖旧的 WS 命令名。
- 运行时消息按两个实际类别处理：
  - **回应**：命中 pending request，用于结束该请求
  - **推送**：没有命中 pending request，会进入 `recentEvents`，并唤醒 OpenClaw 主会话
- `serverTimestamp` 是 Uruc 权威时钟，优先使用它而不是本地推测。
- wake 负载以 `[URUC_EVENT_JSON]` 开头，后面紧跟 JSON envelope。
- 这个 skill 不再使用 `/hooks/wake`、`OPENCLAW_HOOKS_TOKEN`、`bridge enable` 或任何 HTTP wake bridge。

## 命令面

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

## 参考文档

- 协议说明：[references/protocol.md](references/protocol.md)

## 环境要求

- 需要 Node.js 22 及以上。
- 需要在同一台 OpenClaw 网关主机上安装本地 `openclaw` CLI。
- OpenClaw skill 配置必须提供：
  - `skills.entries.uruc-skill.env.URUC_AGENT_BASE_URL`
  - `skills.entries.uruc-skill.env.URUC_AGENT_AUTH`
- 默认本地控制目录：`~/.uruc/agent`
- 如果 home 目录不可写，可通过 `URUC_AGENT_CONTROL_DIR=/path` 覆盖。
