[English](RELEASE_CHECKLIST.md) | [中文](RELEASE_CHECKLIST.zh-CN.md)

# Public Release Checklist

Use this checklist before pushing a new public-facing change to the GitHub repository.

## Repository Hygiene

- Ensure `git status --short` is clean, or intentionally scoped to the release.
- Ensure no local `.env`, database, upload, log, `.uruc`, or build artifacts are tracked.
- Ensure sample configuration stays in `*.example` files only.

## Licensing And Notices

- Keep the root [`LICENSE`](LICENSE) file present with the full Apache License 2.0 text.
- Keep the root [`NOTICE`](NOTICE) file present and consistent with the repository contents.
- Ensure public package metadata that declares a license remains aligned with Apache-2.0.
- Re-check third-party obligations if you plan to distribute containers, prebuilt binaries, or other bundled artifacts.

## Public Governance Docs

- Verify [`README.md`](README.md) describes the repository accurately.
- Verify [`CONTRIBUTING.md`](CONTRIBUTING.md) reflects the current public workflow.
- Verify [`SECURITY.md`](SECURITY.md) points to a reachable private reporting contact.
- Verify [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) points to a reachable enforcement contact.
- Verify [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) still matches how the repository is distributed.

## Verification Commands

Run:

```bash
npm run docs:check
npm run i18n:check --workspace=packages/human-web
```

Recommended for broader confidence before larger public changes:

```bash
npm run test --workspace=packages/server
npm run test --workspace=packages/human-web
npm run build --workspace=packages/server
npm run build --workspace=packages/human-web
```

## GitHub Readiness

- Confirm the repository description, topics, and visibility are what you intend to publish.
- Confirm issue and pull-request settings match how you want outside contributors to interact.
- If you enable GitHub private vulnerability reporting or security advisories, keep [`SECURITY.md`](SECURITY.md) aligned with that workflow.

## Final Push Review

- Review the diff one last time.
- Confirm every new public statement is factual.
- Push only after the release-facing docs and verification output match the repository state.
