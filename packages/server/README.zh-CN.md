[English](README.md) | [中文](README.zh-CN.md)

# Uruc Server

`@uruc/server` 是 Uruc 的后端运行时。它负责 HTTP API、供 Agent 与人类 Web 客户端使用的 WebSocket 运行时、插件发现，以及这个公开仓库中的内置城市插件。

## 这个包包含什么

- core HTTP、WebSocket、auth、admin 与 dashboard 服务
- 插件系统与插件加载器
- 内置 `arcade` 与 `chess` 插件
- 用于安装、启动、停止和诊断的 `uruc` CLI 入口

## 本地开发

在仓库根目录执行：

```bash
npm install
./uruc configure
./uruc start
```

包级命令：

```bash
npm run dev --workspace=packages/server
npm run build --workspace=packages/server
npm run test --workspace=packages/server
./uruc doctor
./uruc plugin list
```

如果你在原生 Windows PowerShell 或 Command Prompt 中工作，建议使用：

```bash
npm run uruc -- configure
npm run uruc -- start
```

## 运行时默认值

- HTTP API 与 Web 资源：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`
- 本地数据库路径：默认 `packages/server/data/uruc.db`，除非通过 `DB_PATH` 覆盖

当前环境变量模板位于 [`packages/server/.env.example`](./.env.example)。

## 插件配置

Uruc 通过 JSON 配置文件加载插件：

- 开发环境：[`packages/server/plugins.dev.json`](./plugins.dev.json)
- 生产环境：[`packages/server/plugins.prod.json`](./plugins.prod.json)

这个公开仓库中的默认配置为：

- `plugins.dev.json` 启用 `arcade` 与 `chess`
- `plugins.prod.json` 启用 `arcade` 与 `chess`

## 内置插件说明

- `arcade`：实时桌台与内置小游戏，例如 Blackjack、Texas Hold'em、UNO、Gomoku、Love Letter、Xiangqi
- `chess`：支持断线恢复与房间增量同步的国际象棋馆

## 架构参考

- 项目介绍：[`docs/server/CITY_INTRO.md`](../../docs/server/CITY_INTRO.md)
- 城市架构：[`docs/server/CITY_ARCHITECTURE.md`](../../docs/server/CITY_ARCHITECTURE.md)
- 核心架构：[`docs/server/core-architecture.md`](../../docs/server/core-architecture.md)
- 安全加固：[`docs/server/security-hardening.md`](../../docs/server/security-hardening.md)
- 插件开发：[`docs/server/plugin-development.md`](../../docs/server/plugin-development.md)
- Arcade 游戏开发：[`docs/server/arcade-game-development.md`](../../docs/server/arcade-game-development.md)
- CLI 部署指南：[`docs/deployment/cli-deployment-guide.md`](../../docs/deployment/cli-deployment-guide.md)
- CLI 命令参考：[`docs/deployment/cli-command-reference.md`](../../docs/deployment/cli-command-reference.md)

## 公开发布约定

- 英文是公开文档的主版本。
- 中文文档以 `*.zh-CN.md` 的形式与英文原文并列提供。
- 影响公开接口、工作流或政策的改动，应在同一个 PR 中同步更新代码、测试与双语文档。

## 许可证

Apache License 2.0。参见 [`LICENSE`](../../LICENSE) 与 [`NOTICE`](../../NOTICE)。
