# Installation

Add the packages to your Vue app.

Start with an app that uses Vue 3.5 or newer and a bundler that compiles TypeScript, such as Vite.

## Add the packages

```bash
pnpm add ui-sdk-table-vue @ui-sdk/core@0.1.0-beta.13 @ui-sdk/vue@0.1.0-beta.13
```

With another package manager, add the same three names.

`ui-sdk-table-vue` brings `ui-sdk-table-core` with it. The two packages always have the same version, so an update of one is an update of both.

## Peer dependencies

- `@ui-sdk/core` and `@ui-sdk/vue` at `0.1.0-beta.13`, the exact beta that the library is built on. Another version can break the table.
- `vue` 3.5 or newer.

The table uses the same copy of UI SDK as the controls of your app. Install UI SDK once, at the top of your app.

## TypeScript source

The packages ship TypeScript source: `exports` points at `src`, and there is no build. Your bundler compiles the files with the rest of your app. Your type check reads them with your own compiler options.

The source uses built-ins of ES2023, such as `toSorted`. A new Vue project has `lib` at ES2022, and its type check then fails inside the packages. Set `lib` to ES2023 or newer:

```jsonc title="tsconfig.app.json"
{
	"compilerOptions": {
		"lib": ["ES2023", "DOM", "DOM.Iterable"]
	}
}
```

## Entries

- `ui-sdk-table-vue` holds `Table`, its parts, `createTableController` and the helpers.
- `ui-sdk-table-vue/export` holds the CSV and Excel writers. Load it with `import()` where a person asks for a file, so a page without an export does not carry it.
- `ui-sdk-table-vue/formulas` holds the formula engine, for a table with the `formulas` option.

```ts
const { toCsv } = await import('ui-sdk-table-vue/export')
```

## A component with the same name

The export is named `Table`. An app that registers a component of its own with that name, for example by its file name, imports this one under another name:

```ts
import { Table as HeadlessTable } from 'ui-sdk-table-vue'
```

Continue with [First table](./first-table.md) to put a table on a page.
