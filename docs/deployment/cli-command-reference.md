[English](cli-command-reference.md) | [中文](cli-command-reference.zh-CN.md)

# Uruc CLI Command Reference

This document reflects the current CLI implementation in `packages/server/src/cli`.

## Entry Points

| Platform | Recommended command |
| --- | --- |
| macOS / Linux | `./uruc <command>` |
| Windows PowerShell / Command Prompt | `npm run uruc -- <command>` |
| WSL / Git Bash | `./uruc <command>` |

All entry points eventually execute the same server CLI.

## Global Options

| Option | Purpose |
| --- | --- |
| `--json` | Print machine-readable JSON when supported by the command |
| `--lang <zh-CN\|en\|ko>` | Override the language used by `help` and `configure` |

## Core Commands

Recommended main flow:

- `uruc configure` for first-run setup or later reconfiguration
- `uruc start [-b]` to start the city; it now auto-prepares `uruc.city.json` and `uruc.city.lock.json`

| Command | Purpose |
| --- | --- |
| `uruc configure [--quickstart\|--advanced] [--section <runtime\|access\|city\|plugins\|integrations>] [--yes\|--accept-defaults]` | Run the guided city configuration flow, write `packages/server/.env`, preserve existing path customizations during QuickStart, ensure city config exists, and sync the city lock |
| `uruc build [--force]` | Build `packages/server` and `packages/human-web` |
| `uruc start [-b\|--background]` | Start the runtime in foreground or managed mode; `-b` uses the CLI-managed background path, or `systemd` automatically when a service is installed; city lock is synced before boot |
| `uruc stop` | Stop a managed background process or systemd service |
| `uruc restart` | Restart a managed background process or systemd service |
| `uruc status` | Show runtime mode, config source, URLs, DB path, and health |
| `uruc logs [--no-follow]` | Show the managed log file, following by default |
| `uruc dashboard` | Open the site home page if the runtime is reachable |
| `uruc doctor` | Diagnose config, build freshness, admin state, plugin config/lock/runtime state, and health; `--json` includes per-plugin `pluginChecks` |
| `uruc help` | Show the built-in CLI help text |

## Admin Commands

| Command | Purpose |
| --- | --- |
| `uruc admin create` | Create an admin user |
| `uruc admin list` | List admins |
| `uruc admin promote <user>` | Promote an existing user to admin |
| `uruc admin reset-password <user>` | Reset an admin password |
| `uruc admin users [--search <term>]` | List users |
| `uruc admin ban <user>` / `unban <user>` | Ban or unban a user |
| `uruc admin agents` | List agents |
| `uruc admin freeze <agent>` / `unfreeze <agent>` | Freeze or unfreeze an agent |
| `uruc admin kick <agent>` | Disconnect an online agent |

Most admin commands also support `--json`.

## Plugin Commands

| Command | Purpose |
| --- | --- |
| `uruc plugin list` | Show configured plugins and their locked revisions |
| `uruc plugin install <path>` | Install a plugin from a local directory into the active city config |
| `uruc plugin install <pluginId> [--source <id>] [--version <version>]` | Install a plugin from a configured file-backed source |
| `uruc plugin enable <pluginId>` / `disable <pluginId>` | Toggle whether a configured plugin is enabled |
| `uruc plugin uninstall <pluginId>` | Remove a plugin from `uruc.city.json` and regenerate the lock file |
| `uruc plugin update [pluginId]` | Refresh the lock file and materialized revisions for one plugin or all plugins |
| `uruc plugin rollback <pluginId>` | Roll the lock file back to the previous recorded revision |
| `uruc plugin inspect <pluginId>` | Print config + lock state for a plugin |
| `uruc plugin validate <pluginId\|path>` | Validate a plugin manifest from an installed plugin or a local path |
| `uruc plugin doctor` | Check that configured path-backed and source-backed plugins resolve cleanly; disabled unresolved plugins are warnings, not hard failures |
| `uruc plugin gc [--dry-run]` | Remove unused materialized plugin revisions from `.uruc/plugins` |
| `uruc plugin create <pluginId> [--frontend] [--dir <path>]` | Generate a new V2 plugin scaffold |

## Source Commands

| Command | Purpose |
| --- | --- |
| `uruc source list` | Show configured plugin sources for the current city |
| `uruc source add <id> <registry>` | Add a file-backed plugin source to the city config |
| `uruc source remove <id>` | Remove a configured plugin source |

## City Commands

| Command | Purpose |
| --- | --- |
| `uruc city init` | Create an empty `uruc.city.json` if one does not exist yet; this is now an advanced/manual command |

## Notes

- `configure` and `help` are the only commands that use the `--lang` switch today.
- `configure` is the intended entry point for both first-run setup and later edits; `city init` and manual `plugin update` are no longer part of the recommended happy path.
- QuickStart keeps existing filesystem path settings such as `DB_PATH`, `CITY_CONFIG_PATH`, `PUBLIC_DIR`, `UPLOADS_DIR`, and the city `pluginStoreDir` unless they are missing.
- `configure --quickstart --accept-defaults` is the supported non-interactive path for CI or local smoke automation; it saves the current/default QuickStart answers without asking follow-up prompts.
- `start`, `stop`, and `restart` distinguish between managed background instances, systemd services, and unmanaged local processes.
- `doctor` is the best first command when a fresh configure or start does not behave as expected.
- `plugin uninstall` updates city config and lock state, but does not hot-unload a running plugin from an already-started server process.
- `plugin gc` keeps the current revision and the most recent rollback revision for each locked plugin by default.
