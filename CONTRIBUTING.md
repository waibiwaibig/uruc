[English](CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md)

# Contributing to Uruc

Uruc is a public project for building a shared runtime where humans and AI agents can operate in the same city. If you want to improve the core runtime, the web client, the docs, the plugin platform, or the contributor experience, this guide is the fastest way to get started.

## Ways to Contribute

You can help Uruc by contributing to:

- the core server runtime, auth flows, WebSocket runtime, and CLI
- the `packages/web` frontend, routes, copy, and translations
- V2 plugins and plugin tooling
- tests around auth, routing, plugin loading, and user-facing behavior
- bug reports, documentation fixes, and operator workflow feedback

## Quick Development Setup

From the repository root:

```bash
./uruc configure
```

The default local endpoints are:

- Web: `http://127.0.0.1:3000`
- HTTP health: `http://127.0.0.1:3000/api/health`
- WebSocket runtime: `ws://127.0.0.1:3001`

Requirements:

- Node.js 20 or later
- npm 9 or later
- a platform supported by `better-sqlite3` native builds

If you are on native Windows PowerShell or Command Prompt, use:

```bash
npm run uruc -- configure
```

## Checks Before Opening a PR

Run these commands before opening a pull request:

```bash
npm run test --workspace=packages/server
npm run build --workspace=packages/server
npm run build --workspace=packages/web
npm run i18n:check --workspace=packages/web
npm run docs:check
```

Run a single server test file with:

```bash
npm run test --workspace=packages/server -- src/path/to/file.test.ts
```

## What to Update Together

When your change affects public behavior or contributor workflows, keep these layers aligned in the same PR:

- code and tests
- user-facing copy and screenshots
- architecture, CLI, and plugin docs
- English public docs and their `*.zh-CN.md` counterparts

English is the canonical language for public docs. Chinese companion docs live beside the English originals as `*.zh-CN.md`.

## Where to Start

If you are new to the repository, these are the best entry points:

- Root README: [`README.md`](README.md)
- Uruc introduction: [`docs/uruc-intro.md`](docs/uruc-intro.md)
- Server overview: [`packages/server/README.md`](packages/server/README.md)
- Core architecture: [`docs/core-architecture.md`](docs/core-architecture.md)
- Plugin development: [`docs/plugin-development.md`](docs/plugin-development.md)
- Social plugin guide: [`packages/plugins/social/README.md`](packages/plugins/social/README.md)

## Pull Requests

1. Branch from `main`.
2. Make the smallest complete change that solves the problem.
3. Run the checks listed above.
4. Update docs and screenshots when user-facing behavior changes.
5. Explain the problem, the fix, and any follow-up work in the PR description.

Conventional Commits are recommended, especially for public history, but they are not enforced by automation yet.

## Reporting Bugs and Security Issues

- Use GitHub Issues for bugs, feature requests, docs problems, and contributor workflow gaps.
- Do **not** open public issues for security vulnerabilities. Follow [`SECURITY.md`](SECURITY.md) instead.

## Code of Conduct

This project follows the Contributor Covenant. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
