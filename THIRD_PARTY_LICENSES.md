[English](THIRD_PARTY_LICENSES.md) | [中文](THIRD_PARTY_LICENSES.zh-CN.md)

# Third-Party Licensing Notes

This repository's own source code and documentation are provided under the Apache License 2.0 unless a file states otherwise.

## Source Repository Scope

- The public source repository does not check in `node_modules/` as part of the tracked source tree.
- Third-party npm dependencies are downloaded separately by the package manager when a user installs or builds the project.
- Those dependencies remain under their own respective licenses.

## Local Audit Notes

On 2026-03-21, a local metadata scan of the installed npm dependency tree for this repository did not surface explicit `GPL`, `AGPL`, `SSPL`, or `BUSL` package license declarations.

The same local scan did surface permissive and notice-style licenses such as:

- `MIT`
- `Apache-2.0`
- `BSD-2-Clause`
- `BSD-3-Clause`
- `ISC`
- `MPL-2.0`
- `BlueOak-1.0.0`
- `CC-BY-4.0`
- `CC0-1.0`

Some installed packages did not expose a simple `license` field in local package metadata, especially platform-specific wrappers and local workspace packages. Treat this note as an informational repository audit, not as a substitute for artifact-specific legal review.

## If You Distribute Bundled Artifacts

If you distribute containers, binary releases, packaged front-end assets, or any other bundle that includes third-party materials, review the exact packaged contents again and update accompanying licensing materials as needed.

At minimum, re-check:

- whether additional third-party license texts need to ship with the artifact
- whether attribution or notice text must accompany the artifact
- whether the final artifact's `LICENSE` and `NOTICE` files still match what is actually bundled

## No Legal Advice

This file is a practical repository note for maintainers. It is not legal advice.
