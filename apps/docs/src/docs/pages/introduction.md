# Introduction

A headless table for Vue: the logic of a data table, and no looks.

`ui-sdk-table` renders a real `<table>` with the roles, the keyboard and the state of a grid. It gives sort, search, filters, groups with totals, pages, row selection, a row window for many rows, pinned and resized columns, cell editing, copy and paste, an export, and the rules of a data sheet. It gives no colours, no fonts and no toolbar.

Every cell is a slot. Every state has a `v-model`. A controller gives each action to code outside the table, and to an agent.

## The layers

A styled table stands on three layers. Each one builds on the one under it.

- [UI SDK](https://ui-sdk.dev) gives the logic primitives: focus in a grid, a range of cells, resize, inline edit, popups. It also ships the controls around a table, such as a select, a slider or a pagination.
- This library builds the headless table on them. It holds the state, the data for the controls (`getView`, `getFacets`, `getTotals`, `subscribe`), and the attributes and CSS variables that a style reads.
- Your app builds the styled table on this library: the looks, the toolbar, the search field, the filter controls and the column menu of its own design system.

A feature that only gives looks belongs to your app. The library has the logic that the looks need.

## Quick start

Copy this prompt into your agent:

```text prompt
Set up ui-sdk-table in this Vue project. It needs Vue 3.5 or newer.

1. Add ui-sdk-table-vue and ui-sdk-table-core from GitHub, pinned to one commit, as Installation in node_modules/ui-sdk-table-vue/docs/installation.md says. Add @ui-sdk/vue and @ui-sdk/core at the exact version that it names. If a release-age policy blocks the install, stop and ask me instead of changing it.
2. Add a note to AGENTS.md, creating it if needed: before building a table, follow the ui-sdk skill and the ui-sdk-table skill if they are installed, and read node_modules/ui-sdk-table-vue/docs/llms.txt and node_modules/@ui-sdk/vue/docs/llms.txt.
3. If you support skills, run: npx skills@latest add vercel-labs/ui --skill ui-sdk
4. If you support skills, run: npx skills@latest add FallDownTheSystem/ui-sdk-table --skill ui-sdk-table
```

It installs the table and points your `AGENTS.md` at the docs that ship with the package. The skill of this library lives in `skills/ui-sdk-table` of the repository.

## Set it up yourself

- [Installation](./installation.md): Add the packages to your Vue app.
- [First table](./first-table.md): Put a table on a page and give it looks.
