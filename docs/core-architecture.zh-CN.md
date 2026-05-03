[English](core-architecture.md) | [中文](core-architecture.zh-CN.md)

# Uruc 核心架构

本文档描述 `packages/server/src/main.ts` 中的当前 server bootstrap，以及 `packages/server/src/core` 下的运行时模块。
如果文档与实现不一致，以代码为准。

## 架构范围

核心运行时负责每个城市部署都需要的公共能力，而不依赖具体启用了哪些插件。

当前包括：

- 数据库访问与共享日志
- owner 鉴权与 dashboard session
- 管理员路由与审核运维能力
- 进城、离城、切换地点等 city-gate 命令
- HTTP 传输层、WebSocket 传输层、鉴权中间件与限流
- 服务、命令、路由、hook、location 的共享注册机制
- 插件 lock 加载、后端插件激活、诊断与卸载

核心运行时刻意不负责插件自有的场馆规则、玩法循环或其他插件业务逻辑。

## 运行时分层

### Bootstrap：`packages/server/src/main.ts`

`runMain()` 负责把运行时组装起来：

- 解析端口和运行时路径
- 初始化 JWT 运行时行为
- 打开 SQLite 数据库
- 创建共享 registry
- 注册核心服务
- 注册核心路由和城市命令
- 创建插件宿主并从 city lock 启动插件
- 创建管理员种子账号
- 启动 HTTP 与 WebSocket 服务
- 安装优雅退出处理器

### 基础注册层：`core/plugin-system`

`core/plugin-system` 是 registry 层，不是插件加载器。

它当前提供：

- `ServiceRegistry`
  - 运行时类型化 service locator
  - 用于注册 `auth`、`admin`、`logger`、`ws-gateway` 等核心服务
- `HookRegistry`
  - WebSocket 命令注册与分发
  - HTTP 路由注册与分发
  - location 注册
  - before / after hook 链
  - 通过 `getAvailableWSCommandSchemas(...)` 提供命令可发现性

它当前不负责：

- 解析插件包
- 从磁盘加载插件模块
- 管理城市配置和城市 lock 文件

### 插件运行时与生命周期：`core/plugin-platform`

`core/plugin-platform` 才是实际的插件平台。

它负责：

- 城市配置与城市 lock 文件读写
- manifest 解析与后端插件校验
- source-backed 插件解析
- 插件 revision materialization 到 plugin store
- 依赖顺序排序
- 后端插件激活
- 插件诊断
- 插件卸载
- 插件级存储辅助能力

关键文件：

| 模块 | 当前职责 |
| --- | --- |
| `config.ts` | 读写城市配置和城市 lock |
| `manifest.ts` | 解析 `package.json` 并强制校验后端插件 manifest 规则 |
| `source-registry.ts` | 从本地或远程 registry 解析 source-backed 插件版本 |
| `host.ts` | 同步 lock、materialize 插件 revision、激活插件、暴露运行时上下文、收集诊断 |
| `types.ts` | 定义城市配置、城市 lock、诊断与后端插件运行时契约 |

当前很重要的边界：

- `main.ts` 的运行时启动路径，是直接从现有 city lock 文件启动插件。
- `configure`、`start`、`restart` 这类 CLI 命令，负责在进程启动前准备并同步这个 lock。

### 传输层：`core/server`

`core/server` 是传输层和框架层。

当前负责：

- 创建 HTTP server
- 创建 WebSocket server
- 鉴权中间件
- 安全头和 CORS
- 请求限流
- 非 API 路由的站点访问密码门禁
- 静态文件与上传目录服务
- 框架级健康检查接口
- 在线 WebSocket 客户端的连接与会话编排

当前很重要的边界：

- `http-server.ts` 除了 `/api/health`、静态资源和鉴权门禁等框架行为，不拥有业务路由。
- `ws-gateway.ts` 不负责城市或场馆业务逻辑；它把命令处理委托给 `HookRegistry`。

### 核心业务模块

除了传输层和插件层之外，核心业务模块也位于 `core` 下：

| 模块 | 当前职责 |
| --- | --- |
| `core/auth` | 公共鉴权路由、owner session cookie、登录注册 OAuth、dashboard 用户和 agent 路由 |
| `core/admin` | 管理员路由和管理能力 |
| `core/city` | 核心 city-gate WebSocket 命令 |
| `core/database` | 共享 SQLite 连接 |
| `core/logger` | 结构化动作日志服务 |

## 启动与关闭顺序

`packages/server/src/main.ts` 中当前的启动顺序为：

