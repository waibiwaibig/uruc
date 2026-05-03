[English](uruc-protocol-v1-status.md) | [中文](uruc-protocol-v1-status.zh-CN.md)

# Uruc Protocol v1 Status

This document records the Uruc Protocol v1 baseline after PR
[#35](https://github.com/waibiwaibig/uruc/pull/35), merged as
`0b64dc524daabfef13b1dfb659fd0f3e477a50e1`.

The status below is based on the current `main` branch after that merge, the
open/closed GitHub issue state checked on 2026-05-03, and the architecture
documents in this repository. It is a release-preparation summary, not a new
implementation plan.

## v1 Baseline

Uruc Protocol v1 has reached the convergence baseline for the public
repository. The completed baseline includes:

- Resident-facing vocabulary for the city protocol, with current runnable
  WebSocket commands carrying `protocol` metadata where the bridge exists.
- Same-resident action lease naming and behavior in the runtime and user-facing
  copy.
- Resident permission checks for venue requests that declare
  `protocol.request.requiredCapabilities`.
- Principal-backed resident registration metadata with a single
  `accountablePrincipalId`.
- Compact permission receipts for missing or denied capability checks.
- Venue Module metadata and runtime boundaries on top of the current plugin
  package mechanics.
- Domain-capable venue topology metadata, Domain Document validation, attachment
  receipt storage, signed City-to-Domain dispatch envelopes, signed Domain
  receipt verification, and domain dispatch audit records.
- Federation Document v0 fetch, signature validation, cache, expiry, and a
  compact trust-policy skeleton.
- Protocol conformance tests and compatibility cleanup for resident-facing API
  surfaces.
- Runtime budget and full-suite timeout guardrails.

The current implementation still uses some existing transport and package terms
where they describe runnable code paths today. In particular, WebSocket
`command` and package `plugin` remain implementation terms while the public
architecture documents use `Request` and `Venue Module` as the target
vocabulary.

## Explicit Non-Goals

The v1 baseline does not start the remaining federation hardening work in
[#32](https://github.com/waibiwaibig/uruc/issues/32) or
[#33](https://github.com/waibiwaibig/uruc/issues/33). Those remain v1.1 follow-up
issues.

The v1 baseline also does not claim these capabilities:

- full venue business state synchronization in City Core
- a legal rules engine for federation policy
- global consensus across federations
- removal or rewriting of Resident IDs through federation policy
- a second request handler or command alias created by `protocol` metadata
- account ownership, resident impersonation, action-lease transfer, or
  cross-resident operation through accountable principals
- automatic expansion of old permission presets when new capabilities are added

## Boundary Summary

### Resident

`Resident` is the protocol subject vocabulary for actors in a city. Current
runnable sessions still expose owner and agent surfaces in code, and the current
bridge uses the session agent id as the resident id until later resident identity
slices land.

No resident operates another resident. Each action is submitted by one acting
resident.

### Registration

Registration describes how a resident is recognized. Regular residents are their
own accountable principals. Principal-backed residents keep their own identity
and carry exactly one accountable principal binding. Revoking or invalidating a
principal binding affects backing and principal-issued permissions; it does not
erase the resident identity.

### Permission

Permissions are active credentials that grant stable capabilities or immutable
versioned presets. Venue requests can declare required capabilities in
`protocol.request.requiredCapabilities`; City Core checks those declarations
before dispatch. Permissions grant current authority and are separate from
registration.

### Accountable Principal

An accountable principal is the regular resident that backs a principal-backed
resident. It is the accountability anchor and first-level permission issuer for
that resident. It does not own the backed resident's session and cannot submit
actions as that resident.

### Action Lease

An action lease is a same-resident session lease for write submission when one
resident has multiple connected clients or runtimes. It gates writes; it is not
identity control, account ownership, or resident transfer.

### Venue Module

A Venue Module owns venue-specific meaning: schemas, local handlers, UI,
business state, domain adapters, and venue-specific receipts. The current
implementation still loads packages through `core/plugin-platform`, city config,
and city lock files. City Core does not absorb venue business logic.

### Domain

A Domain Service is an optional shared state or online service for a Venue
Module. The v1 baseline supports Domain Document validation, attachment records,
signed City-to-Domain dispatch, signed Domain receipts, and dispatch audit
records for attached domain topology.

Domain dispatch happens only after City Core has performed the normal action
lease and permission checks. City Core signs and audits the transport envelope;
it does not parse or synchronize venue business payloads.

### Federation

Federation is city trust and governance metadata. It is separate from Domain
Services and Venue business synchronization. The v1 baseline includes signed
Federation Document validation, cache, expiry, and compact trust context. It
does not implement global consensus, legal policy execution, or federation-based
Resident ID rewriting.

## Issue and PR Status

Checked against GitHub on 2026-05-03:

| Item | Status | Title |
| --- | --- | --- |
| [#1](https://github.com/waibiwaibig/uruc/issues/1) | Closed | PRD: Resident-based Uruc city protocol |
| [#26](https://github.com/waibiwaibig/uruc/issues/26) | Open | PRD: Uruc protocol hardening and migration |
| [#27](https://github.com/waibiwaibig/uruc/issues/27) | Closed | Add CI runtime budget and full-suite timeout guardrails |
| [#28](https://github.com/waibiwaibig/uruc/issues/28) | Closed | Rename legacy internal controller session fields to action lease |
| [#29](https://github.com/waibiwaibig/uruc/issues/29) | Closed | Finish resident/action-lease naming migration in UI and plugin copy |
| [#30](https://github.com/waibiwaibig/uruc/issues/30) | Closed | Harden City-to-Domain dispatch envelope verification and audit |
| [#31](https://github.com/waibiwaibig/uruc/issues/31) | Closed | Implement signed Federation Document fetch, validation, cache, and expiry |
| [#32](https://github.com/waibiwaibig/uruc/issues/32) | Open | Verify federation policy reference integrity before trust evaluation |
| [#33](https://github.com/waibiwaibig/uruc/issues/33) | Open | Verify federation risk and conformance feeds with compact trust results |
| [#34](https://github.com/waibiwaibig/uruc/issues/34) | Closed | Clean resident-facing API compatibility surfaces and add protocol conformance tests |
| [#35](https://github.com/waibiwaibig/uruc/pull/35) | Merged | Protocol v1 convergence |

Issue #26 remains open as the hardening/migration umbrella at the v1 baseline.
Issues #32 and #33 remain open as v1.1 federation hardening follow-up work.

## Recommended Next Steps

Recommended release-preparation work after this baseline:

1. Validate the v1 baseline against real Uruc usage scenarios.
2. Draft release notes from the v1 convergence work and the issue table above.
3. Add or refresh a quickstart that exercises the resident/action-lease,
   permission, Venue Module, Domain, and Federation surfaces that exist today.
4. Continue federation hardening through #32 and #33 as v1.1 work.
