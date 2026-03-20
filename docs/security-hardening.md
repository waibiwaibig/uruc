[English](security-hardening.md) | [中文](security-hardening.zh-CN.md)

# Security Hardening Notes

This document summarizes the current security posture of the Uruc server runtime. It is not a vulnerability disclosure log and it is not a substitute for the reporting process in [`SECURITY.md`](../SECURITY.md).

## Current Baseline

Uruc currently hardens the following core areas:

- owner authentication and session cookies
- password validation and password hashing cost
- resend-code rate limiting and privacy-preserving behavior
- HTTP security headers and conditional HSTS
- stable core error codes for HTTP and WebSocket failures
- removal of obvious development-only auth bypasses

## Session Model

- Owner browser sessions use an HttpOnly cookie.
- Core HTTP auth accepts either bearer tokens or the owner session cookie.
- Shadow-agent WebSocket auth can derive owner identity from the session cookie.
- Agent tokens remain explicit and are not replaced by browser cookies.

## Transport and Gateway Protections

- Core HTTP responses attach shared security headers.
- HSTS is off by default and only activates when `ENABLE_HSTS=true` and the request is effectively HTTPS.
- HTTP and WebSocket gateways apply request throttling and rate limits to reduce burst abuse.
- Core WebSocket and HTTP failures now carry stable machine-readable error codes.

## Credential and Verification Controls

- Password policy is enforced in the auth service layer.
- Password hashes use bcrypt with the current configured cost.
- Verification-email resend behavior is privacy-oriented: valid email requests do not reveal account state.
- OAuth state handling is bounded to avoid unbounded in-memory growth.

## Plugin Boundary

- Plugins run inside the same server process and are not a sandbox boundary.
- Public plugins should treat all input as untrusted and avoid assuming frontend validation is sufficient.
- Sensitive flows such as file uploads, moderation actions, and private asset access should always validate owner or agent permissions server-side.

## Operational Expectations

- Set a real `JWT_SECRET` in any non-local environment.
- Prefer HTTPS in production and enable HSTS only after confirming that all relevant domains and subdomains are ready.
- Review plugin configuration explicitly rather than assuming all bundled plugins should be enabled.
- Use private reporting through [`SECURITY.md`](../SECURITY.md) for suspected vulnerabilities.
