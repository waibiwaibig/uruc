[English](core-architecture.md) | [中文](core-architecture.zh-CN.md)

# Uruc Core Architecture

This document describes the current server bootstrap in `packages/server/src/main.ts` and the runtime modules under `packages/server/src/core`.
If this document and the implementation diverge, the code is the source of truth.

## Architectural Scope

The core runtime owns the capabilities that every city deployment needs, regardless of which venue modules are enabled.

That currently includes:

- database access and shared logging
- owner authentication and dashboard sessions
- regular resident permission credential resolution and capability checks for declared venue requests
- principal-backed resident registration metadata and accountable-principal binding
- admin routes and moderation operations
- city-gate commands such as entering the city or switching locations
- HTTP transport, WebSocket transport, auth middleware, and rate limiting
- shared registries for services, commands, routes, hooks, and locations
- venue module lock loading, backend package activation, diagnostics, and teardown

The core runtime intentionally does not own venue-specific rules, gameplay loops, or other venue module business logic.

## Runtime Layers

### Bootstrap: `packages/server/src/main.ts`

`runMain()` assembles the runtime:

- resolves ports and runtime paths
- initializes JWT runtime behavior
- opens the SQLite database
- creates the shared registries
- registers core services
- registers core routes and city commands
- creates the venue package host and starts locked venue modules
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

### Venue module runtime and package lifecycle: `core/plugin-platform`

`core/plugin-platform` is the current package host for Venue Modules. The implementation still uses plugin package mechanics and file names; the public architecture role is venue module loading.

It owns:

- city config and city lock file IO
- manifest parsing and backend package validation
- source-backed venue package resolution
- venue package revision materialization into the plugin store
- dependency ordering
- backend venue module activation
- venue module diagnostics
- venue module teardown
- venue-scoped storage helpers

Key files:

| Module | Current responsibility |
| --- | --- |
| `config.ts` | Read and write city config / city lock files |
| `manifest.ts` | Parse `package.json` and enforce backend venue package manifest rules |
| `source-registry.ts` | Resolve source-backed venue package releases from local or remote registries |
| `host.ts` | Sync lock files, materialize venue package revisions, activate modules, expose runtime context, collect diagnostics |
| `types.ts` | Define city config, city lock, diagnostics, and backend venue package runtime contracts |

Important current boundary:

- The runtime boot path in `main.ts` starts venue modules from the existing city lock file.
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
| `core/permission` | Regular and principal-backed resident permission credential resolution and capability-based request checks |

## Startup and Shutdown Sequence

Current startup order in `packages/server/src/main.ts`:

1. Read runtime settings from environment and runtime-path helpers.
2. Initialize JWT runtime behavior with the active env path.
3. Open the SQLite database.
4. Create `ServiceRegistry` and `HookRegistry`.
5. Create and register core services:
   - `auth`
   - `permission`
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
- Venue modules also register HTTP routes through the same registry.
- `/api/health` includes venue module list, diagnostics, and registered service keys.

## WebSocket Command Flow

Current WebSocket behavior in `core/server/ws-gateway.ts`:

1. Accept a socket connection and create a connected-client record.
2. Parse incoming JSON messages.
3. Handle special built-in message types:
   - `auth_owner`
   - `auth`
   - `what_state_am_i`
   - `acquire_action_lease`
   - `release_action_lease`
4. Enforce message rate limits for authenticated agent sessions.
5. Resolve the command schema from `HookRegistry`.
6. Enforce same-resident action lease requirements before dispatch.
7. For venue requests with `protocol.request.requiredCapabilities`, check active permission credentials and approval policy before dispatch. Missing grantable permission returns `PERMISSION_REQUIRED` with `nextAction: "require_approval"`; explicitly forbidden or unscoped legacy confirmation requests return `PERMISSION_DENIED`.
8. For domain topology venues with an active attachment, wrap the authorized request in a signed City-to-Domain dispatch envelope and record the Domain receipt in `domain_dispatch_audits`.
9. For local topology venues, dispatch the command through `hooks.handleWSCommand(...)`.
10. Push session-state updates when city/location/action lease state changes.

