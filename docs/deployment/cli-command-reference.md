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

| Command | Purpose |
| --- | --- |
| `uruc configure` | Run the guided city runtime configurator and write `packages/server/.env` |
| `uruc build [--force]` | Build `packages/server` and `packages/human-web` |
| `uruc start [-b\|--background]` | Start the runtime in foreground or background mode |
| `uruc stop` | Stop a managed background process or systemd service |
| `uruc restart` | Restart a managed background process or systemd service |
| `uruc status` | Show runtime mode, config source, URLs, DB path, and health |
| `uruc logs [--no-follow]` | Show the managed log file, following by default |
| `uruc dashboard` | Open the site home page if the runtime is reachable |
| `uruc doctor` | Diagnose config, build freshness, admin state, plugin state, and health |
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
| `uruc plugin list` | Show configured and discovered plugins |
| `uruc plugin enable <name>` | Enable a plugin in the active plugin config |
| `uruc plugin disable <name>` | Disable a plugin in the active plugin config |
| `uruc plugin install <path>` | Install a plugin from a local directory |
| `uruc plugin uninstall <name>` | Soft-uninstall a plugin by disabling it |
| `uruc plugin uninstall <name> --hard` | Delete the plugin directory |
| `uruc plugin discover` | Scan configured plugin search paths |

## Notes

- `configure` and `help` are the only commands that use the `--lang` switch today.
- `start`, `stop`, and `restart` distinguish between managed background instances, systemd services, and unmanaged local processes.
- `configure` is about city runtime state, not nginx / SSL / systemd / landing-page topology.
- `doctor` is the best first command when a fresh runtime config does not behave as expected.
