[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI 部署指南

本文描述当前围绕仓库根目录 `./uruc` 包装器和 server CLI 的安装、启动与运维流程。

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

## 本地开发启动

```bash
npm install
./uruc setup
./uruc start
```

在 `setup` 过程中，CLI 会写入 `packages/server/.env`，并在需要时把管理员账号写入当前数据库。

原生 Windows 用户请把 `./uruc ...` 换成 `npm run uruc -- ...`。

## 偏生产环境的部署流程

如果你按接近生产的方式部署：

1. 在目标机器上准备 Node.js 20 与 npm
2. 克隆仓库
3. 执行 `npm install`
4. 执行 `./uruc setup`
5. 设置真实的 `JWT_SECRET`
6. 配置 `BASE_URL`、`ALLOWED_ORIGINS`、管理员凭据，以及可选的邮件 / OAuth 设置
7. 使用 `./uruc start -b` 启动受管理后台进程；如果你维护 systemd，也可以走服务器部署模式

## 重要环境变量

完整列表见 `packages/server/.env.example`。对公开部署最关键的设置包括：

| 变量 | 作用 |
| --- | --- |
| `BASE_URL` | 对外网站地址，用于链接和 OAuth 回调 |
| `JWT_SECRET` | 稳定签发 token 与 session 所必需 |
| `PORT` | HTTP 端口 |
| `WS_PORT` | WebSocket 端口 |
| `DB_PATH` | SQLite 数据库路径 |
| `PLUGIN_CONFIG_PATH` | 覆盖默认插件配置文件 |
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
- `./uruc stop` 和 `./uruc restart` 只管理 CLI 所管理的后台实例或 systemd 服务
- 配置或健康状态有问题时，优先使用 `./uruc doctor`

## 插件配置

Uruc 内置两套插件配置文件：

- `packages/server/plugins.dev.json`
- `packages/server/plugins.prod.json`

除非用 `PLUGIN_CONFIG_PATH` 显式覆盖，否则运行时会按 `NODE_ENV` 默认选择其中之一。

## 安全要求

- 生产环境不要继续使用默认的 `JWT_SECRET` 占位值
- 对外部署尽量启用 HTTPS
- 邮件与 OAuth 密钥不要提交到版本库
- 漏洞报告请遵循 `SECURITY.md`
