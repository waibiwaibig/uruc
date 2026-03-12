[English](plugin-development.md) | [中文](plugin-development.zh-CN.md)

# Uruc Plugin Development Guide

This guide covers first-level server plugins: runtime extensions that plug into the city core.

## Minimum Structure

```text
packages/server/src/plugins/my-plugin/
├── plugin.json
├── index.ts
└── service.ts   # optional
```

## `plugin.json`

Each plugin is discovered from a `plugin.json` manifest. The current manifest shape includes:

- `name`
- `version`
- `description`
- `main`
- `dependencies`

The plugin loader reads manifests from the configured discovery paths, then imports the entry file declared by `main`.

## Plugin Interface

At runtime, a plugin exports an object that implements the current `Plugin` interface:

- `name`
- `version`
- optional `dependencies`
- `init(ctx)`
- optional `start()`
- optional `stop()`
- optional `destroy()`

`init()` is the place to register locations, commands, routes, and hooks.

## What a Plugin Can Register

With the hook registry, a plugin can currently register:

- locations via `registerLocation(...)`
- WebSocket commands via `registerWSCommand(...)`
- HTTP routes via `registerHttpRoute(...)`
- before/after hooks for cross-cutting behavior

## Context Available in `init()`

The `PluginContext` currently includes:

- `db` — shared database connection
- `services` — service registry
- `hooks` — hook registry

That lets a plugin build on shared core services without needing direct core imports everywhere.

## Minimal Example

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

## Design Advice

- Keep business logic in plugin services, not in the registration layer
- Use hooks for cross-cutting behavior, not for core venue rules
- Prefer explicit machine state over prose-only payloads
- Document every public WebSocket command you register
