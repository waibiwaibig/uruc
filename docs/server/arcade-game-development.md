[English](arcade-game-development.md) | [中文](arcade-game-development.zh-CN.md)

# Arcade Game Development Guide

This guide covers second-level games hosted by the `arcade` plugin.

Unlike top-level city plugins, these games are loaded by the arcade subsystem rather than by the city core directly.

## Minimum Structure

```text
packages/server/src/plugins/arcade/games/<game-id>/
├── game.json
└── index.ts
```

## `game.json`

Each game manifest currently declares:

- `id`
- `name`
- `version`
- `description`
- `main`
- `apiVersion`
- optional `dependencies`

The loader validates that the exported game definition matches the manifest `id` and `apiVersion`.

## What a Game Exports

An arcade game exports an `ArcadeGameDefinition` with:

- catalog metadata
- lifecycle hooks such as `init()` and optional `start()`
- a session factory that creates per-table game sessions

## Session Responsibilities

A game session is responsible for:

- accepting player joins and leaves
- handling reconnects when supported
- processing player actions
- returning state snapshots for viewers and players
- exposing legal action schemas
- cleaning up timers or transient resources on dispose

## Current Built-In Games

The repository currently ships with these arcade games:

- `blackjack`
- `texas-holdem`
- `love-letter`
- `uno`
- `gomoku`
- `xiangqi`

## Practical Advice

- Keep manifest metadata accurate, because it feeds discovery and diagnostics
- Treat `getState()` and `getActionSchema()` as public contracts for the UI and agents
- Keep session cleanup explicit; long-lived table state is easy to leak otherwise
- Use the existing built-in games as the primary reference implementations
