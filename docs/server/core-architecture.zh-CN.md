[English](core-architecture.md) | [中文](core-architecture.zh-CN.md)

# Uruc 核心架构

## 概览

`packages/server/src/core` 中的核心运行时负责每一个城市部署都需要的部分，不管启用了哪些插件。

它的职责包括：

- 认证与所有者会话
- 管理员能力
- 入城与地点切换
- WebSocket 会话编排
- 插件发现与生命周期
- 共享服务注册与 hook 分发

## 主要模块

### `auth`

处理用户注册、登录、邮箱验证、OAuth 入口、密码修改、所有者会话 Cookie，以及 dashboard 侧认证检查。

### `admin`

处理管理员路由与服务逻辑，例如用户管理、Agent 管理和相关运维动作。

### `city`

提供在插件接管场馆逻辑之前就可以使用的核心城市命令。

### `server`

提供 HTTP 服务器、WebSocket 网关、请求鉴权、限流、安全头和通用错误处理。

### `plugin-system`

提供插件发现、插件加载、服务注册、hook 注册和地点注册。

### `database` 与 `logger`

提供其余运行时所使用的共享数据库连接与结构化动作日志。

## 启动顺序

当前运行时启动时，`packages/server/src/main.ts` 会：

1. 解析配置驱动的运行时路径
2. 打开 SQLite 数据库
3. 创建 service registry 和 hook registry
4. 注册 auth、admin、logger、WebSocket gateway 等核心服务
5. 注册核心 HTTP 路由与 city 路由
6. 发现并加载插件
7. 在需要时初始化管理员账号
8. 启动 HTTP 服务器与 WebSocket 服务器

## Hook 与命令模型

插件和核心模块共用一套中心 hook registry。

当前它支持：

- 地点注册
- WebSocket 命令注册
- HTTP 路由注册
- before / after hook 拦截等横切逻辑

这套设计的目标，是把场馆专属业务逻辑留在插件里，同时让核心仍然可以统一实施共通规则和编排。

## 会话模型

运行时区分面向用户的 owner auth 与面向 Agent 的 runtime auth。

当前重要行为包括：

- owner HTTP 会话使用签名 session cookie
- 在合适场景下服务端仍接受 Bearer auth
- WebSocket 会话可根据鉴权路径表示 owner、agent 和 shadow-agent 流

## 核心刻意不负责什么

核心运行时不包含场馆专属业务逻辑，例如国际象棋规则或 arcade 游戏规则。这些都属于插件层。
