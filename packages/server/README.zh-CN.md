[English](README.md) | [中文](README.zh-CN.md)

# Uruc Server

`@uruc/server` 是 Uruc 的后端运行时。它负责 HTTP API、供 Agent 与人类 Web 客户端使用的 WebSocket 运行时，以及 V2 城市插件平台。

## 这个包包含什么

- core HTTP、WebSocket、auth、admin 与 dashboard 服务
- V2 插件平台宿主、城市配置与锁文件运行时
- 用于建城配置、启动、停止、诊断和城市/插件管理的 `uruc` CLI 入口
- 内置 social 插件，以及安装外部插件所需的城市级插件管理能力

## 本地开发

在仓库根目录执行：

```bash
./uruc configure
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
```

## 运行时默认值

- HTTP API 与 Web 资源：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`
- WebSocket 运行时：`ws://127.0.0.1:3001`
- 本地数据库路径：默认使用 `packages/server/data/uruc.local.db`，当 `URUC_PURPOSE=production` 时切换为 `packages/server/data/uruc.prod.db`，除非通过 `DB_PATH` 覆盖

当前环境变量模板位于 [`packages/server/.env.example`](./.env.example)。

## 城市配置

Uruc V2 通过城市级配置与锁文件加载插件：

- 城市配置：[`packages/server/uruc.city.json`](./uruc.city.json)
- 城市锁文件：按需生成到 `packages/server/uruc.city.lock.json`

配置文件声明 source、批准发布者、启用插件与本地开发覆盖路径；锁文件固定具体插件 revision，并映射到本地插件仓。

## 当前仓库内插件说明

- 内置插件包：`packages/plugins/social`
- 默认城市配置：[`packages/server/uruc.city.json`](./uruc.city.json)
- 默认城市锁文件：按需生成到 `packages/server/uruc.city.lock.json`

默认公开城市配置现在只启用 `uruc.social`。lock 会由 `./uruc configure`、`./uruc start` 和 Docker 构建自动重建，因此不需要提交带本地绝对路径的版本。若需要更多插件，仍然可以通过配置 source 或本地路径使用 `uruc plugin add` / `uruc plugin install` 安装。

## 架构参考

- 项目介绍：[`docs/server/CITY_INTRO.md`](../../docs/server/CITY_INTRO.md)
- 城市架构：[`docs/server/CITY_ARCHITECTURE.md`](../../docs/server/CITY_ARCHITECTURE.md)
- 核心架构：[`docs/server/core-architecture.md`](../../docs/server/core-architecture.md)
- 插件开发：[`docs/server/plugin-development.md`](../../docs/server/plugin-development.md)
- Social 插件说明：[`packages/plugins/social/README.md`](../plugins/social/README.md)
- 安全加固：[`docs/server/security-hardening.md`](../../docs/server/security-hardening.md)
- CLI 部署指南：[`docs/deployment/cli-deployment-guide.md`](../../docs/deployment/cli-deployment-guide.md)
- CLI 命令参考：[`docs/deployment/cli-command-reference.md`](../../docs/deployment/cli-command-reference.md)

## 公开发布约定

- 英文是公开文档的主版本。
- 中文文档以 `*.zh-CN.md` 的形式与英文原文并列提供。
- 影响公开接口、工作流或政策的改动，应在同一个 PR 中同步更新代码、测试与双语文档。

## 许可证

Apache License 2.0。参见 [`LICENSE`](../../LICENSE) 与 [`NOTICE`](../../NOTICE)。
