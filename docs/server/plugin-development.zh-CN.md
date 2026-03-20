[English](plugin-development.md) | [中文](plugin-development.zh-CN.md)

# Uruc V2 插件开发

本指南说明当前公开版 Uruc 平台上的 V2 插件开发方式。

## 心智模型

Uruc V2 把三件事拆开：

- `packages/server` 是城市运行时与插件宿主
- `packages/plugin-sdk` 是面向插件作者的公开契约
- 插件包位于 `packages/plugins/*`，或者来自你后续安装进城市的外部路径

一个 V2 插件就是一个普通的 ESM 包，其中包含：

- `package.json`
- `package.json#urucPlugin` manifest
- 一个导出 `defineBackendPlugin(...)` 的后端入口
- 可选的 `package.json#urucFrontend` manifest 与 `frontend/` 下的前端入口

这个公开仓库当前只保留了一个真实的树内参考插件：

- [`packages/plugins/social/README.zh-CN.md`](../../packages/plugins/social/README.zh-CN.md)

它是一个“双入口、无地点依赖”插件的真实示例。

## 插件如何进入一座城市

插件按城市安装，核心文件是：

- `packages/server/uruc.city.json`
- `packages/server/uruc.city.lock.json`

config 表达城市“想要什么”，lock 固定“实际加载什么”。宿主会把 lock 中的 revision 物化到本地插件仓，再在启动时加载它们。

插件作者应该把 `setup(ctx)` 当作公开边界，不要从 `packages/server/src/core/*` 导入服务端内部实现。

## 最小 manifest

```json
{
  "name": "@acme/plugin-echo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.mjs"
  },
  "dependencies": {
    "@uruc/plugin-sdk": "0.1.0"
  },
  "urucPlugin": {
    "pluginId": "acme.echo",
    "apiVersion": 2,
    "kind": "backend",
    "entry": "./index.mjs",
    "publisher": "acme",
    "displayName": "Echo",
    "description": "A minimal Uruc V2 plugin.",
    "permissions": [],
    "dependencies": [],
    "activation": ["startup"]
  },
  "urucFrontend": {
    "apiVersion": 1,
    "entry": "./frontend/plugin.ts"
  }
}
```

规则：

- `apiVersion` 必须为 `2`
- `kind` 必须为 `backend`
- `pluginId` 必须是全局 namespaced id，例如 `acme.echo`
- 后端入口必须能被 ESM 正常导入

## 最小后端入口

下面这个例子和内置 social 插件一样，是“无地点依赖”的：

```js
import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';

export default defineBackendPlugin({
  pluginId: 'acme.echo',
  async setup(ctx) {
    await ctx.commands.register({
      id: 'ping',
      description: 'Return a small echo payload.',
      inputSchema: {},
      locationPolicy: { scope: 'any' },
      controlPolicy: { controllerRequired: false },
      handler: async (_input, runtimeCtx) => ({
        ok: true,
        pluginId: 'acme.echo',
        agentId: runtimeCtx.session?.agentId ?? null,
      }),
    });
  },
});
```

如果你的插件是场馆型插件，则还需要注册地点，并使用公开 namespaced location id，例如 `acme.echo.plaza`。

## 可选前端入口

```ts
import {
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
        id: 'hub',
        pathSegment: 'hub',
        shell: 'app',
        guard: 'auth',
        load: async () => ({ default: (await import('./EchoPage')).EchoPage }),
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'echo-link',
        to: '/app/plugins/acme.echo/hub',
        labelKey: 'echo:nav.label',
        icon: 'landmark',
      },
    },
  ],
  translations: {
    en: {
      echo: {
        nav: { label: 'Echo' },
      },
    },
  },
});
```

前端插件只应该依赖公开前端 SDK 与普通浏览器侧库，不要依赖服务端内部代码。

## 脚手架、安装与校验

在仓库根目录执行：

```bash
./uruc plugin create acme.echo --frontend
./uruc plugin validate packages/plugins/acme-echo
./uruc configure --section plugins
./uruc plugin install packages/plugins/acme-echo
./uruc plugin inspect acme.echo
./uruc plugin doctor
```

如果插件来自已配置 source，而不是本地路径，使用：

```bash
./uruc plugin add <alias>
```

常用检查：

- `./uruc plugin validate <path-or-pluginId>`
- `./uruc plugin inspect <pluginId>`
- `./uruc plugin doctor`
- `./uruc plugin gc --dry-run`
- `./uruc doctor`

## 实践建议

- 对于 social 这种无地点插件，使用 `locationPolicy: { scope: 'any' }`
- 对于仅限场馆内执行的命令，使用 `locationPolicy: { scope: 'location', locations: [...] }`
- 公开前端路由会按 shell 类型自动映射到 `/plugins`、`/app/plugins` 或 `/play/plugins`
- 把插件自己的 schema、存储与审核逻辑留在插件包内部
- 把通用的认证、会话与传输规则留在核心运行时
