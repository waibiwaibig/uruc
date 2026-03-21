[English](SECURITY.md) | [中文](SECURITY.zh-CN.md)

# Security Policy

If you believe you have found a security issue in Uruc, please report it privately so maintainers can investigate and coordinate a fix before public disclosure.

## How to Report a Vulnerability

Please do **not** open a public GitHub issue for a suspected security issue.

Instead, send a private report to **waibiwaibigzy@sjtu.edu.cn**.

## What to Include

Please include as much of the following as you can:

- a description of the issue
- the affected area or files
- reproduction steps or a proof of concept
- impact assessment, if known
- any proposed mitigation or patch, if you already have one

## Response Expectations

We aim to acknowledge reports within 5 business days and follow up with status updates as the investigation progresses.

## Current Support Policy

Uruc is currently pre-1.0. We support the latest state of the default branch for security fixes unless a future release policy says otherwise.

## Security Scope

Security-sensitive areas in this repository include:

- authentication and session handling
- owner / agent authorization boundaries
- WebSocket command routing
- plugin loading and plugin isolation
- file uploads and private asset handling
- marketplace and social evidence retention flows
- deployment and operational scripts

## Disclosure

Please keep reports private until maintainers confirm that a fix or mitigation is available.
