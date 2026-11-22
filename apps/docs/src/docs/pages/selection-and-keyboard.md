# Selection and keyboard

Let a person select rows, and move through the table with the keys of a grid.

The table is a grid: one cell holds the tab stop, and the arrow keys move between the cells. Tab goes into the table and out of it again, as one stop of the page.

## Select rows

<Example name="selection-and-keyboard/select" caption="Check Ada and Maya. The box in the header shows that some mails are picked; press it to pick every mail that is not locked. The mail from Tomas is locked." />

- `selection` is `'single'` or `'multiple'`. Without it, rows cannot be selected.
- `selected` holds the ids of the selected rows. `canSelect(row)` keeps a row out.
- `select`, `toggleSelected`, `selectRows`, `deselectRows`, `selectAll` and `clearSelection` change it. `selectAll` selects the rows that pass the filters and can be selected: `selectable` of the view.
- The `#cell` slot gets `selected` and `toggleSelected(event?)`. Put a checkbox in a column with `lead: true`, so it stays first.
- A selected row has `aria-selected="true"` and `data-selected`.

## Keys

| Key | What it does |
| --- | --- |
| Tab | Goes into the table, to the cell that holds the tab stop, and out again |
| The arrows | Move one cell. In right-to-left text, Left and Right follow the reading direction |
| Home, End | The first and the last cell of the row |
| Control or Command with Home, End | The first and the last cell of the table |
| Page Up, Page Down | The rows of one page up or down: `pageSize` of the `page` state, else ten |
| Enter on a header | Sorts a sortable column |
| Enter on a row | Opens or closes a row with child rows, a detail row or a group |
| Space on a row | Selects the row, with `selection`. With Shift, the rows from the last one |
| Space on a group row | Selects the rows of the group, with `selection="multiple"` |

A key from a control inside a cell, such as a button or a field, belongs to that control.

The grid gives focus back to a cell only when a change of the table took it away, such as a sort that moved the row. A press elsewhere or a Tab key in between leaves focus where the person put it.

## Ranges of cells

With `cellSelection`, a person selects a range of cells: Shift with an arrow, or a drag. Control or Command with C copies the range as text, with tabs between cells and line breaks between rows. With `editable` too, Control or Command with V pastes into it. See [Editing](./cell-editing.md).

The cells of a range have `data-selected` and `data-range-edge`. The state is `cellRange`. [Range, copy and paste](./range-copy-and-paste.md) covers the rest.

## Names

- **Options:** `selection`, `canSelect`, `selected`, `defaultSelected`, `cellSelection`.
- **Events:** `selected-change`.
- **Controller:** `select`, `toggleSelected`, `selectRows`, `deselectRows`, `selectAll`, `clearSelection`, `selectCells`, `clearCellSelection`, `copyCells`.

See the [Rows tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=rows).
