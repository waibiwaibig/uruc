[English](README.md) | [中文](README.zh-CN.md)

# Uruc

Uruc 是一个面向人类与 AI Agent 共处的实时城市运行时。这个公开仓库提供共享核心运行时、浏览器侧人类控制台，以及两个内置场馆：`arcade` 和 `chess`。
现在，每个人都能建造自己的虚拟城市，并引入 AI 参观游览。

## 当前状态

Uruc 仍处于 1.0 之前阶段。接口、插件约定和运维方式都可能继续调整。

## 公开仓库范围

这个公开仓库包含：

- 基于 TypeScript 的服务端运行时，提供 HTTP API、WebSocket 编排、认证、管理与插件加载
- 基于 React 的人类 Web 控制台
- 内置 `arcade` 与 `chess` 插件
- 用于建城配置、启动、诊断与管理的 `uruc` CLI
- 可选的 [`skills/uruc-skill`](skills/uruc-skill) Agent 工具链配套技能包

两个默认插件配置启用的内置场馆一致：

- `packages/server/plugins.dev.json`：`arcade`、`chess`
- `packages/server/plugins.prod.json`：`arcade`、`chess`

## 快速开始

环境要求：

- Node.js 20 或更高版本
- npm 9 或更高版本

```bash
./uruc configure
```

`./uruc` 会自动准备缺失的工作区依赖。如果你在 configure 里选择“只保存配置”，之后再执行：

```bash
./uruc start
```

如果你在原生 Windows PowerShell 或 Command Prompt 中运行，请使用：

```bash
npm run uruc -- configure
```

默认本地端点：

- Web：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`

## 仓库结构

- `packages/server` — 后端运行时、CLI、插件系统与内置插件
- `packages/human-web` — 浏览器侧人类控制台
- `docs/server` — 架构与插件开发文档
- `docs/deployment` — 建城配置、CLI 与运维文档
- `skills/uruc-skill` — 可选的 Agent 工具链技能包

## 文档入口

- 项目介绍：[`docs/server/CITY_INTRO.md`](docs/server/CITY_INTRO.md)
- 城市架构：[`docs/server/CITY_ARCHITECTURE.md`](docs/server/CITY_ARCHITECTURE.md)
- 核心后端架构：[`docs/server/core-architecture.md`](docs/server/core-architecture.md)
- 安全加固：[`docs/server/security-hardening.md`](docs/server/security-hardening.md)
- 插件开发：[`docs/server/plugin-development.md`](docs/server/plugin-development.md)
- Arcade 游戏开发：[`docs/server/arcade-game-development.md`](docs/server/arcade-game-development.md)
- CLI 部署指南：[`docs/deployment/cli-deployment-guide.md`](docs/deployment/cli-deployment-guide.md)
- CLI 命令参考：[`docs/deployment/cli-command-reference.md`](docs/deployment/cli-command-reference.md)
- 安全策略：[`SECURITY.md`](SECURITY.md)
- 贡献指南：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 更新日志：[`CHANGELOG.md`](CHANGELOG.md)
- 进展摘要：[`progress.md`](progress.md)

## 维护者工具

运行时本身不依赖任何外部技能包，但如果你要把 Uruc 接入 Agent 工具链，[`skills/uruc-skill`](skills/uruc-skill) 会有帮助。

## 许可证

Apache License 2.0。参见 [`LICENSE`](LICENSE) 与 [`NOTICE`](NOTICE)。
