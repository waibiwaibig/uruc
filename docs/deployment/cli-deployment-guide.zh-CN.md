[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI 部署指南

本文描述当前围绕仓库根目录 `./uruc` 包装器和 server CLI 的 configure、启动与运维流程。

## 部署运行时：原生 Node.js 与 Docker 的区别

本项目的官方生产部署方案使用 **systemd + Caddy + rsync**，运行在原生 Node.js 环境上。这条路径让运维人员可以直接使用 `./uruc` 命令、系统级服务管理，并与宿主机环境深度集成。

Docker 仍然是受支持的可选运行时，适用于本地评估、开源使用和容器化环境。对于希望在服务器上直接使用 `./uruc` 并进行系统级服务管理的运维人员，建议选择原生 Node.js 部署，并在其前端配置反向代理（Caddy 或 Nginx）。

简而言之：

- 原生 Node.js + systemd + Caddy —— 官方生产路径
- Docker —— 受支持、可靠，适合容器化或开发环境；不是主要的生产目标

## CLI 负责什么

Uruc 的 server CLI 负责：

- 首次初始化配置
- 构建编排
- 前台 / 后台运行时管理
- 运行时诊断
- 插件配置
- 基础管理员引导

真正生效的应用配置文件是 `packages/server/.env`。

## 环境要求

- Node.js 20 或更高版本
- npm 9 或更高版本
- 能够构建 `better-sqlite3`
- 可写的 `packages/server/data/` 目录，或自定义 `DB_PATH`

## 本地开发

```bash
./uruc configure
./uruc start
```

在 `configure` 过程中，CLI 会写入 `packages/server/.env`，同时准备 `uruc.city.json` 和 `uruc.city.lock.json`，并在需要时初始化或更新管理员账号；也可以直接从配置向导里启动城市。`./uruc` 包装器还会在命令执行前自动准备缺失的 workspace 依赖。

如果你想走一条可重复的本地验证链路，推荐：

```bash
./uruc configure --quickstart
./uruc start -b
./uruc doctor
./uruc stop
```

当实例里已经配置过路径时，QuickStart 会保留现有的 `DB_PATH`、`CITY_CONFIG_PATH`、`PUBLIC_DIR`、`UPLOADS_DIR` 和城市级 `pluginStoreDir`，不会随手重写。

原生 Windows 用户请把 `./uruc ...` 换成 `npm run uruc -- ...`。

## 偏生产环境的配置流程

如果你按接近生产的方式部署：

1. 在目标机器上准备 Node.js 20 与 npm
2. 克隆仓库
3. 执行 `./uruc configure`
4. 设置真实的 `JWT_SECRET`
5. 配置 `BASE_URL`、`ALLOWED_ORIGINS`、管理员凭据，以及可选的邮件 / OAuth 设置
6. configure 结束后，可以先只保存配置，稍后再执行 `./uruc start -b`；也可以让 configure 直接启动受管理运行时。如果机器上已经安装了 `systemd` 服务，这条受管理路径会自动转到该服务，而不会再额外拉起一个 CLI 自管后台进程

## 重要环境变量

完整列表见 `packages/server/.env.example`。对公开部署最关键的设置包括：

| 变量 | 作用 |
| --- | --- |
| `BASE_URL` | 对外网站地址，用于链接和 OAuth 回调 |
| `JWT_SECRET` | 稳定签发 token 与 session 所必需 |
| `PORT` | HTTP 端口 |
| `WS_PORT` | WebSocket 端口 |
| `DB_PATH` | SQLite 数据库路径 |
| `CITY_CONFIG_PATH` | 覆盖城市配置文件路径 |
| `CITY_LOCK_PATH` | 覆盖城市锁文件路径 |
| `PLUGIN_STORE_DIR` | 覆盖本地插件 revision 仓路径 |
| `ALLOWED_ORIGINS` | 允许访问 API 的前端来源，逗号分隔 |
| `ENABLE_HSTS` | 当请求等效为 HTTPS 时启用 HSTS |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | 管理员引导身份 |
| `FROM_EMAIL` / `RESEND_API_KEY` | 邮件发送配置 |

## 构建与运行命令

```bash
./uruc build
./uruc start
./uruc start -b
./uruc status
./uruc logs
./uruc stop
./uruc restart
./uruc doctor
```

运维备注：

- `./uruc start` 以前台模式运行
- `./uruc start -b` 会创建受 CLI 管理的后台进程
- `./uruc start` 现在会在启动前自动创建默认城市配置（如果缺失）并刷新 city lock
- `./uruc stop` 和 `./uruc restart` 只管理 CLI 所管理的后台实例或 systemd 服务
- 配置、插件 config/lock/runtime 或健康状态有问题时，优先使用 `./uruc doctor`

## 城市配置

Uruc V2 通过以下文件读取插件状态：

- `packages/server/uruc.city.json`
- `packages/server/uruc.city.lock.json`

可用 `CITY_CONFIG_PATH` 覆盖城市配置路径，用 `CITY_LOCK_PATH` 覆盖解析后的锁文件路径。本地 revision 仓默认位于 `packages/server/.uruc/plugins`，也可通过 `PLUGIN_STORE_DIR` 覆盖。对常见使用路径来说，你不需要再把 `city init` 或手动 `plugin update` 当成启动前必做步骤。

## 安全要求

- 生产环境里 `JWT_SECRET` 是硬要求，缺失时启动会直接失败
- 本地 / 测试环境缺少 `JWT_SECRET` 时只会警告，并生成进程内临时 secret
- 对外部署尽量启用 HTTPS
- 邮件与 OAuth 密钥不要提交到版本库
- 漏洞报告请遵循 `SECURITY.md`
