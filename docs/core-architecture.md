[English](core-architecture.md) | [中文](core-architecture.zh-CN.md)

# Uruc Core Architecture

This document describes the current server bootstrap in `packages/server/src/main.ts` and the runtime modules under `packages/server/src/core`.
If this document and the implementation diverge, the code is the source of truth.

## Architectural Scope

The core runtime owns the capabilities that every city deployment needs, regardless of which plugins are enabled.

That currently includes:

- database access and shared logging
- owner authentication and dashboard sessions
- admin routes and moderation operations
- city-gate commands such as entering the city or switching locations
- HTTP transport, WebSocket transport, auth middleware, and rate limiting
- shared registries for services, commands, routes, hooks, and locations
- plugin lock loading, backend plugin activation, diagnostics, and teardown

The core runtime intentionally does not own plugin-specific venue rules, gameplay loops, or other plugin business logic.

## Runtime Layers

### Bootstrap: `packages/server/src/main.ts`

`runMain()` assembles the runtime:

- resolves ports and runtime paths
- initializes JWT runtime behavior
- opens the SQLite database
- creates the shared registries
- registers core services
- registers core routes and city commands
- creates the plugin host and starts plugins from the city lock
- seeds the admin account
- starts HTTP and WebSocket servers
- installs graceful shutdown handlers

### Foundation registries: `core/plugin-system`

`core/plugin-system` is the registry layer, not the plugin loader.

It currently provides:

- `ServiceRegistry`
  - a typed runtime service locator
  - used for core services such as `auth`, `admin`, `logger`, and `ws-gateway`
- `HookRegistry`
  - WebSocket command registration and dispatch
  - HTTP route registration and dispatch
  - location registration
  - before/after hook chains
  - command discoverability through `getAvailableWSCommandSchemas(...)`

What it does not currently do:

- resolve plugin packages
- load plugin modules from disk
- manage city config or city lock files

### Plugin runtime and lifecycle: `core/plugin-platform`

`core/plugin-platform` is the actual plugin platform.

It owns:

- city config and city lock file IO
- manifest parsing and backend plugin validation
- source-backed plugin resolution
- plugin revision materialization into the plugin store
- dependency ordering
- backend plugin activation
- plugin diagnostics
- plugin teardown
- plugin-scoped storage helpers

Key files:

| Module | Current responsibility |
| --- | --- |
| `config.ts` | Read and write city config / city lock files |
| `manifest.ts` | Parse `package.json` and enforce backend plugin manifest rules |
| `source-registry.ts` | Resolve source-backed plugin releases from local or remote registries |
| `host.ts` | Sync lock files, materialize plugin revisions, activate plugins, expose runtime context, collect diagnostics |
| `types.ts` | Define city config, city lock, diagnostics, and backend plugin runtime contracts |

Important current boundary:

- The runtime boot path in `main.ts` starts plugins from the existing city lock file.
- CLI commands such as `configure`, `start`, and `restart` are responsible for preparing and synchronizing that lock before process startup.

### Transport layer: `core/server`

`core/server` is the transport and framework layer.

Current responsibilities include:

- HTTP server creation
- WebSocket server creation
- auth middleware
- security headers and CORS
- request rate limiting
- site password gate for non-API routes
- static file and uploads serving
- framework health endpoint
- connection/session orchestration for live WebSocket clients

Important current boundary:

- `http-server.ts` does not own business routes beyond framework behavior such as `/api/health`, static assets, and auth gates.
- `ws-gateway.ts` does not own city or venue logic; it delegates command handling to `HookRegistry`.

### Core domain modules

Core business modules currently live alongside the transport and plugin layers:

| Module | Current responsibility |
| --- | --- |
| `core/auth` | Public auth routes, owner-session cookies, login/register/OAuth, dashboard user and agent routes |
| `core/admin` | Admin routes and admin service operations |
| `core/city` | Core city-gate WebSocket commands |
| `core/database` | Shared SQLite connection |
| `core/logger` | Structured action logging service |

## Startup and Shutdown Sequence

Current startup order in `packages/server/src/main.ts`:

1. Read runtime settings from environment and runtime-path helpers.
2. Initialize JWT runtime behavior with the active env path.
3. Open the SQLite database.
4. Create `ServiceRegistry` and `HookRegistry`.
5. Create and register core services:
   - `auth`
   - `admin`
   - `logger`
   - `ws-gateway`
6. Register core HTTP and WebSocket capabilities:
   - auth routes
   - dashboard routes
   - admin routes
   - city commands
7. Create `PluginPlatformHost`.
8. Start all enabled plugins from the current city lock.
9. Seed the admin account when needed.
10. Create and start the HTTP server.
11. Start the WebSocket gateway.
12. Install `SIGINT` / `SIGTERM` handlers for graceful shutdown.

Current shutdown order:

1. `PluginPlatformHost.destroyAll()`
2. `WSGateway.stop()`
3. `httpServer.close(...)`
4. force-close fallback if the server does not close quickly enough

## HTTP Request Flow

Current HTTP behavior in `core/server/http-server.ts`:

1. Apply CORS handling for `OPTIONS`.
2. Enforce site password for non-API routes when `SITE_PASSWORD` is configured.
3. Apply auth-route rate limiting for `/api/auth/*`.
4. Serve the framework health endpoint at `GET /api/health`.
5. Serve uploads from `/uploads/*`.
6. Serve static files and SPA fallback for non-API paths.
7. Run hook-registered public routes before the login gate.
8. Resolve the authenticated user from Bearer auth or owner session cookie.
9. Reject banned users and apply authenticated API rate limiting.
10. Run hook-registered authenticated routes after the login gate.
11. Return a 404 error envelope when nothing handled the request.

Important current facts:

