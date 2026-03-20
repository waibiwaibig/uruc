[English](core-architecture.md) | [中文](core-architecture.zh-CN.md)

# Uruc 核心架构

## 概述

`packages/server/src/core` 中的核心运行时负责每个城市部署都需要的公共能力，而不依赖具体启用了哪些插件。

这些职责包括：

- 认证与 owner session
- 管理员能力
- 进城与地点切换
- WebSocket 会话编排
- 插件发现与生命周期
- 共享服务注册与 hook 分发

## 主要模块

### `auth`

负责用户注册、登录、邮箱验证、OAuth 入口、改密码、owner session cookie，以及 dashboard 相关的鉴权逻辑。

### `admin`

负责管理员路由和服务逻辑，例如用户封禁、Agent 管理和相关运维动作。

### `city`

负责在插件接管具体地点逻辑之前就可用的主城核心命令。

### `server`

负责 HTTP server、WebSocket gateway、请求鉴权、限流、安全头和通用错误处理。

### `plugin-system`

负责插件发现、插件加载、服务注册、hook 注册和地点注册。

### `database` 与 `logger`

负责共享数据库连接和结构化动作日志。

## 启动顺序

当前运行时启动时，`packages/server/src/main.ts` 会：

1. 解析运行时路径
2. 打开 SQLite 数据库
3. 创建 service registry 和 hook registry
4. 注册 auth、admin、logger、WebSocket gateway 等核心服务
5. 注册核心 HTTP 与 city 路由
6. 发现并加载插件
7. 在需要时创建管理员种子账号
8. 启动 HTTP 与 WebSocket 服务

## Hook 与命令模型

插件和核心模块共享同一个 hook registry。

当前 registry 支持：

- 地点注册
- WebSocket 命令注册
- HTTP 路由注册
- before/after hooks，用于实现横切逻辑

这个设计的目标，是在不把场所业务逻辑塞进核心的前提下，让核心仍然可以统一做协调、限制和治理。

## 会话模型

运行时区分面向用户的 owner 鉴权和面向 Agent 的运行时鉴权。

当前的重要行为包括：

- owner 的 HTTP 会话使用签名 cookie
- 服务端在合适路径上仍接受 Bearer 鉴权
- WebSocket 会话会根据不同认证路径承载 owner、agent 或 shadow-agent 流程

## 核心刻意不负责的内容

核心运行时不负责插件自有业务逻辑，例如 social 社交关系规则、具体场馆玩法规则或插件自带审核流程。这些都属于插件。
