[English](plugin-development.md) | [中文](plugin-development.zh-CN.md)

# Uruc Plugin Development

This guide explains how to build plugins for the current public Uruc repository.
It is written against the code that exists today in:

- `packages/server/src/core/plugin-platform`
- `packages/plugin-sdk`
- `packages/web/src/plugins`
- `packages/plugins/social`

If this document and the implementation diverge, the code is the source of truth.

This guide is written for both human developers and AI coding agents.

## 1. What a Plugin Is in This Repository

In the current codebase, a plugin is a normal ESM package with:

- a backend manifest in `package.json#urucPlugin`
- a backend entry file that the server can import
- optionally, frontend package metadata in `package.json#urucFrontend`
- optionally, a frontend entry under `frontend/plugin.ts` or `frontend/plugin.tsx`
- optionally, a published frontend build under `frontend-dist/`

There are two frontend loading paths:

- Backend plugin loading is dynamic and city-specific.
  - The server resolves plugins from `uruc.city.json` and `uruc.city.lock.json`.
  - A backend plugin can come from a local path or from a configured source registry.
- Frontend plugin discovery for in-repo development is static in the checked-in web app.
  - `packages/web` discovers frontend plugins from `packages/plugins/*/package.json` plus `packages/plugins/*/frontend/plugin.ts(x)`.
- Frontend plugin loading for installed marketplace artifacts is runtime-based.
  - `packages/server` serves `frontend-dist/` assets from the materialized plugin revision.
  - `packages/web` fetches `/api/frontend-plugins` and loads those installed plugin frontends at runtime.

The main in-tree example today is:

- `packages/plugins/social`

## 2. Fastest Working Path

The shortest path to a working plugin is to start from the built-in scaffold.

### Create a new plugin

```bash
./uruc plugin create acme.echo --frontend
```

Default output location:

- `packages/plugins/acme-echo`

Generated files:

- `package.json`
- `index.mjs`
- `README.md`
- `frontend/plugin.ts` when `--frontend` is used
- `frontend/PluginPage.tsx` when `--frontend` is used

### Approve your publisher if needed

The current plugin resolver checks `approvedPublishers` in the city config.

For example, if your plugin id is `acme.echo`, the publisher is `acme`.
If the active city config only approves `uruc`, local linking or source-backed install will fail until you add `acme`.

Current example city config:

- `packages/server/uruc.city.json`

Example edit:

```json
{
  "approvedPublishers": ["uruc", "acme"]
}
```

### Validate, link, and run during local development

```bash
./uruc plugin validate packages/plugins/acme-echo
./uruc plugin link packages/plugins/acme-echo
./uruc start
./uruc plugin inspect acme.echo
./uruc plugin doctor
./uruc doctor
```

Mental model for that flow:

- `packages/plugins/acme-echo` is your workspace source package
- `uruc plugin link ...` records a local override in the city config
- `uruc start` materializes the linked plugin into `.uruc/plugins/*` before boot

If you are developing against a running managed instance, use `./uruc restart` after backend changes.
The current start and restart paths automatically rebuild stale server and web assets before boot.

### Pack for the official marketplace

If you want the plugin to work through `uruc plugin install <pluginId|alias>` / source-backed installs, publish a packed artifact instead of raw source.

```bash
./uruc plugin pack packages/plugins/acme-echo --out dist/plugins
```

This command:

- stages the plugin package into a temporary directory
- builds `frontend-dist/` when `urucFrontend` is present
- runs `npm pack`
- prints the tarball path and `sha512-...` integrity digest

Upload that tarball to `uruk.life` and use the printed integrity in the source registry entry.

## 3. Recommended Package Layouts

### Backend-only plugin

```text
packages/plugins/acme-echo/
├── package.json
├── index.mjs
└── README.md
```

### Backend + frontend plugin

```text
packages/plugins/acme-echo/
├── package.json
├── index.mjs
├── README.md
└── frontend/
    ├── plugin.ts
    └── PluginPage.tsx
```

### Packed marketplace artifact

```text
package/
├── package.json
├── index.mjs
├── README.md
├── frontend/
│   ├── plugin.ts
│   └── PluginPage.tsx
└── frontend-dist/
    ├── manifest.json
    ├── plugin.js
    └── plugin.css
```