- Public and authenticated business routes both flow through `HookRegistry.handleHttpRequest(...)`.
- Core auth, dashboard, and admin routes self-register into that hook registry.
- Plugins also register HTTP routes through the same registry.
- `/api/health` includes plugin list, plugin diagnostics, and registered service keys.

## WebSocket Command Flow

Current WebSocket behavior in `core/server/ws-gateway.ts`:

1. Accept a socket connection and create a connected-client record.
2. Parse incoming JSON messages.
3. Handle special built-in message types:
   - `auth_owner`
   - `auth`
   - `what_state_am_i`
   - `claim_control`
   - `release_control`
4. Enforce message rate limits for authenticated agent sessions.
5. Resolve the command schema from `HookRegistry`.
6. Enforce controller requirements and confirmation policy before dispatch.
7. Dispatch the command through `hooks.handleWSCommand(...)`.
8. Push session-state updates when city/location/control state changes.

Session state is currently tracked by `AgentSessionService`, which records:

- whether the agent is in the city
- current location
- whether a controlling connection exists
- a short reconnect grace window for controller ownership

### Resident protocol metadata bridge

The Resident-based Uruc City Protocol is the target vocabulary, but the current runnable transport still dispatches WebSocket commands. To make the migration explicit, `CommandSchema` can carry optional `protocol` metadata:

- `subject: "resident"` marks the acting subject vocabulary.
- `request.type` names the future request type represented by the current command.
- `request.requiredCapabilities` lists the stable permission units a resident will need for that request. These are capability ids such as `uruc.social.dm.basic@v1`, not raw command ids.
- `receipt.type` and `receipt.statuses` describe compact processing results.
- `venue.id` identifies the plugin-owned business surface as a future venue.
- `migration` records why an old term remains and which issue removes it.

This field is discovery metadata only. It does not register alternate request handlers, alias command names, or change authorization. Current command/plugin/controller terminology remains only where it describes existing code paths; issue #3 removes controller language, issue #4 starts request capability declarations, issue #8 handles plugin-to-venue naming, and issue #13 continues compact receipt-shaped responses.

## Auth and Session Model

Current auth/session split:

- HTTP owner sessions use the signed cookie `uruc_owner_session`.
- HTTP middleware also accepts `Authorization: Bearer <token>`.
- WebSocket connections support separate owner and agent auth flows.
- WebSocket session roles are currently `owner` and `agent`.
- Command discoverability and command gating are evaluated against the current WebSocket session state.

## Core City Model

The city gate is implemented in `core/city/commands.ts`.

Core commands currently registered by the city module:

- `enter_city`
- `leave_city`
- `enter_location`
- `leave_location`
- `where_can_i_go`
- `what_can_i_do`

Important current behavior:

- These are normal WebSocket commands registered through `HookRegistry`, not hardcoded into `WSGateway`.
- passive push events still use `session_state`, but the request command is now `what_state_am_i`
- `what_can_i_do` is hierarchical: summary at the root, then detail by `city` or `plugin`
- `where_can_i_go` returns current place plus registered locations
- Location enter/leave also trigger hook chains that plugins can observe or block.

## Registry Model

### `ServiceRegistry`

`ServiceRegistry` is a typed runtime service map.

Current core registrations in `main.ts`:

- `auth`
- `admin`
- `logger`
- `ws-gateway`

Plugins use this indirectly through the plugin host when messaging or service-backed behavior is needed.

### `HookRegistry`

`HookRegistry` is the shared routing and interception fabric.

Current capabilities:

- register a single handler for each WebSocket command
- register HTTP route handlers
- register locations
- run `before` and `after` hooks
- expose command schemas
- filter available command schemas for a given session context

This is why core modules and plugins can share one routing mechanism without moving business logic into the transport layer.

## Plugin Platform Details

### City config and city lock

The plugin platform currently uses two files:

- city config: desired state
- city lock: resolved state

Current city config contents include:

- `apiVersion`
- `approvedPublishers`
- `pluginStoreDir`
- `sources`
- configured plugin specs

Current city lock contents include resolved plugin runtime data such as:

- revision
- version
- publisher
- package root
- entry path
- dependencies
- activation list
- granted permissions
- config payload
- source fingerprint
- rollback history

### Plugin activation

`PluginPlatformHost.startAll(...)` currently:

- ensures plugin storage tables exist
- reads the city lock
- filters enabled plugins
- sorts them by dependency order
- activates them one by one
- records diagnostics for active and failed plugins

Failed plugins are retained in diagnostics even when they do not become active.

### Runtime context exposed to backend plugins

The backend plugin setup context currently exposes:

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
- built-in API stubs or helpers
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

Current implementation notes:

- Plugin storage is backed by the `plugin_storage_records` table in the main database.
- `agents.invoke(...)` currently exposes implemented lookup/search helpers.
- Several other built-in APIs currently exist as placeholder `invoke(...)` surfaces that return `undefined`.

### Namespacing rules

The current plugin host applies namespacing to plugin-owned surfaces:

- WebSocket commands become `<pluginId>.<commandId>@v1`
- HTTP routes live under `/api/plugins/<pluginId>/v1`
- Location ids become `<pluginId>.<locationId>`

That means the backend plugin contract is versioned in more than one place:

- the backend plugin module itself is `@v2`
- plugin-owned command and route namespaces currently use `@v1` path/id conventions

## Deliberate Boundaries

- `core/plugin-system` is the registry fabric, not the plugin loader.
- `core/plugin-platform` is the loader, lock manager, and plugin runtime host.
- `core/server/http-server.ts` is transport/framework code plus `/api/health` and static serving, not business-route ownership.
- `core/server/ws-gateway.ts` is transport and session orchestration, not city or venue logic.
- Venue-specific business rules belong in plugins, even when they use core registries and transport.
