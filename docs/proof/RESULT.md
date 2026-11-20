# UI SDK headless data table proof — result

**Installed:** `@ui-sdk/vue@0.1.0-beta.13`, `@ui-sdk/core@0.1.0-beta.13` (npm `latest` and `beta` both point to beta.13). Vue 3.5.46, Vite 8.3.8, vue-tsc 3.3.14, TypeScript 6.0.3. TS 7.0.2 was pulled in first and had to be pinned back: vue-tsc does not run on it.

**Overall:** all five proofs run on a real semantic `<table>` (thead/tbody, `th`/`td`, 8 columns). 20 Playwright assertions pass in Chromium, and `vue-tsc --noEmit` exits 0. (b), (c) and (d) needed almost no bridge code. (a) and (e) needed some, and (e) hit two real hazards along the way: a blank viewport and a jump back to the top. Both were worked around in bridge code; neither is fixed in the library.

## How to run

```bash
cd <this folder>
pnpm install
pnpm exec playwright install chromium   # once
pnpm dev                                # http://localhost:5199
pnpm test:e2e                           # Playwright; starts/reuses the dev server itself
pnpm typecheck                          # vue-tsc --noEmit
```

## Verdicts per proof

| Proof | Verdict | Bridge code |
|---|---|---|
| a. Column resize (`createResize`) | Works with bridge code | ~17 lines |
| b. Grid keyboard navigation (`createGridFocus`) | Works as documented | ~3 lines |
| c. Column reorder (`createReorder`) | Works as documented | ~3 lines |
| d. Cell range (`createCellRange` + grid) | Works as documented; one gap: the header row is part of the range | 0 lines |
| e. Row virtualization (`createVirtualizer` + grid) | Works with bridge code; fragile | ~35 lines |

### a. Column resize — works with bridge code
- **Evidence (`tests/a-resize.spec.ts`, 6 tests):**
  - Dragging the `name` edge +60px gives a committed width of 200, a rendered `th` width of 200±1, and `aria-valuenow=200`.
  - Min and max clamp at 60 and 400.
  - The column follows the pointer during the drag, before release (160 while the committed value is still 120).
  - Escape during the drag restores 120.
  - Keyboard: ArrowRight gives +1, Shift+ArrowRight gives +10 (`largeStep`), ArrowLeft gives −1.
  - RTL: dragging the inline-end edge outward widens the column, but only after the bridge below.
- **What doesn't fit:** `createResize` resizes 2-D boxes `{x,y,width,height}` with physical compass handles (`n/e/s/w…`). Its docs assume an absolutely positioned box (`boxStyle`). There is no column-resize behavior.
- **Bridge:**
  - Each column becomes a box with a dummy `x/y/height`, and the `ResizeBox` record is mapped back to widths.
  - The `<col>` width is read from `resize.box(state, key).width`.
  - The table width is the sum of the columns.
  - The handle is my own `role="separator"` with `aria-valuenow/min/max/orientation`, because `handleAttrs` gives only a cursor and `touch-action`.
- **Bug hit (RTL):** in RTL, the handle `"e"` is physical. Before the bridge, dragging the inline-end edge outward shrank the column to 80 instead of widening it to 200. The fix is `isRTL(el) ? "w" : "e"`. The keyboard arrows are physical as well.
- **Friction:** `focus: "native"` on a `<span>` raises a dev warning. Use `"tab-stop"` with `tabindex="0"`.

### b. Grid keyboard navigation — works as documented
- **Evidence (`tests/b-grid.spec.ts`, 4 tests):**
  - Exactly one `tabindex="0"` in the grid.
  - Tab enters at the header cell (1,1).
  - ArrowDown and ArrowRight move as expected; Home and End reach the row's ends; Ctrl+End reaches (201,8) and Ctrl+Home goes back to (1,1).
  - PageDown and PageUp move by `pageSize` (5).
  - Arrows stop at the edges, with no wrap.
  - Tab leaves the grid, and Shift+Tab returns to the last active cell.
  - A click makes a cell active.
  - `aria-rowindex` and `aria-colindex` are correct; they are my attrs.
  - Header cells take part in navigation, as row 0 of the grid.
- **Button inside a cell:**
  - Clicking the button fires it, and focus lands on the button.
  - Arrow keys pressed while the button has focus still move the grid; focus goes to the next cell.
  - Enter or F2 on the cell does **not** move into the button or activate it. The APG "enter cell / interaction mode" is not provided; that is own code.