Use backend-only when the plugin only needs commands, routes, storage, or events.
Add frontend files when you want pages, nav entries, intro cards, or runtime slices in the web app.
For marketplace distribution, `frontend-dist/` must be present in the published artifact.

## 4. `package.json`

The scaffold generates a package like this:

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
    "description": "Echo plugin generated by uruc plugin create.",
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

### Required backend fields

| Field | Meaning |
| --- | --- |
| `urucPlugin.pluginId` | Lowercase namespaced plugin id such as `acme.echo` |
| `urucPlugin.apiVersion` | Must currently be `2` |
| `urucPlugin.kind` | Must currently be `"backend"` |
| `urucPlugin.entry` | Backend entry file the server imports |
| `urucPlugin.publisher` | Publisher name checked against city `approvedPublishers` |
| `urucPlugin.displayName` | Human-facing plugin name |

### Optional backend fields

| Field | Current behavior |
| --- | --- |
| `permissions` | Parsed and checked against granted permissions in city config |
| `dependencies` | Used to sort plugin startup order when dependent plugins are also enabled |
| `activation` | Stored in the lock file, but the current host still starts every enabled plugin during `startAll()` |
| `migrations` | Parsed from the manifest, but not executed by the current host |
| `healthcheck` | Parsed and stored in the lock file, but not actively run by the current host |

### Frontend metadata

`urucFrontend` is optional.

`urucFrontend` describes the source frontend entry used during development and packaging.

Current rules:

- `apiVersion` must currently be `1`
- `entry` should currently point to `./frontend/plugin.ts` or `./frontend/plugin.tsx`
- the checked-in frontend registry still only scans `packages/plugins/*/frontend/plugin.ts(x)`
- the frontend plugin id must match `package.json#urucPlugin.pluginId`
- `package.json dependencies` must not include `@uruc/plugin-sdk`; the host provides that bridge at runtime

### Published frontend build metadata

Marketplace artifacts with frontend UI must also include `frontend-dist/manifest.json`.

Current manifest shape:

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

The current runtime expects:

- `entry` and `css` to be relative to `frontend-dist/`
- `format` to be `"global-script"`
- the built script to assign the frontend plugin object into `window.__uruc_plugin_exports[exportKey]`
- shared host runtime globals to be consumed instead of bundling a separate React/plugin-sdk runtime

Current shared host frontend modules:

- `react`
- `react-dom`
- `react/jsx-runtime`
- `react/jsx-dev-runtime`
- `@uruc/plugin-sdk/frontend`
- `@uruc/plugin-sdk/frontend-react`
- `@uruc/plugin-sdk/frontend-http`
- `i18next`
- `react-i18next`
- `react-router-dom`
- `lucide-react`

## 5. Backend Plugin Development

### The simplest valid backend entry

```js
import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';

const PLUGIN_ID = 'acme.echo';
const LOCATION_ID = 'echo-hub';
const FULL_LOCATION_ID = `${PLUGIN_ID}.${LOCATION_ID}`;

export default defineBackendPlugin({
  pluginId: PLUGIN_ID,
  async setup(ctx) {
    await ctx.locations.register({
      id: LOCATION_ID,
      name: 'Echo Hub',
      description: 'A simple example location.',
    });

    await ctx.commands.register({
      id: 'ping',
      description: 'Return a small status payload.',
      inputSchema: {
        text: {
          type: 'string',
          description: 'Optional text to echo back.',
          required: false,
        },
      },
      locationPolicy: {
        scope: 'location',
        locations: [FULL_LOCATION_ID],
      },
      controlPolicy: {
        controllerRequired: false,
      },
      handler: async (input, runtimeCtx) => ({
        ok: true,
        pluginId: PLUGIN_ID,
        text: typeof input?.text === 'string' ? input.text : null,
        currentLocation: runtimeCtx.currentLocation ?? null,
      }),
    });

    await ctx.http.registerRoute({
      routeId: 'status',
      method: 'GET',
      path: '/status',
      authPolicy: 'public',
      handler: async () => ({
        ok: true,
        pluginId: PLUGIN_ID,
      }),
    });
  },
});
```

