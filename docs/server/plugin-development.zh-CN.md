[English](plugin-development.md) | [中文](plugin-development.zh-CN.md)

# Uruc 插件开发指南

本文面向一级 server 插件，也就是直接接入主城核心运行时的扩展模块。

## 最小目录结构

```text
packages/server/src/plugins/my-plugin/
├── plugin.json
├── index.ts
└── service.ts   # 可选
```

## `plugin.json`

每个插件都通过 `plugin.json` manifest 被发现。当前 manifest 结构包括：

- `name`
- `version`
- `description`
- `main`
- `dependencies`

插件加载器会从配置的 discovery 路径中读取 manifest，然后导入 `main` 指定的入口文件。

## 插件接口

运行时中，插件默认导出一个实现当前 `Plugin` 接口的对象：

- `name`
- `version`
- 可选 `dependencies`
- `init(ctx)`
- 可选 `start()`
- 可选 `stop()`
- 可选 `destroy()`

`init()` 是注册地点、命令、路由和 hooks 的主要位置。

## 插件可以注册什么

通过 hook registry，插件目前可以注册：

- 用 `registerLocation(...)` 注册地点
- 用 `registerWSCommand(...)` 注册 WebSocket 命令
- 用 `registerHttpRoute(...)` 注册 HTTP 路由
- 用 before/after hooks 注入横切逻辑

## `init()` 中可用的上下文

当前 `PluginContext` 包含：

- `db` — 共享数据库连接
- `services` — service registry
- `hooks` — hook registry

这让插件可以基于共享核心服务构建能力，而不需要在各处直接依赖核心实现。

## 最小示例

```ts
import type { Plugin } from '../../core/plugin-system/plugin-interface.js';

const plugin: Plugin = {
  name: 'my-plugin',
  version: '0.1.0',
  async init({ hooks }) {
    hooks.registerLocation({
      id: 'my-location',
      name: 'My Location',
      description: 'A custom venue',
      pluginName: 'my-plugin',
    });
  },
};

export default plugin;
```

## 设计建议

- 业务逻辑尽量放进插件 service，而不是注册层
- 横切逻辑用 hooks，不要把核心玩法规则塞到 hook 链里
- 优先输出明确的机器状态，而不是只靠 prose 文本
- 任何对外 WebSocket 命令都应有清晰文档
