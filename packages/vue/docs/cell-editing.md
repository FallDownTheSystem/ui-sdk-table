# Editing

Let a person change the value of a cell, check it first, and put it into your rows.

The table never writes a row. It reports each edit through `@cell-edit`, and the app puts the value into its rows. `applyEdits` does that for plain rows.

```vue title="prices.vue"
<script setup lang="ts">
import {
	applyEdits,
	Table,
	type CellEdit,
	type ColumnDef,
	type StandardSchemaV1,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Product = { id: string; name: string; price: number; stock: number }

// Any Standard Schema works: Zod, Valibot, ArkType. This one is written by hand.
function check(test: (value: unknown) => string | undefined): StandardSchemaV1 {
	return {
		'~standard': {
			version: 1,
			vendor: 'example',
			validate: (value) => {
				const message = test(value)
				return message === undefined ? { value } : { issues: [{ message }] }
			},
		},
	}
}

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', editable: false },
	{
		id: 'price',
		header: 'Price',
		format: 'decimal',
		numberKeyboard: true,
		schema: check((value) =>
			typeof value === 'number' && value >= 0 ? undefined : 'A price is a number, zero or more.',
		),
	},
	{
		id: 'stock',
		header: 'In stock',
		format: 'integer',
		numberKeyboard: true,
		schema: check((value) =>
			Number.isInteger(value) && Number(value) >= 0 ? undefined : 'Stock is a whole number.',
		),
	},
]

// The rows are yours. The table reports an edit and never writes a row.
const rows = shallowRef<Product[]>([
	{ id: 'p1', name: 'Green tea', price: 6.5, stock: 40 },
	{ id: 'p2', name: 'Dark coffee', price: 9.9, stock: 12 },
	{ id: 'p3', name: 'Oat cookies', price: 3.2, stock: 75 },
])
const last = shallowRef('Nothing edited yet.')

function onCellEdit(edits: readonly CellEdit<Product>[], details: TableEditDetails) {
	rows.value = applyEdits(rows.value, edits)
	const [edit] = edits
	if (edit)
		last.value = `${edit.row.name}: ${edit.column.header} ${edit.previous} to ${edit.value}, by ${details.reason}`
}
</script>

<template>
	<Table :rows="rows" :columns="columns" editable aria-label="Prices" @cell-edit="onCellEdit" />
	<p role="status">{{ last }}</p>
</template>
```

Double-press a price, type 7, and press Enter. The line under the table says what changed. Type -1 and the editor stays open with the reason. Product names cannot be edited.

## Turn it on

- `editable` on the table lets a person edit every cell. `editable` on a column says otherwise for its cells: `false`, or a function `(row) => boolean` for some rows.
- `@cell-edit` gets `(edits, details)`. Each edit has `rowId`, `columnId`, `row` (your object, as it was before), `column`, `value` and `previous`. `details.reason` says how it came: `enter-key`, `tab-key`, `focus-out`, `paste` or `imperative`. `details.cancel()` refuses the edit.
- `applyEdits(rows, edits, getRowId?)` returns a new array with a new object for each row that changed. The other rows stay the same objects. It finds the row of an edit by its object, and by its id when the object was replaced already. Pass the `getRowId` of the table when it has one. It reads the top level only: the child rows of a tree need your own code.

## Keys

| Key | On a cell that can be edited |
| --- | --- |
| Enter, F2 or a double press | Opens the editor with the value |
| A character | Opens the editor with that character |
| Enter in the editor | Saves, and focus goes back to the cell |
| Tab, Shift+Tab in the editor | Saves and goes to the next or the cell before |
| Escape in the editor | Closes it and puts the value back |
| A press elsewhere | Saves |

