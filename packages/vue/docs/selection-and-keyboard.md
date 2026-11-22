# Selection and keyboard

Let a person select rows, and move through the table with the keys of a grid.

The table is a grid: one cell holds the tab stop, and the arrow keys move between the cells. Tab goes into the table and out of it again, as one stop of the page.

## Select rows

```vue title="select.vue"
<script setup lang="ts">
import { Checkbox, CheckboxIndicator } from '@ui-sdk/vue/checkbox'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Mail = { id: string; from: string; subject: string; locked: boolean }

const mails: Mail[] = [
	{ id: 'm1', from: 'Ada', subject: 'The plan for May', locked: false },
	{ id: 'm2', from: 'Tomas', subject: 'Invoice 1042', locked: true },
	{ id: 'm3', from: 'Maya', subject: 'Photos of the trip', locked: false },
	{ id: 'm4', from: 'Leo', subject: 'Lunch on Friday?', locked: false },
]

const columns: ColumnDef<Mail>[] = [
	// A lead column stays first, and holds the checkbox of its row.
	{ id: 'pick', header: 'Pick', lead: true, hideable: false, searchable: false },
	{ id: 'from', header: 'From' },
	{ id: 'subject', header: 'Subject' },
]

// A locked mail cannot be picked.
const canSelect = (mail: Mail) => !mail.locked
const controller = createTableController()
const view = useTableView(controller)
const selected = shallowRef<string[]>([])

const all = computed(() => {
	const open = view.value?.selectable.length ?? 0
	if (selected.value.length === 0) return false
	return selected.value.length === open ? true : 'indeterminate'
})
</script>

<template>
	<p role="status">{{ selected.length }} picked</p>
	<Table
		v-model:selected="selected"
		:rows="mails"
		:columns="columns"
		:controller="controller"
		:can-select="canSelect"
		selection="multiple"
		aria-label="Inbox"
	>
		<template #header-pick>
			<Checkbox
				:checked="all"
				aria-label="Pick every mail"
				@checked-change="
					(on) => (on === true ? controller.selectAll() : controller.clearSelection())
				"
			>
				<CheckboxIndicator v-slot="{ state }">{{
					state.indeterminate ? '–' : '✓'
				}}</CheckboxIndicator>
			</Checkbox>
		</template>
		<template #col-pick="{ row, selected: on, toggleSelected }">
			<Checkbox
				v-if="canSelect(row)"
				:checked="on"
				:aria-label="`Pick the mail from ${row.from}`"
				@checked-change="toggleSelected()"
			>
				<CheckboxIndicator>✓</CheckboxIndicator>
			</Checkbox>
		</template>
	</Table>
</template>
```

Check Ada and Maya. The box in the header shows that some mails are picked; press it to pick every mail that is not locked. The mail from Tomas is locked.

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

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [Rows tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=rows).
