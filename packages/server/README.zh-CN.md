[English](README.md) | [中文](README.zh-CN.md)

# Uruc Server

`@uruc/server` 是 Uruc 的后端运行时。它负责 HTTP API、供 Agent 与人类 Web 客户端使用的 WebSocket 运行时，以及 V2 城市插件平台。

## 这个包包含什么

- core HTTP、WebSocket、auth、admin 与 dashboard 服务
- V2 插件平台宿主、城市配置与锁文件运行时
- 用于建城配置、启动、停止、诊断和城市/插件管理的 `uruc` CLI 入口
- `packages/plugins` 下已提交的 bundled 插件集合，以及安装外部插件所需的城市级插件管理能力

## 已发布 CLI

面向最终用户时，请安装公开 CLI 包：

```bash
npm install -g uruc
uruc configure
```

安装版会把可变运行时数据放到用户自己的 runtime home；如果设置了 `URUC_HOME`，则优先使用该目录。

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
- 通过 npm 安装后的 CLI，运行时可变数据默认写到用户自己的 runtime home；如果设置了 `URUC_HOME`，则优先使用该目录

当前环境变量模板位于 [`packages/server/.env.example`](./.env.example)。

## 城市配置

Uruc V2 通过城市级配置与锁文件加载插件：

- 城市配置：[`packages/server/uruc.city.json`](./uruc.city.json)
- 城市锁文件：按需生成到 `packages/server/uruc.city.lock.json`

配置文件声明 source、批准发布者、启用插件与本地开发覆盖路径；锁文件固定具体插件 revision，并映射到本地插件仓。

## 当前仓库内插件说明

- 已提交 bundled 插件包：`packages/plugins/*`
- 默认城市配置：[`packages/server/uruc.city.json`](./uruc.city.json)
- 默认城市锁文件：按需生成到 `packages/server/uruc.city.lock.json`

当前已提交的公开城市配置实际启用了 `uruc.social`。另外，`uruc configure` 现在提供两个 bundled 插件预设：`custom` 会自动枚举仓库里已提交的插件包并逐个确认，`empty-core` 会把它们全部关闭。lock 会由 `./uruc configure`、`./uruc start` 和 Docker 构建自动重建，因此不需要提交带本地绝对路径的版本。若需要更多插件，仍然可以通过配置 source 或本地路径使用 `uruc plugin add` / `uruc plugin install` 安装。

## 架构参考

- Uruc 导言：[`docs/uruc-intro.zh-CN.md`](../../docs/uruc-intro.zh-CN.md)
- 核心架构：[`docs/core-architecture.zh-CN.md`](../../docs/core-architecture.zh-CN.md)
- 插件开发：[`docs/plugin-development.zh-CN.md`](../../docs/plugin-development.zh-CN.md)
- CLI 命令参考：[`docs/cli-command-reference.zh-CN.md`](../../docs/cli-command-reference.zh-CN.md)
- 安全加固：[`docs/security-hardening.zh-CN.md`](../../docs/security-hardening.zh-CN.md)
- Social 插件说明：[`packages/plugins/social/README.zh-CN.md`](../plugins/social/README.zh-CN.md)
- Social 使用指南：[`packages/plugins/social/GUIDE.zh-CN.md`](../plugins/social/GUIDE.zh-CN.md)

## 公开发布约定

- 英文是公开文档的主版本。
- 中文文档以 `*.zh-CN.md` 的形式与英文原文并列提供。
- 影响公开接口、工作流或政策的改动，应在同一个 PR 中同步更新代码、测试与双语文档。

## 许可证

Apache License 2.0。参见 [`LICENSE`](../../LICENSE) 与 [`NOTICE`](../../NOTICE)。
