[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI Deployment Guide

This guide describes the current supported configure and operations flow around the repository-level `./uruc` wrapper and the server CLI.

## Deployment Runtime: Native vs. Docker

The official production deployment for this project uses **systemd + Caddy + rsync** on a native Node.js runtime. This is the path that gives operators direct `./uruc` ergonomics, system-level service management, and the tightest integration with the host environment.

Docker remains a supported optional runtime for local evaluation, open-source usage, and container-based environments. For operators who want direct server-side use of `./uruc` and system-level service management, prefer a native Node.js deployment behind a reverse proxy (Caddy or Nginx).

In short:

- Native Node.js + systemd + Caddy — the official production path
- Docker — supported, respectable, and appropriate for containerized or dev environments; not the primary production target

## What the CLI Manages

Uruc uses the server CLI to handle:

- first-run configuration
- build orchestration
- foreground and background runtime management
- runtime diagnostics
- plugin configuration
- basic admin bootstrap

The active application config file is `packages/server/.env`.

## Requirements

- Node.js 20 or later
- npm 9 or later
- A machine that can build `better-sqlite3`
- A writable `packages/server/data/` directory or a custom `DB_PATH`

## Local Development

```bash
./uruc configure
./uruc start
```

During configure, the CLI writes `packages/server/.env`, prepares `uruc.city.json` and `uruc.city.lock.json`, initializes or updates the admin account when needed, and can start the city immediately. The `./uruc` wrapper also prepares missing workspace dependencies before the command runs.

For a repeatable local verification loop, prefer:

```bash
./uruc configure --quickstart
./uruc start -b
./uruc doctor
./uruc stop
```

QuickStart preserves existing filesystem path settings such as `DB_PATH`, `CITY_CONFIG_PATH`, `PUBLIC_DIR`, `UPLOADS_DIR`, and the city `pluginStoreDir` when they are already configured.

Native Windows users should replace `./uruc ...` with `npm run uruc -- ...`.

## Production-Oriented Configuration

For a production-style deployment:

1. prepare the machine with Node.js 20 and npm
2. clone the repository
3. run `./uruc configure`
4. set a real `JWT_SECRET`
5. configure `BASE_URL`, `ALLOWED_ORIGINS`, admin credentials, and optional mail / OAuth settings
6. after configure, either save only and run `./uruc start -b` later, or let configure start the managed runtime immediately; when a `systemd` service is installed, the managed path automatically delegates to that service instead of spawning a separate CLI-owned background process

## Important Environment Variables

See `packages/server/.env.example` for the full list. The most important public-facing settings are:

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | Public site URL used by links and OAuth callbacks |
| `JWT_SECRET` | Required for stable token and session signing |
| `PORT` | HTTP port |
| `WS_PORT` | WebSocket port |
| `DB_PATH` | SQLite database path |
| `CITY_CONFIG_PATH` | Override the city config file path |
| `CITY_LOCK_PATH` | Override the city lock file path |
| `PLUGIN_STORE_DIR` | Override the local plugin revision store |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
| `ENABLE_HSTS` | Enable HSTS when the request is effectively HTTPS |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | Admin bootstrap identity |
| `FROM_EMAIL` / `RESEND_API_KEY` | Mail delivery settings |

## Build and Runtime Commands

```bash
./uruc build
./uruc start
./uruc start -b
./uruc status
./uruc logs
./uruc stop
./uruc restart
./uruc doctor
```

Operational notes:

- `./uruc start` runs in the foreground
- `./uruc start -b` creates a managed background process
- `./uruc start` now auto-creates the default city config if it is missing and always refreshes the city lock before boot
- `./uruc stop` and `./uruc restart` only manage CLI-managed background instances or systemd services
- `./uruc doctor` is the best overview command for config, plugin config/lock/runtime, and health issues

## City Configuration

Uruc V2 loads plugin state from:

- `packages/server/uruc.city.json`
- `packages/server/uruc.city.lock.json`

`CITY_CONFIG_PATH` can override the city config location, and `CITY_LOCK_PATH` can override the resolved lock file. The local revision store defaults to `packages/server/.uruc/plugins` unless `PLUGIN_STORE_DIR` overrides it. In the common path, you should not need to run `city init` or manual `plugin update` before `start`.

## Security Expectations

- In production, `JWT_SECRET` is mandatory and startup fails if it is missing
- In local/test environments, a missing `JWT_SECRET` only triggers a warning and an ephemeral in-process secret
- Prefer HTTPS for public deployments
- Keep mail and OAuth secrets out of version control
- Use `SECURITY.md` for vulnerability reporting
