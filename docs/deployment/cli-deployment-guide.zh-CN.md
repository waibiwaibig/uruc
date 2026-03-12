[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI Runtime 指南

本文描述当前围绕仓库根目录 `./uruc` 包装器和 server CLI 的 runtime 配置、启动与生命周期流程。

## CLI 负责什么

Uruc 的 server CLI 负责：

- city runtime 配置
- 构建编排
- 前台 / 后台运行时管理
- 运行时诊断
- 插件配置
- 基础管理员引导

Uruc 的主 CLI 不负责：

- nginx
- SSL / certbot
- systemd 安装
- 落地页与多站点拓扑

真正生效的应用配置文件是 `packages/server/.env`。

## 环境要求

- Node.js 20 或更高版本
- npm 9 或更高版本
- 能够构建 `better-sqlite3`
- 可写的 `packages/server/data/` 目录，或自定义 `DB_PATH`

## 本地开发

```bash
npm install
./uruc configure
./uruc start
```

在 `configure` 过程中，CLI 会写入 `packages/server/.env`，并在需要时把管理员账号写入当前数据库。

原生 Windows 用户请把 `./uruc ...` 换成 `npm run uruc -- ...`。

## Runtime 暴露方式

`uruc configure` 支持三种 city runtime 暴露模型：

- `local-only`：绑定 `127.0.0.1`，仅本机访问
- `lan-share`：绑定 `0.0.0.0`，允许局域网朋友访问
- `direct-public`：绑定 `0.0.0.0`，并用公网主机名或域名作为 `BASE_URL`

这些模式只描述 city runtime 本身如何绑定和对外标识，不会安装 nginx、申请证书，也不会决定你的反向代理拓扑。

## 公开运行一个 City Runtime

如果你按接近生产的方式运行 city runtime：

1. 在目标机器上准备 Node.js 20 与 npm
2. 克隆仓库
3. 执行 `npm install`
4. 执行 `./uruc configure`
5. 设置真实的 `JWT_SECRET`
6. 配置 `BASE_URL`、`BIND_HOST`、`ALLOWED_ORIGINS`、管理员凭据，以及可选的邮件 / OAuth 设置
7. 使用 `./uruc start -b` 启动受管理后台进程
8. 如果环境需要 nginx / SSL / systemd，请在 CLI 之外单独管理

## 重要环境变量

完整列表见 `packages/server/.env.example`。对公开部署最关键的设置包括：

| 变量 | 作用 |
| --- | --- |
| `BASE_URL` | 对外网站地址，用于链接和 OAuth 回调 |
| `BIND_HOST` | 运行时绑定地址，例如 `127.0.0.1` 或 `0.0.0.0` |
| `JWT_SECRET` | 稳定签发 token 与 session 所必需 |
| `PORT` | HTTP 端口 |
| `WS_PORT` | WebSocket 端口 |
| `DB_PATH` | SQLite 数据库路径 |
| `PLUGIN_CONFIG_PATH` | 覆盖默认插件配置文件 |
| `ALLOWED_ORIGINS` | 允许访问 API 的前端来源，逗号分隔 |
| `APP_BASE_PATH` | 可选的 city UI 子路径，例如 `/app` |
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
- 外部反向代理、TLS 与服务安装故意不放在 `uruc configure` 里

## 插件配置

Uruc 内置两套插件配置文件：

- `packages/server/plugins.dev.json`
- `packages/server/plugins.prod.json`

除非用 `PLUGIN_CONFIG_PATH` 显式覆盖，否则运行时会按 `NODE_ENV` 默认选择其中之一。

## 安全要求

- 生产环境不要继续使用默认的 `JWT_SECRET` 占位值
- 对外部署尽量启用 HTTPS，但请在主 CLI 之外配置
- 邮件与 OAuth 密钥不要提交到版本库
- 漏洞报告请遵循 `SECURITY.md`