That one file creates three public surfaces:

- WebSocket command: `acme.echo.ping@v1`
- HTTP route: `/api/plugins/acme.echo/v1/status`
- Location id: `acme.echo.echo-hub`

### Important naming rule

Register backend commands and locations with short ids, not fully qualified ids.

Use these patterns:

- command registration id: `ping`
- location registration id: `echo-hub`

The host adds the plugin namespace for you.

Use fully qualified ids only when you refer to the public surface later:

- call command: `acme.echo.ping@v1`
- reference location in policies or frontend metadata: `acme.echo.echo-hub`

### What `setup(ctx)` can do

Current setup context surfaces:

| API | What it is for |
| --- | --- |
| `ctx.commands.register(...)` | Register WebSocket commands |
| `ctx.http.registerRoute(...)` | Register plugin HTTP routes |
| `ctx.locations.register(...)` | Register visitable locations |
| `ctx.policies.register(...)` | Register cross-cutting command or location policies |
| `ctx.events.subscribe(...)` | Subscribe to plugin host lifecycle/runtime events |
| `ctx.messaging` | Send pushes to agents or owners, or broadcast |
| `ctx.storage` | Store JSON records in plugin-owned collections |
| `ctx.logging` | Write plugin log lines |
| `ctx.diagnostics` | Emit plugin diagnostic messages |
| `ctx.lifecycle.onStop(...)` | Register cleanup logic |
| `ctx.config.get()` | Read the plugin config object from city config |

Additional helper surfaces currently exist:

- `ctx.agents.invoke(...)`
- `ctx.identity.invoke(...)`
- `ctx.presence.invoke(...)`
- `ctx.assets.invoke(...)`
- `ctx.moderation.invoke(...)`
- `ctx.scheduler.invoke(...)`

Current reality:

- `ctx.agents.invoke(...)` has real helper behavior today.
- The other helper surfaces currently exist, but the current host implementation returns `undefined` unless your runtime adds more behavior later.

### Commands

Backend commands are registered through `ctx.commands.register(...)`.

Current runtime facts:

- The host does not perform runtime validation for backend command input.
- `inputSchema` is currently metadata for discoverability and documentation.
- `resultSchema` is stored on the command schema, but is not runtime-enforced.
- Your handler receives `msg.payload` as-is.
- You must validate input inside the handler or in your own helper functions.

Useful current defaults:

| Field | Default |
| --- | --- |
| `authPolicy` | `agent` |
| `locationPolicy` | `{ scope: "any" }` |
| `controlPolicy` | `{ controllerRequired: true }` |
| `confirmationPolicy` | `{ required: false }` |

Location rules to remember:

- If you want a locationless command, use `locationPolicy: { scope: 'any' }`.
- If you want a venue-only command, use `scope: 'location'` and provide fully qualified location ids such as `acme.echo.echo-hub`.

### HTTP routes

Plugin HTTP routes are registered through `ctx.http.registerRoute(...)`.

Current route base path:

- `/api/plugins/<pluginId>/v1`

Example:

- registered path `/status`
- public path `/api/plugins/acme.echo/v1/status`

Supported current auth policies:

- `public`
- `user`
- `admin`

Current input behavior:

- `GET` routes receive parsed query parameters
- JSON requests use the parsed JSON body
- non-JSON requests can read raw bytes from `runtimeCtx.request.rawBody`

This is how the social plugin currently handles authenticated asset upload.

### Locations

Register plugin locations through `ctx.locations.register(...)`.

Current behavior:

- the host namespaces the public location id as `<pluginId>.<locationId>`
- the registered `name` and `description` become part of the shared city location list

Important rule:

- `ctx.locations.register({ id: 'echo-hub', ... })` publishes `acme.echo.echo-hub`
- `locationPolicy.locations` must use the full published id

### Events

Current event names supported by `ctx.events.subscribe(...)`:

- `agent.authenticated`
- `connection.close`
- `location.entered`
- `location.left`

Use these when the plugin needs to react to runtime state changes instead of waiting for direct commands.

### Storage

Plugin storage is backed by the main database table `plugin_storage_records`.

Current behavior:

- values are stored as JSON
- records are scoped by plugin id and collection name
- `list(collection)` returns records sorted by latest update

Current migration reality:

- `ctx.storage.migrate(version, handler)` exists
- the current host does not persist migration state
- it simply runs the handler

So if you need one-time migrations today, implement your own guard record in storage.

### Config

`ctx.config.get()` returns the plugin's `config` object from the active city config.

Current reality:

- there is no dedicated per-plugin config editor in the CLI today
- plugin config is edited in the city config file
- after editing config, restart the server so the plugin reloads with the new lock/runtime state

### Structured errors

For WebSocket commands and HTTP routes, the current host forwards structured error fields when you throw them.

Current useful fields:

- `message` or error text
- `code`
- `action`
- `details`
- `statusCode` for HTTP route status

Example:

```js
throw Object.assign(new Error('Missing text.'), {
  code: 'BAD_INPUT',
  action: 'retry',
  details: { field: 'text' },
  statusCode: 400,
});
```

## 6. Frontend Plugin Development

### Current discovery model

The checked-in web app discovers frontend plugins by statically scanning:

- `packages/plugins/*/package.json`
- `packages/plugins/*/frontend/plugin.ts`
- `packages/plugins/*/frontend/plugin.tsx`

That means:

- the frontend entry must live under `packages/plugins/<dir>/frontend/plugin.ts(x)` in this repository
- external backend plugins installed from arbitrary local paths or registries are not automatically bundled into the web app frontend

### Minimal frontend entry

```ts
import {
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
  ],
  translations: {
    en: {
      echo: {
        nav: { label: 'Echo' },
        venue: {
          title: 'Echo Hub',
          description: 'A simple plugin page.',
        },
      },
    },
  },
});
```

### Frontend contribution types

| Target | What it contributes |
| --- | --- |
| `PAGE_ROUTE_TARGET` | A plugin page route |
| `LOCATION_PAGE_TARGET` | Metadata that binds a location id to a page route |
| `NAV_ENTRY_TARGET` | A navigation item |
| `INTRO_CARD_TARGET` | A card shown in the intro/discovery surface |
| `RUNTIME_SLICE_TARGET` | A background runtime mount point |

### Canonical route paths

The current frontend registry generates canonical page paths from:

- plugin id
- route id or `pathSegment`
- shell

Current shell mapping:

| Shell | Canonical base path |
| --- | --- |
| `public` | `/plugins` |
| `app` | `/app/plugins` |
| `standalone` | `/play/plugins` |

Example:

- plugin id: `acme.echo`
- route id: `home`
- shell: `app`
- canonical path: `/app/plugins/acme.echo/home`

### Frontend validation rules

The frontend registry currently rejects or reports diagnostics for:

- invalid package metadata
- missing frontend entry
- frontend `pluginId` mismatch
- unsupported extension targets
- invalid payloads
- duplicate canonical routes
- duplicate aliases
- duplicate location ids
- location pages that reference a missing route id

### React helpers

Current public React helpers:

- `usePluginPage()`
- `usePluginRuntime()`
- `usePluginAgent()`
- `usePluginShell()`

Use `usePluginRuntime()` when a page needs to:

- send WebSocket commands
- check connection and location state
- enter or leave the city
- enter or leave locations

### Calling backend commands from the frontend

Use the fully qualified public command id:

```ts
const runtime = usePluginRuntime();
const result = await runtime.sendCommand('acme.echo.ping@v1', { text: 'hello' });
```

### Current runtime state and discovery helpers

The current frontend plugin runtime intentionally keeps session state small.

`runtime.refreshSessionState()` returns:

```ts
{
  connected: boolean;
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number;
}
```

Current implications:

- Session state no longer includes `availableCommands` or `availableLocations`.
- Core time is exposed as `citytime`, not `serverTimestamp`.
- If a frontend plugin needs command discovery, use `runtime.refreshCommands()`.
- If a frontend plugin needs location discovery, call the core command `where_can_i_go` through `runtime.sendCommand(...)`.

`runtime.refreshCommands()` now follows the hierarchical core discovery model:

- no argument returns grouped summary data such as `city` and plugin buckets
- `{ scope: 'city' }` returns detailed city and protocol command schemas
- `{ scope: 'plugin', pluginId: 'acme.echo' }` returns detailed command schemas for one plugin

