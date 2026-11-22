# A formula writer

Build a field that helps a person write a formula: suggestions of functions, a hint for the argument at the caret, references picked with the pointer or the arrow keys, and the cells of each reference in colour.

Use it for a formula bar above a sheet, or for the editor of a cell. The library gives the logic and the state; the field, the list and the colours are the app's. Everything here needs the `formulas` option, except the pick mode.

```vue title="writer.vue"
<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellAttrsContext,
	type CellEdit,
	type CellFormulas,
	type CellPick,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import {
	createFormulaEngine,
	FORMULA_FUNCTIONS,
	formulaHelp,
	insertReference,
	useFormulaBar,
} from 'ui-sdk-table-vue/formulas'
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'

type Line = { id: string; item: string; price: number | null; qty: number | null; total?: unknown }

const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: 156 },
	{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: 178 },
	{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: 177 },
	{ id: 'l4', item: 'Order total', price: null, qty: null, total: null },
])

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', allowFormula: false },
	{ id: 'price', header: 'Price', format: 'decimal' },
	{ id: 'qty', header: 'Qty', format: 'integer' },
	{ id: 'total', header: 'Total', format: 'decimal' },
]

const formulas = shallowRef<CellFormulas>({
	cells: {
		l1: { total: '=[price]*[qty]' },
		l2: { total: '=[price]*[qty]' },
		l3: { total: '=[price]*[qty]' },
	},
})

const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)
const field = useTemplateRef<HTMLInputElement>('field')
const frame = useTemplateRef<HTMLElement>('frame')

// The caret of the field, and the reference that the last pick put there:
// the next pick replaces it, so a drag writes one reference.
const caret = shallowRef({ start: 0, end: 0 })
const picked = shallowRef<{ start: number; end: number } | null>(null)
// A screen reader hears nothing when a script changes the text of a field, so
// the status line says the address of each pick.
const said = shallowRef('')

const text = computed(() => bar.text.value)
const help = computed(() => formulaHelp(text.value, caret.value.end, { locale: 'en-US' }))
const formula = computed(() => text.value.startsWith('='))
// The pick mode is on where a reference fits at the caret, and after a pick until the person types.
const picking = computed(() => formula.value && (help.value.reference || picked.value !== null))

// The functions whose name starts with the word at the caret.
const word = computed(() => {
	const token = help.value.token
	return token && (token.kind === 'name' || token.kind === 'function') ? token : null
})
const suggestions = computed(() => {
	const typed = word.value?.text.toUpperCase()
	return typed ? FORMULA_FUNCTIONS.filter((info) => info.name.startsWith(typed)).slice(0, 6) : []
})

function readCaret() {
	const el = field.value
	if (el) caret.value = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
}
function place(start: number, end = start) {
	caret.value = { start, end }
	void nextTick(() => field.value?.setSelectionRange(start, end))
}
function typed(event: Event) {
	picked.value = null
	said.value = ''
	bar.input((event.target as HTMLInputElement).value)
	readCaret()
}
function choose(name: string) {
	const token = word.value
	if (!token) return
	const next = insertReference(text.value, token, `${name}(`)
	bar.input(next.text)
	picked.value = null
	place(next.end)
}
function pick(cells: CellPick | null) {
	const address = cells && controller.getRangeAddress(cells)
	if (!address) return
	const next = insertReference(text.value, picked.value ?? caret.value, address)
	bar.input(next.text)
	picked.value = { start: next.start, end: next.end }
	said.value = `Picked ${address}`
	place(next.end)
}
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const
function arrow(event: KeyboardEvent) {
	const key = ARROWS.find((name) => name === event.key)
	if (!key || !picking.value || event.altKey) return
	event.preventDefault()
	controller.movePick(key, {
		extend: event.shiftKey,
		edge: event.ctrlKey || event.metaKey,
		// After a typed character, a pick starts again from the cell of the field.
		start: picked.value === null,
	})
}
function commit() {
	picked.value = null
	said.value = ''
	// After the field, focus goes back to the active cell.
	if (bar.commit()) frame.value?.querySelector<HTMLElement>('[data-active]')?.focus()
}

// Each reference of the text and its cells get one colour, by its place in the text.
const references = computed(() => {
	const at = bar.cell.value
	return formula.value && at ? controller.getFormulaReferences(text.value, at) : []
})
// The table says which reference holds a cell, and at which edges of its block.
const cellAttrs = computed(() => {
	const found = references.value
	// New rows move the places of the document, so the marks are asked again.
	void lines.value
	if (!found.length) return undefined
	const mark = controller.getReferenceMarks(found)
	return (context: CellAttrsContext<Line>) => {
		const at = context.kind === 'cell' ? mark(context.node.id, context.column.id) : undefined
		return (
			at && { 'data-reference': String(at.index % 4), 'data-reference-edge': at.edges || undefined }
		)
	}
})
</script>

<template>
	<form class="writer" @submit.prevent="commit">
		<output data-testid="address">{{ bar.address.value || '—' }}</output>
		<input
			ref="field"
			aria-label="Formula of the active cell"
			placeholder="Press a cell, then type ="
			autocomplete="off"
			spellcheck="false"
			:value="text"
			:disabled="!bar.ready.value"
			:aria-invalid="!!bar.error.value"
			@input="typed"
			@select="readCaret"
			@keyup="readCaret"
			@click="readCaret"
			@keydown="arrow"
			@keydown.escape.prevent="bar.cancel()"
		/>
		<p v-if="help.call?.info" data-testid="hint">
			{{ help.call.name }}(<template v-for="(arg, index) in help.call.info.arguments" :key="index"
				><template v-if="index">, </template
				><strong v-if="index === help.call.argument">{{ arg.name }}</strong
				><template v-else>{{ arg.name }}</template></template
			>)
		</p>
		<ul v-if="suggestions.length" aria-label="Functions">
			<li v-for="info in suggestions" :key="info.name">
				<button type="button" @pointerdown.prevent @click="choose(info.name)">
					<strong>{{ info.name }}</strong> {{ info.help }}
				</button>
			</li>
		</ul>
		<p role="status">{{ bar.error.value || said }}</p>
	</form>
	<div ref="frame">
		<Table
			v-model:cell-formulas="formulas"
			:formulas="engine"
			:rows="lines"
			:columns="columns"
			:controller="controller"
			:pick-cells="picking"
			:cell-attrs="cellAttrs"
			locale="en-US"
			sheet
			column-letters
			aria-label="An order with a formula writer"
			@picked-cells-change="pick"
			@cell-edit="(edits: readonly CellEdit<Line>[]) => (lines = applyEdits(lines, edits))"
		/>
	</div>
</template>
```

Press the total of the Order total (D4), type =SUM( in the field, then drag from D1 to D3: the field gets D1:D3 and the three cells get a colour. Type ) and press Enter. Type =D1+ and press the Left arrow: the field gets C4, and Shift with the Up arrow makes it C3:C4. Type =su in the field: the list shows SUM and SUBSTITUTE.

## Suggest functions

`formulaHelp(text, caret, { locale })` of the formulas entry reads the text of the field, also a text that is not a whole formula yet (`=SUM(B2;` or `=IF(A1>2, "ope`), and tells what the caret is at:

- `token`: the token that ends at the caret or holds it, with its `kind`, `text`, `start` and `end`. When its kind is `name` or `function`, filter `FORMULA_FUNCTIONS` (or `controller.getFormulaFunctions()`) by its text, and put the choice in its place with `insertReference(text, token, 'SUM(')`.
- `call`: the innermost call around the caret: its `name`, `start`, the `index` of the argument at the caret, and `argument`, the place of that argument in `info.arguments`. A hint marks that argument.
- `reference`: whether a reference fits at the caret: the text starts with `=` and the caret follows `=`, `(`, a sign between arguments or an operator, and is not inside a text in quotes.

Each function of `FORMULA_FUNCTIONS` has its `name`, `args` as a text, `help`, its `group` (`math`, `condition`, `lookup`, `logic`, `text` or `date`) and `arguments` as a list. An argument has a `name`, `optional`, and `repeats`: the arguments with `repeats` come again as a group, as `range2, criterion2` of `COUNTIFS` do, and `argument` counts them again.

The locale decides the signs, as for the table: with a decimal comma (`fi-FI`), `;` separates the arguments.

## Pick cells with the pointer

Turn on `pick-cells` while a reference fits at the caret. While it is on, a press or a drag on cells of the body picks them, and a press on a letter of `column-letters` picks its column. A pick changes nothing else: the active cell, the selected cells, an open editor, focus and the caret of the field stay where they are.

- `@picked-cells-change` hears the press and each step of a drag; `@picked-cells-commit` the end of a drag. `v-model:picked-cells` holds the pick. A pick is places in the grid, as `cellRange` is, with `columns` for whole columns. It goes back to `null` when `pick-cells` goes off.
- `controller.getRangeAddress(pick)` gives its text: `B2`, `B2:C5`, or `B:B` for a column. Without an argument it reads the selected cells.
- `insertReference(text, selection, address)` puts the address in place of the selection of the field and gives the new text with the place of the reference. During a drag, pass the place of the last step as the selection of the next one, so each step replaces the reference of the step before. After a pick, a press on another cell replaces it again until the person types.
- A press on any other cell picks nothing and changes nothing: a header cell, a footer cell, a cell of a group row or a detail row, a row number and the corner. Nothing sorts, moves a column, selects or opens, and focus and the caret stay in the field. A press on a control inside a cell (a button, a field, the resize handle) stays the control's. A double press opens no editor.

It works the same for the field of the table's own editor (`[data-slot='table-editor']`), for a control in the `editor` slot, and for a field outside the table such as `useFormulaBar`. The press is prevented, so focus never leaves the field.

## Pick cells with the arrow keys

As in the point mode of Excel, an arrow key picks where a reference fits. The first arrow picks the cell next to the cell of the field, in its direction, and writes its address at the caret. More arrows move the pick, and the address is replaced. Shift with an arrow keeps the first cell and grows a range. Control (or Command) with an arrow goes to the edge of the body. The keys follow the direction of the table, as they do for the active cell: in a right-to-left table the Left arrow picks the next column, so a field passes the key that it got and turns nothing. A first arrow with no cell in its direction, such as the Up arrow in the first row, picks nothing and changes no text. The next character that the person types keeps the reference and ends the pick; an arrow after it, where a reference fits again, starts a new pick from the cell of the field.

- The cell of the field is the cell of the open editor, else the active cell (the cell of `useFormulaBar`).
- When a typed character opens the editor, the field starts with that character and fires no `input` event. An app that turns on `pick-cells` from the text of the field reads it when the field gets focus.
- `controller.movePick(key, { extend, edge, start })` moves the pick. `key` is `ArrowUp`, `ArrowDown`, `ArrowLeft` or `ArrowRight`; `extend` grows a range, `edge` goes to the edge of the body, and `start` starts a new pick from the cell of the field even when a pick is there. It reports through `@picked-cells-change` as a press does, with the reason `list-navigation`, so the same listener writes the address with `insertReference`. A cell that the row window does not show is scrolled into view; focus and the caret stay. It needs `pick-cells` and throws without it.
- A field of the app (a bar with `useFormulaBar`, a control in the `editor` slot) hears its own keys: on an arrow while the pick mode is on, it calls `preventDefault()` and `movePick`, with `start: true` after a typed character.
- The text field of the table's own editor needs nothing: while `pick-cells` is on, the table hears its arrows and picks, and a typed character, Backspace or Delete sets `picked-cells` back to `null`, so the next arrow starts anew.
- Keep `pick-cells` on while the reference of the last pick ends at the caret, also when `formulaHelp().reference` is false there: the next arrow must move that pick.

A screen reader hears nothing when a script changes the text of a field. Say the address of each pick in a live region, such as a `role="status"` line beside the field (`Picked C3:C4`), and empty it when the person types.

## Colour the references

`controller.getFormulaReferences(text, at?)` gives each reference of the text with its `start` and `end` in the text and the cells that it names by ids, from the first (`from`) to the last (`to`), and `columns` for whole columns. `at` is the cell of the formula, the active cell by default; `useFormulaBar().cell` is the cell of the bar. A reference to a column or a row that the document does not hold is left out.

Give the cells of each reference one colour through `cell-attrs`. `controller.getReferenceMarks(references)` gives a function that takes a row id and a column id and tells whether a reference holds the cell: `index`, the place of the first reference that holds it, and `edges`, the edges of its block that the cell is at (`top`, `bottom`, `left` and `right`, joined by spaces, as `data-pick-edge` holds them). It gives `undefined` for a cell that no reference holds and for a column that leads. The places are those of the document, so a column that the app puts first or hides changes nothing, and the app needs no map of its own. Each question costs two reads of a map, also for a whole column of 50,000 rows.

Ask for the marks again, and pass a new `cell-attrs` function, when the references or the rows change; pass the same one while they stay.

## What a styled table needs

- A list of functions under the field, and a hint with the argument at the caret marked.
- A look for `[data-pick]` on the table (a cursor) and for `[data-picked]` on the picked cells (a dashed line; `data-pick-edge` holds `top`, `bottom`, `left` and `right` for a line around them).
- One colour for each reference, through `cell-attrs`.

## Attributes

- `data-pick` on the table while `pick-cells` is on.
- `data-picked` on each picked cell, and `data-pick-edge` on the cells at its edges.

## Keys

While `pick-cells` is on, in the text field of the table's own editor:

| Key | Does |
| --- | --- |
| An arrow | Picks the cell next to the cell of the field, or moves the pick. |
| Shift with an arrow | Grows the pick into a range from its first cell. |
| Control or Command with an arrow | Moves the pick to the edge of the body. |
| A character, Backspace, Delete | Is the field's, and ends the pick. |

A field of the app gets the same keys by calling `movePick`. With `pick-cells` off, every key does what it does without the pick mode.

See the [Formula tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=formula).

## Names

- **Options:** `pick-cells`, `picked-cells`, `default-picked-cells`; events `picked-cells-change` and `picked-cells-commit`. `CellPick` is `{ anchor, end, columns }`.
- **Controller:** `movePick(key, options?)` (the types `PickKey` and `PickMoveOptions`), `getRangeAddress(cells?)` (`null` without cells, for a column without a letter, and with `manual-page`), `getFormulaReferences(text, at?)`, `getReferenceMarks(references)` (the type `FormulaReferenceMark`), `getFormulaFunctions()`.
- **Formulas entry:** `formulaHelp`, `insertReference`, `FORMULA_FUNCTIONS`; the types `FormulaHelp`, `FormulaHelpOptions`, `FormulaToken`, `FormulaTokenKind`, `FormulaReference`, `FormulaArgument`, `FormulaFunctionGroup`.
- **Vue:** `useFormulaBar(controller).cell`.
- **Attributes:** `data-pick`, `data-picked`, `data-pick-edge`.
