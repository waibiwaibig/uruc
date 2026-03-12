[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI Deployment Guide

This guide describes the current supported setup and operations flow around the repository-level `./uruc` wrapper and the server CLI.

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

## Local Development Setup

```bash
npm install
./uruc setup
./uruc start
```

During setup, the CLI writes `packages/server/.env` and, if needed, initializes the admin account in the configured database.

Native Windows users should replace `./uruc ...` with `npm run uruc -- ...`.

## Production-Oriented Setup

For a production-style deployment:

1. prepare the machine with Node.js 20 and npm
2. clone the repository
3. run `npm install`
4. run `./uruc setup`
5. set a real `JWT_SECRET`
6. configure `BASE_URL`, `ALLOWED_ORIGINS`, admin credentials, and optional mail / OAuth settings
7. run `./uruc start -b` for a managed background process, or use the server deployment mode if you maintain a systemd-based setup

## Important Environment Variables

See `packages/server/.env.example` for the full list. The most important public-facing settings are:

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | Public site URL used by links and OAuth callbacks |
| `JWT_SECRET` | Required for stable token and session signing |
| `PORT` | HTTP port |
| `WS_PORT` | WebSocket port |
| `DB_PATH` | SQLite database path |
| `PLUGIN_CONFIG_PATH` | Override the plugin config file path |
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
- `./uruc stop` and `./uruc restart` only manage CLI-managed background instances or systemd services
- `./uruc doctor` is the best overview command for config and health issues

## Plugin Configuration

Uruc ships with two built-in config files:

- `packages/server/plugins.dev.json`
- `packages/server/plugins.prod.json`

The runtime picks one by default based on `NODE_ENV`, unless `PLUGIN_CONFIG_PATH` overrides it.

## Security Expectations

- Do not run production with the default `JWT_SECRET` placeholder
- Prefer HTTPS for public deployments
- Keep mail and OAuth secrets out of version control
- Use `SECURITY.md` for vulnerability reporting
