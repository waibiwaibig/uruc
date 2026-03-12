[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI Deployment Guide

This guide describes the current supported configure and runtime flow around the repository-level `./uruc` wrapper and the server CLI.

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
```

During configure, the CLI writes `packages/server/.env`, initializes or updates the admin account when needed, and can start the city immediately. The `./uruc` wrapper also prepares missing workspace dependencies before the command runs.

Native Windows users should replace `./uruc ...` with `npm run uruc -- ...`.

## LAN / Server City Setup

For a LAN-shared or public city:

1. download or clone the repository
2. run `./uruc configure`
3. choose `lan` or `server`
4. confirm the share host, ports, registration policy, and admin identity
5. let configure start the city immediately, or run `./uruc start -b` later if you saved config only
6. if you need HTTPS or a reverse proxy, add it manually after the city is already reachable over direct HTTP / WS

## Important Environment Variables

See `packages/server/.env.example` for the full list. The most important public-facing settings are:

| Variable | Purpose |
| --- | --- |
| `BIND_HOST` | Network interface Uruc listens on (`127.0.0.1` for local, `0.0.0.0` for LAN / server) |
| `BASE_URL` | Share URL used by links and OAuth callbacks |
| `JWT_SECRET` | Required for stable token and session signing |
| `PORT` | HTTP port |
| `WS_PORT` | WebSocket port |
| `URUC_CITY_REACHABILITY` | Saved city reachability mode (`local`, `lan`, `server`) |
| `DB_PATH` | SQLite database path |
| `PLUGIN_CONFIG_PATH` | Override the plugin config file path |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
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
- `./uruc stop` and `./uruc restart` only manage CLI-managed background instances or systemd services
- `./uruc doctor` is the best overview command for config and health issues
- `configure` no longer installs `nginx`, certificates, Node.js, or system packages for you

## Plugin Configuration

Uruc ships with two built-in config files:

- `packages/server/plugins.dev.json`
- `packages/server/plugins.prod.json`

The runtime picks one by default based on `NODE_ENV`, unless `PLUGIN_CONFIG_PATH` overrides it.

## Security Expectations

- Do not run production with the default `JWT_SECRET` placeholder
- Add HTTPS or a reverse proxy yourself when you need public TLS
- Keep mail and OAuth secrets out of version control
- Use `SECURITY.md` for vulnerability reporting
