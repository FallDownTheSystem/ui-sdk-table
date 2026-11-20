# ui-sdk-table

A headless table for Vue, built on [UI SDK](https://ui-sdk.dev) behaviors. Work in progress: the name and the packages are not published.

## Layout

| Folder | What it is |
| --- | --- |
| `packages/core` | Framework-free: the table primitive, behaviors and pure row helpers. Depends on `@ui-sdk/core` only. |
| `packages/vue` | Vue parts for the primitive: slots, `v-model`, controllers. |
| `packages/styled` | The styled table. An app installs it through a registry and owns the copy. |
| `apps/docs` | Demo pages, the benchmark page and browser tests. |
| `docs/proof` | A frozen copy of the feasibility proof for UI SDK behaviors on a real `<table>`. |

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