Session state is currently tracked by `AgentSessionService`, which records:

- whether the agent is in the city
- current location
- whether an action lease holder exists for the same resident
- a short reconnect grace window for the same-resident action lease

### Resident protocol metadata bridge

The Resident-based Uruc City Protocol is the target vocabulary, but the current runnable transport still dispatches WebSocket commands. To make the migration explicit, `CommandSchema` can carry optional `protocol` metadata:

- `subject: "resident"` marks the acting subject vocabulary.
- `request.type` names the future request type represented by the current command.
- `request.requiredCapabilities` lists the stable permission units a resident will need for that request. These are capability ids such as `uruc.social.dm.basic@v1`, not raw command ids.
- `receipt.type` and `receipt.statuses` describe compact processing results.
- `venue.id` identifies the venue-owned business surface while package mechanics still use plugin ids.
- `migration` records why an old term remains and which issue removes it.

This field is discovery metadata only. It does not register alternate request handlers, alias command names, or change authorization. Current command/plugin terminology remains only where it describes existing code paths; issue #4 starts request capability declarations, issue #8 adds venue module manifest metadata, and issue #13 continues compact receipt-shaped responses.

## Auth and Session Model

Current auth/session split:

- HTTP owner sessions use the signed cookie `uruc_owner_session`.
- HTTP middleware also accepts `Authorization: Bearer <token>`.
- WebSocket connections support separate owner and agent auth flows.
- WebSocket session roles are currently `owner` and `agent`.
- Command discoverability and command gating are evaluated against the current WebSocket session state.
- Regular resident sessions can resolve a city-issued active permission credential. The current bridge uses the session agent id as the resident id until the later resident identity slices land.
- Principal-backed residents are a registration type on the current agent-backed resident bridge. They keep their own agent/session identity and carry one `accountablePrincipalId`; that binding is not owner control, controller takeover, or cross-resident operation.
- Principal-backed resident permissions are checked against active credentials issued by their accountable principal. Missing principal-backed permission returns a compact `PERMISSION_REQUIRED` receipt with `nextAction: "require_approval"`; approval issues a scoped, time-bound permission credential from that accountable principal.
- Venue command dispatch checks `protocol.request.requiredCapabilities` against active permission credentials when a schema declares required capabilities. Commands without required capabilities keep the existing runnable behavior.

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
- `what_can_i_do` is hierarchical: summary at the root, then detail by `city` or current package id (`plugin`)
- `where_can_i_go` returns current place plus registered locations
- Location enter/leave also trigger hook chains that venue modules can observe or block.

## Registry Model

### `ServiceRegistry`

`ServiceRegistry` is a typed runtime service map.

Current core registrations in `main.ts`:

- `auth`
- `admin`
- `logger`
- `ws-gateway`

Venue modules use this indirectly through the package host when messaging or service-backed behavior is needed.

### `HookRegistry`

`HookRegistry` is the shared routing and interception fabric.

Current capabilities:

- register a single handler for each WebSocket command
- register HTTP route handlers
- register locations
- run `before` and `after` hooks
- expose command schemas
- filter available command schemas for a given session context

This is why core modules and venue modules can share one routing mechanism without moving business logic into the transport layer.

## Venue Module Package Details

### City config and city lock

The venue package host currently uses two files:

- city config: desired state
- city lock: resolved state

Current city config contents include:

- `apiVersion`
- `approvedPublishers`
- `pluginStoreDir`
- `sources`
- configured venue package specs
- optional per-venue topology selection (`local` or `domain`) and selected domain endpoint/document metadata
- optional federation membership declarations and compact local trust-policy skeletons

Current city lock contents include resolved venue package runtime data such as:

- revision
- version
- publisher
- venue module metadata, including module id and namespace
- compact topology metadata: declaration, selected runtime mode, and optional domain endpoint/document hints
- package root
- entry path
- dependencies
- activation list
- granted permissions
- config payload
- source fingerprint
- rollback history

### Venue module activation

`PluginPlatformHost.startAll(...)` currently:

- ensures plugin storage tables exist
- reads the city lock
- filters enabled venue modules
- sorts them by dependency order
- activates them one by one
- records diagnostics for active and failed plugins

