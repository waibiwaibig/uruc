[English](cli-command-reference.md) | [中文](cli-command-reference.zh-CN.md)

# Uruc CLI Command Reference

This document describes the current CLI implementation in `packages/server/src/cli`.
If this document and the implementation diverge, the code is the source of truth.

## Entry Points

| Platform | Recommended entry point |
| --- | --- |
| macOS / Linux | `./uruc <command>` |
| Windows PowerShell / Command Prompt | `npm run uruc -- <command>` |
| WSL / Git Bash | `./uruc <command>` |

All supported entry points dispatch to the same server CLI.

## Parsing Model

- The top-level dispatcher lives in `packages/server/src/cli/index.ts`.
- The first non-flag token becomes the top-level command.
- The global parser recognizes `--json` and `--lang <zh-CN|en|ko>`.
- All other arguments are forwarded to the selected command.
- `--lang` currently affects `help` and `configure`.
- `plugin`, `source`, and `city` are invoked with raw argument arrays rather than `CommandContext`, so they do not currently participate in the uniform `--json` success-output path used by most core commands.

## Output and JSON Support

| Commands | Current JSON behavior |
| --- | --- |
| `build`, `dashboard`, `stop`, `restart`, `status`, `doctor` | Support `--json` for success output |
| `admin ...` | Most subcommands support `--json` |
| `help`, `configure`, `start`, `logs` | Success output is text only |
| `source list`, `plugin inspect`, `plugin validate` | Always print JSON |
| Other `plugin ...`, `source add/remove`, `city init` | Success output is text only |

Implementation detail that matters for automation:

- For commands that receive `CommandContext`, top-level errors are rendered as `{"error": "..."}` when `--json` is present.
- `plugin`, `source`, and `city` manage their own error formatting today, so their failures are still plain text.

## Recommended Operational Flow

1. Run `uruc configure` for first-time setup or later reconfiguration.
2. Run `uruc start` or `uruc start -b` to bring the city online.
3. Use `uruc status`, `uruc dashboard`, `uruc logs`, and `uruc doctor` for routine operations and troubleshooting.

## Core Runtime Commands

### `uruc configure`

Syntax:

```bash
uruc configure [--quickstart|--advanced] [--section <runtime|access|city|plugins|integrations>] [--yes|--accept-defaults]
```

Current behavior:

- Runs the interactive city configuration flow and writes `packages/server/.env`.
- Ensures a city config exists and synchronizes the city lock before finishing.
- Supports two modes:
  - `--quickstart`: asks fewer questions and targets a runnable default city.
  - `--advanced`: exposes section-by-section reconfiguration.
- Supported advanced sections are `runtime`, `access`, `city`, `plugins`, and `integrations`.
- `--quickstart` cannot be combined with `--section`.
- `--yes` and `--accept-defaults` are synonyms in the current parser.
- `--accept-defaults` currently requires `--quickstart`.
- QuickStart preserves existing path-oriented settings when they already exist, including:
  - `DB_PATH`
  - `CITY_CONFIG_PATH`
  - `PUBLIC_DIR`
  - `UPLOADS_DIR`
  - city-level `pluginStoreDir`
- At the end of the flow, the CLI can save only, start in foreground, or start in managed background mode.

Section scope in the current implementation:

| Section | Current focus |
| --- | --- |
| `runtime` | Bind host, reachability, public host, protocol, ports, static directories |
| `access` | Admin account, registration policy, indexing policy, site password |
| `city` | Database path and city config path |
| `plugins` | Bundled plugin preset, source edits, plugin store path |
| `integrations` | CORS, JWT, Resend mail, Google OAuth, GitHub OAuth |

### `uruc build`

Syntax:

```bash
uruc build [--force] [--json]
```

Current behavior:

- Builds `packages/server` and `packages/human-web`.
- Returns JSON when `--json` is present.
- `--force` is forwarded to the build helper.

### `uruc start`

Syntax:

```bash
uruc start [-b|--background]
```

Current behavior:

- If `packages/server/.env` is missing, launches `uruc configure` first and returns from the normal start path.
- Warns when a repo-root `.env` exists, because only `packages/server/.env` is active.
- Resolves the configured city path and fails if a non-default configured path does not exist.
- Calls `prepareCityRuntime(...)` before boot:
  - synchronizes `uruc.city.lock.json`
  - auto-creates the default city config when the default city path is missing
- Rebuilds automatically when the build output is stale.
- Verifies that the configured HTTP and WebSocket ports are available before starting.
- Starts in one of two modes:
  - foreground by default
  - managed background when `-b` or `--background` is used
- Managed background startup prefers `systemd` when a matching service is installed; otherwise it uses the CLI-managed detached-process path.

### `uruc stop`

Syntax:

```bash
uruc stop [--json]
```

Current behavior:

- Stops a running `systemd` service when one is active.
- Stops the CLI-managed background process when one is recorded and still alive.
- Otherwise, attempts to stop a recognized local unmanaged Uruc process running from the current server package root.
- Returns `{ "stopped": false, "reason": "already_stopped" }` in JSON mode when nothing is running.

### `uruc restart`

Syntax:

```bash
uruc restart [--json]
```

Current behavior:

- Only works for managed background or `systemd` instances.
- Rejects `stopped` and `unmanaged` runtime modes.
- Re-prepares the city runtime and rebuilds if the build output is stale before restarting.

### `uruc status`

Syntax:

```bash
uruc status [--json]
```

Current behavior:

- Reports runtime mode: `stopped`, `background`, `systemd`, or `unmanaged`.
- Reports reachability, bind host, URLs, active env path, DB path, city config path, public dir, admin username, and health state.
- Includes managed PID and managed log path when the runtime is CLI-managed.

### `uruc logs`

Syntax:

```bash
uruc logs [--no-follow]
```

Current behavior:

- Uses `journalctl -u <service>` when Uruc is running as a `systemd` service.
- Otherwise reads the CLI-managed log file.
- Follows logs by default.
- `--no-follow` switches to a finite view.

### `uruc dashboard`

Syntax:

```bash
uruc dashboard [--json]
```

Current behavior:

- Checks runtime health first.
- Opens the site home page when the runtime is reachable.
- In JSON mode, returns whether the dashboard was opened plus the site URL.

### `uruc doctor`

Syntax:

```bash
uruc doctor [--json]
```

Current behavior:

- Checks:
  - active server env presence
  - invalid repo-root `.env`
  - DB path, city config path, and public dir existence
  - reachability and runtime health
  - build freshness
  - admin existence and configured password match state
  - plugin config/lock/runtime consistency
- In JSON mode, includes both high-level checks and per-plugin `pluginChecks`.
- This is the most complete built-in diagnostic command for a broken or partially configured city.

### `uruc help`

Syntax:

```bash
uruc help
```

Current behavior:

- Prints the built-in help text.
- Uses the configured language or the `--lang` override.

## Admin Commands

All admin commands are implemented in `packages/server/src/cli/commands/admin.ts`.

| Command | Current behavior |
| --- | --- |
| `uruc admin create [username] [--password <password>] [--email <email>]` | Creates an admin; prompts for missing fields |
| `uruc admin list` | Lists admins |
| `uruc admin promote <user>` | Promotes an existing user to admin |
| `uruc admin reset-password <user> [--password <password>]` | Resets an admin password; prompts when missing |
| `uruc admin users [--search <term>]` | Lists users, optionally filtered |
| `uruc admin ban <user>` / `unban <user>` | Bans or unbans a user |
| `uruc admin agents` | Lists agents |
| `uruc admin freeze <agent>` / `unfreeze <agent>` | Freezes or unfreezes an agent |
| `uruc admin kick <agent>` | Disconnects an online agent |

Current JSON support:

- `create`
- `list`
- `promote`
- `reset-password`
- `users`
- `ban`
- `unban`
- `agents`
- `freeze`
- `unfreeze`
- `kick`

## Plugin Commands

All plugin commands are implemented in `packages/server/src/cli/plugin-manager.ts`.

| Command | Current behavior |
| --- | --- |
| `uruc plugin list` | Lists configured plugins and their locked revisions |
| `uruc plugin add <alias>` | Resolves an alias from the official marketplace source and installs it into the current city config |
| `uruc plugin install <path>` | Installs a local plugin package by path |
| `uruc plugin install <pluginId> [--source <id>] [--version <version>]` | Resolves a source-backed plugin release and installs it into the current city config |
| `uruc plugin enable <pluginId>` / `disable <pluginId>` | Toggles whether a configured plugin is enabled |
| `uruc plugin uninstall <pluginId>` | Removes a plugin from `uruc.city.json` and re-syncs the lock |
| `uruc plugin update [pluginId]` | Refreshes source-backed plugin versions and re-syncs the lock |
| `uruc plugin rollback <pluginId>` | Rolls the lock entry back to the most recent history entry |
| `uruc plugin inspect <pluginId>` | Prints JSON containing both config and lock state |
| `uruc plugin validate <pluginId|path>` | Prints the resolved plugin manifest as JSON |
| `uruc plugin doctor` | Inspects configured plugins and reports warnings or failures |
| `uruc plugin gc [--dry-run]` | Removes unused materialized plugin revisions from the plugin store |
| `uruc plugin pack <path> [--out <dir>]` | Builds a publishable plugin artifact, including `frontend-dist/` when the plugin declares `urucFrontend` |
| `uruc plugin create <pluginId> [--frontend] [--dir <path>]` | Generates a new backend plugin scaffold, optionally with frontend package metadata |

Important current details:

- `plugin add <alias>` is a convenience command for the official marketplace source:
  - source id: `official`
  - registry URL: `https://uruk.life/market/registry.json`
- `plugin install <path>` stores the plugin as a local development override.
- `plugin pack <path>` builds `frontend-dist/` into a temporary staged package and then runs `npm pack`.
- `plugin update` skips plugins that are configured through `devOverridePath`.
- `plugin doctor` exits non-zero when hard failures are found.
- `plugin inspect` and `plugin validate` always print JSON, even without `--json`.

## Source Commands

All source commands are implemented in `packages/server/src/cli/source-manager.ts`.

| Command | Current behavior |
| --- | --- |
| `uruc source list` | Prints the configured source array as JSON |
| `uruc source add <id> <registry>` | Adds or replaces a source entry with `type: "npm"` |
| `uruc source remove <id>` | Removes a source entry |

Current source-resolution behavior:

- The source manager stores the source exactly as `{ id, type: "npm", registry }`.
- The source resolver accepts:
  - a local directory containing `uruc-registry.json`
  - a direct local `uruc-registry.json` path
  - a `file://` URL
  - an HTTP(S) registry URL

## City Commands

All city commands are implemented in `packages/server/src/cli/city-manager.ts`.

| Command | Current behavior |
| --- | --- |
| `uruc city init` | Creates an empty city config when it does not already exist |

Current `city init` output file:

- `apiVersion: 2`
- `approvedPublishers: ["uruc"]`
- `pluginStoreDir: ".uruc/plugins"`
- `plugins: {}`

## Operational Notes

- The repo-root `.env` file is ignored by the runtime and CLI; `packages/server/.env` is the active env file.
- `start` and `restart` prepare the city runtime before process startup, but the server bootstrap itself loads plugins from the city lock file that already exists on disk.
- `plugin uninstall`, `plugin enable`, and `plugin disable` update config and lock files; they do not hot-unload or hot-reload an already running server process.
- `plugin gc` keeps the current locked revision and the most recent rollback revision for each locked plugin.
- `stop` can terminate a recognized unmanaged local process; `restart` cannot restart unmanaged processes.
