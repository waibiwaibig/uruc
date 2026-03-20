[English](plugin-development.md) | [中文](plugin-development.zh-CN.md)

# Uruc V2 Plugin Development

This guide explains how to build a V2 plugin package for the current public Uruc platform.

## Mental Model

Uruc V2 separates three concerns:

- `packages/server` is the city runtime and plugin host
- `packages/plugin-sdk` is the public contract for plugin authors
- plugin packages live under `packages/plugins/*` or any external path you install into a city

A V2 plugin is a normal ESM package with:

- `package.json`
- a `package.json#urucPlugin` manifest
- a backend entry that exports `defineBackendPlugin(...)`
- optionally, a `package.json#urucFrontend` manifest and a frontend entry under `frontend/`

The checked-in public repo currently keeps one real in-tree reference package:

- [`packages/plugins/social/README.md`](../../packages/plugins/social/README.md)

That package is a good example of a dual-entry, locationless plugin.

## How Plugins Reach a City

Plugins are installed per city through:

- `packages/server/uruc.city.json`
- `packages/server/uruc.city.lock.json`

The config declares what the city wants. The lock pins concrete resolved revisions. The host materializes those revisions into the local plugin store and loads them at startup.

Plugin authors should treat `setup(ctx)` as the public runtime boundary. Do not import server internals from `packages/server/src/core/*`.

## Minimal Package Manifest

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

Rules:

- `apiVersion` must be `2`
- `kind` must be `backend`
- `pluginId` must be globally namespaced, for example `acme.echo`
- the backend entry must resolve to an ESM module

## Minimal Backend Entry

This example is intentionally locationless, like the built-in social plugin:

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

If your plugin is venue-style instead, also register locations and use namespaced public location ids such as `acme.echo.plaza`.

## Optional Frontend Entry

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

Frontend packages should depend only on the public frontend SDK and normal browser-side libraries. They should not reach into server internals.

## Scaffold, Install, and Validate

From the repository root:

```bash
./uruc plugin create acme.echo --frontend
./uruc plugin validate packages/plugins/acme-echo
./uruc configure --section plugins
./uruc plugin install packages/plugins/acme-echo
./uruc plugin inspect acme.echo
./uruc plugin doctor
```

When a plugin comes from a configured source instead of a local path, use:

```bash
./uruc plugin add <alias>
```

Useful checks:

- `./uruc plugin validate <path-or-pluginId>`
- `./uruc plugin inspect <pluginId>`
- `./uruc plugin doctor`
- `./uruc plugin gc --dry-run`
- `./uruc doctor`

## Practical Notes

- Use `locationPolicy: { scope: 'any' }` for locationless plugins like social-style consoles.
- Use `locationPolicy: { scope: 'location', locations: [...] }` for venue-only commands.
- Public frontend route paths are namespaced automatically under `/plugins`, `/app/plugins`, or `/play/plugins` depending on shell type.
- Keep plugin-owned schemas, storage, and moderation logic inside the plugin package.
- Keep cross-cutting auth, session, and transport concerns in the core runtime.
