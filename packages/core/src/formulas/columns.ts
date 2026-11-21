import type { FormulaError } from '../formula/errors'
import type { CellFormulas, FormulaColumn, FormulaColumns, FormulaIssue } from '../formula/types'
import { leafColumns } from '../rows/columns'
import type { ColumnDef } from '../rows/types'

/** Compiles the formula of one column against the columns that it can read. */
export type ColumnCompiler = (
	formula: string,
	columnId: string,
	columns: readonly ColumnDef[],
) => FormulaColumn | { issues: FormulaIssue[] }

/** The error that a column shows for a formula of the owner that cannot be read. */
function errorOf(issues: readonly FormulaIssue[]): FormulaError {
	switch (issues[0]?.code) {
		case 'unknownColumn':
		case 'sharedHeader':
			return '#REF!'
		case 'cycle':
		case 'circle':
			return '#CYCLE!'
		default:
			return '#NAME?'
	}
}

/**
 * Puts the formulas of the `columns` layer into the columns: a column with a
 * formula gets a `value` from the engine, cannot be edited, and gets the
 * format that the value needs when it has none. A column formula can read
 * another one; they are computed in the order of their reads. Columns whose
 * formulas read each other in a circle show `#CYCLE!`, and a formula that
 * cannot be read shows an error: the owner can pass any text, and the table
 * cannot refuse it.
 *
 * Without formulas of columns the columns of the owner come back as they are,
 * so no stage of the rows runs again.
 */
export function withColumnFormulas(
	columns: readonly ColumnDef[],
	layer: CellFormulas['columns'],
	compile: ColumnCompiler,
): FormulaColumns {
	if (!layer) return { columns, issues: new Map() }
	const leaves = leafColumns(columns)
	const ids = new Set(leaves.map((column) => column.id))
	const formulas = Object.keys(layer).filter((id) => ids.has(id))
	if (!formulas.length) return { columns, issues: new Map() }

	const issues = new Map<string, readonly FormulaIssue[]>()
	const byId = new Map(leaves.map((column) => [column.id, column]))
	// First the reads of each formula, against the columns of the owner.
	const reads = new Map<string, readonly string[]>()
	for (const id of formulas) {
		const read = compile(layer[id] ?? '', id, leaves)
		if ('issues' in read) issues.set(id, read.issues)
		// Only the reads of other formula columns decide the order.
		else
			reads.set(
				id,
				read.reads.filter((name) => name !== id && formulas.includes(name)),
			)
	}
	// The order: a column after the formula columns that it reads. What is
	// left when no column is ready reads in a circle.
	const waiting = new Map<string, number>()
	const readers = new Map<string, string[]>()
	for (const [id, list] of reads) {
		const inputs = list.filter((name) => reads.has(name) || issues.has(name))
		waiting.set(id, inputs.length)
		for (const name of inputs) {
			const found = readers.get(name)
			if (found) found.push(id)
			else readers.set(name, [id])
		}
	}
	const ready = [...issues.keys()]
	for (const [id, count] of waiting) if (count === 0) ready.push(id)
	const order: string[] = []
	for (let index = 0; index < ready.length; index++) {
		const id = ready[index] ?? ''
		if (reads.has(id)) order.push(id)
		for (const reader of readers.get(id) ?? []) {
			const left = (waiting.get(reader) ?? 0) - 1
			waiting.set(reader, left)
			if (left === 0) ready.push(reader)
		}
	}

	const fixed = (column: ColumnDef, error: FormulaError): ColumnDef => ({
		...column,
		editable: false,
		value: () => error,
	})
	for (const [id, found] of issues) {
		const column = byId.get(id)
		if (column) byId.set(id, fixed(column, errorOf(found)))
	}
	for (const id of reads.keys()) {
		if (order.includes(id)) continue
		const column = byId.get(id)
		issues.set(id, [{ code: 'circle', cells: [column?.header ?? id] }])
		if (column) byId.set(id, fixed(column, '#CYCLE!'))
	}
	for (const id of order) {
		const column = byId.get(id)
		if (!column) continue
		const made = compile(layer[id] ?? '', id, [...byId.values()])
		if ('issues' in made) {
			issues.set(id, made.issues)
			byId.set(id, fixed(column, errorOf(made.issues)))
			continue
		}
		byId.set(id, {
			...(column.format === undefined ? made.shows : undefined),
			...column,
			key: undefined,
			editable: false,
			value: made.value,
		})
	}
	const rebuild = (list: readonly ColumnDef[]): ColumnDef[] =>
		list.map((column) =>
			column.columns?.length
				? { ...column, columns: rebuild(column.columns) }
				: (byId.get(column.id) ?? column),
		)
	return { columns: rebuild(columns), issues }
}

/**
 * The issue of a new formula for a column against the other formulas of
 * columns: a circle of columns, with its path in headers. `undefined` when
 * it can be set.
 */
export function columnCircle(
	columnId: string,
	formula: string,
	columns: readonly ColumnDef[],
	layer: CellFormulas['columns'],
	compile: ColumnCompiler,
): FormulaIssue | undefined {
	const formulas = { ...layer, [columnId]: formula }
	const leaves = leafColumns(columns)
	const readsOf = (id: string) => {
		const read = compile(formulas[id] ?? '', id, leaves)
		return 'issues' in read ? [] : read.reads.filter((name) => name in formulas)
	}
	// A walk from the new formula: a path that comes back to its column is a circle.
	const path: string[] = []
	const seen = new Set<string>()
	const walk = (id: string): boolean => {
		if (id === columnId && path.length) return true
		if (seen.has(id)) return false
		seen.add(id)
		path.push(id)
		for (const next of readsOf(id)) if (walk(next)) return true
		path.pop()
		return false
	}
	if (!walk(columnId)) return undefined
	const names = new Map(leaves.map((column) => [column.id, column.header ?? column.id]))
	return { code: 'circle', cells: [...path, columnId].map((id) => names.get(id) ?? id) }
}
