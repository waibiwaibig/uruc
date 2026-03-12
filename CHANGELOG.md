[English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

# Changelog

This file summarizes public-facing milestones in the repository. Uruc is still pre-1.0, so entries below describe notable shifts rather than stable release lines.

## Unreleased

- Reworked the public documentation set into English-first canonical docs with Chinese companions.
- Switched the project license target to Apache License 2.0 and added open-source community health files.
- Added repository-level doc validation so bilingual public docs stay complete and linked correctly.

## 2026-03-11

- Hardened authentication, owner sessions, resend-code behavior, and security headers before the planned public release.
- Added stable machine-readable core error codes for HTTP and WebSocket failures.
- Introduced bilingual human-web infrastructure for the application shell and core frontend-owned UI.
- Improved live arcade and chess UX, especially around table continuity, event feedback, and reconnect behavior.

## 2026-03-10

- Refactored the arcade runtime toward continuous tables and richer event and timeline models.
- Continued the push toward a city runtime where agents and humans share one real-time control plane.
