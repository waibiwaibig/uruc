# README Front Door Design

**Date:** 2026-03-21
**Scope:** Upgrade the opening sections of `README.md` and `README.zh-CN.md`
**Status:** Approved in chat before implementation

## Goal

Give the repository a stronger GitHub front door that feels more designed and brand-aware, while keeping the README factual, developer-friendly, and easy to act on.

## Current State

The existing opening sections are structurally correct but visually plain:

- language switcher
- `# Uruc`
- one slogan heading
- two descriptive paragraphs
- one navigation line

This presents the facts, but it does not create a strong first impression or a clear brand moment on GitHub.

## Constraints

- Keep all claims grounded in facts already supported by the repository
- Do not introduce exaggerated marketing copy
- Keep GitHub rendering stable without depending on external badge services
- Upgrade both `README.md` and `README.zh-CN.md`
- Use the provided brand icon at `/Users/waibiwaibi/uruk/uruc宣传资料/uruc.png`
- Because GitHub cannot render local machine paths, copy that image into this repository before referencing it in README content

## Chosen Direction

Use a balanced front-door design:

- a stronger brand hero at the top
- immediate factual positioning below it
- quick navigation and a concrete start command close to the top

This preserves developer efficiency while making the repository feel more premium and intentional.

## Rejected Alternatives

### Poster-heavy Hero

Pros:

- strongest visual impact
- closest to the referenced OpenClaw style

Cons:

- slower to scan for technical readers
- pushes action-oriented content too far down

### Minimal Documentation Refresh

Pros:

- lowest risk
- smallest change set

Cons:

- does not meaningfully close the perceived quality gap
- still looks like a standard unstyled README

## Information Architecture

The new opening sequence should be:

1. Language switcher
2. Centered brand hero
3. Centered brand statement
4. Centered factual product description
5. Centered fact tags
6. Centered primary navigation
7. Clear start command callout
8. Existing `Getting Started` or `快速开始` section body

## Visual Structure

Use GitHub-safe HTML only for the hero block so alignment and image sizing are controlled. Return to normal Markdown immediately after the hero to keep maintenance simple.

The hero should include:

- repository-local brand image
- `Uruc` title
- a stronger primary statement
- a short factual positioning paragraph

Avoid:

- animated assets
- shields.io badges
- decorative tables
- heavy HTML layouts throughout the file

## Copy Direction

### English

Primary statement:

`AI agents need a city, not just a chat window.`

Factual positioning line:

`A real-time city runtime for humans and AI agents, combining account management, agent control, live HTTP + WebSocket flows, and a V2 plugin platform.`

### Chinese

Primary statement:

`AI agents 需要一座城市，而不只是一个聊天窗口。`

Factual positioning line:

`一个面向人类与 AI agents 的实时城市运行时，把账户体系、agent 控制、实时 HTTP + WebSocket 流程与 V2 插件平台放进同一套底座。`

## Fact Tags

Represent fact tags using inline code-style chips rather than external badges.

Recommended tags:

- `Pre-1.0`
- `Runs End to End`
- `HTTP + WebSocket`
- `V2 Plugin Platform`

These tags should stay factual and stable across both languages unless a localized label is clearly better in Chinese.

## Trust And Entry Layer

Immediately under the hero:

- keep a concise status note based on the current README's existing pre-1.0 statement
- keep a strong documentation navigation row
- surface `./uruc configure` near the top as the clearest first action

This layer should answer:

- what is this
- how mature is it
- where do I click
- what do I run first

## Files To Modify

- Create: `docs/assets/uruc-logo.png`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

## Implementation Notes

- Preserve the existing section bodies as much as possible below the upgraded front door
- Tighten copy where needed for flow, but do not rewrite unrelated sections
- Keep English and Chinese versions structurally parallel, not necessarily word-for-word identical
- Prefer repository-relative image references that render correctly on GitHub

## Acceptance Criteria

- GitHub README opening looks noticeably more polished and brand-led
- The repository-local logo displays correctly
- The first screen communicates both identity and practical entry points
- Both README languages are upgraded together
- No unsupported factual claims are introduced
