import type { CellFormulas, FormulaSummaryLine } from '../formula/types'

/**
 * The formulas of a table as a short list, for an agent: the formulas of
 * the columns, then each different text of the cells of a column once,
 * most cells first. 50,000 cells with one formula are one line.
 */
export function formulaSummary(
	formulas: CellFormulas,
	limit: unknown = 100,
): { lines: FormulaSummaryLine[]; more: number } {
	if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 500) {
		throw new Error('`getFormulaSummary` takes a limit that is a whole number from 1 to 500.')
	}
	const lines: FormulaSummaryLine[] = []
	for (const columnId in formulas.columns) {
		const formula = formulas.columns[columnId] ?? ''
		lines.push({ columnId, formula, cells: 0, rowId: null, ofColumn: true })
	}
	const byText = new Map<string, FormulaSummaryLine>()
	const cells = formulas.cells ?? {}
	for (const rowId in cells) {
		const row = cells[rowId]
		if (!row) continue
		for (const columnId in row) {
			const formula = row[columnId] ?? ''
			const key = `${columnId}\u0000${formula}`
			const found = byText.get(key)
			if (found) found.cells++
			else byText.set(key, { columnId, formula, cells: 1, rowId, ofColumn: false })
		}
	}
	lines.push(...[...byText.values()].sort((a, b) => b.cells - a.cells))
	return { lines: lines.slice(0, limit), more: Math.max(0, lines.length - limit) }
}
