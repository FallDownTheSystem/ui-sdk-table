# First table

Put a table on a page and give it looks.

If you haven't added the packages yet, start with [Installation](./installation.md).

## Put a table on a page

A table needs rows, columns and a name. Each row needs a stable `id`. Each column has an `id`, which is also the key of its value in the row.

<Example name="first-table/people" caption="Press Score to sort by it. Press it again to turn the order. Press Tab to reach the table, then move between the cells with the arrow keys." />

`aria-label` gives the table its accessible name. A screen reader and an agent find the table by it.

The table never copies or changes your row objects. It reads them, and it reports a change through an event.

## Add looks

The table has no looks of its own. Every element carries a `data-slot`, and its state shows as `aria-*` and `data-*` attributes. A style reads those, and no class.

| Part | Attribute |
| --- | --- |
| The table | `data-slot="table"` |
| A header row and a body row | `data-slot="table-header-row"`, `data-slot="table-row"` |
| A header cell and a body cell | `data-slot="table-cell"`, in a `th` or a `td` |
| The column of a cell | `data-column` with the column id |
| The format of a column | `data-format` on each of its cells, such as `decimal` |
| The sort of a column | `aria-sort` and `data-sorted` (`asc` or `desc`) on its header cell |

<Example name="first-table/styled" caption="Press Score to turn the order, and Name to sort by name. The arrow comes from data-sorted. Hover a row, or reach a cell with Tab, to see the hover and the focus ring." />

`always-sorted` keeps one column in the sort: a press on it turns the order and never clears it.

The rules of a scoped style reach the elements of the table through `:deep()`, because the table renders them.

## Keep going

- [Introduction](./introduction.md) says what the library gives and what your app builds.
