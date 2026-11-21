import type { ColumnDef } from '../rows'

/** One cell that got a new value. The table does not write it: the caller puts it in the rows. */
export type CellEdit<Row = unknown> = {
	rowId: string
	columnId: string
	/** The caller's own row object, as it is before the edit. */
	row: Row
	column: ColumnDef<Row>
	value: unknown
	previous: unknown
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
 */
export function applyEdits<Row>(rows: readonly Row[], edits: readonly CellEdit<Row>[]): Row[] {
	const changes = new Map<Row, Record<string, unknown>>()
	for (const edit of edits) {
		const change = changes.get(edit.row) ?? {}
		change[edit.column.key ?? edit.column.id] = edit.value
		changes.set(edit.row, change)
	}
	return rows.map((row) => {
		const change = changes.get(row)
		return change ? { ...row, ...change } : row
	})
}
