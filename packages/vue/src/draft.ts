import {
	cellKey,
	cellValue,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-core'
import { computed, shallowRef, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'

export type EditDraftOptions<Row> = {
	/** The `getRowId` of the table, when it has one. Without it, a row is found by its `id`, else by its place. */
	getRowId?: (row: Row, index: number, parent: null) => string | number
	/**
	 * The formulas of the owner, for a table with `formulas`. The draft then
	 * holds the formulas that a person types as it holds the values: pass
	 * `formulas` of the draft as the `cell-formulas` of the table and its
	 * `onCellFormulasChange` as the listener, and the formulas of the owner
	 * stay as they are until Save.
	 */
	formulas?: MaybeRefOrGetter<CellFormulas | undefined>
}

/**
 * What `save` gives: the edits against the rows of the owner, and the
 * formulas to keep. An edit carries `formula` where the formula of its cell
 * differs from the formula of the owner: a text, or `null` for one that went.
 */
export type EditDraftSave<Row> = CellEdit<Row>[] & {
	/** The formulas of the owner with those of the draft over them, both layers. `undefined` without the `formulas` option. */
	formulas: CellFormulas | undefined
}

export type EditDraft<Row> = {
	/** The rows to pass to the table: the rows of the owner with the values of the draft in them. */
	rows: ComputedRef<Row[]>
	/**
	 * The formulas to pass to the table as `cell-formulas`: the formulas of
	 * the owner with those of the draft over them. Without the `formulas`
	 * option, those of the draft alone.
	 */
	formulas: ComputedRef<CellFormulas>
	/** How many cells hold another value or another formula than the owner, each cell once, and how many columns another formula. */
	count: ComputedRef<number>
	/** Whether a cell holds another value or another formula of its own than the owner, by the row id and the column id. */
	changed: (rowId: string, columnId: string) => boolean
	/** Whether the formula of a column (the `columns` layer) differs from the formula of the owner. */
	changedColumn: (columnId: string) => boolean
	/** Pass it as the `cell-formulas-change` listener of the table. */
	onCellFormulasChange: (value: CellFormulas) => void
	/**
	 * Pass it as the `cell-edit` listener of the table. It takes every report:
	 * an edit, a paste, a fill, a clear and an undo. It throws for an edit of a
	 * row that is not in the rows of the owner, such as a child row.
	 */
	onCellEdit: (edits: readonly CellEdit<Row>[]) => void
	/**
	 * The edits against the rows of the owner, one for each cell that
	 * differs, and the formulas to keep; the draft is empty after it.
	 */
	save: () => EditDraftSave<Row>
	/** Empties the draft: the values and the formulas together. */
	cancel: () => void
}

type Entry<Row> = { rowId: string; column: ColumnDef<Row>; value: unknown }
/** The formulas of the draft over the owner: a text, or `null` for a formula that the draft took away. */
type Patches = {
	cells: ReadonlyMap<string, { rowId: string; columnId: string; formula: string | null }>
	columns: ReadonlyMap<string, string | null>
}

const NO_PATCHES: Patches = { cells: new Map(), columns: new Map() }
const NO_FORMULAS: CellFormulas = {}

/** The formulas of the owner with the patches over them. */
function withPatches(owner: CellFormulas, patches: Patches): CellFormulas {
	if (!patches.cells.size && !patches.columns.size) return owner
	const columns: Record<string, string> = { ...owner.columns }
	for (const [id, formula] of patches.columns) {
		if (formula === null) delete columns[id]
		else columns[id] = formula
	}
	const cells: Record<string, Record<string, string>> = { ...owner.cells }
	for (const { rowId, columnId, formula } of patches.cells.values()) {
		const row: Record<string, string> = { ...cells[rowId] }
		if (formula === null) delete row[columnId]
		else row[columnId] = formula
		if (Object.keys(row).length) cells[rowId] = row
		else delete cells[rowId]
	}
	return { columns, cells }
}

/** What differs in `value` from `owner`, cell by cell and column by column. */
function patchesOf(owner: CellFormulas, value: CellFormulas): Patches {
	const cells = new Map<string, { rowId: string; columnId: string; formula: string | null }>()
	const rows = new Set([...Object.keys(owner.cells ?? {}), ...Object.keys(value.cells ?? {})])
	for (const rowId of rows) {
		const before = owner.cells?.[rowId]
		const after = value.cells?.[rowId]
		if (before === after) continue
		for (const columnId of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
			const formula = after?.[columnId] ?? null
			if (formula !== (before?.[columnId] ?? null)) {
				cells.set(cellKey(rowId, columnId), { rowId, columnId, formula })
			}
		}
	}
	const columns = new Map<string, string | null>()
	for (const id of new Set([
		...Object.keys(owner.columns ?? {}),
		...Object.keys(value.columns ?? {}),
	])) {
		const formula = value.columns?.[id] ?? null
		if (formula !== (owner.columns?.[id] ?? null)) columns.set(id, formula)
	}
	return { cells, columns }
}

const same = (a: unknown, b: unknown) =>
	Object.is(a, b) || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime())

/**
 * A draft of edits that the owner saves or cancels as a whole, for a table
 * whose cells a person fills in before a Save button. It never changes a row
 * object of the owner: a row with values of the draft is a new object.
 *
 * The draft reads the top level of the rows only, as `applyEdits` does, and
 * finds a row by the `getRowId` of the table, else by its `id`, else by its
 * place. An edit of a row that it cannot find, such as a child row of a tree,
 * throws, so no edit is dropped without a word.
 *
 * A value is kept by its row id and its column id. When the owner passes new
 * rows, the draft stays over them, and a cell whose new value is the value of
 * the draft no longer differs. A cell of a row that is gone counts no more,
 * and `save` does not give it.
 *
 * With the `formulas` option, the draft holds the formulas too, both layers
 * of `cellFormulas`: a formula of a cell and a formula of a column wait for
 * Save as a value does, and Cancel drops them with the values. A formula is
 * kept by its cell, or by its column, over the formulas of the owner, so a
 * formula that the owner passes meanwhile shows where the draft has none.
 */
export function useEditDraft<Row>(
	source: MaybeRefOrGetter<readonly Row[]>,
	options: EditDraftOptions<Row> = {},
): EditDraft<Row> {
	const entries = shallowRef<ReadonlyMap<string, Entry<Row>>>(new Map())
	const patches = shallowRef<Patches>(NO_PATCHES)
	// The columns of the reports, for an edit of a cell whose formula changed and whose value did not.
	const seen = new Map<string, ColumnDef<Row>>()
	const columnOf = (id: string): ColumnDef<Row> => seen.get(id) ?? { id }
	const ownFormulas = computed(() => toValue(options.formulas) ?? NO_FORMULAS)
	// The patches against the formulas of the owner now: one that the owner holds already differs no more.
	const formulaPatches = computed(() => {
		const value = withPatches(ownFormulas.value, patches.value)
		return value === ownFormulas.value ? NO_PATCHES : patchesOf(ownFormulas.value, value)
	})
	const formulas = computed(() => withPatches(ownFormulas.value, formulaPatches.value))

	const owner = computed(() => {
		const byId = new Map<string, Row>()
		toValue(source).forEach((row, index) => {
			const own = (row as { id?: unknown } | null)?.id
			const id = options.getRowId
				? options.getRowId(row, index, null)
				: typeof own === 'string' || typeof own === 'number'
					? own
					: index
			byId.set(String(id), row)
		})
		return byId
	})

	/** The entries whose row is there and whose value is not the value of the owner. */
	const differing = computed(() => {
		const kept = new Map<string, Entry<Row>>()
		for (const [key, entry] of entries.value) {
			const row = owner.value.get(entry.rowId)
			if (row !== undefined && !same(cellValue(row, entry.column), entry.value)) {
				kept.set(key, entry)
			}
		}
		return kept
	})

	const rows = computed(() => {
		const byRow = new Map<Row, Record<string, unknown>>()
		for (const entry of differing.value.values()) {
			const row = owner.value.get(entry.rowId) as Row
			let change = byRow.get(row)
			if (!change) byRow.set(row, (change = {}))
			change[entry.column.key ?? entry.column.id] = entry.value
		}
		return toValue(source).map((row) => {
			const change = byRow.get(row)
			return change ? { ...row, ...change } : row
		})
	})

	return {
		rows,
		formulas,
		count: computed(() => {
			let count = differing.value.size + formulaPatches.value.columns.size
			for (const key of formulaPatches.value.cells.keys()) if (!differing.value.has(key)) count++
			return count
		}),
		changed: (rowId, columnId) => {
			const key = cellKey(rowId, columnId)
			return differing.value.has(key) || formulaPatches.value.cells.has(key)
		},
		changedColumn: (columnId) => formulaPatches.value.columns.has(columnId),
		onCellFormulasChange: (value) => {
			if (value !== formulas.value) patches.value = patchesOf(ownFormulas.value, value)
		},
		onCellEdit: (edits) => {
			for (const edit of edits) {
				if (!owner.value.has(edit.rowId)) {
					throw new Error(
						`The draft has no row "${edit.rowId}" for the edit of column "${edit.columnId}": it reads the top level of the rows only. Pass the \`getRowId\` of the table to \`useEditDraft\`; the edits of child rows need code of your own.`,
					)
				}
			}
			const next = new Map(entries.value)
			for (const edit of edits) {
				seen.set(edit.columnId, edit.column)
				const key = cellKey(edit.rowId, edit.columnId)
				const row = owner.value.get(edit.rowId)
				// A cell that is set back to the value of the owner leaves the draft.
				if (row !== undefined && same(cellValue(row, edit.column), edit.value)) next.delete(key)
				else next.set(key, { rowId: edit.rowId, column: edit.column, value: edit.value })
			}
			entries.value = next
		},
		save: () => {
			const cells = formulaPatches.value.cells
			const edits = [...differing.value].map(([key, entry]): CellEdit<Row> => {
				const row = owner.value.get(entry.rowId) as Row
				const patch = cells.get(key)
				return {
					rowId: entry.rowId,
					columnId: entry.column.id,
					row,
					column: entry.column,
					value: entry.value,
					previous: cellValue(row, entry.column),
					...(patch ? { formula: patch.formula } : undefined),
				}
			})
			// A cell whose formula differs and whose value does not: its value stays, its formula changes.
			for (const [key, patch] of cells) {
				const row = owner.value.get(patch.rowId)
				const column = columnOf(patch.columnId)
				if (differing.value.has(key) || row === undefined) continue
				const value = cellValue(row, column)
				edits.push({
					rowId: patch.rowId,
					columnId: patch.columnId,
					row,
					column,
					value,
					previous: value,
					formula: patch.formula,
				})
			}
			const saved = Object.assign(edits, {
				formulas: options.formulas === undefined ? undefined : formulas.value,
			})
			entries.value = new Map()
			patches.value = NO_PATCHES
			return saved
		},
		cancel: () => {
			entries.value = new Map()
			patches.value = NO_PATCHES
		},
	}
}