The arrows in the editor move the caret. Without an editor, Tab leaves the table; in the [entry mode](./cell-editing.md#an-entry-mode-with-save-and-cancel) it goes to the next cell that can be edited.

## Check a value

A text becomes a value in two steps:

1. `parse(text, row)` of the column makes the value. Without it, the value that the cell holds now decides: a number stays a number, a boolean a boolean, a date a date, and anything else gets the text. An empty text empties a number or a date.
2. `schema` of the column checks the value. Any Standard Schema works: Zod, Valibot, ArkType. A refusal keeps the editor open with the message of the schema.

A check can answer with a promise. The editor then waits (`data-checking`), and Escape takes the edit back.

`numberKeyboard: true` on a column gives the field of its editor `inputmode="decimal"`, so a phone shows its number keyboard. The field stays a text field and never `type="number"`.

## Your own editor

`#editor` and `#edit-{column id}` fill the editor of a cell. They get `row`, `column`, `value`, `text`, `error`, `checking`, `mode`, `typed`, `inputMode`, `save(value, event)` and `cancel()`. The control must take focus itself. A `save` goes through the same check as the field of the table.

## From code

`controller.editCell(rowId, columnId, value)` gives a cell a value with the check of its column, and reports it with the reason `imperative`. It throws with the reason when the value is refused. `startEdit` opens the editor of a cell in view, and `cancelEdit` closes it.

## An entry mode with Save and Cancel

`entry` turns the table into a form for many cells at once: a person moves with Tab and types. Turn it on and off from your own Edit button; while it is on, cells can be edited as with `editable`, unless `editable` is false or a column says otherwise.

```vue title="entry.vue"
<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	Table,
	useEditDraft,
	type CellAttrsContext,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Shift = { id: string; person: string; day: string; hours: number; note: string }

const columns: ColumnDef<Shift>[] = [
	{ id: 'person', header: 'Person', editable: false },
	{ id: 'day', header: 'Day' },
	{ id: 'hours', header: 'Hours', format: 'decimal', numberKeyboard: true },
	{ id: 'note', header: 'Note' },
]

// The rows are yours. The draft holds the edits until Save.
const rows = shallowRef<Shift[]>([
	{ id: 's1', person: 'Kofi', day: 'Monday', hours: 8, note: '' },
	{ id: 's2', person: 'Ines', day: 'Tuesday', hours: 6.5, note: 'Late start' },
	{ id: 's3', person: 'Tomas', day: 'Friday', hours: 4, note: '' },
])
const draft = useEditDraft(rows)
const editing = shallowRef(false)
const last = shallowRef('Nothing saved yet.')

function save() {
	const edits = draft.save()
	rows.value = applyEdits(rows.value, edits)
	last.value = `Saved ${edits.length} ${edits.length === 1 ? 'cell' : 'cells'}.`
	editing.value = false
}

function cancel() {
	draft.cancel()
	editing.value = false
}

// A cell whose value differs from your rows gets a mark of its own.
const cellAttrs = (context: CellAttrsContext<Shift>) =>
	context.kind === 'cell' && draft.changed(context.node.id, context.column.id)
		? { class: 'changed' }
		: undefined
</script>

<template>
	<div>
		<Button v-if="!editing" @click="editing = true">Edit</Button>
		<template v-else>
			<Button @click="save">Save</Button>
			<Button @click="cancel">Cancel</Button>
			<span>{{ draft.count.value }} changed</span>
		</template>
	</div>
	<Table
		:rows="draft.rows.value"
		:columns="columns"
		:entry="editing"
		:cell-attrs="cellAttrs"
		aria-label="Shifts"
		@cell-edit="draft.onCellEdit"
	/>
	<p role="status">{{ last }}</p>
</template>

<style scoped>
/* In the entry mode, the cells that take input show it. */
:deep([data-entry] td[data-editable]) {
	box-shadow: inset 0 -1px 0 #94a3b8;
	cursor: text;
}

:deep(td.changed) {
	background: #fef9c3;
}
</style>
```

Press Edit, then press a day: its editor opens. Type Sunday and press Tab: the day is saved and focus goes to the hours, where typing 7 replaces the value. Press Tab, then Save. Cancel puts every cell back.

- **Tab and Shift+Tab** on a cell and in the editor go to the next and the previous cell that can be edited, in reading order and across the rows. They pass over a cell that cannot be edited, a group row and a column that leads. From the last such cell Tab leaves the table, and from the first Shift+Tab: the table is never a trap. Inside a selected range of more than one cell, Tab walks the range.
- **One press** on a cell that can be edited opens its editor. A press with Shift, Control, Command or Alt, and a drag, keep their meaning, also with `cell-selection`.
- **A character** on a cell replaces its value, and Tab, Enter or a press elsewhere saves it, as without the mode.
- The root has `data-entry`, so a style can show which cells take input: `[data-entry] [data-editable]`.

`useEditDraft(rows, { getRowId? })` holds the edits until a person saves them. It never changes one of your row objects. It reads the top level of your rows only, as `applyEdits` does, and finds a row by `getRowId`, else by its `id`, else by its place: pass the `getRowId` of the table when it has one.

- `rows` is the list to pass to the table: your rows, with the values of the draft in new objects.
- `onCellEdit` is the `@cell-edit` listener. It takes every report: an edit, a paste, a fill, a clear and an undo. For an edit of a row that it cannot find, such as a child row of a tree, it throws with the row id, and takes nothing of that report.
- `count` is how many cells differ from your rows, and `changed(rowId, columnId)` says whether one does, for a mark through `cellAttrs`. A cell set back to its first value no longer differs.
- `save()` gives the edits against your rows, one for each cell that differs, and empties the draft: pass them to `applyEdits`, or to your server. `cancel()` empties the draft.
- **New rows while a draft is open:** the draft is kept by row id and column id and stays over the new rows. A cell whose new value is the value of the draft no longer differs, and a cell of a row that is gone counts no more and is not saved.
- **Formulas:** the draft holds values only. A formula that a person types goes into the `cellFormulas` state of the table at once, as without a draft, and `cancel()` does not take it back. For a table with `formulas`, keep the formulas in a `v-model:cell-formulas` of your own and put the old state back on Cancel.

## Attributes

- `data-entry` on the root in the entry mode.
- `data-editable` on a cell that can be edited, `data-editing` while its editor is open, `data-checking` while a check runs.
- The editor is `[data-slot='table-editor']`, with `aria-invalid` and `data-invalid` after a refusal. Its name is "Edit Price" (message `editCell`).
- The reason of a refusal is `[data-slot='table-edit-error']`, which the editor names with `aria-errormessage`.

## Names

- **Options:** `editable`, `entry`, `onCellEdit` (`@cell-edit`); column keys `editable`, `parse`, `schema`, `numberKeyboard`.
- **Controller:** `editCell`, `startEdit`, `cancelEdit`.
- **Slots:** `#editor`, `#edit-{column id}`.
- **Exports:** `applyEdits`, `cellValue`, `emptyValue`, `useEditDraft`, and the types `EditDraft`, `EditDraftOptions`, `CellEdit`, `TableEditDetails`, `TableEditReason`, `StandardSchemaV1`, `EditorSlotProps`.

See the [Edit tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=edit).
