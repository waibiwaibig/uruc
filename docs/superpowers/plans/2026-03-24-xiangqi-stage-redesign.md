# Xiangqi Stage Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Chinese chess frontend stage so it renders a traditional Xiangqi board and bound SVG disc pieces while preserving the existing room workflow, runtime wiring, and right-rail workspace.

**Architecture:** Keep `ChineseChessPage.tsx` as the page entry and preserve its data flow, room state, and action handlers. Replace the copied chessboard presentation with a Xiangqi-specific board shell: line-based board overlay, river and palace markers, bound SVG disc pieces, and a stage surface whose supporting UI matches the board material system. Refine the live layout so the board owns the left column, the right rail shrinks to remaining space, and player presence collapses into two single-line badges attached to the board's left edge.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, existing Uruc plugin frontend runtime.

---

## Chunk 1: Regression Tests For The Correct Board Structure

### Task 1: Add failing tests for classic Xiangqi board markup and CSS

**Files:**
- Modify: `packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx`
- Create: `packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`

- [ ] **Step 1: Extend the page test with Xiangqi-specific shell expectations**

```tsx
expect(html).toContain('chinese-chess-board-stage');
expect(html).toContain('chinese-chess-board-grid');
expect(html).toContain('chinese-chess-board-overlay');
expect(html).toContain('play:chineseChess.page.riverChu');
expect(html).toContain('play:chineseChess.page.riverHan');
expect(html).toContain('chinese-chess-piece-image');
```

- [ ] **Step 2: Run the page test to verify it fails**

Run: `npm test --workspace=@uruc/human-web -- --run packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx`
Expected: FAIL because the current page still emits the stale board shell and the CSS class contract is incomplete.

- [ ] **Step 3: Add a CSS regression test that rejects the copied 8x8 chessboard**

```ts
expect(css).not.toContain('grid-template-columns: repeat(8');
expect(css).not.toContain('.chinese-chess-square');
expect(css).toContain('.chinese-chess-board-grid');
expect(css).toContain('.chinese-chess-board-intersection');
expect(css).toContain('.chinese-chess-piece-image');
expect(css).toContain('drop-shadow');
```

- [ ] **Step 4: Run the CSS test to verify it fails**

Run: `npm test --workspace=@uruc/human-web -- --run packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`
Expected: FAIL because the stylesheet still contains chess-derived 8x8 grid rules and missing Xiangqi classes.

## Chunk 2: Rebuild The Board Markup

### Task 2: Replace the stale board shell with Xiangqi-specific stage markup

**Files:**
- Modify: `packages/plugins/chinese-chess/frontend/ChineseChessPage.tsx`

- [ ] **Step 1: Replace `renderBoard()` container markup with a dedicated Xiangqi stage**

Introduce a structure shaped like:

```tsx
<div className="chinese-chess-board-stage">
  <div className="chinese-chess-board-stage__table">
    <div className="chinese-chess-board-frame">
      <div className="chinese-chess-board-grid">
        <svg className="chinese-chess-board-overlay" ... />
        <div className="chinese-chess-river">...</div>
        {intersections}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Keep the existing move logic, but remap square buttons to intersection buttons**

Use the existing `handleBoardSquareClick(square)` logic and `pieceAtSquare()` lookup, but render each location as:

```tsx
<button className="chinese-chess-board-intersection" data-square={square}>...</button>
```

- [ ] **Step 3: Replace outer coordinate rails with optional subtle in-board markers**

Do not keep `abcdefghi` / numeric rails around the board. If labels are needed, keep them small and integrated into the board frame rather than external rows and columns.

- [ ] **Step 4: Run the page test to verify the new structure passes**

Run: `npm test --workspace=@uruc/human-web -- --run packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx`
Expected: PASS for the updated board structure assertions.

## Chunk 3: Rebuild The Xiangqi Visual System

### Task 3: Replace the chess-derived CSS with a traditional Xiangqi stage

**Files:**
- Modify: `packages/plugins/chinese-chess/frontend/chinese-chess.css`

- [ ] **Step 1: Replace the stale board tokens**

Add board/stage tokens for:

```css
--chinese-chess-board-wood
--chinese-chess-board-wood-deep
--chinese-chess-board-line
--chinese-chess-piece-red-ink
--chinese-chess-piece-black-ink
```

- [ ] **Step 2: Delete 8x8 square-board rules and add Xiangqi board classes**

Implement:

```css
.chinese-chess-board-stage
.chinese-chess-board-frame
.chinese-chess-board-grid
.chinese-chess-board-intersection
.chinese-chess-piece
.chinese-chess-piece-image
.chinese-chess-capture-piece
```

- [ ] **Step 3: Style the board overlay, river, palace, star points, and interaction states**

Required visual behavior:
- line-based board, not checkerboard cells
- river text centered between upper and lower halves
- target and last-move states shown as rings or glows around intersections
- round disc pieces rendered as bound SVG assets rather than CSS circles plus live text

- [ ] **Step 4: Restyle the seat cards, captures, and result overlay to match the board**

Keep layout responsibilities intact, but move these areas from cold glass styling to wood/paper styling consistent with the board.

- [ ] **Step 5: Run the CSS regression test**

Run: `npm test --workspace=@uruc/human-web -- --run packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`
Expected: PASS.

## Chunk 4: Verify The Redesign End To End

### Task 4: Run targeted verification for the Xiangqi frontend

**Files:**
- Verify only:
  - `packages/plugins/chinese-chess/frontend/ChineseChessPage.tsx`
  - `packages/plugins/chinese-chess/frontend/chinese-chess.css`
  - `packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx`
  - `packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`

- [ ] **Step 1: Run the Chinese chess frontend tests together**

Run: `npm test --workspace=@uruc/human-web -- --run packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`
Expected: PASS.

- [ ] **Step 2: Run one broader plugin test sweep if the targeted tests are green**

Run: `npm test --workspace=@uruc/human-web -- --run packages/plugins/chinese-chess/frontend`
Expected: PASS.

- [ ] **Step 3: Manually inspect the final DOM/CSS contract in the diff**

Confirm:
- no `8x8` board grid remains in the Chinese chess stylesheet
- the main board uses Xiangqi-specific classes only
- stage support UI stays aligned with the new board material system

## Chunk 5: Promote The Board And Collapse Player Chrome

### Task 5: Replace large seat cards with left-edge badges and rebalance the desktop split

**Files:**
- Modify: `packages/plugins/chinese-chess/frontend/ChineseChessPage.tsx`
- Modify: `packages/plugins/chinese-chess/frontend/chinese-chess.css`
- Modify: `packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx`
- Modify: `packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`

- [ ] **Step 1: Extend tests to lock in board-edge player badges**

Add expectations like:

```tsx
expect(html).toContain('chinese-chess-board-player-badge');
expect(html).toContain('chinese-chess-board-player-badge--top');
expect(html).toContain('chinese-chess-board-player-badge--bottom');
expect(html).not.toContain('chinese-chess-seat-card');
```

- [ ] **Step 2: Run the updated tests to verify they fail**

Run: `npx vitest run packages/plugins/chinese-chess/frontend/ChineseChessPage.test.tsx packages/plugins/chinese-chess/frontend/chinese-chess-layout-css.test.ts`
Expected: FAIL because the page still renders large seat cards and the stylesheet still defines the old card classes.

- [ ] **Step 3: Replace `renderPlayerCard()` with a single-line board badge renderer**

Implement a compact badge shaped like:

```tsx
<div className="chinese-chess-board-player-badge chinese-chess-board-player-badge--top">
  <span className="chinese-chess-board-player-badge__avatar">AP</span>
  <strong className="chinese-chess-board-player-badge__name">Awaiting player</strong>
  <span className="chinese-chess-board-player-badge__clock mono">10:00</span>
</div>
```

Use top-left and bottom-left placement only. Do not render side labels.

- [ ] **Step 4: Make the left column board-first and the right rail remainder-based**

Update desktop CSS so:
- `.chinese-chess-com-layout` uses a flexible left column plus a clamped right rail
- `.chinese-chess-main-stage` computes board width from left-column availability first
- `.chinese-chess-right-rail` narrows to a clamped range instead of pre-allocating dominant width

- [ ] **Step 5: Remove obsolete seat-card CSS and add board badge CSS**

Implement new classes:

```css
.chinese-chess-board-player-badge
.chinese-chess-board-player-badge--top
.chinese-chess-board-player-badge--bottom
.chinese-chess-board-player-badge__avatar
.chinese-chess-board-player-badge__name
.chinese-chess-board-player-badge__clock
```

Delete the unused `.chinese-chess-seat-card*` block once the markup no longer references it.

- [ ] **Step 6: Re-run tests and build**

Run:
- `npx vitest run packages/plugins/chinese-chess/frontend`
- `npm run build --workspace=@uruc/human-web`

Expected: PASS, with the board visually dominant and no remaining large player-card shell.
