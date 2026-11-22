import { cellKey, cellValue, type CellEdit, type ColumnDef } from 'ui-sdk-table-core'
import { computed, shallowRef, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'

export type EditDraftOptions<Row> = {
	/** The `getRowId` of the table, when it has one. Without it, a row is found by its `id`, else by its place. */
	getRowId?: (row: Row, index: number, parent: null) => string | number
}

export type EditDraft<Row> = {
	/** The rows to pass to the table: the rows of the owner with the values of the draft in them. */
	rows: ComputedRef<Row[]>
	/** How many cells hold another value than the rows of the owner. */
	count: ComputedRef<number>
	/** Whether a cell holds another value than the rows of the owner, by the row id and the column id. */
	changed: (rowId: string, columnId: string) => boolean
	/**
	 * Pass it as the `cell-edit` listener of the table. It takes every report:
	 * an edit, a paste, a fill, a clear and an undo. It throws for an edit of a
	 * row that is not in the rows of the owner, such as a child row.
	 */
	onCellEdit: (edits: readonly CellEdit<Row>[]) => void
	/** The edits against the rows of the owner, one for each cell that differs, and an empty draft. */
	save: () => CellEdit<Row>[]
	/** Empties the draft. */
	cancel: () => void
}

type Entry<Row> = { rowId: string; column: ColumnDef<Row>; value: unknown }

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
 * and `save` does not give it. The draft holds values only: the formulas of a
 * table with `formulas` are in its `cellFormulas` state and stay there.
 */
export function useEditDraft<Row>(
	source: MaybeRefOrGetter<readonly Row[]>,
	options: EditDraftOptions<Row> = {},
): EditDraft<Row> {
	const entries = shallowRef<ReadonlyMap<string, Entry<Row>>>(new Map())

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
		count: computed(() => differing.value.size),
		changed: (rowId, columnId) => differing.value.has(cellKey(rowId, columnId)),
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
				const key = cellKey(edit.rowId, edit.columnId)
				const row = owner.value.get(edit.rowId)
				// A cell that is set back to the value of the owner leaves the draft.
				if (row !== undefined && same(cellValue(row, edit.column), edit.value)) next.delete(key)
				else next.set(key, { rowId: edit.rowId, column: edit.column, value: edit.value })
			}
			entries.value = next
		},
		save: () => {
			const edits = [...differing.value.values()].map((entry): CellEdit<Row> => {
				const row = owner.value.get(entry.rowId) as Row
				return {
					rowId: entry.rowId,
					columnId: entry.column.id,
					row,
					column: entry.column,
					value: entry.value,
					previous: cellValue(row, entry.column),
				}
			})
			entries.value = new Map()
			return edits
		},
		cancel: () => {
			entries.value = new Map()
		},
	}
}
