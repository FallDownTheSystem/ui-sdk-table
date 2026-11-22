# Cells and slots

Put your own content in a header, a cell, a footer or the empty table, and give rows and cells your own attributes.

Every cell of the table is a Vue slot. A slot gets the row, the column, the value and its text, and the functions that act on its row. Without a slot, a cell shows the text of its value.

<Example name="cells-and-slots/slots" caption="The State column shows a badge from its own slot. The Hours header has its own text, and the footer shows the sum under it." />

## The slots

| Slot | Fills | Gets |
| --- | --- | --- |
| `#cell`, `#col-{column id}` | A body cell | `row`, `node`, `column`, `value`, `text`, `format`, `selected`, `expanded`, `expandable`, `level`, `pinned`, `toggleSelected`, `toggleExpanded`, `formula` |
| `#header`, `#header-{column id}` | A header cell | `column`, `label`, `leaf`, `sort`, `sortIndex`, `toggleSort`, `pin`, `selectColumn`, `formula` |
| `#foot`, `#foot-{column id}` | A footer cell | `column`, `value`, `text`, `totals`, `aggregate`, `setAggregate` |
| `#group` | The label cell of a group row | See [Groups and totals](./groups-and-totals.md) |
| `#group-total`, `#group-total-{column id}` | A cell of a group row under a column | See [Groups and totals](./groups-and-totals.md) |
| `#detail` | The detail row of a row | `row`, `node`, `toggleExpanded` |
| `#editor`, `#edit-{column id}` | The editor of a cell | See [Editing](./cell-editing.md) |
| `#empty` | The body, when no row passes the filters | Nothing |
| `#loading` | The body, while `loading` is set and the table has no rows | Nothing |

A slot for one column wins over the slot for every column: `#col-state` wins over `#cell`.

- `text` is the value with the format of the cell, else of its column. Show `text` unless the cell needs more.
- `row` is your own row object. `node` is the place of the row in the table: its `id`, its `depth` and its `parentId`.
- A header slot of a sortable column replaces the sort button too. Call `toggleSort(event)` from your own button, and pass the event: the table reads the Shift key from it.

## Attributes of rows and cells

`rowAttrs`, `cellAttrs` and `sectionAttrs` give attributes to the elements that the table renders, such as a class or a `data-*` attribute of your own.

- `rowAttrs(context)` gets the kind of the row: `header`, `letters`, `row`, `group`, `detail`, `foot` or `empty`, with the row or the group.
- `cellAttrs(context)` gets the kind of the cell: `header`, `letter`, `cell`, `group`, `group-total`, `detail`, `foot` or `empty`, with the column and the row.
- `sectionAttrs` is an object with `head`, `body` and `foot`.

The table spreads these first and its own attributes after them. A caller cannot replace a part prop (`value`, `index`, `row`, `col`, `colspan`), a role, a `tabindex` or a state attribute of the table (`aria-*` and the `data-*` attributes of the table). Such a name in the answer is left out.

The table calls `rowAttrs` when it renders its rows, not for a new selection or a new active cell. Show such state with the attributes of the table, such as `aria-selected`. Pass the same function while its answers stay the same: a new function renders every row again.

A scoped style of your component does not reach the elements that the table renders. Use `:deep()`, or a style that is not scoped.

## Names

- **Slot props types:** `CellSlotProps`, `HeaderSlotProps`, `FootSlotProps`, `GroupSlotProps`, `GroupTotalSlotProps`, `DetailSlotProps`, `EditorSlotProps`, `RowHeaderSlotProps`, `LetterSlotProps`, `TableSlots`.
- **Attribute types:** `TableAttrsProps`, `RowAttrsContext`, `CellAttrsContext`, `PartAttrs`.

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more).
