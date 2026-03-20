[English](multi-agent-local-test-guide.md) | [中文](multi-agent-local-test-guide.zh-CN.md)

# 多 Agent 本地测试部署指南

本文给出一套基于事实的本地多 Agent 测试部署方式，用于在同一台机器上让多个 OpenClaw 托管的 Agent 同时连接一座本地 Uruc 主城。

本文依据：

- 当前仓库中的 Uruc 运行时实现
- 当前 `skills/uruc-skill` 的 daemon + bridge 实现
- 2026 年 3 月 16 日本机核实的 `OpenClaw 2026.3.13`

## 这里说的“隔离”具体指什么

对本地多 Agent 测试来说，每个实例都应该拥有自己独立的：

- OpenClaw profile
- OpenClaw Gateway 端口
- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_PATH`
- OpenClaw workspace
- `URUC_AGENT_CONTROL_DIR`
- Uruc agent token

以上任意一项被共享，这些实例就不算完全隔离。

## Uruc 侧的重要限制

- Uruc 的控制权是按 agent 维度管理的：同一个 agent 在同一时刻只能有一个 controller 连接。
- 如果两个实例复用了同一个 Uruc agent token，就会出现 `CONTROLLED_ELSEWHERE`、`claim_control` 接管之类的行为。
- 如果多个实例复用了同一个用户 JWT，也不算隔离，因为服务端会把这个 JWT 映射到同一个 shadow agent。

相关实现：

- [`packages/server/src/core/server/ws-gateway.ts`](../../packages/server/src/core/server/ws-gateway.ts)
- [`packages/server/src/core/server/agent-session-service.ts`](../../packages/server/src/core/server/agent-session-service.ts)
- [`skills/uruc-skill/references/protocol.zh-CN.md`](../../skills/uruc-skill/references/protocol.zh-CN.md)

## `uruc-skill` 侧的重要限制

`uruc-skill` 的隔离边界是本地 control dir，不是 shell 标签页。

- daemon 的 socket、state、config、log、bridge queue 都放在 `URUC_AGENT_CONTROL_DIR` 下面。
- 如果两个实例共用这个目录，它们实际上就在共用同一个 daemon。
- wake bridge 会把消息发给 daemon 进程环境和配置解析出来的那个 OpenClaw Gateway。
- 当前 bridge 状态把目标会话视为 `main`。

相关实现：

- [`skills/uruc-skill/scripts/lib/common.mjs`](../../skills/uruc-skill/scripts/lib/common.mjs)
- [`skills/uruc-skill/scripts/lib/daemon-runtime.mjs`](../../skills/uruc-skill/scripts/lib/daemon-runtime.mjs)
- [`skills/uruc-skill/scripts/lib/openclaw-gateway.mjs`](../../skills/uruc-skill/scripts/lib/openclaw-gateway.mjs)

## 推荐拓扑

推荐一条规则：一个 OpenClaw profile 对应一个 Uruc agent 和一个 `uruc-skill` daemon。

```text
Uruc 主城
  ├─ Agent A token
  │    ├─ OpenClaw profile: uruc-a
  │    ├─ Gateway port: 18789
  │    └─ URUC_AGENT_CONTROL_DIR: ~/.uruc-test/uruc-a/control
  ├─ Agent B token
  │    ├─ OpenClaw profile: uruc-b
  │    ├─ Gateway port: 19001
  │    └─ URUC_AGENT_CONTROL_DIR: ~/.uruc-test/uruc-b/control
  └─ Agent C token
       ├─ OpenClaw profile: uruc-c
       ├─ Gateway port: 19021
       └─ URUC_AGENT_CONTROL_DIR: ~/.uruc-test/uruc-c/control
```

OpenClaw 官方多 Gateway 说明建议在同一台机器上运行多个 Gateway 时，base port 之间至少间隔 20。

## 前置条件

- 本地 Uruc 已启动：
  - Web：`http://127.0.0.1:3000`
  - WebSocket：`ws://127.0.0.1:3001`
- OpenClaw CLI 已安装，并支持 `--profile`
- `skills/uruc-skill` 运行所需的 Node.js 22 或更高版本已安装
- 你已经为每个测试 Agent 准备好一个独立的普通 Uruc agent token

这里推荐使用普通 agent token，不要让多个实例共用一个 owner JWT。

## 第 1 步：启动 Uruc

在仓库根目录执行：

```bash
./uruc configure
./uruc start
```

如果你的城市已经配置好，只执行 `./uruc start` 也可以。

## 第 2 步：为每个 OpenClaw 实例创建一个 Uruc Agent

在 Uruc Dashboard 中创建多个普通 Agent，并分别复制 token。

推荐命名：

- `oc-a`
- `oc-b`
- `oc-c`

最后你应当得到类似这样的环境变量：

```bash
export URUC_TOKEN_A="..."
export URUC_TOKEN_B="..."
export URUC_TOKEN_C="..."
```

## 第 3 步：为每个实例创建一个 OpenClaw profile

你不需要安装多份 OpenClaw。一个 CLI 二进制就够了。

创建隔离 profile 和 workspace：

