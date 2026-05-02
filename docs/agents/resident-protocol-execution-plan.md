# Resident Protocol Execution Plan

This document is the handoff plan for implementing the Resident-based Uruc City Protocol. It is written for a fresh Codex session or an orchestrating agent that may delegate individual GitHub issues to subagents.

## Current State

The architecture discussion has already been captured in:

- `docs/uruc-city-protocol.md` — target architecture and vocabulary.
- `docs/uruc-city-protocol.zh-CN.md` — Chinese companion.
- GitHub issue #1 — PRD: Resident-based Uruc city protocol.
- GitHub issues #2 through #13 — implementation slices.
- `docs/agents/issue-tracker.md` — GitHub issue tracker setup.
- `docs/agents/triage-labels.md` — triage label mapping.
- `docs/agents/domain.md` — domain docs consumption rules.

Two commits exist on top of the previous main history:

- `6621a86 docs: define uruc city protocol`
- `a37ef2c docs: configure agent issue workflow`

There are unrelated untracked log files in the workspace:

- `build_output.log`
- `test_head.log`
- `test_output.log`

Do not include those logs in implementation commits unless a later task explicitly asks for them.

## Architecture Summary

The target model is:

- `Resident` is the only city subject.
- Identity, registration, and permission are separate.
- Registration has two main forms:
  - `regular`
  - `principal-backed`
- A principal-backed resident has exactly one accountable principal.
- Every resident acts only as itself. No takeover, impersonation, or cross-resident operation.
- `controller`/`claim_control` should evolve into same-resident `action lease` language.
- `command` should evolve into `Request`.
- `Event` is an append-only fact.
- `Receipt` is a processing result.
- City Core owns authority: identity, registration, permission, session/action lease, authorization, audit, signed envelopes, and domain trust.
- Venue Module owns meaning: schemas, capabilities, local state, UI, and optional domain adapter.
- Domain Service is a Venue's optional shared state or online service.
- Federation is a city trust/governance alliance, not plugin business synchronization.
- Intercity Protocol standardizes signed communication, credential verification, and receipts.
- Venue Domain Protocols own plugin-specific state synchronization.
- Context Economy is a protocol-wide requirement: compact responses, stable ids, refs, pagination, sparse push, detail pull.

## Execution Rule

Do not attempt the whole protocol in one branch.

Each GitHub issue is a vertical slice. Implement one issue per agent session unless explicitly orchestrating independent subagents in separate worktrees.

Avoid permanent compatibility shims. If a temporary alias or adapter is necessary, document:

- why it exists
- which issue or milestone removes it
- which tests cover the transition

Use Matt Pocock's engineering skills during implementation:

- Use `/tdd` for each implementation issue. The default loop is red, green, refactor: write or update a failing behavior test first, implement the narrow fix, then refactor while keeping tests green.
- Use `/diagnose` when a test failure, runtime failure, or behavior regression is not immediately understood. The expected loop is reproduce, minimize, hypothesize, instrument, fix, and regression-test.
- Use `/zoom-out` only when the agent is unfamiliar with a code area and needs to understand how it fits into the larger system before editing.
- Do not use `/diagnose` as a substitute for `/tdd`; use it when the feedback loop reveals a bug or unclear failure.

## Dependency Order

Parent:

- #1 PRD: Resident-based Uruc city protocol

Implementation slices:

1. #2 Introduce resident protocol vocabulary in public docs and runtime types
2. #3 Replace controller language with same-resident action lease
3. #4 Add capability declarations to venue request registration
4. #5 Implement permission credential MVP for regular residents
5. #6 Implement principal-backed resident registration MVP
6. #7 Convert trustMode and confirmation into permission approval flow
7. #8 Rename plugin architecture surface to Venue Module
8. #9 Add local and domain venue topology declaration
9. #10 Implement Domain Document and attachment handshake MVP
10. #11 Add signed city-to-domain envelope dispatch path
11. #12 Define federation document and trust-policy skeleton
12. #13 Enforce context economy across core request responses

Hard dependency graph:

```text
#1
  -> #2
       -> #3
       -> #4
            -> #5
                 -> #6
            -> #8
                 -> #9
                      -> #10
                           -> #11
                                -> #12
       -> #13
```

Recommended execution:

```text
Batch 1:
  #2 only

Batch 2, after #2 is merged:
  #3, #4, #13 may run in parallel in separate worktrees

Batch 3:
  #5 after #4
  #8 after #4

Batch 4:
  #6 after #5
  #9 after #8

Batch 5:
  #10 after #9
  #11 after #10
  #12 after #11
```

Do not run dependent issues in parallel unless the dependency has already landed.

## Parallel Worktree Guidance

If using subagents, give each subagent its own branch or worktree.

Suggested branch names:

```text
codex/issue-2-resident-vocabulary
codex/issue-3-action-lease
codex/issue-4-capabilities
codex/issue-13-context-economy
```

Do not let multiple agents edit the same working tree. This refactor touches shared types, docs, tests, and runtime behavior. Shared working trees will create avoidable conflicts.

## Standard Prompt For A New Agent

Use this as the base prompt, replacing the issue number.

