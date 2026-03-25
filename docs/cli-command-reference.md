[English](cli-command-reference.md) | [中文](cli-command-reference.zh-CN.md)

# Uruc CLI Command Reference

This document describes the current CLI implementation in `packages/server/src/cli`.
If this document and the implementation diverge, the code is the source of truth.

## Entry Points

| Platform | Recommended entry point |
| --- | --- |
| npm-installed CLI on macOS / Linux / Windows | `uruc <command>` |
| Source checkout on macOS / Linux | `./uruc <command>` |
| Source checkout on Windows PowerShell / Command Prompt | `npm run uruc -- <command>` |
| Source checkout on WSL / Git Bash | `./uruc <command>` |

All supported entry points dispatch to the same server CLI.

## Parsing Model

- The top-level dispatcher lives in `packages/server/src/cli/index.ts`.
- The first non-flag token becomes the top-level command.
- The global parser recognizes `--json` and `--lang <zh-CN|en|ko>`.
- All other arguments are forwarded to the selected command.
- `--lang` currently affects `help` and `configure`.
- `plugin` now receives `CommandContext`, so it participates in the same top-level JSON error rendering as the core commands.
- `city` still receives raw argument arrays.

## Output and JSON Support

| Commands | Current JSON behavior |
| --- | --- |
| `build`, `dashboard`, `stop`, `restart`, `status`, `doctor` | Support `--json` for success output |
| `admin ...` | Most subcommands support `--json` |
| `help`, `configure`, `start`, `logs` | Success output is text only |
| `plugin list`, `plugin scan`, `plugin inspect`, `plugin source list` | Support `--json` |
| `plugin validate` | Always prints JSON |
| Other `plugin ...`, `city init` | Success output is text only |

Implementation detail that matters for automation:

- For commands that receive `CommandContext`, top-level errors are rendered as `{"error": "..."}` when `--json` is present.
- That now includes `plugin ...`.
- `city` still manages its own error formatting today, so its failures remain plain text.

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

- Runs the interactive city configuration flow and writes the active server env file:
  - source checkout: `packages/server/.env`
  - npm-installed CLI: `<runtime-home>/.env`
- Ensures a city config exists and synchronizes the city lock before finishing.
- Supports two modes:
  - `--quickstart`: asks fewer questions and targets a runnable default city.
  - `--advanced`: opens a persistent hub menu and saves section changes immediately.
- In interactive Advanced mode, the main menu now includes `runtime`, `access`, `city`, `plugins`, `integrations`, `review summary`, and `finish`.
- Supported direct section shortcuts remain `runtime`, `access`, `city`, `plugins`, and `integrations` through `--advanced --section ...`.
- `--quickstart` cannot be combined with `--section`.
- `--yes` and `--accept-defaults` are synonyms in the current parser.
- `--accept-defaults` currently requires `--quickstart`.
- QuickStart preserves existing path-oriented settings when they already exist, including:
  - `DB_PATH`
  - `CITY_CONFIG_PATH`
  - `PUBLIC_DIR`
  - `UPLOADS_DIR`
  - city-level `pluginStoreDir`
- Plugin onboarding is now runtime-first:
  - workspace plugins are source code under `packages/plugins/*`
  - installed plugins are declared in `uruc.city.json` / `uruc.city.lock.json`
  - the runtime plugin store is `.uruc/plugins/*`
- QuickStart can offer to link recommended workspace plugins.
- The Advanced `plugins` menu is now a thin UI over the normal plugin lifecycle commands:
  - a top-level grouped menu for viewing plugins, managing installed plugins, adding plugins, editing the runtime plugin store path, and going back
  - installed-plugin actions are grouped in their own submenu
  - add-plugin actions are grouped in their own submenu
  - installed-plugin pickers now include an explicit `back` entry
- Source editing moved out of `configure`; use `uruc plugin source ...`.
- At the end of the flow, the CLI can save only, start in foreground, or start in managed background mode.

Section scope in the current implementation:

| Section | Current focus |
| --- | --- |
| `runtime` | Bind host, reachability, public host, protocol, ports, static directories |
| `access` | Admin account, registration policy, indexing policy, site password |
| `city` | Database path and city config path |
| `plugins` | Installed plugin lifecycle actions plus plugin store path editing |
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