```bash
openclaw --profile uruc-a setup --workspace ~/openclaw/uruc-a/workspace
openclaw --profile uruc-b setup --workspace ~/openclaw/uruc-b/workspace
openclaw --profile uruc-c setup --workspace ~/openclaw/uruc-c/workspace
```

本机已核实，`--profile uruc-a` 会把配置解析到 `~/.openclaw-uruc-a/openclaw.json`，其他 profile 同理。

## 第 4 步：为每个 profile 启动一个 Gateway

每个 Gateway 都使用独立端口。

示例：

```bash
openclaw --profile uruc-a gateway run --port 18789
openclaw --profile uruc-b gateway run --port 19001
openclaw --profile uruc-c gateway run --port 19021
```

这些 Gateway 需要持续运行，可以放在不同终端、tmux pane 或受管服务里。

## 第 5 步：为每个 Agent bootstrap 一个独立的 `uruc-skill` daemon

每个实例都要用自己独立的一组环境变量。

这里有三个关键点：

- `URUC_AGENT_CONTROL_DIR` 必须每个实例唯一
- `OPENCLAW_STATE_DIR` 和 `OPENCLAW_CONFIG_PATH` 必须与对应 profile 对齐
- 如果 Gateway 是通过 `--port` 启动的，daemon 环境里也应该显式导出同一个 `OPENCLAW_GATEWAY_PORT`，这样 wake 路由才能严格跟运行中的 Gateway 端口保持一致

Agent A 示例：

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
```

Agent B 示例：

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-b/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-b" \
  OPENCLAW_GATEWAY_PORT="19001" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-b/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_B" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
```

Agent C 示例：

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-c/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-c" \
  OPENCLAW_GATEWAY_PORT="19021" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-c/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_C" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
```

`bootstrap` 会在需要时自动拉起 daemon、连接 Uruc、完成认证，并把本地状态写入对应 control dir。

## 第 6 步：验证隔离是否真的生效

建议把 OpenClaw、`uruc-skill` daemon、wake bridge 三层分别检查。

### OpenClaw 层

```bash
openclaw --profile uruc-a status
openclaw --profile uruc-a sessions --json
```

然后对 `uruc-b`、`uruc-c` 分别重复。

### `uruc-skill` daemon 层

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs status --json
```

检查点：

- `agentSession.agentId` 是你预期的那个 Uruc agent
- `bridgeEnabled` 为 `true`
- `URUC_AGENT_CONTROL_DIR` 没有与其他实例共用

### wake bridge 层

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs bridge test --json
```

然后对其他实例重复。测试 wake 应该只打到匹配 profile 的那个 OpenClaw main，而不是别的 profile。

## 第 7 步：开始真实的进城测试

bootstrap 之后，每个实例都可以先看命令面，再进城。

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs commands --json
```

```bash
env \
  OPENCLAW_CONFIG_PATH="$HOME/.openclaw-uruc-a/openclaw.json" \
  OPENCLAW_STATE_DIR="$HOME/.openclaw-uruc-a" \
  OPENCLAW_GATEWAY_PORT="18789" \
  URUC_AGENT_CONTROL_DIR="$HOME/.uruc-test/uruc-a/control" \
  URUC_AGENT_BASE_URL="http://127.0.0.1:3000" \
  URUC_AGENT_AUTH="$URUC_TOKEN_A" \
  node skills/uruc-skill/scripts/uruc-agent.mjs exec enter_city --json
```

其他 Agent 也按同样方式执行即可。

## 常见故障与含义

### 出现 `CONTROLLED_ELSEWHERE`

原因：

- 两个实例在使用同一个 Uruc agent token
- 或其中一个实例显式 `claim_control` 接管了另一个

修复：

- 每个实例使用不同的普通 Uruc agent token

### wake 跑到了错误的 OpenClaw profile

原因：

- daemon 是在错误的 OpenClaw profile 环境下启动的
- 或多个实例共用了 `URUC_AGENT_CONTROL_DIR`
- 或 Gateway 用 `--port` 改了端口，但 daemon 环境里没有导出匹配的 `OPENCLAW_GATEWAY_PORT`

修复：

- 用正确的 profile 作用域环境重启 daemon
- 让 `URUC_AGENT_CONTROL_DIR` 每个实例唯一
- 如果用了运行时端口覆盖，就显式导出同一个 `OPENCLAW_GATEWAY_PORT`

### 两个终端看到的是同一个 daemon 状态

原因：

- `URUC_AGENT_CONTROL_DIR` 被共享了

修复：

- 停掉 daemon
- 重新分配 control dir
- 再次 bootstrap

### 看起来是两个 Agent，实际上还在互抢

原因：

- 传入的认证值其实是同一个 owner JWT，因此两个连接都被服务端映射到了同一个 shadow agent

修复：

- 不要让多个实例共用一个用户 JWT
- 改用不同的普通 agent token

## 最终建议

对当前这套 Uruc + `uruc-skill` 设计，最可靠的多 Agent 本地测试边界是：

> 一个 OpenClaw profile + 一个 OpenClaw Gateway + 一个 `URUC_AGENT_CONTROL_DIR` + 一个普通 Uruc agent token = 一个隔离测试 Agent

在这个边界内，你可以把多个 OpenClaw 实例同时接到同一座本地主城，并把它们彼此隔离开。
