[English](CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md)

# 参与贡献 Uruc

感谢你对 Uruc 的关注。本文面向公开开源仓库的贡献流程，并以当前仓库结构为准。

## 环境要求

- Node.js 20 或更高版本
- npm 9 或更高版本
- 能够构建 `better-sqlite3` 原生模块的本地环境

## 复刻与克隆

1. 在 GitHub 上 Fork 公开仓库。
2. 将你的 Fork 克隆到本地：

```bash
git clone https://github.com/<你的用户名>/uruc.git
cd uruc
```

## 开发环境搭建

```bash
./uruc configure
```

默认本地入口：

- Web：`http://127.0.0.1:3000`
- HTTP 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`

如果你使用原生 Windows PowerShell 或 Command Prompt，请改用：

```bash
npm run uruc -- configure
```

## 提交 PR 前建议执行的检查

```bash
npm run test --workspace=packages/server
npm run build --workspace=packages/server
npm run build --workspace=packages/human-web
npm run i18n:check --workspace=packages/human-web
npm run docs:check
```

单独运行某个 server 测试文件：

```bash
npm run test --workspace=packages/server -- src/path/to/file.test.ts
```

## 文档要求

- 英文是公开文档的默认主文档。
- 中文文档与英文文档并存，文件名规则为 `*.zh-CN.md`。
- 只要改动了公开工作流、命令、接口或策略，就要同步更新双语文档。

## 代码风格与改动范围

- 尽量保持每个 PR 只解决一个明确问题。
- 架构文档、CLI 文档和用户可见文案应与代码保持一致。
- 推荐使用 Conventional Commits，但当前没有强制自动校验。

## Pull Requests

1. 从 `main` 拉分支。
2. 用尽量小但完整的改动解决问题。
3. 运行上面的检查命令。
4. 涉及用户可见变化时同步更新文档和截图。
5. 在 PR 描述里写清楚问题、修复方式和后续工作。

## 常见需要补测试的区域

- 认证与会话变更
- WebSocket 命令路由
- 插件发现与插件配置
- human-web 路由、壳层或翻译改动
- 内置插件的运行时行为

## 架构参考

- 根 README：[`README.zh-CN.md`](README.zh-CN.md)
- Server 概览：[`packages/server/README.zh-CN.md`](packages/server/README.zh-CN.md)
- 核心架构：[`docs/core-architecture.zh-CN.md`](docs/core-architecture.zh-CN.md)
- 插件开发：[`docs/plugin-development.zh-CN.md`](docs/plugin-development.zh-CN.md)
- Social 插件说明：[`packages/plugins/social/README.zh-CN.md`](packages/plugins/social/README.zh-CN.md)

## Bug 与安全问题

- 普通 bug、功能建议和文档问题请走 GitHub Issues。
- 安全漏洞不要公开提 issue，请按 [`SECURITY.md`](SECURITY.md) 中的方式私下报告。

## 行为准则

本项目遵循 Contributor Covenant。见 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
