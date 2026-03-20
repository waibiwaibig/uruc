# Plugin Runtime Dependencies Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install plugin runtime dependencies into each materialized plugin revision so marketplace plugins can start without manual dependency setup.

**Architecture:** Extend `PluginPlatformHost` materialization to install package `dependencies` inside the revision directory before bridging `@uruc/plugin-sdk`. Cover the behavior with a host integration test that uses a local `file:` dependency to avoid external network reliance.

**Tech Stack:** TypeScript, Node.js, npm, Vitest

---

## Chunk 1: Host Dependency Materialization

### Task 1: Add the failing regression test

**Files:**
- Modify: `packages/server/src/core/plugin-platform/__tests__/host.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that creates:
- a local dependency package
- a plugin package that imports that dependency
- a host config that materializes the plugin

Assert that:
- `syncLockFile()` produces a revision directory
- `startAll()` marks the plugin active
- the dependency exists inside the materialized revision

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/server -- host.test.ts`
Expected: FAIL because the plugin dependency is not installed into the materialized revision.

### Task 2: Install runtime dependencies during materialization

**Files:**
- Modify: `packages/server/src/core/plugin-platform/host.ts`

- [ ] **Step 1: Add a helper to inspect plugin package dependencies**

Read the materialized `package.json` and determine whether production dependencies need installation.

- [ ] **Step 2: Add a helper that installs production dependencies in the revision directory**

Run `npm install` in the materialized revision only when dependencies are present.

- [ ] **Step 3: Call the helper from the materialization flow**

Ensure dependency installation runs after the package copy and before the SDK bridge.

- [ ] **Step 4: Include plugin context in install failures**

Wrap install failures with the plugin id and revision directory so lock-sync errors are actionable.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=packages/server -- host.test.ts`
Expected: PASS

### Task 3: Verify the modified host area

**Files:**
- Modify: `packages/server/src/core/plugin-platform/__tests__/host.test.ts`
- Modify: `packages/server/src/core/plugin-platform/host.ts`

- [ ] **Step 1: Run the targeted plugin host tests**

Run: `npm run test --workspace=packages/server -- packages/server/src/core/plugin-platform/__tests__/host.test.ts`
Expected: PASS

- [ ] **Step 2: Run the plugin manager tests as a regression check**

Run: `npm run test --workspace=packages/server -- packages/server/src/cli/__tests__/plugin-manager.test.ts`
Expected: PASS