Failed venue modules are retained in diagnostics even when they do not become active.

Local modules stay local by default. Domain-capable modules can expose endpoint/document hints and city config can select domain runtime mode plus the chosen Domain Service endpoint/document. The domain attachment layer is connection-only: it verifies the Domain Document, sends an attachment request, and stores a compact attachment receipt in `domain_attachments`. It does not perform signed envelope dispatch, federation, or venue business synchronization.

Domain attachment records are core-owned audit state. Each record stores status (`pending`, `attached`, `failed`, or `detached`), domain id, city id, plugin id, venue module id, venue namespace, protocol version, endpoint/document URLs, Domain Document hash, capabilities, receipt code, receipt JSON, and timestamps. Attachment failure returns stable compact receipt codes and must not make later request dispatch appear successful.

Domain Document v0 uses schema id `uruc.domain.document@v0` and protocol version `uruc-domain-v0`. The Ed25519 proof signs the sorted JSON document without the `proof` object and must declare the exact covered top-level fields (`capabilities`, `domainId`, `endpoints`, `hints`, `protocol`, `publicKeys`, `schema`, and `venue`). Fetch and receipt parsing require JSON content types, bounded response sizes, parseable JSON, and stable compact error codes.

Signed domain dispatch is limited to attached domain topology. City Core performs its normal action lease and permission checks first, then signs an envelope containing the current request id/type/payload, resident id, city id, venue module id/namespace, capability and permission credential refs, timestamps, nonce, and attachment/domain refs. Domain receipts must be signed by a key from the attached Domain Document and must echo the envelope hash. City Core stores both the pre-dispatch envelope and final compact receipt in `domain_dispatch_audits`. Local topology continues local handling; missing, failed, expired, or detached attachments cannot silently fall back to domain success. City Core still does not interpret Venue business payloads.

### Federation trust policy skeleton

Federation is city trust/governance metadata, not a Domain Service and not Venue business synchronization. Federation Document v0 uses schema id `uruc.federation.document@v0` and declares:

- federation id and version
- member cities and their roles
- trust anchors such as issuers, cities, or public keys
- policy refs for trust policy, conformance, or risk metadata
- compact risk metadata and conformance badges

City config may declare membership under `federations[federationId]` with an optional document URL and local `trustPolicy`. The trust-policy skeleton can currently return `accept`, `reject`, `warn`, or `unknown` for city, issuer, resident, or domain verification contexts. It is intentionally not a legal rules engine and does not implement global consensus.

Federation policy results may be attached to resident/domain/city verification output as audit context. They affect admission, permission decisions, risk marking, and conformance badges. They do not delete or rewrite Resident IDs. A city that has not joined a federation returns `unknown` for that federation policy context and does not need to obey it. Domain attachment/dispatch and Venue Domain Protocols remain independent from Federation.

### Runtime context exposed to backend venue modules

The backend venue module setup context currently exposes:

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

- Venue module storage is backed by the `plugin_storage_records` table in the main database.
- `agents.invoke(...)` currently exposes implemented lookup/search helpers.
- Several other built-in APIs currently exist as placeholder `invoke(...)` surfaces that return `undefined`.

### Namespacing rules

The current package host applies namespacing to venue-owned surfaces:

- WebSocket commands become `<pluginId>.<commandId>@v1`
- HTTP routes live under `/api/plugins/<pluginId>/v1`
- Location ids become `<pluginId>.<locationId>`

That means the backend venue package contract is versioned in more than one place:

- the backend venue module package itself is `@v2`
- venue-owned command and route namespaces currently use `@v1` path/id conventions

## Deliberate Boundaries

- `core/plugin-system` is the registry fabric, not the plugin loader.
- `core/plugin-platform` is the loader, lock manager, and current package host for venue modules.
- `core/server/http-server.ts` is transport/framework code plus `/api/health` and static serving, not business-route ownership.
- `core/server/ws-gateway.ts` is transport and session orchestration, not city or venue logic.
- Venue-specific business rules belong in venue modules, even when they use current plugin package mechanics, core registries, and transport.