- **Friction:** one slot can't render both `th` and `td`. I called `createParts` a second time with `{cell: "th"}`. That works, but it is not documented. `role` needs a function plus `roles: ["columnheader", "gridcell"]`.

### c. Column reorder — works as documented
- **Evidence (`tests/c-reorder.spec.ts`, 2 tests):**
  - Dragging the ID header past City commits `name,email,city,id,…`.
  - During the drag, the draft order already shows, and body row 200 follows the header.
  - After the drop, header, row 1 and row 200 all match the committed order.
  - Keyboard: Space picks up, arrows move, Space drops. Enter then End moves to the end, and Escape cancels back to the committed order.
  - Focus stays on the moved header.
- **Bridge:** `orientation: "horizontal"` and `reorder.keydown(...) || roving.keydown(...)`, both as documented. The body renders from `reorder.order(state)`, exposed through the root's slot state.
- **Friction:** `--drag-x` is written only on the `th`; body cells don't visually travel with it.
- **Not tested:** combining this with (a) or (b). A resize handle inside a reorderable `th` must `preventDefault()` its pointerdown; the docs say a prevented pointerdown doesn't start a reorder. Also untested: reorder with `createGridFocus` instead of roving focus on the header.
- **Test pitfall, not an SDK bug:** a header below the fold received no events. Scroll it into view first.

### d. Cell range — works as documented
- **Evidence (`tests/d-range.spec.ts`, 3 tests):**
  - Dragging from (2,1) to (4,3) gives bounds `{top:2,left:1,bottom:4,right:3}`, 9 cells with `aria-selected=true`, and `data-range-edge="top left"` on the corner.
  - Shift+arrows grow the range from the clicked cell, and focus follows the moving end.
  - A plain arrow clears the range.
  - Shift+click extends the range, Escape clears it, and Ctrl+A selects all.
- **Gap:** because the header is grid row 0, Ctrl+A, Shift+Space and drags include the **header cells** (bounds `{top:0,…,bottom:200}`). `createCellRange` has no option to exclude rows. A fix needs own code, such as clamping in `set`.

### e. Virtualization — works with bridge code, fragile
- **Evidence (`tests/e-virtual.spec.ts`, 5 tests):**
  - 10,000 rows; `aria-rowcount=10001`; 14–20 `tr` rendered.
  - At `scrollTop=120000`, the first visible row is about index 5002, as expected.
  - The sticky header stays at the scroller's top in the middle and at the end.
  - The last row renders at the end, and the bottom spacer is 0.
  - Grid focus across the window: 30×ArrowDown, PageDown, Ctrl+End to (10001,8) with the cell visible below the header, and Ctrl+Home back to the header. `reveal` → `scrollToIndex` brings each target row in, and focus lands on it.
  - Variable height: rows measure differently; Ctrl+End and 40×PageDown keep focus visible; the visible band stays covered after jumps.
- **What doesn't fit:** the docs say to position rows absolutely at `start` inside a box `size()` tall. A `<tr>` can't be positioned that way.
- **Bridge:**
  - Spacer `<tr aria-hidden>` rows.
  - Grid row ↔ data index ±1, because the header row isn't virtualized.
  - `virtual.subscribe` → `store.set({window, size})` so Vue re-renders.
  - The `keep()` mapping from the active cell.
  - `measure` from the row slot's `bind`.
- **Undocumented fact:** `start` and `size()` exclude `scrollMargin`; I found this by testing.
- **Problems hit:**
  1. **`keep()` makes `items()` non-contiguous:** the focused row comes first, then the visible window. With a single top spacer, the visible rows rendered directly after the kept row, about 100,000px off-screen, and the viewport went **blank**. The fix is a spacer in every gap.
  2. **Jump back to the top (variable height):** after moving the jump to the end to 1e7 or `max`, `scrollTop` went to 27, then 0.
     - I traced the `scrollTop` setter: `virtualizer.measure → record` wrote `scrollTop` while the table was mid-patch with `scrollHeight=670`. A newly keyed gap row was not inserted yet, while the end spacer had already shrunk, so the browser had clamped `scrollTop`.
     - A control with the documented absolute-div setup (`ProofVirtualDivs.vue`) does not do this.
     - Fix: positional, stable gap keys. Root cause: `measure` reads layout and writes `scrollTop` synchronously while the framework patches. Any table layout whose height collapses mid-patch will hit it again.
  3. **Variable height drifts at the end:** it takes **3 jumps** to reach the last row, and 133px of scroll remains after it renders. The div control reaches the last row in one jump.
  4. **Focus loss without `keep`:** scrolling the focused row away drops focus to `<body>`, and the grid then has **0 tab stops**, so it can't be re-entered with Tab until the row scrolls back. This is asserted as known breakage. With `keep` (and the gap bridge), focus stays and ArrowDown continues from it.

