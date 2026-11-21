import type { CellFormulas, FormulaChange, FormulaRows } from '../formula/types'
import { cellValue, leafColumns } from '../rows/columns'
import type { ColumnDef } from '../rows/types'
import { CellMap } from './graph'

const same = (a: unknown, b: unknown) =>
	Object.is(a, b) || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime())

/**
 * The cells to check after the owner gave new rows: each cell whose value
 * is not the one that the table reported, as a change, and a formula cell
 * as an entry, so its formula runs again. `all` when rows came or went: the
 * numbers of the rows moved, so a range can hold other rows. `undefined`
 * when the rows hold what the table reported and nothing else.
 */
export function changedCells(
	rows: FormulaRows,
	columns: readonly ColumnDef[],
	formulas: CellFormulas,
): FormulaChange[] | 'all' | undefined {
	const { before, after } = rows
	if (!before || before.size !== after.size) return 'all'
	const told = new CellMap<unknown>()
	for (const report of rows.told)
		for (const edit of report) told.set(edit.rowId, edit.columnId, edit.value)
	const leaves = leafColumns(columns)
	const changes: FormulaChange[] = []
	for (const [rowId, node] of after) {
		const old = before.get(rowId)
		if (!old) return 'all'
		if (old.row === node.row) continue
		for (const column of leaves) {
			const value = cellValue(node.row, column)
			if (same(value, cellValue(old.row, column))) continue
			if (told.has(rowId, column.id) && same(told.get(rowId, column.id), value)) continue
			const formula = formulas.cells?.[rowId]?.[column.id]
			changes.push(
				formula === undefined
					? { rowId, columnId: column.id }
					: { rowId, columnId: column.id, formula },
			)
		}
	}
	return changes.length ? changes : undefined
}

/** Every formula of a cell as an entry, for a check of the whole table. */
export function everyFormula(formulas: CellFormulas): FormulaChange[] {
	const entries: FormulaChange[] = []
	const cells = formulas.cells ?? {}
	for (const rowId in cells) {
		const row = cells[rowId]
		for (const columnId in row) entries.push({ rowId, columnId, formula: row[columnId] ?? '' })
	}
	return entries
}
