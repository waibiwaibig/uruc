# Market Frontend Plugin Runtime Design

## Goal

Make an officially published Uruc plugin work as one installable unit:

- backend installs and starts from the marketplace artifact
- frontend is prebuilt before publication
- `./uruc start` exposes installed frontend assets locally
- `packages/human-web` loads installed external plugin frontends at runtime

This design is specifically for the current public repository state on 2026-03-21.

## Current Facts

- Backend plugin loading is dynamic and lock-based.
- Frontend plugin loading is still static and only scans `packages/plugins/*`.
- `package.json#urucFrontend` currently describes a source entry such as `./frontend/plugin.ts`.
- Marketplace artifacts currently do not have a standardized frontend build output.
- `@uruc/chess` in `/Users/waibiwaibi/uruk/uruc-core/packages/plugins/chess` is representative of the gap:
  - it declares `urucFrontend.entry`
  - it ships source frontend files
  - it does not ship any compiled frontend asset

Because of that, a marketplace plugin can currently install as a backend package but still fail to appear in the web UI.

## Requirements

- Official marketplace installs must not build frontend source on the end-user machine.
- Backend and frontend must remain one plugin package, one revision, one install path.
- Built-in in-repo plugins must keep working without migration.
- External frontend plugins must share the host React and plugin SDK runtime instead of bundling their own copy.
- Failure modes must be explicit and diagnosable.

## Chosen Approach

Use a prebuilt frontend artifact inside the plugin package, plus a runtime loader in the host web app.

The package keeps the source declaration:

- `package.json#urucFrontend.entry`

The published artifact additionally contains:

- `frontend-dist/plugin.js`
- `frontend-dist/manifest.json`
- optional CSS and other static assets under `frontend-dist/`

The host server materializes those files together with the backend revision and serves them from the local plugin store.

The host web app loads them at runtime and merges the resulting frontend contributions with the existing static in-repo registry.

## Frontend Build Contract

Each published plugin frontend build produces a `frontend-dist/manifest.json` file with this shape:

```json
{
  "apiVersion": 1,
  "pluginId": "uruc.chess",
  "version": "0.1.0",
  "format": "global-script",
  "entry": "./plugin.js",
  "css": ["./plugin.css"],
  "exportKey": "uruc.chess"
}
```

Rules:

- `entry` and `css` paths are relative to `frontend-dist/`
- `format` is initially fixed to `global-script`
- `exportKey` is the key used in `window.__uruc_plugin_exports`
- the bundle must assign the plugin object into `window.__uruc_plugin_exports[exportKey]`

## Shared Runtime Contract

The host web app will install one shared global object before loading any external plugin frontend:

- `window.__uruc_plugin_globals`

It provides:

- `React`
- `ReactDOM`
- `ReactJsxRuntime`
- `ReactJsxDevRuntime`
- `UrucPluginSdkFrontend`
- `UrucPluginSdkFrontendReact`
- `UrucPluginSdkFrontendHttp`

Published frontend bundles externalize those modules and read them from the shared globals.

This keeps React and the frontend SDK singleton at runtime.

## Publication Workflow

Add a first-class CLI path for packaging marketplace artifacts:

- `./uruc plugin pack <path> [--out <dir>]`

Behavior:

1. Read and validate the plugin package.
2. If `urucFrontend` exists, build `frontend-dist/` from the declared source entry.
3. Pack the staged plugin with `npm pack`.
4. Print the tarball path and integrity digest needed by the marketplace registry.

The packed tarball is the artifact uploaded to `uruk.life`.

This keeps the marketplace path standard:

- authors build before publication
- users install compiled artifacts

## Server Changes

### Manifest and Lock

Extend the plugin manifest read path to capture:

- optional frontend source metadata from `package.json#urucFrontend`
- optional frontend build metadata from `frontend-dist/manifest.json`

Extend `LockedPluginSpec` with optional frontend build information. The lock remains the source of truth for what the runtime may serve.

### Runtime Asset Serving

Add two framework-level endpoints:

- `GET /api/frontend-plugins`
- `GET /api/plugin-assets/:pluginId/:revision/*`

`/api/frontend-plugins` returns runtime-loadable frontend manifests for installed plugins that have frontend build metadata in the active lock.

`/api/plugin-assets/...` serves files from the materialized plugin revision under the locked package root.

Rules:

- only files inside the locked materialized revision may be served
- asset URLs are revision-scoped
- the server serves local installed assets, never direct remote marketplace URLs

## human-web Changes

Keep the existing static discovery path for built-in plugins.

Add a second runtime path:

1. fetch `/api/frontend-plugins`
2. inject declared CSS assets once
3. load each script asset once
4. read `window.__uruc_plugin_exports[exportKey]`
5. validate with `frontendPluginSchema`
6. merge contributions into the final registry

Conflict rule:

- static in-repo plugins win when a runtime plugin has the same `pluginId`

## Compatibility Model

Two supported workflows remain:

### In-repo development

- source files under `packages/plugins/*`
- static registry loading
- unchanged local development behavior

### Marketplace distribution

- source plugin is packaged with `./uruc plugin pack`
- published artifact contains `frontend-dist/`
- installed artifact is materialized by the plugin host
- frontend is loaded at runtime from the local installed revision

## Diagnostics

The runtime must surface explicit diagnostics for:

- frontend build manifest missing or invalid
- asset file missing from a materialized revision
- runtime script load failure
- missing `window.__uruc_plugin_exports[exportKey]`
- frontend schema validation failure
- plugin id mismatch between backend and frontend
- runtime plugin shadowed by a static in-repo plugin id

## Non-Goals

This upgrade does not attempt to solve:

- code signing
- plugin permission sandboxing in the browser
- hot reload for marketplace-installed plugins
- remote runtime loading directly from `uruk.life`

## Acceptance Criteria

This upgrade is only complete when all of the following are true:

1. A backend+frontend plugin can be packed into a marketplace artifact with `./uruc plugin pack`.
2. The installed artifact materializes both backend files and `frontend-dist/`.
3. `./uruc start` starts the backend plugin successfully.
4. `/api/frontend-plugins` lists the installed plugin frontend manifest.
5. `/api/plugin-assets/:pluginId/:revision/...` serves the built JS/CSS.
6. `packages/human-web` loads the installed frontend contribution at runtime.
7. The plugin page/nav/location contribution appears when backend health reports the plugin started.
8. Existing built-in plugins such as `packages/plugins/social` continue to work unchanged.