## API facts (from `docs/core.md` sections and `dist/foundation/**/*.d.ts`)

All behaviors take `context` from `definePrimitive`'s `api` and wire up through slots: `on` handlers, a `bind` that returns a cleanup, and pure `attrs`. Each slot declares a role with `focus` and `keys` (`core.md` "Roles, Focus and Keys").

- **`createGridFocus(context, {key, rows, cols, pageSize?=10, disabled?, reveal?, onMove?})`** (`@experimental`; core.md "Grids"; `focus/grid-focus.d.ts`)
  - Returns `{active, tabIndex(state,cell), isActive, placeOf, bind(el,cell), focus(cell,details), keydown(e)}`.
  - The caller owns the `active: GridCell|null` state key, `rows`/`cols`, roles and `aria-row/colindex`; it owns focus movement and the tab stop.
  - Cells are addressed by numeric `row`/`col`, not DOM structure, so `th`/`td` and thead/tbody are fine. Cells need a stable `id` prop.
  - Left and Right flip in RTL. `reveal` plus "focus lands when the cell binds" supports unrendered rows.
- **`byCell` / `byCellRange`:** `selects()` readers so a move re-renders only the affected cells (core.md "One Tab Stop in a Grid").
- **`createCellRange(context, {key, grid, rows, cols, reveal?, set?, message?})`** (`@experimental`; core.md "Ranges of Cells"; `selection/cell-range.d.ts`)
  - Returns `{bounds, contains, cellAttrs, select, selectAll, selectRows, selectColumns, bind, keydown, pointerdown, text}`, plus `cellsToText` / `textToCells`.
  - The caller owns `range: CellRange|null`. `range.bind` and `range.keydown` wrap the grid.
  - A drag finds cells under the pointer and auto-scrolls near the grid edges. It announces through a live region.
- **`createReorder(context, {slot, key, draft, set, orientation?, group?, preview?, createAutoScroll?, disabled?, label?, message?})`** (`@stable`; core.md "Reordering"; `drag-and-drop/reorder.d.ts`)
  - The caller owns `string[]` order and a `ReorderDraft|null`. It renders from `order(state)`, which returns the draft while dragging.
  - The drop position comes from the measured rects of the bound items (`horizontal | vertical | grid`).
  - It writes `--drag-x/y` on the dragged element; the caller applies the transform.
  - `preview: true` drags a top-layer copy instead.
  - Keyboard: Space or Enter grab and drop, the arrows and Home/End move, Escape cancels, and Tab cancels and moves on. Every other key is swallowed while an item is grabbed.
- **`createResize(context, {boxes, draft, set, min?, max?, bounds?, aspect?, step?, largeStep?, scale?, disabled?, label?, message?})`** (`@experimental`; core.md "Resizing Boxes"; `direct-manipulation/resize.d.ts`)
  - Returns `{box, resizeTo, resizeBy, keydown, pointerdown(e,key,handle,el), dragging, boxStyle, style, handleAttrs}`.
  - Assumes absolutely positioned boxes (`left/top/width/height` via CSS variables) and **physical** compass handles.
  - Gives no ARIA for handles. The pointer drag uses `dragThreshold`, and Escape cancels.
- **`createVirtualizer({count, estimate, key?, overscan?=4, horizontal?, scrollMargin?, keep?, onEnd?, endThreshold?, findable?})`** (`@experimental`; core.md "Long Lists"; `lists/virtualizer.d.ts`)
  - Has no context and owns no app state.
  - Returns `{items, size, subscribe, connect(scroller), measure(index,el), scrollToIndex, refresh, findableText, reset}`.
  - Assumes a scroller holding a box `size()` tall, with absolutely positioned or translated rows.
  - `measure` uses a ResizeObserver and corrects `scrollTop`.
  - The docs tell you to set `aria-rowcount` and `aria-rowindex` yourself.
