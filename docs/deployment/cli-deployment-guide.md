[English](cli-deployment-guide.md) | [中文](cli-deployment-guide.zh-CN.md)

# Uruc CLI Runtime Guide

This guide describes the current runtime configuration and lifecycle flow around the repository-level `./uruc` wrapper and the server CLI.

## What the CLI Manages

Uruc uses the server CLI to handle:

- city runtime configuration
- build orchestration
- foreground and background runtime management
- runtime diagnostics
- plugin configuration
- basic admin bootstrap

Uruc does not use the main CLI to manage:

- nginx
- SSL / certbot
- systemd installation
- landing pages or multi-site topology

The active application config file is `packages/server/.env`.

## Requirements

- Node.js 20 or later
- npm 9 or later
- A machine that can build `better-sqlite3`
- A writable `packages/server/data/` directory or a custom `DB_PATH`

## Local Development

```bash
npm install
./uruc configure
./uruc start
```

During configure, the CLI writes `packages/server/.env` and, if needed, initializes the admin account in the configured database.

Native Windows users should replace `./uruc ...` with `npm run uruc -- ...`.

## Runtime Exposure Modes

`uruc configure` supports three city runtime exposure models:

- `local-only` — bind to `127.0.0.1` for single-machine use
- `lan-share` — bind to `0.0.0.0` so friends on the same LAN can join
- `direct-public` — bind to `0.0.0.0` and use a public host / domain in `BASE_URL`

These modes only describe how the city runtime should bind and identify itself. They do not install nginx, provision certificates, or define your reverse-proxy topology.

## Running a Public City Runtime

For a public or production-style runtime:

1. prepare the machine with Node.js 20 and npm
2. clone the repository
3. run `npm install`
4. run `./uruc configure`
5. set a real `JWT_SECRET`
6. configure `BASE_URL`, `BIND_HOST`, `ALLOWED_ORIGINS`, admin credentials, and optional mail / OAuth settings
7. run `./uruc start -b` for a managed background process
8. manage nginx / SSL / systemd separately if your environment needs them

## Important Environment Variables

See `packages/server/.env.example` for the full list. The most important public-facing settings are:

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | Public site URL used by links and OAuth callbacks |
| `BIND_HOST` | Host interface the runtime binds to (`127.0.0.1` or `0.0.0.0`) |
| `JWT_SECRET` | Required for stable token and session signing |
| `PORT` | HTTP port |
| `WS_PORT` | WebSocket port |
| `DB_PATH` | SQLite database path |
| `PLUGIN_CONFIG_PATH` | Override the plugin config file path |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
| `APP_BASE_PATH` | Optional city UI mount path such as `/app` |
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
- external reverse proxies, TLS, and service installation are intentionally outside `uruc configure`

## Plugin Configuration

Uruc ships with two built-in config files:

- `packages/server/plugins.dev.json`
- `packages/server/plugins.prod.json`

The runtime picks one by default based on `NODE_ENV`, unless `PLUGIN_CONFIG_PATH` overrides it.

## Security Expectations

- Do not run production with the default `JWT_SECRET` placeholder
- Prefer HTTPS for public deployments, but configure it outside the main CLI
- Keep mail and OAuth secrets out of version control
- Use `SECURITY.md` for vulnerability reporting
