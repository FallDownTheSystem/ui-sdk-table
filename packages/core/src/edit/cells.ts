import type { ColumnDef } from '../rows'
import { ownId } from '../rows/nodes'

/** One cell that got a new value. The table does not write it: the caller puts it in the rows. */
export type CellEdit<Row = unknown> = {
	/** The id of the row of the cell. */
	rowId: string
	/** The id of the column of the cell. */
	columnId: string
	/** The caller's own row object, as it is before the edit. */
	row: Row
	/** The definition of the column. */
	column: ColumnDef<Row>
	/** The new value, after `parse` and the schema of the column. */
	value: unknown
	/** The value of the cell before the edit. */
	previous: unknown
	/**
	 * With formulas: the formula that the cell holds now (a text in the
	 * stored form), or `null` when its formula went. Not set for a value and
	 * for a result that followed from other cells.
	 */
	formula?: string | null
}

/** One text for the row and the column of a cell. The state holds the cell that is edited by this id. */
export function cellKey(rowId: string, columnId: string): string {
	return JSON.stringify([rowId, columnId])
}

/** The row and the column of a cell key, or `undefined` for a text that is not one. */
export function parseCellKey(key: string): { rowId: string; columnId: string } | undefined {
	if (!key.startsWith('[')) return undefined
	try {
		const parsed: unknown = JSON.parse(key)
		if (!Array.isArray(parsed) || parsed.length !== 2) return undefined
		const [rowId, columnId] = parsed as unknown[]
		return typeof rowId === 'string' && typeof columnId === 'string'
			? { rowId, columnId }
			: undefined
	} catch {
		return undefined
	}
}

/**
 * Puts edits into rows, for the columns that read their value from a
 * property. It returns a new array with a new object for each row that
 * changed; the other rows are the same objects. It reads the top level only:
 * the child rows of a tree need code of the caller.
 *
 * An edit is about a row id. Its `row` is the object that the table had at
 * the report, and a caller that got two reports in one turn (two calls from
 * code, an undo after an undo) has replaced that object already at the
 * second. So an edit whose object is not among the rows is put into the row
 * with its id: the `id` of the row, else its place, as the table counts
 * them. Pass the `getRowId` of the table when it has one.
 */
export function applyEdits<Row>(
	rows: readonly Row[],
	edits: readonly CellEdit<Row>[],
	getRowId?: (row: Row, index: number, parent: null) => string | number,
): Row[] {
	type Change = Record<string, unknown>
	const byId = new Map<string, Change>()
	const byRow = new Map<Row, Change>()
	for (const edit of edits) {
		let change = byId.get(edit.rowId)
		if (!change) byId.set(edit.rowId, (change = {}))
		change[edit.column.key ?? edit.column.id] = edit.value
		byRow.set(edit.row, change)
	}
	const applied = new Set<Change>()
	const next = rows.map((row) => {
		const change = byRow.get(row)
		if (!change) return row
		applied.add(change)
		return { ...row, ...change }
	})
	if (applied.size === byId.size) return next
	return next.map((row, index) => {
		const before = rows[index] as Row
		if (row !== before) return row
		const id = getRowId ? String(getRowId(before, index, null)) : (ownId(before) ?? String(index))
		const change = byId.get(id)
		return change && !applied.has(change) ? { ...row, ...change } : row
	})
}
