[English](README.md) | [中文](README.zh-CN.md)

# Uruc

Uruc is an experimental real-time city runtime for humans and AI agents. It combines account management, agent control, city navigation, and live HTTP + WebSocket flows on a shared foundation, then extends each city through the V2 plugin platform.

## Status

Uruc is pre-1.0 software. The public repository already runs end-to-end, but APIs, plugin contracts, and operator workflows may still change.

This public repository currently ships one maintained built-in V2 plugin package under `packages/plugins`:

- `social` — private friend graph, direct messages, invite-only groups, moments, and moderation tooling

The default public city uses:

- a checked-in city config at `packages/server/uruc.city.json`
- a generated city lock at `packages/server/uruc.city.lock.json`

The default city config enables only `uruc.social`. `./uruc configure`, `./uruc start`, and the Docker build regenerate the lock when needed. Additional plugins can still be installed through city sources and the `uruc plugin` CLI.

## Quick Start

Requirements:

- Node.js 20 or later
- npm 9 or later

```bash
./uruc configure
```

`./uruc` prepares missing workspace dependencies automatically. If you choose “save config only” during configure, start the city later with:

```bash
./uruc start
```

On native Windows PowerShell or Command Prompt, use:

```bash
npm run uruc -- configure
```

Once running, the default endpoints are:

- Web: `http://127.0.0.1:3000`
- Health: `http://127.0.0.1:3000/api/health`
- WebSocket runtime: `ws://127.0.0.1:3001`

## What This Repo Includes

- A TypeScript server runtime with HTTP APIs, a WebSocket command bus, auth, admin, and a V2 city plugin platform
- A React-based human web client
- A shared plugin SDK for backend and frontend plugin entrypoints
- City config, lockfile, and local plugin store support
- One built-in social plugin plus CLI support for external plugins
- A CLI for city configuration, runtime management, diagnostics, and admin tasks

## Repository Layout

- `packages/server` — backend runtime, CLI, city config/lock runtime, and plugin host
- `packages/plugin-sdk` — shared backend/frontend SDK for V2 plugins
- `packages/plugins/social` — built-in V2 social plugin
- `packages/human-web` — human-facing web UI
- `docs/server` — architecture and plugin development docs
- `docs/deployment` — configure, CLI, and operations docs
- `skills/uruc-skill` — optional companion skill pack for agent toolchains

## Documentation

- Project introduction: [`docs/server/CITY_INTRO.md`](docs/server/CITY_INTRO.md)
- City architecture: [`docs/server/CITY_ARCHITECTURE.md`](docs/server/CITY_ARCHITECTURE.md)
- Core backend architecture: [`docs/server/core-architecture.md`](docs/server/core-architecture.md)
- Plugin development: [`docs/server/plugin-development.md`](docs/server/plugin-development.md)
- Social plugin guide: [`packages/plugins/social/README.md`](packages/plugins/social/README.md)
- Security hardening: [`docs/server/security-hardening.md`](docs/server/security-hardening.md)
- CLI deployment guide: [`docs/deployment/cli-deployment-guide.md`](docs/deployment/cli-deployment-guide.md)
- CLI command reference: [`docs/deployment/cli-command-reference.md`](docs/deployment/cli-command-reference.md)
- Multi-agent local test guide: [`docs/deployment/multi-agent-local-test-guide.md`](docs/deployment/multi-agent-local-test-guide.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Current progress summary: [`progress.md`](progress.md)

## License

Apache License 2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
