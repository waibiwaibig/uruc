# Plugin Runtime Dependencies Design

## Goal

Ensure source-backed plugins installed from the Uruc marketplace can start successfully when their backend entry imports normal npm runtime dependencies.

## Current Behavior

- `uruc plugin add` resolves and materializes the plugin package into the plugin store.
- `PluginPlatformHost` copies the package into a revision directory and creates a runtime bridge for `@uruc/plugin-sdk`.
- Ordinary npm dependencies declared in the plugin package are not installed into the materialized revision.
- Plugins that import those dependencies fail at startup with `Cannot find package ...`.

## Design

- Extend plugin revision materialization so the host installs runtime dependencies for the materialized package when `package.json.dependencies` is non-empty.
- Keep installation scoped to the revision directory so each locked revision is self-contained.
- Preserve the existing `@uruc/plugin-sdk` bridge after dependency installation.
- Surface dependency installation failures during lock sync with explicit plugin context.

## Non-Goals

- Installing `devDependencies`
- Hoisting plugin dependencies into the host workspace
- Changing frontend plugin bundling behavior

## Verification

- Add a host test that materializes a plugin with a real package dependency provided via a local `file:` package.
- Verify the materialized revision contains that dependency and the plugin starts successfully.
