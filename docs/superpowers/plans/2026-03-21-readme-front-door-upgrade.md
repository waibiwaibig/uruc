# README Front Door Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the opening sections of `README.md` and `README.zh-CN.md` so the repository presents a stronger brand front door while staying factual and developer-friendly.

**Architecture:** Copy the approved logo into a repository-local asset path, rebuild the top of each README with a GitHub-safe centered hero plus factual navigation and quick-start content, then verify image references and section structure with direct file inspection. Keep the remainder of both README files intact unless small wording changes improve flow.

**Tech Stack:** Markdown, GitHub-safe inline HTML, repository asset files, git diff verification

---

## Chunk 1: Asset And English README

### Task 1: Add the repository-local logo asset

**Files:**
- Create: `docs/assets/uruc-logo.png`

- [ ] **Step 1: Create the asset directory if it does not exist**

Run: `mkdir -p docs/assets`
Expected: command exits successfully

- [ ] **Step 2: Copy the approved logo into the repository**

Run: `cp '/Users/waibiwaibi/uruk/uruc宣传资料/uruc.png' docs/assets/uruc-logo.png`
Expected: `docs/assets/uruc-logo.png` exists with PNG image data

- [ ] **Step 3: Verify the copied asset**

Run: `file docs/assets/uruc-logo.png`
Expected: output identifies a PNG image

- [ ] **Step 4: Commit the asset addition**

```bash
git add docs/assets/uruc-logo.png
git commit -m "docs: add README brand asset"
```

### Task 2: Rebuild the English README opening

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the current plain opening with the approved hero structure**

Update the top of `README.md` so it contains:

- language switcher
- centered hero image sourced from `docs/assets/uruc-logo.png`
- centered `Uruc` title
- centered statement `AI agents need a city, not just a chat window.`
- centered factual positioning line from the approved spec

- [ ] **Step 2: Add the fact tags and navigation row**

Add a centered row using inline code-style facts:

- `Pre-1.0`
- `Runs End to End`
- `HTTP + WebSocket`
- `V2 Plugin Platform`

Then add centered top navigation links for:

- `Getting Started`
- `What You Can Do Today`
- `Architecture`
- `Plugin Development`
- `CLI`
- `Security`
- `Contributing`

- [ ] **Step 3: Add the quick-start entry callout**

Surface the preferred first action near the top:

```bash
./uruc configure
```

Keep the current status statement factual and concise near this top block.

- [ ] **Step 4: Verify the English README structure**

Run: `sed -n '1,120p' README.md`
Expected: the new hero, fact tags, navigation, and quick-start block appear before the `## Getting Started` heading

- [ ] **Step 5: Commit the English README upgrade**

```bash
git add README.md
git commit -m "docs: upgrade English README front door"
```

## Chunk 2: Chinese README And Final Verification

### Task 3: Rebuild the Chinese README opening

**Files:**
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Mirror the English structure with Chinese copy**

Update the top of `README.zh-CN.md` so it contains:

- language switcher
- centered hero image sourced from `docs/assets/uruc-logo.png`
- centered `Uruc` title
- centered statement `AI agents 需要一座城市，而不只是一个聊天窗口。`
- centered factual positioning line from the approved spec

- [ ] **Step 2: Add the Chinese trust and entry layer**

Keep the structure parallel to the English README:

- concise status note
- fact tags
- top navigation links
- a clear `./uruc configure` start command near the top

- [ ] **Step 3: Verify the Chinese README structure**

Run: `sed -n '1,120p' README.zh-CN.md`
Expected: the new hero, tags, navigation, and start command appear before the `## 快速开始` heading

- [ ] **Step 4: Commit the Chinese README upgrade**

```bash
git add README.zh-CN.md
git commit -m "docs: upgrade Chinese README front door"
```

### Task 4: Final verification and review

**Files:**
- Verify: `docs/assets/uruc-logo.png`
- Verify: `README.md`
- Verify: `README.zh-CN.md`

- [ ] **Step 1: Verify file references and staged content**

Run: `rg -n "docs/assets/uruc-logo.png|AI agents need a city|AI agents 需要一座城市|./uruc configure" README.md README.zh-CN.md`
Expected: both README files reference the shared logo and include the approved top-level copy

- [ ] **Step 2: Review the full diff**

Run: `git diff -- README.md README.zh-CN.md docs/assets/uruc-logo.png`
Expected: diff shows only the approved README front-door restructuring and logo addition

- [ ] **Step 3: Check repository status**

Run: `git status --short`
Expected: only the intended README and asset changes remain, unless commits were already created during the plan

- [ ] **Step 4: Commit the final integrated result if needed**

```bash
git add README.md README.zh-CN.md docs/assets/uruc-logo.png
git commit -m "docs: refresh README front door"
```

