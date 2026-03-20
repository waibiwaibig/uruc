# Market Frontend Plugin Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make officially packaged Uruc plugins install and run as unified backend+frontend artifacts, with prebuilt frontend assets loaded at runtime by the host web app.

**Architecture:** Add a frontend build manifest under `frontend-dist/`, store that metadata in the city lock, serve revision-scoped plugin assets from the server, and extend `human-web` to merge runtime-loaded external plugin frontends with the existing static registry. Add a packaging command so marketplace artifacts are built before publication instead of compiled on user machines.

**Tech Stack:** TypeScript, Vite build API, Node HTTP server, Vitest, existing Uruc plugin SDK.

---

## Chunk 1: Contracts And Tests

### Task 1: Define frontend build metadata contract

**Files:**
- Modify: `packages/plugin-sdk/src/frontend.ts`
- Modify: `packages/server/src/core/plugin-platform/types.ts`
- Test: `packages/server/src/core/plugin-platform/__tests__/host.test.ts`

- [ ] **Step 1: Write the failing test**

Add a host test that materializes a plugin package containing `frontend-dist/manifest.json` and expects the resulting lock entry to preserve frontend metadata.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/server -- src/core/plugin-platform/__tests__/host.test.ts`
Expected: FAIL because `LockedPluginSpec` has no frontend field yet.

- [ ] **Step 3: Write minimal implementation**

Add frontend build manifest schema/types and optional `frontend` field on the plugin manifest and lock types.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/server -- src/core/plugin-platform/__tests__/host.test.ts`
Expected: PASS for the new host test.

### Task 2: Define runtime frontend registry response contract

**Files:**
- Modify: `packages/human-web/src/lib/types.ts`
- Test: `packages/human-web/src/plugins/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Add a registry test that stubs `/api/frontend-plugins` and expects runtime plugin metadata to be merged into the loaded registry.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts`
Expected: FAIL because runtime registry loading does not exist.

- [ ] **Step 3: Write minimal implementation**

Add the frontend runtime manifest types used by `human-web`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts`
Expected: PASS for the new contract-level test.

## Chunk 2: Server Runtime

### Task 3: Persist frontend build metadata during lock sync

**Files:**
- Modify: `packages/server/src/core/plugin-platform/manifest.ts`
- Modify: `packages/server/src/core/plugin-platform/host.ts`
- Test: `packages/server/src/core/plugin-platform/__tests__/host.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the host test fixture plugin to include `frontend-dist/manifest.json` and assert `syncLockFile()` stores the frontend metadata.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/server -- src/core/plugin-platform/__tests__/host.test.ts`
Expected: FAIL because `syncLockFile()` drops frontend build metadata.

- [ ] **Step 3: Write minimal implementation**

Read optional build metadata from `frontend-dist/manifest.json` and persist it onto the locked plugin entry.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/server -- src/core/plugin-platform/__tests__/host.test.ts`
Expected: PASS.

### Task 4: Serve runtime frontend manifests and assets

**Files:**
- Modify: `packages/server/src/core/plugin-platform/types.ts`
- Modify: `packages/server/src/core/plugin-platform/host.ts`
- Modify: `packages/server/src/core/server/http-server.ts`
- Test: `packages/server/src/core/server/__tests__/frontend-plugin-assets.test.ts`

- [ ] **Step 1: Write the failing test**

Add an HTTP server test that expects:

- `/api/frontend-plugins` to list a locked plugin frontend manifest
- `/api/plugin-assets/:pluginId/:revision/plugin.js` to return the materialized asset

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/server -- src/core/server/__tests__/frontend-plugin-assets.test.ts`
Expected: FAIL because neither endpoint exists.

- [ ] **Step 3: Write minimal implementation**

Extend `PluginPlatformHealthProvider` with runtime frontend asset accessors and wire the two endpoints into `http-server.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/server -- src/core/server/__tests__/frontend-plugin-assets.test.ts`
Expected: PASS.

## Chunk 3: human-web Runtime Loader

### Task 5: Install shared frontend globals

**Files:**
- Create: `packages/human-web/src/plugins/runtime-globals.ts`
- Modify: `packages/human-web/src/main.tsx`
- Test: `packages/human-web/src/plugins/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Add a registry test that expects the shared globals object to exist before runtime plugin scripts are evaluated.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts`
Expected: FAIL because the globals installer does not exist.

- [ ] **Step 3: Write minimal implementation**

Create the globals installer and call it from `main.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts`
Expected: PASS.

### Task 6: Load external runtime frontends and merge them with static plugins

**Files:**
- Modify: `packages/human-web/src/lib/api.ts`
- Modify: `packages/human-web/src/plugins/registry.ts`
- Test: `packages/human-web/src/plugins/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests covering:

- runtime frontend manifests are fetched from `/api/frontend-plugins`
- CSS and JS assets are loaded once
- `window.__uruc_plugin_exports[exportKey]` is validated and merged
- static plugin ids override runtime duplicates

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts`
Expected: FAIL because `loadFrontendPluginRegistry()` only loads static in-repo plugins.

- [ ] **Step 3: Write minimal implementation**

Refactor registry loading into static + runtime sources, then merge them into one `FrontendPluginRegistry`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts`
Expected: PASS.

## Chunk 4: Packaging Workflow

### Task 7: Build a plugin frontend into `frontend-dist/`

**Files:**
- Create: `scripts/build-plugin-frontend.mjs`
- Test: `packages/server/src/cli/__tests__/plugin-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Add a CLI-level test fixture plugin with `urucFrontend.entry` and expect the build helper to emit `frontend-dist/plugin.js` and `frontend-dist/manifest.json`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/server -- src/cli/__tests__/plugin-manager.test.ts`
Expected: FAIL because no build helper exists.

- [ ] **Step 3: Write minimal implementation**

Use the Vite build API to produce:

- `frontend-dist/plugin.js`
- optional CSS assets
- `frontend-dist/manifest.json`

The generated wrapper must assign the plugin object into `window.__uruc_plugin_exports[pluginId]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/server -- src/cli/__tests__/plugin-manager.test.ts`
Expected: PASS.

### Task 8: Add `uruc plugin pack`

**Files:**
- Modify: `packages/server/src/cli/plugin-manager.ts`
- Modify: `packages/server/src/cli/__tests__/plugin-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that runs `plugin pack <path>` and expects:

- frontend build output included in the staged package
- an npm tarball emitted
- the command output to include tarball path and integrity

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/server -- src/cli/__tests__/plugin-manager.test.ts`
Expected: FAIL because `plugin pack` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add the CLI command and use `npm pack` on a staged plugin directory after building `frontend-dist/` when needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/server -- src/cli/__tests__/plugin-manager.test.ts`
Expected: PASS.

## Chunk 5: Documentation And Verification

### Task 9: Update plugin development documentation

**Files:**
- Modify: `docs/plugin-development.md`
- Modify: `docs/plugin-development.zh-CN.md`

- [ ] **Step 1: Write the documentation changes**

Document the split between source entry and published frontend build output, plus the `./uruc plugin pack` marketplace workflow.

- [ ] **Step 2: Verify docs are internally consistent**

Run: `npm run docs:check`
Expected: PASS.

### Task 10: Run full verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run focused server tests**

Run: `npm run test --workspace=packages/server -- src/core/plugin-platform/__tests__/host.test.ts src/core/server/__tests__/frontend-plugin-assets.test.ts src/cli/__tests__/plugin-manager.test.ts`
Expected: PASS.

- [ ] **Step 2: Run focused human-web tests**

Run: `npm run test --workspace=packages/human-web -- src/plugins/__tests__/registry.test.ts src/plugins/__tests__/standalone-shell-registry.test.ts src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run end-to-end smoke on the chess reference plugin if time allows**

Run a local pack/install/start flow against `/Users/waibiwaibi/uruk/uruc-core/packages/plugins/chess`.
Expected: backend starts and frontend manifest becomes loadable through `/api/frontend-plugins`.