That means frontend plugins should not assume that one state refresh returns a flat list of all currently available commands.

### Calling plugin HTTP routes from the frontend

Use the HTTP helper with the plugin base path:

```ts
import { requestJson } from '@uruc/plugin-sdk/frontend-http';

const basePath = '/api/plugins/acme.echo/v1';
const result = await requestJson(basePath, '/status');
```

### Frontend enablement

The current app only enables plugin UI when the backend health response reports that plugin as started.

So a frontend plugin can be bundled correctly and still appear disabled if:

- the backend plugin failed to start
- the backend plugin is not enabled in the active city

## 7. Current Development Realities

These are the current facts that matter during development:

- The backend contract is strict about `urucPlugin.apiVersion = 2` and `kind = "backend"`.
- The frontend package metadata is strict about `urucFrontend.apiVersion = 1`.
- Backend plugin loading is dynamic; frontend plugin discovery in the checked-in app is static.
- The current host starts every enabled backend plugin at startup.
- The current host does not lazy-load by `activation`.
- The current host does not runtime-validate command or route input schemas for you.
- The current host records permissions, migrations, and healthcheck metadata, but does not yet provide a full execution model for all of them.
- The current host does not hot-unload a plugin from an already running server process when you edit config files.

## 8. Debugging Checklist

Use these commands first:

- `./uruc plugin validate <path-or-pluginId>`
- `./uruc plugin inspect <pluginId>`
- `./uruc plugin doctor`
- `./uruc doctor`
- `./uruc status`

Typical failures and their causes:

| Symptom | Usual cause |
| --- | --- |
| `Plugin id must be a lowercase namespaced id like acme.demo` | Invalid plugin id format |
| `publisher "... " is not approved` | Missing publisher in city `approvedPublishers` |
| `Config entry ... does not match manifest pluginId ...` | City config plugin id does not match package manifest |
| frontend plugin id mismatch | `frontend/plugin.ts(x)` uses a different plugin id from `package.json` |
| missing route in location page | `LOCATION_PAGE_TARGET.payload.routeId` references a route id that was never registered |
| route or alias collision | two plugins claimed the same canonical route or alias |
| command not found from frontend | frontend called a short command id instead of `<pluginId>.<commandId>@v1` |
| location policy never matches | you used a short location id instead of the full namespaced location id |

## 9. Agent-Friendly Plugin Rules

If you want a plugin that humans and AI agents can use correctly, follow these rules:

- Keep command ids short at registration time and stable over time.
- Give every command a complete one-sentence description.
- Describe every input field with explicit `type`, `description`, and `required` metadata.
- Return plain JSON-serializable objects with predictable field names.
- Use read-only commands with `controllerRequired: false` when writing is not required.
- Prefer explicit set-state commands over ambiguous toggle commands.
- Throw structured errors with `code`, `action`, and `details`.
- Keep storage collection names plugin-owned and readable.
- Keep plugin logic inside the plugin package; do not import server internals from `packages/server/src/core/*`.
- For a complex plugin, consider exposing a guide command like the social plugin's `get_usage_guide`.

## 10. AI Agent Recipe

If you are an AI coding agent creating a new plugin in this repo, use this sequence:

1. Pick a lowercase namespaced plugin id such as `acme.echo`.
2. Run `./uruc plugin create acme.echo --frontend` unless the plugin truly does not need UI.
3. Keep the backend entry in `index.mjs` unless you also introduce and verify a build step that produces the final ESM entry file.
4. Register commands and locations with short ids only.
5. Use full ids only when calling commands or referring to locations from frontend code, tests, or policies.
6. If the plugin publisher is not already approved, add it to the active city config's `approvedPublishers`.
7. Keep frontend entry at `frontend/plugin.ts` or `frontend/plugin.tsx` if you want the checked-in web app to discover it.
8. Validate with `./uruc plugin validate <path>`.
9. Link local development builds with `./uruc plugin link <path>`.
10. Check `./uruc plugin inspect <pluginId>` and `./uruc plugin doctor`.
11. Start or restart Uruc and verify the backend plugin actually reports as started.
