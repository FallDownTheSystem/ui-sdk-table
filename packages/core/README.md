# ui-sdk-table-core

The framework-free part of the headless table: the table primitive, its behaviors and the pure row helpers, built on `@ui-sdk/core`. An app uses it through [`ui-sdk-table-vue`](https://www.npmjs.com/package/ui-sdk-table-vue), which depends on it.

- `ui-sdk-table-core/export` holds the CSV and Excel writers.
- `ui-sdk-table-core/formulas` holds the formula engine.
- The package ships TypeScript source (`exports` points at `src`), so an app compiles it with its own compiler options.

The docs are at <https://falldownthesystem.github.io/ui-sdk-table/>.
