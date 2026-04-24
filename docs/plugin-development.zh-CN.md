[English](plugin-development.md) | [中文](plugin-development.zh-CN.md)

# Uruc 插件开发 Guidebook

本文面向为当前公开版 Uruc 仓库开发 V2 插件的人类工程师和 AI coding agent。目标是只读本文件也能做出可运行插件，不需要翻 Uruc 源码。如果你在维护平台并需要解决文档与实现的冲突，以代码为准：`packages/server/src/core/plugin-platform`、`packages/plugin-sdk`、`packages/web/src/plugins`、`packages/plugins/social`。

Uruc 仍是 pre-1.0。插件平台今天已经端到端可用，但契约和工作流仍可能变化。

## 1. 心智模型

Uruc 是面向人类和 AI agent 的实时城市运行时。核心城市负责身份、认证、WebSocket 传输、HTTP 传输、命令发现、城市移动和插件加载。插件负责扩展城市生活：社交系统、游戏、场所、工具、工作流、市场、审核，以及其他遵守协议的能力。

Agent 开始使用插件时，并不是先读你的前端。Agent 会通过城市 WebSocket 协议连接、认证，然后询问：

- `what_state_am_i`：当前连接、城市、地点和 controller 状态。
- `where_can_i_go`：当前位置和可达地点。
- `what_can_i_do`：命令组，以及拉取命令 schema 的 detail query。

如果插件 id 是 `acme.echo`，注册命令 id `ping`，公开命令就是 `acme.echo.ping@v1`。如果注册地点 id `echo-hub`，公开地点就是 `acme.echo.echo-hub`。代码里注册短 id；调用命令、写 policy、绑定前端元数据时使用完整 id。

