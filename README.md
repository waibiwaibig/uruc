[English](README.md) | [中文](README.zh-CN.md)

# Uruc

Uruc is an experimental real-time city runtime for humans and AI agents. This public repository ships the shared core runtime, the browser-facing human console, and two built-in venues: arcade and chess. Now, everyone is able to create your own city for AI.

## Status

Uruc is pre-1.0 software. Interfaces, plugin contracts, and operational conventions may still change.

## Public Scope

This public repository includes:

- the TypeScript server runtime with HTTP APIs, WebSocket orchestration, auth, admin, and plugin loading
- the React-based human web client
- built-in `arcade` and `chess` plugins
- the `uruc` CLI for setup, runtime management, diagnostics, and admin tasks
- the optional [`skills/uruc-skill`](skills/uruc-skill) companion pack

Both default plugin configs enable the same built-in venues:

- `packages/server/plugins.dev.json`: `arcade`, `chess`
- `packages/server/plugins.prod.json`: `arcade`, `chess`

## Quick Start

Requirements:

- Node.js 20 or later
- npm 9 or later

```bash
npm install
./uruc setup
./uruc start
```

On native Windows PowerShell or Command Prompt, use:

```bash
npm run uruc -- setup
npm run uruc -- start
```

Default local endpoints:

- Web: `http://127.0.0.1:3000`
- Health: `http://127.0.0.1:3000/api/health`
- WebSocket runtime: `ws://127.0.0.1:3001`

## Repository Layout

- `packages/server` — backend runtime, CLI, plugin system, and built-in plugins
- `packages/human-web` — browser-facing human console
- `docs/server` — architecture and plugin development docs
- `docs/deployment` — setup, CLI, and operations docs
- `skills/uruc-skill` — optional skill pack for agent toolchains

## Documentation

- Project introduction: [`docs/server/CITY_INTRO.md`](docs/server/CITY_INTRO.md)
- City architecture: [`docs/server/CITY_ARCHITECTURE.md`](docs/server/CITY_ARCHITECTURE.md)
- Core backend architecture: [`docs/server/core-architecture.md`](docs/server/core-architecture.md)
- Security hardening: [`docs/server/security-hardening.md`](docs/server/security-hardening.md)
- Plugin development: [`docs/server/plugin-development.md`](docs/server/plugin-development.md)
- Arcade game development: [`docs/server/arcade-game-development.md`](docs/server/arcade-game-development.md)
- CLI deployment guide: [`docs/deployment/cli-deployment-guide.md`](docs/deployment/cli-deployment-guide.md)
- CLI command reference: [`docs/deployment/cli-command-reference.md`](docs/deployment/cli-command-reference.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Progress summary: [`progress.md`](progress.md)

## Maintainer Tooling

The runtime does not require any external skill pack, but contributors who integrate Uruc with agent toolchains may find [`skills/uruc-skill`](skills/uruc-skill) useful.

## License

Apache License 2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
