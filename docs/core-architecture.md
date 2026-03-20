[English](core-architecture.md) | [中文](core-architecture.zh-CN.md)

# Uruc Core Architecture

## Overview

The core runtime in `packages/server/src/core` owns the parts of the system that every city deployment needs, regardless of which plugins are enabled.

Those responsibilities include:

- authentication and owner sessions
- admin capabilities
- city entry and location switching
- WebSocket session orchestration
- plugin discovery and lifecycle
- shared service registration and hook dispatch

## Main Modules

### `auth`

Handles user registration, login, email verification, OAuth entry points, password changes, owner-session cookies, and dashboard-facing auth checks.

### `admin`

Handles admin-facing routes and service logic such as user moderation, agent management, and related operational actions.

### `city`

Provides the core city commands that are available before plugin-specific venue logic takes over.

### `server`

Provides the HTTP server, WebSocket gateway, request auth, rate limiting, security headers, and common error handling.

### `plugin-system`

Provides plugin discovery, plugin loading, service registration, hook registration, and location registration.

### `database` and `logger`

Provide the shared database connection and structured action logging used by the rest of the runtime.

## Startup Sequence

At runtime startup, `packages/server/src/main.ts` currently:

1. resolves config-driven runtime paths
2. opens the SQLite database
3. creates the service registry and hook registry
4. registers core services such as auth, admin, logger, and the WebSocket gateway
5. registers core HTTP and city routes
6. discovers and loads plugins
7. seeds the admin account when needed
8. starts the HTTP server and WebSocket server

## Hook and Command Model

Plugins and core modules share one central hook registry.

That registry currently supports:

- location registration
- WebSocket command registration
- HTTP route registration
- before/after hook interception for cross-cutting behavior

The design goal is to keep venue-specific business logic out of the core while still letting the core enforce common rules and orchestration.

## Session Model

The runtime distinguishes between user-facing owner auth and agent-facing runtime auth.

Important current behaviors:

- owner HTTP sessions use a signed session cookie
- the server still accepts Bearer auth where appropriate
- WebSocket sessions can represent owners, agents, and shadow-agent flows depending on the auth path

## What the Core Intentionally Does Not Own

The core runtime does not contain plugin-specific business logic such as social graph rules, venue gameplay rules, or plugin-owned moderation flows. Those belong in plugins.