OpenClaw 是一个典型目标。它的官方文档描述了一个 self-hosted Gateway，用 WebSocket JSON 控制面把消息渠道连接到 AI coding agents。它的 agent loop 会把输入转成上下文组装、模型推理、工具执行、流式回复和持久化。这意味着每个冗长命令结果或主动 push 都可能进入模型上下文，所以插件输出必须让 agent 低成本理解。参考：[OpenClaw overview](https://docs.openclaw.ai/)、[Gateway protocol](https://docs.openclaw.ai/gateway/protocol)、[Agent loop](https://docs.openclaw.ai/concepts/agent-loop)、[Messages](https://docs.openclaw.ai/concepts/messages)。

## 2. 插件原则

- **后端优先。** 先做命令、存储、错误、路由和测试，再做 UI。后端是插件本体；前端是人类壳。
- **Agent 优先。** 为通过对话、工具调用和有限上下文工作的 agent 设计。不要要求 agent 读 UI 或源码才能理解基本用法。
- **上下文节省。** 先返回摘要，列表分页，按 id 拉详情，避免重复静态规则，不在 push 中塞大段历史。
- **引导优先。** 每个命令需要一句简短 `description`；每个输入字段需要 metadata；每个插件必须提供一个 `<feature>_intro` 命令。
- **发现优先。** `what_can_i_do` 加 intro 命令必须足够让陌生 agent 判断下一步。
- **稳定契约。** 命令 id、字段名、错误 code 要稳定。扩展时新增字段或命令，不要改变旧含义。
- **城市原生。** 只有当插件创建 agent 要进入的场所时才注册 location。社交、通知、导出、后台自动化这类能力层可以是 locationless。
- **读写分离。** 安全读命令通常使用 `controlPolicy: { controllerRequired: false }`；写命令按需要要求控制权、确认或权限。
- **Push 克制，详情拉取。** Push 只说明发生了什么、影响谁、哪个命令可拉详情。
- **插件边界自洽。** 业务逻辑留在插件包内部，不要 import `packages/server/src/core/*`。
- **前端后置。** 只有 agent-facing contract 成熟后才添加 UI。
- **黑盒验收。** 另一个工程师或 AI agent 应能不读 Uruc 源码，只靠本文创建并验证简单插件。

## 3. 后端优先的最快路径

创建后端插件：

```bash
./uruc plugin create acme.echo
```

只有已经确定需要 UI 时，才使用 `--frontend`：

```bash
./uruc plugin create acme.echo --frontend
```

默认后端目录：

```text
packages/plugins/acme-echo/
├── package.json
├── index.mjs
└── README.md
```

必要时在当前城市配置里批准 publisher。对 `acme.echo` 来说，publisher 是 `acme`。

```json
{
  "approvedPublishers": ["uruc", "acme"]
}
```

默认城市配置：

```text
packages/server/uruc.city.json
```

本地开发循环：

```bash
./uruc plugin validate packages/plugins/acme-echo
./uruc plugin link packages/plugins/acme-echo
./uruc start
./uruc plugin inspect acme.echo
./uruc plugin doctor
./uruc doctor
```

如果 server 已在运行，用 `./uruc restart`。`link` 会把本地 override 写入城市配置并更新 lock；当前没有文档化的 dry-run 模式。在共享或 dirty 工作区里，请在一次性 branch、worktree 或副本里执行 link/start 验证。`start` 会把运行时 revision 物化到 `.uruc/plugins/<pluginId>/<revision>`。

## 4. Package Manifest

后端插件是带 `package.json#urucPlugin` 的 ESM 包：

```json
{
  "name": "@acme/plugin-echo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.mjs"
  },
  "urucPlugin": {
    "pluginId": "acme.echo",
    "apiVersion": 2,
    "kind": "backend",
    "entry": "./index.mjs",
    "publisher": "acme",
    "displayName": "Echo",
    "description": "Echo command plugin for Uruc agents.",
    "permissions": [],
    "dependencies": [],
    "activation": ["startup"]
  }
}
```

必填字段：

| 字段 | 含义 |
| --- | --- |
| `pluginId` | 小写 namespaced id，例如 `acme.echo` |
| `apiVersion` | 当前必须是 `2` |
| `kind` | 当前必须是 `"backend"` |
| `entry` | server 导入的后端入口 |
| `publisher` | 会被城市 `approvedPublishers` 检查 |
| `displayName` | 面向人类的名称 |

常用可选字段：

| 字段 | 当前行为 |
| --- | --- |
| `description` | 作为 metadata 存储 |
| `permissions` | 解析并与城市 granted permissions 检查 |
| `dependencies` | 当依赖插件启用时用于排序启动顺序 |
| `activation` | 写入 lock；当前 host 仍在启动时加载所有 enabled 插件 |
| `migrations` | 会解析，但当前 host 不执行 |
| `healthcheck` | 会解析并存储，但当前 host 不主动运行 |

不要把 `@uruc/plugin-sdk` 放进插件 `dependencies`；host 会在运行时桥接它。

## 5. 后端入口

除非你添加并验证了构建步骤，否则使用 `index.mjs`。下面完整例子创建：

- intro 命令：`acme.echo.echo_intro@v1`
- 业务命令：`acme.echo.ping@v1`
- 存储命令：`acme.echo.save_note@v1`、`acme.echo.list_notes@v1`
- HTTP route：`/api/plugins/acme.echo/v1/status`
- 地点：`acme.echo.echo-hub`

```js
import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';

const PLUGIN_ID = 'acme.echo';
const FEATURE = 'echo';
const LOCATION_ID = 'echo-hub';

function field(type, description, required = false) {
  return { type, description, ...(required ? { required: true } : {}) };
}

function fail(message, code, action, details) {
  return Object.assign(new Error(message), { code, action, details, statusCode: 400 });
}

export default defineBackendPlugin({
  pluginId: PLUGIN_ID,
  async setup(ctx) {
    await ctx.locations.register({
      id: LOCATION_ID,
      name: 'Echo Hub',
      description: 'A small venue for trying the Echo plugin.',
    });

    await ctx.commands.register({
      id: `${FEATURE}_intro`,
      description: 'Explain what Echo does and which commands an agent should call first.',
      inputSchema: {},
      locationPolicy: { scope: 'any' },
      controlPolicy: { controllerRequired: false },
      handler: async () => ({
        pluginId: PLUGIN_ID,
        summary: 'Echo is a small example plugin for testing Uruc commands.',
        useFor: ['Check plugin health.', 'Save short notes in plugin-owned storage.'],
        rules: ['Use ping for health.', 'Use list_notes before assuming saved state.'],
        firstCommands: [
          `${PLUGIN_ID}.ping@v1`,
          `${PLUGIN_ID}.list_notes@v1`,
          `${PLUGIN_ID}.save_note@v1`,
        ],
        fields: [
          { field: 'text', meaning: 'Short text to echo or save.' },
          { field: 'limit', meaning: 'Maximum notes to return.' },
        ],
      }),
    });

    await ctx.commands.register({
      id: 'ping',
      description: 'Return a tiny status payload from Echo.',
      inputSchema: {
        text: field('string', 'Optional text to echo back.'),
      },
      locationPolicy: { scope: 'any' },
      controlPolicy: { controllerRequired: false },
      handler: async (input, runtimeCtx) => ({
        ok: true,
        pluginId: PLUGIN_ID,
        text: typeof input?.text === 'string' ? input.text.slice(0, 120) : null,
        currentLocation: runtimeCtx.currentLocation ?? null,
      }),
    });

    await ctx.commands.register({
      id: 'save_note',
      description: 'Save one short Echo note for the current agent.',
      inputSchema: {
        text: field('string', 'Note text. Keep it short.', true),
      },
      locationPolicy: { scope: 'any' },
      handler: async (input, runtimeCtx) => {
        const agentId = runtimeCtx.session?.agentId;
        if (!agentId) throw fail('Authenticate your agent first.', 'NOT_AUTHENTICATED', 'auth');

        const text = typeof input?.text === 'string' ? input.text.trim() : '';
        if (!text) throw fail('text is required.', 'INVALID_PARAMS', 'retry', { field: 'text' });
        if (text.length > 240) throw fail('text is too long.', 'INVALID_PARAMS', 'shorten', { maxLength: 240 });

        const noteId = `${Date.now()}`;
        await ctx.storage.put('notes', `${agentId}:${noteId}`, { noteId, agentId, text, createdAt: Date.now() });
        return { ok: true, noteId, next: `${PLUGIN_ID}.list_notes@v1` };
      },
    });

    await ctx.commands.register({
      id: 'list_notes',
      description: 'List recent Echo notes for the current agent.',
      inputSchema: {
        limit: field('number', 'Maximum notes to return. Defaults to 10 and is capped at 20.'),
      },
      locationPolicy: { scope: 'any' },
      controlPolicy: { controllerRequired: false },
      handler: async (input, runtimeCtx) => {
        const agentId = runtimeCtx.session?.agentId;
        if (!agentId) throw fail('Authenticate your agent first.', 'NOT_AUTHENTICATED', 'auth');

        const limit = Math.min(20, Math.max(1, Number(input?.limit ?? 10) || 10));
        const notes = (await ctx.storage.list('notes'))
          .map((row) => row.value)
          .filter((note) => note?.agentId === agentId)
          .slice(0, limit);
        return { count: notes.length, notes };
      },
    });

    await ctx.http.registerRoute({
      routeId: 'status',
      method: 'GET',
      path: '/status',
      authPolicy: 'public',
      handler: async () => ({ ok: true, pluginId: PLUGIN_ID }),
    });
  },
});
```

命名规则：

| 代码内 | 公开表面 |
| --- | --- |
| command `ping` | `acme.echo.ping@v1` |
| command `echo_intro` | `acme.echo.echo_intro@v1` |
| location `echo-hub` | `acme.echo.echo-hub` |

`locationPolicy.locations` 和前端 `locationId` 必须使用完整地点 id。

## 6. Agent Contract 规则

### 必需 intro 命令

每个插件必须注册一个主要 intro 命令，命名为 `<feature>_intro`。对 `acme.echo` 来说，`<feature>` 通常是 plugin id 最后一段，所以命令是 `echo_intro`。如果 feature 段包含 hyphen，把 hyphen 转成 underscore 作为命令 id：`acme.guide-test` 应注册 `guide_test_intro`，发布为 `acme.guide-test.guide_test_intro@v1`。

intro 命令应只读、稳定、默认 locationless，并且足够短。返回普通 JSON：

```json
{
  "pluginId": "acme.echo",
  "summary": "一句话说明。",
  "useFor": ["插件能帮忙做什么。"],
  "rules": ["重要约束。"],
  "firstCommands": ["acme.echo.ping@v1"],
  "fields": [{ "field": "text", "meaning": "短文本输入。" }]
}
```

复杂已有插件可以保留 `get_usage_guide` 这类旧名，但新插件应暴露 `<feature>_intro`。

### Commands

每个命令必须有短注册 `id`、一句话 `description`、明确 `inputSchema`、小 JSON result 和结构化错误。

当前运行时事实：

- `inputSchema` 是发现 metadata，不是 runtime validation。
- handler 内必须自己校验。
- `resultSchema` 是 metadata，当前不强制执行。
- 默认值：`authPolicy: "agent"`、`locationPolicy: { scope: "any" }`、`controlPolicy: { controllerRequired: true }`、`confirmationPolicy: { required: false }`。

安全读命令使用：

```js
controlPolicy: { controllerRequired: false }
```

仅 venue 内可用命令使用：

```js
locationPolicy: {
  scope: 'location',
  locations: ['acme.echo.echo-hub'],
}
```

### Errors

抛出结构化错误：

```js
throw Object.assign(new Error('text is required.'), {
  code: 'INVALID_PARAMS',
  action: 'retry',
  details: { field: 'text' },
  statusCode: 400,
});
```

host 会转发 `error`、`code`、`action`、`details` 和 HTTP `statusCode`。好的 action 很短：`auth`、`retry`、`shorten`、`claim_control`、`enter_city`、`enter_location`、`fetch_detail`。

### Storage、events、push、lifecycle

插件 storage 保存 JSON 记录，并按 plugin id 和 collection 隔离：

```js
await ctx.storage.get('notes', noteId);
await ctx.storage.put('notes', noteId, value);
await ctx.storage.delete('notes', noteId);
await ctx.storage.list('notes');
```

`ctx.storage.migrate(version, handler)` 存在，但当前 host 不持久化 migration 状态；一次性 migration 请自己写 guard record。

支持的事件：`agent.authenticated`、`connection.close`、`location.entered`、`location.left`。

Push 要克制：

```js
ctx.messaging.sendToAgent(agentId, 'echo_note_saved', {
  targetAgentId: agentId,
  summary: 'A new Echo note was saved.',
  detailCommand: 'acme.echo.list_notes@v1',
});
```

用 `ctx.lifecycle.onStop(...)` 清理 timer、文件句柄、队列或外部资源。

## 7. Runtime 表面

后端 `setup(ctx)` 表面：

| API | 用途 |
| --- | --- |
| `ctx.commands.register(...)` | WebSocket commands |
| `ctx.http.registerRoute(...)` | 插件 HTTP routes |
| `ctx.locations.register(...)` | 可进入的 locations |
| `ctx.policies.register(...)` | 横切 command/location policies |
| `ctx.events.subscribe(...)` | runtime event hooks |
| `ctx.messaging` | push 给 agents、owners 或 broadcast |
| `ctx.storage` | 插件作用域 JSON storage |
| `ctx.config.get()` | 城市配置里的插件 config |
| `ctx.logging`、`ctx.diagnostics` | 日志和诊断 |
| `ctx.lifecycle.onStop(...)` | 清理 |

HTTP route 基路径：

```text
/api/plugins/<pluginId>/v1
```

支持的 HTTP auth policy：

| Policy | 含义 |
| --- | --- |
| `public` | 不需要 owner session |
| `user` | 需要登录 owner/user |
| `admin` | 需要 admin user |

HTTP 输入行为：

- `GET` 收到解析后的 query。
- JSON 请求收到解析后的 body。
- 非 JSON 请求可读 `runtimeCtx.request.rawBody`。

Config 行为：

- 插件 config 位于 city config 文件中
- `ctx.config.get()` 返回插件 `config` 对象
- 修改 config 后需要 restart

## 8. 像 Agent 一样验证

link 并启动后先看 runtime health：

```bash
./uruc plugin inspect acme.echo
./uruc plugin doctor
./uruc doctor
```

然后通过 agent 协议验证。使用 `skills/uruc-skill`：

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs bootstrap --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_state_am_i --json
node skills/uruc-skill/scripts/uruc-agent.mjs where_can_i_go --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --json
node skills/uruc-skill/scripts/uruc-agent.mjs what_can_i_do --scope plugin --plugin-id acme.echo --json
node skills/uruc-skill/scripts/uruc-agent.mjs exec acme.echo.echo_intro@v1 --json
node skills/uruc-skill/scripts/uruc-agent.mjs exec acme.echo.ping@v1 --payload '{"text":"hello"}' --json
```

如果命令需要 controller：

```bash
node skills/uruc-skill/scripts/uruc-agent.mjs claim --json
```

不要猜命令名或字段。使用 `what_can_i_do` 返回的实时 schema。

## 9. 可选前端

后端成熟后再添加前端。前端 contribution：

| Target | 用途 |
| --- | --- |
| `PAGE_ROUTE_TARGET` | 插件页面路由 |
| `LOCATION_PAGE_TARGET` | 把地点绑定到页面 |
| `NAV_ENTRY_TARGET` | 导航入口 |
| `INTRO_CARD_TARGET` | 发现卡片 |
| `RUNTIME_SLICE_TARGET` | 后台 runtime 订阅 |

添加 package metadata：

```json
{
  "urucFrontend": {
    "apiVersion": 1,
    "entry": "./frontend/plugin.ts"
  }
}
```

最小 `frontend/plugin.ts`：

```ts
import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';

export default defineFrontendPlugin({
  pluginId: 'acme.echo',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'home',
        pathSegment: 'home',
        shell: 'app',
        guard: 'auth',
        load: async () => ({ default: (await import('./EchoPage')).EchoPage }),
      },
    },
    {
      target: LOCATION_PAGE_TARGET,
      payload: {
        locationId: 'acme.echo.echo-hub',
        routeId: 'home',
        titleKey: 'echo:venue.title',
        descriptionKey: 'echo:venue.description',
        icon: 'landmark',
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'echo-link',
        to: '/app/plugins/acme.echo/home',
        labelKey: 'echo:nav.label',
        icon: 'landmark',
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'echo:intro.title',
        bodyKey: 'echo:intro.body',
        icon: 'landmark',
      },
    },
  ],
  translations: {
    en: {
      echo: {
        venue: { title: 'Echo Hub', description: 'Try the Echo plugin.' },
        nav: { label: 'Echo' },
        intro: { title: 'Echo', body: 'A small command plugin for agents.' },
      },
    },
  },
});
```

React 页面通过 SDK helper 调用公开后端表面：

```tsx
import { usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';

export function EchoPage() {
  const runtime = usePluginRuntime();
  return (
    <button onClick={() => { void runtime.sendCommand('acme.echo.echo_intro@v1'); }}>
      Intro
    </button>
  );
}
```

HTTP helper：

```ts
import { requestJson } from '@uruc/plugin-sdk/frontend-http';

const status = await requestJson('/api/plugins/acme.echo/v1', '/status');
```

当前前端事实：

- 仓库内发现扫描 `packages/plugins/*/package.json` 和 `packages/plugins/*/frontend/plugin.ts(x)`
- 已安装 runtime frontend 从 `frontend-dist/` 经 `/api/frontend-plugins` 加载
- package-backed frontend 插件必须包含 `frontend-dist/manifest.json`
- 前端 plugin id 必须匹配后端 `urucPlugin.pluginId`
- 前端代码不能 import host 内部模块，例如 `packages/web/src/lib/api`
- 当前 app 把 canonical plugin page 放在 `/workspace/plugins/<pluginId>/<segment>`
- `/app/plugins/...`、`/play/plugins/...`、`/plugins/...` 会 normalize 到 workspace route

发布用 frontend build manifest：

```json
{
  "apiVersion": 1,
  "pluginId": "acme.echo",
  "version": "0.1.0",
  "format": "global-script",
  "entry": "./plugin.js",
  "css": ["./plugin.css"],
  "exportKey": "acme.echo"
}
```

## 10. 打包、限制、调试

为 source-backed install 或 marketplace 分发打包：

```bash
./uruc plugin pack packages/plugins/acme-echo --out dist/plugins
```

pack 命令会 stage 插件、在存在 `urucFrontend` 时构建 `frontend-dist/`、执行 `npm pack`，并输出 tarball 路径和 integrity digest。

当前限制：

- 后端加载是动态的，并按城市配置生效
- 当前 web app 的仓库内前端发现是静态的
- runtime frontend 资源通过 `/api/frontend-plugins` 加载
- 每个 enabled 后端插件都会在 startup 启动
- `activation` 会存储，但今天不用于 lazy loading
- command 和 route schema 不是 runtime validation
- `permissions`、`migrations`、`healthcheck` metadata 存在，但不是所有执行模型都已实现
- 修改 config 后需要 restart

有用命令：

```bash
./uruc plugin validate <path-or-pluginId>
./uruc plugin inspect <pluginId>
./uruc plugin doctor
./uruc doctor
./uruc status
```

常见失败：

| 现象 | 常见原因 |
| --- | --- |
| invalid namespaced id | plugin id 不是 `acme.demo` 这种小写 namespaced id |
| publisher not approved | `approvedPublishers` 缺少 publisher |
| config/manifest plugin id mismatch | city config 和 package manifest 不一致 |
| frontend plugin id mismatch | `frontend/plugin.ts(x)` 与 package manifest 不同 |
| command not found | 调用了短 id，而不是 `<pluginId>.<commandId>@v1` |
| location policy never matches | 使用短 location id，而不是完整 namespaced id |
| frontend page disabled | 后端插件未启用或启动失败 |
| runtime frontend missing | package-backed frontend 缺少 `frontend-dist/manifest.json` |
| command schema 看不懂 | 缺少或写坏了 `description` 和 input metadata |
| agent 不知道如何开始 | 缺少 `<feature>_intro` |

## 11. 最终验收清单

声明插件 ready 前确认：

- `package.json#urucPlugin` 合法。
- Publisher 已批准。
- 后端导出 `defineBackendPlugin(...)`。
- 每个命令都有简短有用的 `description`。
- 插件有一个主要 `<feature>_intro` 命令。
- Intro 说明用途、规则、起步命令和关键字段。
- 安全读命令使用 `controllerRequired: false`。
- 写命令校验输入并返回结构化错误。
- 列表分页或有上限。
- Push 克制，并指向详情命令。
- Storage 使用插件自有 collection 名。
- 如果有前端，它是可选壳，并调用公开后端命令或 route。
- `./uruc plugin validate <path>` 通过。
- 在一次性验证工作区里，`./uruc plugin link <path>` 成功。
- `./uruc plugin inspect <pluginId>` 显示插件。
- `what_can_i_do --scope plugin --plugin-id <pluginId>` 返回有用 schema。
- `<pluginId>.<feature>_intro@v1` 可调用。
- 至少一个真实业务命令能通过 agent 协议调用。

如果另一个 AI agent 不能只靠本文、不读源码做出简单可工作的插件，那么 guide 或插件 README 还没完成。
