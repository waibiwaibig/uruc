[English](uruc-protocol-v1-smoke-report.md) | [中文](uruc-protocol-v1-smoke-report.zh-CN.md)

# Uruc Protocol v1 Smoke Verification Report

Verification date: 2026-05-03 (Asia/Shanghai)

Verification base commit: `5e8160feb907c366cde7d23cbb9d407094861d38`

Working branch: `codex/protocol-v1-smoke-report`

This report records a bounded smoke verification of the Uruc Protocol v1
baseline after PR #36 merged the protocol status documents. It uses existing
targeted tests and existing smoke scripts. It does not start the open #32 or #33
federation hardening work.

## Checks Run

| Check | Result |
| --- | --- |
| `npm run test --workspace=@uruc/server -- src/core/server/__tests__/ws-gateway-action-lease.test.ts src/core/server/__tests__/ws-gateway-permission.test.ts src/core/domain/__tests__/domain-attachment.test.ts src/core/domain/__tests__/domain-dispatch.test.ts src/core/federation/__tests__/federation-policy.test.ts src/core/protocol/__tests__/protocol-conformance.test.ts` | Passed: 6 files, 54 tests |
| `npm run uruc:smoke` | Passed |
| `npm run check:bounded` | Passed after serializing concurrent server package builds in `packages/server/scripts/build-package.mjs` |
| `npm run docs:check` | Passed |
| `git diff --check` | Passed |

## Verified Items

### Resident Session and City Entry

Covered by `ws-gateway-action-lease.test.ts` and
`ws-gateway-permission.test.ts`.

The tests authenticate regular, shadow, and principal-backed resident sessions,
then execute `enter_city`. The verified result shape is a WebSocket `result`
receipt, including cases where existing regular agent and shadow resident city
commands remain runnable without venue capability metadata.

### Action Lease

Covered by `ws-gateway-action-lease.test.ts`.

The tests verify that the first write command auto-acquires the same-resident
action lease, that a second same-resident writer is rejected with
`ACTION_LEASE_HELD`, and that the response points at `acquire_action_lease`.
They also verify lease recovery, previous-holder notification, read-only command
behavior, command discovery, non-holder release rejection, and replacement
pushes carrying `citytime`.

### Permission Credential and Permission-Required Receipt

Covered by `ws-gateway-permission.test.ts`.

The tests verify active city-issued credentials for shadow and regular resident
sessions, approved capability dispatch, principal-backed approval dispatch,
expired approval rejection, and approval-forbidden denial. Missing capability
checks are verified before venue dispatch and return compact error receipts with
stable `code`, `text`, `nextAction`, and `details`, including
`PERMISSION_REQUIRED` with `nextAction: require_approval` and
`PERMISSION_DENIED` with `nextAction: deny`.

### Local Venue Module Request

Covered by `domain-dispatch.test.ts` and `ws-gateway-permission.test.ts`.

The local topology fixture registers `acme.local.echo@v1`, executes the request,
calls the local handler once, returns a compact `result` payload
`{ local: true }`, and records no domain dispatch audit rows. Permission fixture
requests also verify local venue dispatch with and without declared required
capabilities.

### Domain Topology, Attachment, and Signed Dispatch

Covered by `domain-attachment.test.ts` and `domain-dispatch.test.ts`.

The tests verify Domain Document validation, attachment receipt storage, attached
domain dispatch after City Core permission checks, signed City-to-Domain
envelopes, signed Domain receipt verification, semantic receipt mismatch
rejection, failed receipt auditing, and the local-topology boundary. No new
domain system or live external Domain Service was invented for this smoke.

### Audit, Receipt, Error Code, and NextAction Shape

Covered by `ws-gateway-action-lease.test.ts`,
`ws-gateway-permission.test.ts`, `domain-dispatch.test.ts`, and
`protocol-conformance.test.ts`.

The targeted tests verify stable action-lease codes, permission-required and
permission-denied receipts, compact domain dispatch success and failure receipts,
domain dispatch audit rows, protocol conformance checks, and the current
`nextAction` migration shape.

### Federation

Covered by `federation-policy.test.ts` and `protocol-conformance.test.ts`.

No live federation network verification was run. The current smoke boundary is
the existing parser, signature validation, bounded fetch/cache diagnostics,
expiry, trust-policy, policy-ref, feed-entry, risk, and conformance tests. The
tests also verify that federation policy results attach to verification output
without deleting or rewriting resident identity.

## Live Verification Boundaries

- No live federation network verification was performed.
- No real deployed Uruc instance was used.
- No new fixture system was created for #32 or #33.
- `npm run uruc:smoke` verifies local quickstart configuration preservation,
  bounded server startup, health, doctor plugin checks, and shutdown. It does
  not itself execute `enter_city`; city-entry behavior is covered by the targeted
  WebSocket tests listed above.

## Follow-Up

- #32: verify federation policy reference integrity before trust evaluation.
- #33: verify federation risk and conformance feeds with compact trust results.
- Run a real deployment smoke after the v1 release candidate is deployed.
