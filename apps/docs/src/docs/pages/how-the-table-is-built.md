# How the table is built

The four layers of the table, from the behaviors to the `Table` component, and which word means what.

Read it before you write a part of your own, or when `Table` does not give the markup you need.

<Example name="how-the-table-is-built/parts" caption="A table built by hand from the parts, with no Table component. Press a cell and use the arrow keys: focus moves from cell to cell, as in a Table." />

## The four layers

1. **Behaviors.** Each is a function `create<Thing>(context, options)` in `ui-sdk-table-core`: the focus of the grid (`createTableGrid`), a range of cells (`createTableRange`), an editor (`createCellEdit`), the resize, the move and the pins of columns, sticky rows, the row window, the fill handle, the writes of many cells and the history. Most of them wrap one behavior of UI SDK, such as `createGridFocus` or `createCellRange`. A behavior does not know the others.
2. **The primitive.** `table` of `ui-sdk-table-core` is one `definePrimitive` of UI SDK. It holds the options, the state, the row pipeline and the behaviors, and it meets them in its `api`. Its slots are the elements of a table: `root`, `head`, `body`, `foot`, `col`, `header-row`, `plain-row`, `spacer`, `row`, `cell`, `editor`, `edit-error`, `fill-handle` and `resizer`. Each slot gives its element a role, ARIA and `data-*` attributes, and its event handlers.
3. **The parts.** `createParts` of `@ui-sdk/vue/primitive` turns each slot into a Vue component with its element: `TableRoot` is a `table`, `TableRow` a `tr`, `TableCell` a `td`. A slot has one element, so `TableHeaderCell` is a second part of the `cell` slot, as a `th`.
4. **`Table`.** The component that you use on a page. It renders the parts from `rows` and `columns`: the header rows, the rows of the body, the group rows, the footer and the editor. It gives Vue slots with the row and the value, a `v-model` for each state and the `controller`.

## Two kinds of slot

- A **slot of the primitive** is an element: `cell` is every `td` and `th` of a grid cell. Its name is the `data-slot` of the element, with `table-` before it (`table-cell`).
- A **Vue slot of `Table`** is a place for your content: `#col-price` fills the cells of the column `price`, `#header` fills the header cells. The element around it stays the table's.

## Build a table from the parts

The parts work without `Table`. A test in the package (`packages/vue/src/parts.test.ts`, "a table built by hand from the parts") builds a table from `TableRoot`, `TableHead`, `TableHeaderRow`, `TableHeaderCell`, `TableBody`, `TableRow` and `TableCell`, and shows:

- the root has the role `grid`, its `aria-label`, and `aria-rowcount` and `aria-colcount`;
- each row has the role `row` and its `aria-rowindex`, from 1 for the header row;
- a header cell has the role `columnheader`, a body cell the role `gridcell` and its `aria-colindex`;
- the arrow keys move focus from cell to cell, and the cell with focus has `tabindex="0"`.

What you pass yourself:

- `TableRoot` takes the options of the table as props, as `Table` does: `rows`, `columns` and the rest. It has no Vue slots for cells.
- `TableRoot` is not generic. Its `columns` are `ColumnDef[]`, columns of rows of an unknown type: a list typed `ColumnDef<Planet>[]` does not fit it. Type the list `ColumnDef[]`.
- Each row and cell needs `value`, a key that is unique in the table. A row takes the id of its row; a cell any text of its own.
- A row needs `index`, its place in the grid from 0 for the first header row. A cell needs `row` and `col`, its place in the grid. A header cell needs `header`.

`Table` does all of this, and the group rows, the footer, the editor, the row window and the slots. The test covers the roles, the numbers and the arrow keys only; build on the parts when you need markup that `Table` cannot give, and test the rest yourself.

## Names

- **Parts:** `TableRoot`, `TableHead`, `TableBody`, `TableFoot`, `TableCol`, `TableHeaderRow`, `TableHeaderCell`, `TablePlainRow`, `TableSpacer`, `TableRow`, `TableCell`, `TableEditor`, `TableEditError`, `TableFillHandle`, `TableResizer`.
- **Props of the parts:** `value` (`col`, `header-row`, `row`, `cell`, `spacer`, `editor`, `edit-error`, `resizer`), `index` (`header-row`, `plain-row`, `row`), `row`, `col`, `colspan`, `rowspan`, `header` (`cell`), `footer` (`plain-row`), `size` (`spacer`).
- **Core:** the primitive `table` of `ui-sdk-table-core`.
