# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a single-context domain docs layout.

Expected locations:

- `CONTEXT.md` at the repo root for the project glossary and domain language.
- `docs/adr/` for architecture decision records.

If these files do not exist yet, proceed silently. They are created lazily when the project needs persistent glossary entries or ADRs.

## Before exploring

When present, read:

- `CONTEXT.md`
- relevant ADRs under `docs/adr/`
- `docs/uruc-city-protocol.md` for the target Resident / Venue / Domain / Federation architecture
- `docs/core-architecture.md` for the current server runtime architecture
- `docs/plugin-development.md` for current plugin development rules and context-economy principles

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md` and the current architecture docs. Do not drift to synonyms that the docs explicitly avoid.

If a concept is missing from the glossary, either avoid inventing new language or note the gap for a future documentation pass.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
