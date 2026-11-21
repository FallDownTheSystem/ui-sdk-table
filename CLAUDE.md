# CLAUDE.md

## What this is

A headless table for Vue, built on UI SDK (`@ui-sdk/core`, `@ui-sdk/vue`, public beta). It replaces the `CustomDataTable` of the sibling project `dashboard-template`. Work in progress; nothing is published and every package is `private`.

## Layers

The folder borders are the design. Do not import against the arrows.

```
packages/core    framework-free: table primitive, behaviors, pure row helpers   → @ui-sdk/core only
packages/vue     Vue parts, slots, v-model, controllers                         → core, @ui-sdk/vue, vue
packages/styled  styled table, installed into an app through a registry        → vue, UI SDK components
apps/docs        demo pages, benchmark page, browser tests                      → everything
docs/proof       frozen feasibility proof; reference only, not built or linted
```

- `packages/core` has no Vue import and no Vue dependency. Its `tsconfig.json` sets `types: []` for that reason.
- The styled table uses UI SDK components for every control. No reka-ui, no shadcn-vue.
- Vue is a first-class citizen: slot-based cells, `v-model` for each controlled state, Vue-idiomatic types. If the framework-free core blocks one of these, stop and say so.

## Design rules (from UI SDK)

Follow the `ui-sdk` skill. Read `node_modules/@ui-sdk/vue/docs/llms.txt`; search `docs/core.md` by heading and never read it whole (over 400 KB); read `docs/rendering.md` and `docs/agents.md` sections as needed.

- One `definePrimitive` per component: `options` schema, `state`, `sync`, `controlled`, `api`, `slots`, `agent`.
- A behavior is `create<Thing>(context, options)`. Its rules are function options. It hands results back through `set` / `onMove` / return values. Behaviors do not know each other; they meet only in `api`.
- State contract: `<key>`, `default<Key>`, `on<Key>Change(value, details)`. Every change a person can see goes through `createChange` with a reason from `ReasonVocabulary` when one fits. Drags report steps as changes and the end through `createCommit`.
- Roles go on slots, never in `attrs`. State shows as ARIA and `data-*` attributes and CSS variables, never as classes or inline styles for state.
- Use `selects` / `live` / `direct` (`byCell`, `byCellRange`) so a change reaches only the parts it affects.
- Agent-first: every primitive ends with `agent: { actions: [...] }`; action methods check their arguments and throw a message that lists the valid values; the root has an accessible name.
- Each experimental UI SDK behavior (grid focus, cell range, resize, inline edit, popup) sits behind one table behavior of ours, so an upstream API change touches one file.
- Slot names are kebab-case (`header-row`, `plain-row`), as in UI SDK. `mount` of `@ui-sdk/core/testing` reads its markup as HTML, which has no capital letters in tag names, so a slot with a capital letter cannot be a part in a test.
- The table scrolls with `behavior: 'instant'` only. A page with `scroll-behavior: smooth` otherwise animates a jump, and the next read sees the old place.
- The scroll frame of the row window is the nearest parent whose content is higher than itself, not the nearest with `overflow-y: auto`: a wrapper with `overflow-x: auto` has that computed value too.
- A renderer can call the `bind` of a slot before the element is in the page. A behavior that needs the parents or the size of an element waits for that (see `bindOrigin` in `behaviors/window.ts`).
- The props that `bind` gets are the props at that moment. A rule that must follow a prop goes in `attrs`, not in a closure of `bind`.
- UI SDK has no helper for derived data. The row pipeline keeps its own per-stage cache inside `api`.
- Never copy or mutate a caller's row objects. Rows need a stable id.

## Row pipeline (`packages/core/src/rows`)

`createRowModel` runs source → sort → filter → omit → group → page → flatten. The omit stage takes the pinned rows out of the list; the table shows them in a place of their own. Each stage is a pure function wrapped in `memo`, and runs again only when its input or its own state changed.

- Sort is before filter on purpose: a filter keeps the order of its input, so a keystroke in the search never sorts.
- A stage that removes nothing returns its input array itself. Later stages then keep their results. Keep this property when you add a stage.
- A stage may create a new node around a row (`{ ...node, children }`), never a new row. `node.row` and `node.id` stay the same.
- An unknown column id throws an error that lists the valid ids. People and agents both read these messages.
- `docs/benchmarks.md` holds the 50,000-row numbers. Run the measurement again when you change a stage, and add a column to the table.

## Commands

```bash
vp install        # install
vp run dev        # demo app, http://localhost:5180
vp check [--fix]  # format, lint, type-aware lint
vp run type-check # vue-tsc --build (authoritative for .vue files)
vp test           # unit tests (packages/core, packages/vue)
vp run test:e2e   # Playwright against apps/docs
vp run build      # build the packages
```

Run `vp check`, `vp run type-check` and `vp test` before you call work done; add `vp run test:e2e` when a page or a part changed. Unset `NODE_PATH` first if `vp check` ignores the `fmt` block.

## Tooling facts that cost time

- **Versions live in the `catalog` of `pnpm-workspace.yaml`.** UI SDK is pinned to an exact beta; do not bump it without reading what changed.
- **A package with a Vite plugin must list `vite` (`catalog:`) itself.** Otherwise pnpm gives the plugin plain `vite` as its peer, the plugin's types no longer match `vite-plus`, and `vue-tsc --build` crashes with `Debug Failure. False expression: parameter should have errors when reporting errors` instead of a type error.
- **Do not alias `vitest`.** `vite-plus` 1.7 depends on the real `vitest`; the old `@voidzero-dev/vite-plus-test` alias makes `vp test` fail with `Could not find 'vitest' bin entry`. Import test helpers from `vite-plus/test`.
- **TypeScript stays on `~6.0.3` and `vue-tsc` on `3.3.11`**, for the same reasons as in `dashboard-template` (TS 7 has no compiler API; vue-tsc 3.3.12-3.3.14 break `//` inside static attributes).
- **The packages build JavaScript only, no `.d.ts`.** `definePrimitive` returns a type that names `BaseSlotProps`, `Feature`, `Listener` and `SlotProps`, which `@ui-sdk/core` 0.1.0-beta.13 does not export, so declaration emit fails with TS2883. Types come from the TypeScript source (`exports` points at `src`). Re-evaluate when UI SDK exports those types.
- **The type-aware lint does not read `.vue` files.** `apps/docs/env.d.ts` declares `*.vue` for it.

## Conventions

- Tabs, single quotes, no semicolons (`vp fmt`).
- `noUncheckedIndexedAccess` is on. Guard or default; no `!`, `as any`, `@ts-ignore`.
- Comments explain why. No comment describes a change.
- A keyboard or focus rule is not done until a Playwright test covers it. jsdom passed the tab order, the page reset through `v-model` and Enter on a group row while all three were wrong in a browser.
- Tests: `mount` from `@ui-sdk/core/testing` for a primitive; `@vue/test-utils` for Vue parts; Playwright for real keyboard, pointer and layout. A new behavior gets its own tests.
