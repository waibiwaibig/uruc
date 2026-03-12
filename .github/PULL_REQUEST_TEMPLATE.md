[English](PULL_REQUEST_TEMPLATE.md) | [中文](PULL_REQUEST_TEMPLATE.zh-CN.md)

## Summary

Describe the problem and the change in a few sentences.

## Scope

- packages or areas touched:
- user-facing behavior changed:
- breaking change:

## Validation

- [ ] `npm run test --workspace=packages/server`
- [ ] `npm run build --workspace=packages/server`
- [ ] `npm run build --workspace=packages/human-web`
- [ ] `npm run i18n:check --workspace=packages/human-web`
- [ ] `npm run docs:check`

## Documentation

- [ ] Updated English canonical docs when public behavior changed
- [ ] Updated `*.zh-CN.md` companions for the same public docs

## Follow-Up

List any remaining work that is intentionally out of scope for this PR.