- If the active server env file is missing, launches `uruc configure` first and returns from the normal start path.
- In source checkouts, warns when a repo-root `.env` exists, because only `packages/server/.env` is active there.
- Resolves the configured city path and fails if a non-default configured path does not exist.
- Calls `prepareCityRuntime(...)` before boot:
  - synchronizes `uruc.city.lock.json`
  - auto-creates an empty default city config when the default city path is missing
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

Current mental model:

- `packages/plugins/*` are workspace plugin source packages.
- `uruc.city.json` and `uruc.city.lock.json` define which plugins are installed for the current city.
- `.uruc/plugins/*` is the materialized runtime plugin store that the server actually boots from.

| Command | Current behavior |
| --- | --- |
| `uruc plugin list` | Lists installed plugins, including install origin, configured version, revision, and runtime store path |
| `uruc plugin install <pluginId> [--source <id>] [--version <version>]` | Resolves a source-backed plugin release and installs it into the current city config |
| `uruc plugin install <alias>` | Resolves an alias from the official marketplace source and installs it into the current city config |
| `uruc plugin link <path>` | Links a local workspace/plugin path into the current city for development |
| `uruc plugin enable <pluginId>` / `disable <pluginId>` | Toggles whether a configured plugin is enabled |
| `uruc plugin remove <pluginId>` | Removes a plugin from `uruc.city.json` and re-syncs the lock |
| `uruc plugin unlink <pluginId>` | Removes a linked local plugin; source-backed plugins must use `remove` |
| `uruc plugin update [pluginId]` | Refreshes source-backed plugin versions and re-syncs the lock |
| `uruc plugin rollback <pluginId>` | Rolls the lock entry back to the most recent history entry |
| `uruc plugin inspect <pluginId>` | Prints JSON containing both config and lock state |
| `uruc plugin validate <pluginId|path>` | Prints the resolved plugin manifest as JSON |
| `uruc plugin doctor` | Inspects configured plugins and reports warnings or failures |
| `uruc plugin gc [--dry-run]` | Removes unused materialized plugin revisions from the plugin store |
| `uruc plugin scan [--scope workspace|sources|installed|all] [--json]` | Groups visible plugins by workspace, configured sources, and installed city plugins |
| `uruc plugin source list` / `add <id> <registry>` / `remove <id>` | Manages configured plugin sources under the `plugin` namespace |
| `uruc plugin pack <path> [--out <dir>]` | Builds a publishable plugin artifact, including `frontend-dist/` when the plugin declares `urucFrontend` |
| `uruc plugin create <pluginId> [--frontend] [--dir <path>]` | Generates a new backend plugin scaffold, optionally with frontend package metadata |

Important current details:

- `plugin install <alias>` resolves against the official marketplace source by default:
  - source id: `official`
  - registry URL: `https://uruk.life/uruchub/registry.json`
- `plugin add`, `plugin uninstall`, and `plugin install <path>` were removed and now fail with migration guidance.
- `plugin link <path>` stores the plugin as a local development override.
- `plugin pack <path>` builds `frontend-dist/` into a temporary staged package and then runs `npm pack`.
- `plugin update` skips plugins that are configured through `devOverridePath`.
- `plugin doctor` exits non-zero when hard failures are found.
- `plugin inspect` and `plugin validate` always print JSON, even without `--json`.

## Plugin Source Commands

All source commands now live under `uruc plugin source ...`.

| Command | Current behavior |
| --- | --- |
| `uruc plugin source list` | Prints the configured source array, with `--json` support |
| `uruc plugin source add <id> <registry>` | Adds or replaces a source entry with `type: "npm"` |
| `uruc plugin source remove <id>` | Removes a source entry |

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

- Source checkouts use `packages/server/.env` as the active env file and ignore the repo-root `.env`.
- npm-installed CLIs use `<runtime-home>/.env` by default, or the `URUC_HOME` override when present.
- `start` and `restart` prepare the city runtime before process startup, but the server bootstrap itself loads plugins from the city lock file that already exists on disk.
- `plugin remove`, `plugin unlink`, `plugin enable`, and `plugin disable` update config and lock files; they do not hot-unload or hot-reload an already running server process.
- `plugin gc` keeps the current locked revision and the most recent rollback revision for each locked plugin.
- `stop` can terminate a recognized unmanaged local process; `restart` cannot restart unmanaged processes.
