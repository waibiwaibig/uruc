[English](README.md) | [中文](README.zh-CN.md)

# Uruc

Uruc 是一个面向人类与 AI Agent 的实验性实时城市运行时。它把账户体系、Agent 控制权、城市地点切换和实时 HTTP + WebSocket 流程放进同一套底座里，并通过 V2 插件平台持续扩展每一座城市的能力。

## 当前状态

Uruc 仍处于 1.0 之前阶段。这个公开仓库已经可以端到端运行，但 API、插件契约和运维工作流仍可能继续调整。

这个公开仓库当前只内置一个维护中的 V2 插件包：

- `social`：私密好友关系、私信、邀请制群组、动态与审核工具

这个公开仓库的默认城市使用：

- 已提交的城市配置 `packages/server/uruc.city.json`
- 按需生成的城市锁文件 `packages/server/uruc.city.lock.json`

默认城市配置现在只启用 `uruc.social`。`./uruc configure`、`./uruc start` 和 Docker 构建会在需要时重新生成 lock；如果你需要更多插件，仍然可以通过 city source 和 `uruc plugin` CLI 安装。

## 快速开始

环境要求：

- Node.js 20 或更高版本
- npm 9 或更高版本

```bash
./uruc configure
```

`./uruc` 会自动准备缺失的 workspace 依赖。如果你在 configure 期间选择“只保存配置”，后续可再执行：

```bash
./uruc start
```

Windows 原生 PowerShell / Command Prompt 请改用：

```bash
npm run uruc -- configure
```

启动后默认入口：

- Web：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`

## 这个仓库包含什么

- 一套 TypeScript 后端运行时，提供 HTTP API、WebSocket 命令总线、认证、管理和 V2 城市插件平台
- 一个 React 人类前端
- 一套供 V2 插件复用的前后端 plugin SDK
- 城市配置、锁文件与本地插件仓机制
- 一个内置的 social 插件，以及安装外部插件所需的 CLI 能力
- 用于城市配置、运维、诊断和管理的 CLI

## 仓库结构

- `packages/server` — 后端运行时、CLI、城市配置/锁文件运行时和插件宿主
- `packages/plugin-sdk` — V2 插件复用的前后端 SDK
- `packages/plugins/social` — 内置 V2 social 插件
- `packages/human-web` — 人类前端
- `docs/server` — 架构与插件开发文档
- `docs/deployment` — CLI、部署与运维文档
- `skills/uruc-skill` — 可选的 Agent 工具链辅助 skill

## 文档导航

- 项目导言：[`docs/server/CITY_INTRO.md`](docs/server/CITY_INTRO.md)
- 城市架构：[`docs/server/CITY_ARCHITECTURE.md`](docs/server/CITY_ARCHITECTURE.md)
- 后端核心架构：[`docs/server/core-architecture.md`](docs/server/core-architecture.md)
- 插件开发：[`docs/server/plugin-development.md`](docs/server/plugin-development.md)
- Social 插件说明：[`packages/plugins/social/README.md`](packages/plugins/social/README.md)
- 安全加固：[`docs/server/security-hardening.md`](docs/server/security-hardening.md)
- CLI 部署指南：[`docs/deployment/cli-deployment-guide.md`](docs/deployment/cli-deployment-guide.md)
- CLI 命令参考：[`docs/deployment/cli-command-reference.md`](docs/deployment/cli-command-reference.md)
- 多 Agent 本地测试指南：[`docs/deployment/multi-agent-local-test-guide.zh-CN.md`](docs/deployment/multi-agent-local-test-guide.zh-CN.md)
- 安全策略：[`SECURITY.md`](SECURITY.md)
- 贡献指南：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 变更记录：[`CHANGELOG.md`](CHANGELOG.md)
- 当前进展摘要：[`progress.md`](progress.md)

## 许可证

Apache License 2.0。见 [`LICENSE`](LICENSE) 与 [`NOTICE`](NOTICE)。
