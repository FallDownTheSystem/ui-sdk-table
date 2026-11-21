import type { CellFormulaPatch, CellFormulas, ColumnFormulaPatch } from '../formula/types'

type RowFormulas = Readonly<Record<string, string>>

/** The formulas of a table without any. One constant, so a table without formulas holds one object. */
export const NO_FORMULAS: CellFormulas = Object.freeze({})

const isEmpty = (value: object) => {
	for (const _ in value) return false
	return true
}

/** Formulas without a layer that holds nothing, so two values with the same formulas read the same. */
function tidy(formulas: CellFormulas): CellFormulas {
	const next: { -readonly [Key in keyof CellFormulas]: CellFormulas[Key] } = {}
	if (formulas.columns && !isEmpty(formulas.columns)) next.columns = formulas.columns
	if (formulas.cells && !isEmpty(formulas.cells)) next.cells = formulas.cells
	return isEmpty(next) ? NO_FORMULAS : next
}

/** The formula of a cell of its own, or `undefined`. */
export function formulaAt(
	formulas: CellFormulas,
	rowId: string,
	columnId: string,
): string | undefined {
	return formulas.cells?.[rowId]?.[columnId]
}

/**
 * New formulas, with the changes put on. `now` itself comes back when
 * nothing changes. Rows that held the same formulas before and get the same
 * changes share one object after: a formula filled down 50,000 rows holds
 * one record of 50,000 keys and one object for the rows.
 */
export function setFormulas(
	now: CellFormulas,
	changes: { columns?: readonly ColumnFormulaPatch[]; cells?: readonly CellFormulaPatch[] },
): CellFormulas {
	let columns: Record<string, string> | undefined
	for (const { columnId, formula } of changes.columns ?? []) {
		const before = now.columns?.[columnId]
		if ((formula ?? undefined) === before) continue
		columns ??= { ...now.columns }
		if (formula === null) delete columns[columnId]
		else columns[columnId] = formula
	}
	let cells: Record<string, RowFormulas> | undefined
	if (changes.cells?.length) {
		// The changes of each row, in their order, so rows with the same changes can share.
		const byRow = new Map<string, CellFormulaPatch[]>()
		for (const change of changes.cells) {
			const list = byRow.get(change.rowId)
			if (list) list.push(change)
			else byRow.set(change.rowId, [change])
		}
		const shared = new Map<RowFormulas | undefined, Map<string, RowFormulas | undefined>>()
		for (const [rowId, list] of byRow) {
			const before = now.cells?.[rowId]
			const key = list.map((change) => `${change.columnId}\u0000${change.formula}`).join('\u0001')
			let byKey = shared.get(before)
			if (!byKey) shared.set(before, (byKey = new Map()))
			let after: RowFormulas | undefined
			if (byKey.has(key)) after = byKey.get(key)
			else {
				let row: Record<string, string> | undefined
				for (const { columnId, formula } of list) {
					const current = (row ?? before)?.[columnId]
					if ((formula ?? undefined) === current) continue
					row ??= { ...before }
					if (formula === null) delete row[columnId]
					else row[columnId] = formula
				}
				after = row ? (isEmpty(row) ? undefined : row) : before
				byKey.set(key, after)
			}
			if (after === before) continue
			cells ??= { ...now.cells }
			if (after) cells[rowId] = after
			else delete cells[rowId]
		}
	}
	if (!columns && !cells) return now
	return tidy({ columns: columns ?? now.columns, cells: cells ?? now.cells })
}

/**
 * Takes a change of formulas back, or puts it on again: every formula that
 * differs between `from` and `to` gets its value of `to`, in `now`. A
 * formula that the owner gave another cell or another column since stays.
 */
export function revertFormulas(
	now: CellFormulas,
	from: CellFormulas,
	to: CellFormulas,
): CellFormulas {
	if (now === from) return to
	const columns: ColumnFormulaPatch[] = []
	if (from.columns !== to.columns) {
		for (const id of new Set([
			...Object.keys(from.columns ?? {}),
			...Object.keys(to.columns ?? {}),
		])) {
			const wanted = to.columns?.[id]
			if (from.columns?.[id] !== wanted) columns.push({ columnId: id, formula: wanted ?? null })
		}
	}
	const cells: CellFormulaPatch[] = []
	if (from.cells !== to.cells) {
		const visit = (rowId: string) => {
			const before = from.cells?.[rowId]
			const wanted = to.cells?.[rowId]
			if (before === wanted) return
			for (const id of new Set([...Object.keys(before ?? {}), ...Object.keys(wanted ?? {})])) {
				const formula = wanted?.[id]
				if (before?.[id] !== formula) cells.push({ rowId, columnId: id, formula: formula ?? null })
			}
		}
		for (const rowId in from.cells) visit(rowId)
		for (const rowId in to.cells) if (!from.cells || !(rowId in from.cells)) visit(rowId)
	}
	return setFormulas(now, { columns, cells })
}

/**
 * The formulas without those of rows and columns that are gone, for an owner
 * that removes rows. `now` itself comes back when nothing is gone.
 */
export function pruneFormulas(
	now: CellFormulas,
	rowIds: Iterable<string>,
	columnIds: Iterable<string>,
): CellFormulas {
	const rows = new Set(rowIds)
	const columns = new Set(columnIds)
	const changes: { columns: ColumnFormulaPatch[]; cells: CellFormulaPatch[] } = {
		columns: [],
		cells: [],
	}
	for (const id in now.columns) {
		if (!columns.has(id)) changes.columns.push({ columnId: id, formula: null })
	}
	for (const rowId in now.cells) {
		for (const columnId in now.cells[rowId]) {
			if (!rows.has(rowId) || !columns.has(columnId)) {
				changes.cells.push({ rowId, columnId, formula: null })
			}
		}
	}
	return setFormulas(now, changes)
}
