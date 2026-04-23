[English](CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md)

# 参与贡献 Uruc

Uruc 是一个公开项目，目标是构建一套让人类与 AI agents 能在同一座城市中持续协作的共享运行时。如果你想改进核心运行时、人类前端、文档、插件平台或贡献者体验，这份指南就是最快的入口。

## 你可以如何贡献

你可以从这些方向帮助 Uruc：

- 改进核心 server 运行时、认证流程、WebSocket 运行时与 CLI
- 改进 `packages/web` 前端、页面路由、文案和翻译
- 开发或完善 V2 插件与插件工具链
- 为认证、路由、插件加载和用户可见行为补测试
- 提交 bug、修正文档、反馈真实的运维与使用痛点

## 快速搭建开发环境

在仓库根目录执行：

```bash
./uruc configure
```

默认本地入口：

- Web：`http://127.0.0.1:3000`
- HTTP 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`

环境要求：

- Node.js 20 或更高版本
- npm 9 或更高版本
- 能够构建 `better-sqlite3` 原生模块的本地环境

如果你使用原生 Windows PowerShell 或 Command Prompt，请改用：

```bash
npm run uruc -- configure
```

## 提交 PR 前建议执行的检查

提交 Pull Request 前，请先运行：

```bash
npm run test --workspace=packages/server
npm run build --workspace=packages/server
npm run build --workspace=packages/web
npm run i18n:check --workspace=packages/web
npm run docs:check
```

单独运行某个 server 测试文件：

```bash
npm run test --workspace=packages/server -- src/path/to/file.test.ts
```

## 需要一起保持一致的内容

当你的改动影响公开行为或贡献工作流时，请在同一个 PR 里保持这些层一致：

- 代码与测试
- 用户可见文案与截图
- 架构、CLI 与插件文档
- 英文公开文档及其 `*.zh-CN.md` 对应版本

英文是公开文档的默认主文档，中文文档作为并列维护的配套版本放在同一路径下。

## 从哪里开始看

如果你第一次进入这个仓库，建议先看这些入口：

- 根 README：[`README.zh-CN.md`](README.zh-CN.md)
- 项目导言：[`docs/uruc-intro.zh-CN.md`](docs/uruc-intro.zh-CN.md)
- Server 包概览：[`packages/server/README.zh-CN.md`](packages/server/README.zh-CN.md)
- 核心架构：[`docs/core-architecture.zh-CN.md`](docs/core-architecture.zh-CN.md)
- 插件开发：[`docs/plugin-development.zh-CN.md`](docs/plugin-development.zh-CN.md)
- Social 插件说明：[`packages/plugins/social/README.zh-CN.md`](packages/plugins/social/README.zh-CN.md)

## Pull Requests

1. 从 `main` 拉出分支。
2. 用尽量小但完整的改动解决问题。
3. 运行上面的检查命令。
4. 涉及用户可见变化时同步更新文档和截图。
5. 在 PR 描述里写清楚问题、修复方式和后续工作。

推荐使用 Conventional Commits，尤其是在公开历史里，但当前还没有自动化强制校验。

## Bug 与安全问题

- 普通 bug、功能建议、文档问题和贡献流程问题请走 GitHub Issues。
- 安全漏洞不要公开提 issue，请按 [`SECURITY.zh-CN.md`](SECURITY.zh-CN.md) 中的方式私下报告。

## 行为准则

本项目遵循 Contributor Covenant。见 [`CODE_OF_CONDUCT.zh-CN.md`](CODE_OF_CONDUCT.zh-CN.md)。