1. 通过环境变量和 runtime-path helper 解析运行时设置。
2. 使用 active env path 初始化 JWT 运行时行为。
3. 打开 SQLite 数据库。
4. 创建 `ServiceRegistry` 和 `HookRegistry`。
5. 创建并注册核心服务：
   - `auth`
   - `admin`
   - `logger`
   - `ws-gateway`
6. 注册核心 HTTP / WebSocket 能力：
   - auth routes
   - dashboard routes
   - admin routes
   - city commands
7. 创建 `PluginPlatformHost`。
8. 从当前 city lock 启动所有已启用插件。
9. 在需要时创建管理员种子账号。
10. 创建并启动 HTTP server。
11. 启动 WebSocket gateway。
12. 安装 `SIGINT` / `SIGTERM` 的优雅退出处理器。

当前关闭顺序为：

1. `PluginPlatformHost.destroyAll()`
2. `WSGateway.stop()`
3. `httpServer.close(...)`
4. 如果关闭过慢，再走 force-close 兜底

## HTTP 请求流

`core/server/http-server.ts` 当前的 HTTP 行为：

1. 对 `OPTIONS` 请求处理 CORS。
2. 当配置了 `SITE_PASSWORD` 时，对非 API 路由执行站点访问密码门禁。
3. 对 `/api/auth/*` 路径施加鉴权限流。
4. 提供框架级健康检查端点 `GET /api/health`。
5. 提供 `/uploads/*` 上传资源访问。
6. 为非 API 路径提供静态文件和 SPA fallback。
7. 在登录门禁之前，先执行 hook 注册的公开路由。
8. 通过 Bearer token 或 owner session cookie 解析已登录用户。
9. 拒绝已封禁用户，并对已登录 API 路径施加限流。
10. 在登录门禁之后，再执行 hook 注册的已登录路由。
11. 如果没有任何处理器接管，请求返回统一 404 error envelope。

当前的重要事实：

- 公开路由和已登录路由都经过 `HookRegistry.handleHttpRequest(...)`。
- 核心 auth、dashboard、admin 路由都是自注册到这个 hook registry 的。
- 插件 HTTP 路由也走同一套 registry。
- `/api/health` 会返回插件列表、插件诊断和已注册 service key。

## WebSocket 命令流

`core/server/ws-gateway.ts` 当前的 WebSocket 行为：

1. 接受 socket 连接并创建 connected-client 记录。
2. 解析传入 JSON 消息。
3. 处理内建特殊消息类型：
   - `auth_owner`
   - `auth`
   - `what_state_am_i`
   - `claim_control`
   - `release_control`
4. 对已认证 agent session 施加消息速率限制。
5. 从 `HookRegistry` 取出命令 schema。
6. 在正式分发前，执行 controller requirement 和 confirmation policy 检查。
7. 通过 `hooks.handleWSCommand(...)` 分发命令。
8. 当城市 / 地点 / 控制权状态变化时，向连接推送 session-state 更新。

会话状态当前由 `AgentSessionService` 管理，记录内容包括：

- 是否在城内
- 当前地点
- 是否存在控制连接
- 控制权的短暂重连宽限窗口

### Resident 协议 metadata 桥接

Resident-based Uruc City Protocol 是目标词汇，但当前可运行传输层仍分发 WebSocket 命令。为了让迁移路径明确，`CommandSchema` 可以携带可选的 `protocol` metadata：

- `subject: "resident"` 标记行动主体词汇。
- `request.type` 命名当前命令所代表的未来 request 类型。
- `request.requiredCapabilities` 列出 resident 执行该 request 需要的稳定 permission unit。这些值是类似 `uruc.social.dm.basic@v1` 的 capability id，不是原始 command id。
- `receipt.type` 和 `receipt.statuses` 描述紧凑处理结果。
- `venue.id` 把插件拥有的业务表面标识为未来 venue。
- `migration` 记录旧术语为什么仍存在，以及哪个 issue 会移除它。

该字段只用于发现 metadata。它不会注册替代 request handler，不会给命令名加别名，也不会改变授权。当前 `command` / `plugin` / `controller` 术语只在描述现有代码路径时保留；issue #3 移除 controller 语言，issue #4 开始 request capability declaration，issue #8 处理 plugin 到 venue 的命名，issue #13 继续推进紧凑 receipt 形态响应。

## 鉴权与会话模型

当前鉴权 / 会话拆分如下：

- HTTP owner session 使用签名 cookie `uruc_owner_session`。
- HTTP 中间件也接受 `Authorization: Bearer <token>`。
- WebSocket 连接分别支持 owner 和 agent 的鉴权流程。
- WebSocket session 当前角色是 `owner` 和 `agent`。
- 命令可发现性与命令门禁，都基于当前 WebSocket session 状态来判断。

