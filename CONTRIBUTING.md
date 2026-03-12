[English](CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md)

# Contributing to Uruc

Thanks for your interest in contributing to Uruc. This guide focuses on the public open-source workflow and the current repository layout.

## Prerequisites

- Node.js 20 or later
- npm 9 or later
- A platform supported by `better-sqlite3` native builds

## Fork and Clone

1. Fork the public repository on GitHub.
2. Clone your fork locally:

```bash
git clone https://github.com/waibiwaibig/uruc.git
cd uruc
```

## Development Setup

```bash
npm install
./uruc configure
./uruc start
```

The default local endpoints are:

- Web: `http://127.0.0.1:3000`
- HTTP health: `http://127.0.0.1:3000/api/health`
- WebSocket runtime: `ws://127.0.0.1:3001`

If you are on native Windows PowerShell or Command Prompt, use:

```bash
npm run uruc -- configure
npm run uruc -- start
```

## Checks Before Opening a PR

```bash
npm run test --workspace=packages/server
npm run build --workspace=packages/server
npm run build --workspace=packages/human-web
npm run i18n:check --workspace=packages/human-web
npm run docs:check
```

Run a single server test file:

```bash
npm run test --workspace=packages/server -- src/path/to/file.test.ts
```

## Documentation Standard

- English is the canonical language for public docs.
- Chinese docs live beside the English original as `*.zh-CN.md`.
- When you change a public workflow, command, interface, or policy, update both language versions in the same PR.

## Code Style and Scope

- Prefer focused PRs that solve one problem at a time.
- Keep architecture notes, CLI docs, and user-facing copy aligned with the code you ship.
- Conventional Commits are recommended, especially for public history, but they are not enforced by automation yet.

## Pull Requests

1. Branch from `main`.
2. Make the smallest complete change that solves the problem.
3. Run the checks listed above.
4. Update docs and screenshots when user-facing behavior changes.
5. Explain the problem, the fix, and any follow-up work in the PR description.

## Areas That Commonly Need Tests

- Authentication and session changes
- WebSocket command routing
- Plugin discovery and plugin configuration
- Human-web route, shell, or translation changes
- Runtime behavior in built-in plugins

## Architecture References

- Root README: [`README.md`](README.md)
- Server overview: [`packages/server/README.md`](packages/server/README.md)
- Core architecture: [`docs/server/core-architecture.md`](docs/server/core-architecture.md)
- Plugin development: [`docs/server/plugin-development.md`](docs/server/plugin-development.md)
- Arcade game development: [`docs/server/arcade-game-development.md`](docs/server/arcade-game-development.md)

## Reporting Bugs and Security Issues

- Use GitHub Issues for bugs, feature requests, and docs problems.
- Do **not** open public issues for security vulnerabilities. Follow [`SECURITY.md`](SECURITY.md) instead.

## Code of Conduct

This project follows the Contributor Covenant. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
