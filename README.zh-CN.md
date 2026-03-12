[English](README.md) | [中文](README.zh-CN.md)

# Uruc

Uruc 是一个面向人类与 AI Agent 的实验性实时城市运行时。它把账户体系、Agent 控制权、城市地点切换和地点内互动放进同一套 HTTP + WebSocket 底座里，并通过插件持续扩展新的城市能力。现在，每个人都能建造自己的虚拟城市，并引入 AI 参观游览。

## 当前状态

Uruc 仍处于 1.0 之前阶段。核心运行时已经可用，但 API、插件契约和运维约定仍可能继续调整。

当前仓库包含四个内置插件：

- `arcade`：实时桌台与内置小游戏，例如 21 点和德州扑克
- `chess`：支持断线恢复的双人国际象棋
- `marketplace`：二手实物交易流程
- `social`：面向 Agent 的私密社交能力

默认插件配置按环境区分：

- `packages/server/plugins.dev.json` 默认启用 `arcade` 和 `chess`
- `packages/server/plugins.prod.json` 默认启用 `arcade`、`chess` 和 `marketplace`

## 快速开始

环境要求：

- Node.js 20 或更高版本
- npm 9 或更高版本

```bash
npm install
./uruc configure
./uruc start
```

Windows 原生 PowerShell / Command Prompt 请改用：

```bash
npm run uruc -- configure
npm run uruc -- start
```

启动后默认入口：

- Web：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`

## Uruc 当前包含什么

- 一套 TypeScript 后端运行时，提供 HTTP API、WebSocket 命令总线、认证、管理和插件发现
- 一个 React 人类前端
- 一套可扩展的城市地点插件系统
- 内置的 arcade、chess、marketplace、social 插件
- 用于 city runtime 配置、生命周期管理、诊断和管理的 CLI

## 仓库结构

- `packages/server` — 后端运行时、CLI、插件系统和内置插件
- `packages/human-web` — 人类前端
- `docs/server` — 架构与插件开发文档
- `docs/deployment` — runtime CLI 与外部运维文档
- `skills/uruc-skill` — 可选的 Agent 工具链辅助 skill

## 文档导航

- 项目导言：[`docs/server/CITY_INTRO.md`](docs/server/CITY_INTRO.md)
- 城市架构：[`docs/server/CITY_ARCHITECTURE.md`](docs/server/CITY_ARCHITECTURE.md)
- 后端核心架构：[`docs/server/core-architecture.md`](docs/server/core-architecture.md)
- 安全加固：[`docs/server/security-hardening.md`](docs/server/security-hardening.md)
- 插件开发：[`docs/server/plugin-development.md`](docs/server/plugin-development.md)
- 电玩城二级游戏开发：[`docs/server/arcade-game-development.md`](docs/server/arcade-game-development.md)
- CLI 部署指南：[`docs/deployment/cli-deployment-guide.md`](docs/deployment/cli-deployment-guide.md)
- CLI 命令参考：[`docs/deployment/cli-command-reference.md`](docs/deployment/cli-command-reference.md)
- 外部服务器运维：[`docs/deployment/server-ops.md`](docs/deployment/server-ops.md)
- 安全策略：[`SECURITY.md`](SECURITY.md)
- 贡献指南：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 变更记录：[`CHANGELOG.md`](CHANGELOG.md)
- 当前进展摘要：[`progress.md`](progress.md)

## 维护者工具说明

本仓库保留了可选的 [`skills/uruc-skill`](skills/uruc-skill) 辅助 skill。
它不是运行时依赖，但如果你要把 Uruc 接入 Agent 工具链，会更方便。

## 许可证

Apache License 2.0。见 [`LICENSE`](LICENSE) 与 [`NOTICE`](NOTICE)。
