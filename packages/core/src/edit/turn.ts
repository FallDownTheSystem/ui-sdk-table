import type { CellEdit } from './cells'

export type TurnValues = {
	/** Keeps the values of a report that no listener refused, until the turn ends or other rows come. */
	add(edits: readonly CellEdit[]): void
	/** The value of a cell that was reported in this turn, or `undefined` when the rows say it. */
	read(rowId: string, columnId: string): { value: unknown } | undefined
}

/**
 * The values that the table reported in this turn.
 *
 * The table never writes a row. It reports an edit, and the owner passes new
 * rows at its next render. Until then the table has the rows of the last
 * render, and a second report in the same turn (two calls from code, an undo
 * after an undo) would hold the value before the first report as the value
 * of now. So for one turn the table reads a cell that it reported from here.
 *
 * The values are held for one turn only. An owner that did not take an edit
 * shows that in its rows, and the rows are the truth: after the turn, and as
 * soon as other rows come, the table reads them again.
 */
export function createTurnValues(rows: () => unknown): TurnValues {
	type Held = {
		rows: unknown
		reports: (readonly CellEdit[])[]
		/** By row id, then by column id. Built at the first read: most turns have one report and no read. */
		cells?: Map<string, Map<string, unknown>>
		read: number
	}
	let held: Held | undefined

	return {
		add(edits) {
			if (!edits.length) return
			const now = rows()
			if (held && held.rows !== now) held = undefined
			if (held) {
				held.reports.push(edits)
				return
			}
			const mine: Held = { rows: now, reports: [edits], read: 0 }
			held = mine
			queueMicrotask(() => {
				if (held === mine) held = undefined
			})
		},
		read(rowId, columnId) {
			if (!held) return undefined
			if (held.rows !== rows()) {
				held = undefined
				return undefined
			}
			const cells = (held.cells ??= new Map())
			for (; held.read < held.reports.length; held.read++) {
				for (const edit of held.reports[held.read] ?? []) {
					let row = cells.get(edit.rowId)
					if (!row) cells.set(edit.rowId, (row = new Map()))
					row.set(edit.columnId, edit.value)
				}
			}
			const row = cells.get(rowId)
			return row?.has(columnId) ? { value: row.get(columnId) } : undefined
		},
	}
}