- **`createSelection(context, {key, set, order, multiple?, selectable?})`** (`@stable`): returns `choose`, `toggle`, `extend` (from an anchor), `setAnchor`, `toggleAll` and `isSelected`. `order` must list every key, including unrendered ones. This is what row selection would use.
- **`createRovingFocus(context, {slot, key, orientation?, loop?, remember?, disabled?, focusable?, preferred?, claims?, move?, onItemsChange?})`** (`@stable`): one tab stop over a slot's parts in document order, with `move` for custom layouts. `keydown` returns `{key, from, shift}`.
- **Typeahead:** `createTypeahead(timeout?)` returns `(key, labels, current) => index` (`@stable`). It is pure, and the caller wires it to `roving.focus`.
- **Drag and drop beyond reorder:**
  - `bindDrag(el, event, {onMove, onEnd, threshold, lock, cancelOnEscape})` uses pointer capture, with pointer lock optional.
  - `createTransfer` handles moving items between lists (`@experimental`), and `createTreeReorder` handles trees.
  - `bindDragPreview` and `createAutoScroll` cover drag previews and edge scrolling.
- **Popups:**
  - `createPopup(context, {preset})` (`@experimental`) works with `popupState` and `popupTrigger/Content/Close` and with presets: popover, dialog, tooltip, hover-card.
  - Popups render in the browser top layer (no portal) and take a `container` prop.
  - `position(anchor, el, opts)` and `bindLayer` can be used separately. Events from a popup bubble through the DOM ancestors, so a popup opened from a cell bubbles keydown into the grid's cell handler.
- **Cell editing:** `createInlineEdit(context, {key, value, commit, disabled?})` (`@experimental`; core.md "Editing in Place") gives Enter/F2/double-click to start, Enter to save, Escape to cancel, Tab to save, and restores focus. It exists but was **not tested here**. Nothing else covers cell editing.

## Components `@ui-sdk/vue` ships (package.json exports)

The package exports:
accordion, alert-dialog, async-options, autocomplete, avatar, button, calendar, carousel, checkbox, collapsible, color, color-picker, combobox, command, date, date-picker, date-input, dialog, drawer, field, file-input, gesture, hover-card, image, image-cropper, input, label, listbox, tree, menu, menubar, meter, navigation-menu, number, number-input, otp-input, overlays, pagination, password-input, popover, primitive, preferences, progress, radio, rating, resizable, scroll-area, segmented-control, select, separator, shortcuts, slider, switch, tabs, text-match, agent, observe, history, textarea, time-input, timeline, toast, toggle, token-input, toolbar, tooltip, trigger-menu, waterfall, nuxt.

The requested components:

| Component | Shipped? | Entry or note |
|---|---|---|
| popover | Yes | |
| menu | Yes | |
| select | Yes | |
| combobox | Yes | |
| checkbox | Yes | |
| dialog | Yes | |
| tooltip | Yes | |
| date picker / calendar | Yes | `date-picker`, `calendar` |
| date range picker | Yes, as a mode | No separate entry: Date Picker and Calendar support ranges |
| number input | Yes | |
| pagination | Yes | |
| tabs | Yes | |
| **table / data grid** | **No** | |
| cell editing component | No | Only `createInlineEdit` in core |

## Open risks

- **Beta churn:**
  - 13 betas between 2026-11-12 and 2026-11-19, roughly two a day. beta.11 is missing from the registry.
  - No CHANGELOG ships in either package, and npm has none.
  - Every table-critical behavior except `createReorder`, `createRovingFocus`, `createSelection` and `createTypeahead` is tagged `@experimental`: grid focus, cell range, resize, virtualizer, popup, inline edit, transfer.
  - The project you are working in has beta.1; this proof uses beta.13.
- **Docs inconsistencies:**
  - The "Complete Primitive" rating and the grid snippet in core.md put `role` inside `attrs`, while "Roles, Focus and Keys" says never to do that. The `.d.ts` JSDoc uses slot `role`.
  - The docs don't say that `start` excludes `scrollMargin`.
  - The docs don't say whether one slot can render as `th` and `td`; calling `createParts` twice with different tags worked.
- **Virtualizer + table** is the weakest point: `measure` writes `scrollTop` mid-patch, and the stable-key workaround is easy to break. A non-`<table>` grid (`div role=grid` with absolute rows) avoids the problem, at the cost of semantic table layout.
- **Not covered:**
  - The pieces combined in one table: resize handle + reorder + grid focus + range together.
  - Cell editing.
  - Row selection with `createSelection`.
  - Screen reader output.
  - Firefox and WebKit.
  - Touch.
  - Performance beyond about 1,800 parts per table. It felt instant, but nothing was measured.