```text
Work on issue #<number> in /Users/waibiwaibi/uruk/uruc-public.

Read these first:
- docs/agents/domain.md
- docs/uruc-city-protocol.md
- GitHub issue #1
- GitHub issue #<number>

Implement only issue #<number> as a complete vertical slice. Do not implement later issues. Avoid permanent compatibility shims; if a transitional alias is necessary, document the removal path. Preserve existing behavior and run the narrow relevant checks before finishing.

Use /tdd for the implementation loop. If a failure is unclear or the system behaves unexpectedly, switch to /diagnose until the issue is reproduced, minimized, fixed, and regression-tested.

Use the existing repository style. Do not delete unrelated untracked log files. Do not revert user changes.
```

For an orchestrator using subagents:

```text
You may delegate only independent issues whose dependencies are already merged. Each subagent must work in a separate worktree or branch and must only edit files required for its assigned issue. Do not assign dependent issues in parallel.
```

## First Issue Guidance: #2

Start with #2.

Goal:

- Establish Resident / Request / Receipt / Venue terminology in public docs and runtime-facing type surfaces.
- Keep current behavior running.
- Do not add a permanent alias layer that keeps old and new concepts equally alive forever.

Likely code areas to inspect:

- `packages/server/src/core/plugin-system/hook-registry.ts`
- `packages/server/src/core/plugin-platform/types.ts`
- `packages/plugin-sdk/src/backend.ts`
- `packages/server/src/core/server/ws-gateway.ts`
- `docs/plugin-development.md`
- `docs/core-architecture.md`
- `packages/web/src/i18n/resources/en.ts`
- `packages/web/src/i18n/resources/zh-CN.ts`

Do not assume all of those need edits. Read first, then make the smallest complete vertical slice.

Suggested verification:

```bash
npm run docs:check
npm run test --workspace=packages/server -- src/core/auth/__tests__/shadow-agent.test.ts src/core/server/__tests__/ws-gateway-shadow-auth.test.ts
```

Adjust the test command to the actual files touched.

## Issue Notes

### #3 Same-Resident Action Lease

Purpose:

- Reframe controller/claim_control as a same-resident writer lease.
- Preserve duplicate-connection protection for OpenClaw/browser/daemon sessions.
- Remove identity-control language from surfaces touched by this slice.

Do not let this become cross-resident operation. Lease only arbitrates sessions for the same resident identity.

### #4 Capability Declarations

Purpose:

- Requests declare required capabilities.
- Discovery returns capability requirements compactly.
- This is a prerequisite for permission credentials.

Keep capabilities as stable permission units, not raw command ownership.

### #5 Regular Permission Credential MVP

Purpose:

- Regular residents act through city/issuer-issued permissions.
- `canExecute` starts checking permission before dispatch.

This is the first real authorization behavior change. Keep the behavior narrow and well tested.

### #6 Principal-Backed Registration MVP

Purpose:

- Add principal-backed residents with exactly one accountable principal.
- Principal-backed resident acts as itself.
- Principal can issue permissions.

This likely needs product/API decisions if UI scope is unclear. Keep the first flow narrow.

### #7 Permission Approval Flow

Purpose:

- Replace trustMode/confirmation with scoped permission approval.
- Missing permission may return `require_approval`.
- Policy-forbidden actions return `deny`.

Approval should usually create a scoped, time-bound permission credential.

### #8 Venue Module Surface

Purpose:

- Move public architecture language from plugin to Venue Module.
- Preserve current package mechanics.

This should not break package publishing or plugin loading.

### #9 Venue Topology

Purpose:

- Add local/domain_optional/domain_required metadata.
- City config selects runtime mode.

Existing venues default to local.

### #10 Domain Document And Attachment

Purpose:

- Define and verify signed Domain Document.
- City/domain mutual attachment.
- Store time-bound attachment credential.

Domain v0 is bound to exactly one venue/plugin id.

### #11 Signed City-To-Domain Envelope

Purpose:

- Domain-backed venue produces Domain Dispatch Intent.
- City Core signs envelope and audits receipt.

Domain owns shared business state. City Core owns proofs and audit.

### #12 Federation Skeleton

Purpose:

- Federation is city trust/governance.
- It is not plugin state synchronization.

Keep this docs/schema-first unless implementation is necessary to validate the shape.

### #13 Context Economy

Purpose:

- Compact responses across core request/receipt surfaces.
- Summary first, refs over large embedded objects, stable codes, pagination, sparse push/detail pull.

This can run after #2 and in parallel with #3/#4 if separated carefully.

## Completion Criteria For Each Issue

Each issue should end with:

- A concise implementation summary.
- Tests/checks run.
- A note on the `/tdd` loop used, including the first failing or changed test where applicable.
- A note if `/diagnose` was needed, including the reproduced symptom and regression test.
- Any remaining gaps.
- Git status summary.
- A commit or PR if requested by the user.

Do not claim protocol completion from a single slice. Each slice should say which later issue continues the migration.

## Recommended Human Oversight Points

Ask for human review before:

- Changing persistent database schema for residents/permissions.
- Removing current public command ids.
- Changing existing plugin package manifest compatibility.
- Introducing a domain service network dependency.
- Changing authentication/session behavior that affects OpenClaw bridge pairing.

Do not ask for reversible naming or doc edits.
