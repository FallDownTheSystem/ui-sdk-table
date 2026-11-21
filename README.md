# ui-sdk-table

A headless table for Vue, built on [UI SDK](https://ui-sdk.dev) behaviors. Work in progress: the name and the packages are not published.

## What it gives

The logic of a data table, and no looks:

- A real `<table>` with the roles, the keyboard and the state of a grid: sort with one or several columns, a search with a pause, column filters with facets, groups with totals under their columns, a footer with totals, tree rows, detail rows, pages, row selection, a row window for large lists, sticky and pinned rows, hidden, moved, resized and pinned columns, cell editing, cell ranges with copy and paste, rows from a server, and a CSV and Excel export.
- Every cell is a slot, every state has a `v-model`, and a controller gives each action to code outside the table and to an agent.
- Plain data for the controls around a table: `getView`, `getFacets`, `getTotals`, `subscribe`.

The styled table is the work of the consumer. The library renders elements with `data-slot`, `data-*` and `aria-*` attributes and a few CSS variables, and a consumer gives them the looks and the controls of its own design system: a toolbar, a search field, filter controls, a column menu, the pages. `packages/vue/README.md` lists what a styled table builds on.

## Layout

| Folder | What it is |
| --- | --- |
| `packages/core` | Framework-free: the table primitive, behaviors and pure row helpers. Depends on `@ui-sdk/core` only. |
| `packages/vue` | Vue parts for the primitive: slots, `v-model`, controllers. |
| `apps/docs` | The sink page, demo pages with plain CSS, the benchmark page and browser tests. |
| `docs/proof` | A frozen copy of the feasibility proof for UI SDK behaviors on a real `<table>`. |

## Sink page

`vp run dev` opens the sink page (`?page=sink`): many small tables in a grid of tiles. Each tile is one working table that shows one thing the library does, such as "Sort by two columns." or "Totals under their columns.", and under it stand the names of the library that its code uses. Press a name to see every tile that uses it; the address keeps the choice (`?uses=sort,multiSort&mode=all`), and `?only=edit` or `?only=edit-price` shows one group or one tile.

The page is also the proof that a consumer can style the table: its one table style in `apps/docs/src/sink.css` is written against `data-slot`, `data-*` and `aria-*` attributes only, and works on seven tones.

To add a tile:

1. Write the demo as `apps/docs/src/sink/tiles/<group>/<Name>.vue`: one `Table` with an `aria-label`, in a `<div class="demo">` with a `<div class="sink-frame">` around the table. Controls beside the table are UI SDK components.
2. Add its copy to `apps/docs/src/sink/tiles/<group>.ts`: the id (`edit-price` for `edit/EditPrice.vue`), a title of one to four words with a period, a blurb of one sentence, a size and a tone.
3. Run `vp test`. The names under the tile are read from its code, and the test holds them against the library.

## Commands

```bash
vp install        # install dependencies
vp run dev        # demo app on http://localhost:5180
vp check          # format, lint and type-aware lint
vp run type-check # vue-tsc --build
vp test           # unit tests of the packages
vp run test:e2e   # browser tests of the demo app
vp run build      # build the packages
```