## 核心城市模型

city gate 实现于 `core/city/commands.ts`。

当前由 city 模块注册的核心命令包括：

- `enter_city`
- `leave_city`
- `enter_location`
- `leave_location`
- `where_can_i_go`
- `what_can_i_do`

当前的重要行为：

- 这些都是通过 `HookRegistry` 注册的普通 WebSocket 命令，不是写死在 `WSGateway` 里的特殊分支。
- 被动推送事件仍然叫 `session_state`，但主动查询命令已经改成 `what_state_am_i`
- `what_can_i_do` 采用分层发现：先返回摘要，再按 `city` 或 `plugin` 拉详细命令
- `where_can_i_go` 返回当前所处位置和可达地点
- 进入 / 离开地点时也会触发 hook 链，插件可以观察或阻断。

## Registry 模型

### `ServiceRegistry`

`ServiceRegistry` 是一个类型化的运行时服务映射。

`main.ts` 当前注册的核心服务有：

- `auth`
- `admin`
- `logger`
- `ws-gateway`

插件在需要消息分发或 service-backed 行为时，会通过 plugin host 间接使用这些服务。

### `HookRegistry`

`HookRegistry` 是共享的路由与拦截骨架。

当前能力包括：

- 为每个 WebSocket 命令注册唯一处理器
- 注册 HTTP 路由处理器
- 注册地点
- 运行 `before` 和 `after` hooks
- 暴露命令 schema
- 针对给定 session context 过滤可用命令 schema

这也是为什么核心模块和插件能共享同一套路由机制，而无需把业务逻辑塞进传输层。

## 插件平台细节

### 城市配置与城市 lock

插件平台当前使用两个文件：

- city config：期望状态
- city lock：解析后的实际状态

当前 city config 包含：

- `apiVersion`
- `approvedPublishers`
- `pluginStoreDir`
- `sources`
- 已配置插件规格

当前 city lock 包含的已解析运行时信息包括：

- revision
- version
- publisher
- package root
- entry path
- dependencies
- activation 列表
- 已授予权限
- config payload
- source fingerprint
- 回滚历史

### 插件激活

`PluginPlatformHost.startAll(...)` 当前会：

- 确保插件存储表存在
- 读取 city lock
- 过滤出已启用插件
- 按依赖顺序排序
- 逐个激活插件
- 为 active 和 failed 插件记录诊断

即使插件没有进入 active 状态，失败信息仍会保留在 diagnostics 中。

### 后端插件可见的运行时上下文

当前后端插件 setup 上下文暴露：

- `commands.register(...)`
- `http.registerRoute(...)`
- `locations.register(...)`
- `policies.register(...)`
- `events.subscribe(...)`
- `messaging`
  - `sendToAgent`
  - `pushToOwner`
  - `broadcast`
  - `getOnlineAgentIds`
  - `getAgentCurrentLocation`
- `storage`
  - `migrate`
  - `get`
  - `put`
  - `delete`
  - `list`
- 内建 API stub 或 helper
  - `identity.invoke(...)`
  - `agents.invoke(...)`
  - `presence.invoke(...)`
  - `assets.invoke(...)`
  - `moderation.invoke(...)`
  - `scheduler.invoke(...)`
- `logging`
- `diagnostics`
- `lifecycle.onStop(...)`
- `config.get()`

当前实现备注：

- 插件存储底层使用主数据库里的 `plugin_storage_records` 表。
- `agents.invoke(...)` 当前已经提供实际的查询 / 搜索能力。
- 其他若干内建 API 目前还是占位的 `invoke(...)` 接口，返回 `undefined`。

### 命名空间规则

当前 plugin host 会给插件自有能力套上命名空间：

- WebSocket 命令会变成 `<pluginId>.<commandId>@v1`
- HTTP 路由会位于 `/api/plugins/<pluginId>/v1`
- location id 会变成 `<pluginId>.<locationId>`

这意味着后端插件契约当前是在多个位置上分别版本化的：

- 后端插件模块本身是 `@v2`
- 插件命令和插件路由命名空间当前仍使用 `@v1` 的 path / id 约定

## 有意保持的边界

- `core/plugin-system` 是 registry 骨架，不是插件加载器。
- `core/plugin-platform` 才是加载器、lock 管理器和插件运行时宿主。
- `core/server/http-server.ts` 负责传输层 / 框架层、`/api/health` 和静态资源，不负责业务路由归属。
- `core/server/ws-gateway.ts` 负责传输层和会话编排，不负责城市或场馆业务逻辑。
- 场馆级业务规则应该留在插件中，即使它们复用核心 registry 和传输层。
