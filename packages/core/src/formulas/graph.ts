import type { FormulaError } from '../formula/errors'
import type {
	CellFormulas,
	FormulaChange,
	FormulaIssue,
	FormulaPlace,
	FormulaResult,
	FormulaSheet,
} from '../formula/types'
import type { ColumnDef } from '../rows/types'
import { documentLetters } from '../sheet/chrome'
import { compileCellTree, type FormulaOptions } from './compile'
import type { CellReader } from './functions'
import { parseTree, type ColumnNode, type FormulaAddresses, type FormulaNode } from './parser'
import { STORED_SIGNS } from './tokens'
import { FormulaRange } from './values'

// The formulas of cells over a sheet: what each one reads, the cells that
// follow from a change, the order to compute them in, and circles. Pure: the
// sheet is a reader of ids and values, and nothing is written.

/** The maps of the addresses of one list of columns and rows. */
export type Addresses = {
	letters: ReadonlyMap<string, string>
	columns: ReadonlyMap<string, string>
	numbers: ReadonlyMap<string, number>
	rowIds: readonly string[]
	/** The ids of the columns with a letter, in the order of their letters. */
	order: readonly string[]
}

/** A range as the rows and the columns that it reads: `from` and `to` are row ids, or `*` for every row. */
type RangeRead = { columns: readonly string[]; from: string; to: string }

/** A stored formula, read once for every cell that holds the same text. */
export type CompiledFormula = {
	run: (cell: CellReader) => unknown
	/** The columns of its own row that it reads. */
	own: readonly string[]
	/** The cells of other rows, by id. */
	cells: readonly FormulaPlace[]
	ranges: readonly RangeRead[]
}

type Compiled = CompiledFormula | { error: FormulaError; issues: FormulaIssue[] }

export function addressesFor(rowIds: readonly string[], columns: readonly ColumnDef[]): Addresses {
	const letters = documentLetters(columns)
	const numbers = new Map<string, number>()
	rowIds.forEach((id, index) => numbers.set(id, index + 1))
	return {
		letters,
		columns: new Map([...letters].map(([id, letter]) => [letter, id])),
		numbers,
		rowIds,
		order: [...letters.keys()],
	}
}

export function whereOf(rowId: string, maps: Addresses): FormulaAddresses {
	return {
		rowId,
		columnOf: (letters) => maps.columns.get(letters),
		letterOf: (id) => maps.letters.get(id),
		rowOf: (number) => maps.rowIds[number - 1],
		numberOf: (id) => maps.numbers.get(id),
		rows: maps.rowIds.length,
	}
}

/** The error that a formula of the owner shows when it cannot be read. */
export function errorOfIssues(issues: readonly FormulaIssue[]): FormulaError {
	switch (issues[0]?.code) {
		case 'unknownColumn':
		case 'sharedHeader':
		case 'unknownCell':
			return '#REF!'
		case 'cycle':
		case 'circle':
			return '#CYCLE!'
		default:
			return '#NAME?'
	}
}

/** What a tree reads, without the row of the formula. */
function readsOf(tree: FormulaNode, maps: Addresses): Omit<CompiledFormula, 'run'> {
	const own = new Set<string>()
	const cells: FormulaPlace[] = []
	const ranges: RangeRead[] = []
	const walk = (node: FormulaNode) => {
		switch (node.kind) {
			case 'column':
				if (node.row === undefined) own.add(node.id)
				else if (node.row === '*') ranges.push({ columns: [node.id], from: '*', to: '*' })
				else cells.push({ rowId: node.row, columnId: node.id })
				return
			case 'range':
				ranges.push({
					columns: between(node.from.id, node.to.id, maps),
					from: node.from.row ?? '*',
					to: node.to.row ?? '*',
				})
				return
			case 'unary':
			case 'percent':
				return walk(node.operand)
			case 'group':
				return walk(node.inner)
			case 'binary':
				walk(node.left)
				return walk(node.right)
			case 'call':
				return node.args.forEach(walk)
			default:
				return
		}
	}
	walk(tree)
	return { own: [...own], cells, ranges }
}

const NO_ROW = ''

/**
 * Reads stored formulas once for each text, against one list of columns and
 * rows. A stored formula holds ids, so one text means the same in every row.
 */
export function createCompiler(options: FormulaOptions) {
	const kept = new WeakMap<Addresses, Map<string, Compiled>>()
	return (formula: string, columns: readonly ColumnDef[], maps: Addresses): Compiled => {
		let byText = kept.get(maps)
		if (!byText) kept.set(maps, (byText = new Map()))
		const found = byText.get(formula)
		if (found) return found
		const known = columns as readonly ColumnDef<never>[]
		const parsed = parseTree(formula, {
			columns: known,
			signs: STORED_SIGNS,
			addresses: whereOf(NO_ROW, maps),
			keepGone: true,
		})
		const made: Compiled =
			'issues' in parsed
				? { error: errorOfIssues(parsed.issues), issues: parsed.issues }
				: { run: compileCellTree(parsed.tree, known, options), ...readsOf(parsed.tree, maps) }
		byText.set(formula, made)
		return made
	}
}

/** A value for each cell, by row id and then column id: no text key is made for a lookup. */
export class CellMap<Value> {
	private readonly rows = new Map<string, Map<string, Value>>()
	get(rowId: string, columnId: string): Value | undefined {
		return this.rows.get(rowId)?.get(columnId)
	}
	has(rowId: string, columnId: string): boolean {
		return this.rows.get(rowId)?.has(columnId) ?? false
	}
	set(rowId: string, columnId: string, value: Value): void {
		let row = this.rows.get(rowId)
		if (!row) this.rows.set(rowId, (row = new Map()))
		row.set(columnId, value)
	}
}

const same = (a: unknown, b: unknown) =>
	Object.is(a, b) || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime())

/** A cell to compute, with the cells that read it. */
type Node = FormulaPlace & {
	/** How many cells to compute that it reads and that are not computed yet. */
	waiting: number
	readers: Node[]
	/** The cell whose readers were looked for last, so one cell is no reader twice. */
	seen?: Node
}

/** The index of the readers of the `cells` layer: who reads a cell of another row, and who reads a range of a column. */
type ReaderIndex = {
	byCell: CellMap<FormulaPlace[]>
	/** By column: the rows that a range covers, as numbers of the document, and who reads it. */
	byColumn: Map<string, { lo: number; hi: number; reader: FormulaPlace }[]>
}

export type FollowOptions = {
	compile: ReturnType<typeof createCompiler>
	maxReads: number
}

/**
 * The formula cells that follow from changed cells, each after the cells
 * that it reads, with their new values. Only a value that differs from the
 * value of now is in the list. A circle that a change brings in is an issue;
 * a circle that the formulas held before shows `#CYCLE!`.
 */
export function createFollow(options: FollowOptions) {
	const indexes = new WeakMap<
		object,
		{ maps: Addresses; columns: readonly ColumnDef[]; index: ReaderIndex }
	>()

	function indexOf(
		cells: NonNullable<CellFormulas['cells']>,
		columns: readonly ColumnDef[],
		maps: Addresses,
	) {
		const found = indexes.get(cells)
		if (found && found.maps === maps && found.columns === columns) return found.index
		const index: ReaderIndex = { byCell: new CellMap(), byColumn: new Map() }
		for (const rowId in cells) {
			const row = cells[rowId]
			for (const columnId in row) {
				const compiled = options.compile(row[columnId] ?? '', columns, maps)
				if ('error' in compiled) continue
				const reader = { rowId, columnId }
				for (const cell of compiled.cells) {
					const list = index.byCell.get(cell.rowId, cell.columnId)
					if (list) list.push(reader)
					else index.byCell.set(cell.rowId, cell.columnId, [reader])
				}
				for (const range of compiled.ranges) {
					const a = range.from === '*' ? 1 : maps.numbers.get(range.from)
					const b = range.to === '*' ? Number.POSITIVE_INFINITY : maps.numbers.get(range.to)
					if (a === undefined || b === undefined) continue
					const span = { lo: Math.min(a, b), hi: Math.max(a, b), reader }
					for (const column of range.columns) {
						const list = index.byColumn.get(column)
						if (list) list.push(span)
						else index.byColumn.set(column, [span])
					}
				}
			}
		}
		indexes.set(cells, { maps, columns, index })
		return index
	}

	return function follow(
		changes: readonly FormulaChange[],
		formulas: CellFormulas,
		sheet: FormulaSheet,
		maps: Addresses,
	): { results: FormulaResult[] } | { issues: FormulaIssue[] } {
		const columns = sheet.columns()
		const cellLayer = formulas.cells ?? {}
		const columnLayer = formulas.columns ?? {}
		const index = indexOf(cellLayer, columns, maps)
		const formulaOf = (rowId: string, columnId: string) => cellLayer[rowId]?.[columnId]

		// The column formulas that read each column, for a change of a cell that a computed column reads.
		const columnReaders = new Map<string, string[]>()
		for (const columnId in columnLayer) {
			const compiled = options.compile(columnLayer[columnId] ?? '', columns, maps)
			if ('error' in compiled) continue
			for (const read of compiled.own) {
				const list = columnReaders.get(read)
				if (list) list.push(columnId)
				else columnReaders.set(read, [columnId])
			}
		}

		// The values of this change, then the values that it computes.
		const values = new CellMap<unknown>()
		const entries: FormulaPlace[] = []
		for (const change of changes) {
			if (typeof change.formula === 'string') entries.push(change)
			else if ('value' in change) values.set(change.rowId, change.columnId, change.value)
		}

		// The cells to compute: the formula cells and the computed cells that follow, each with its readers.
		const nodes = new CellMap<Node>()
		const queue: Node[] = []
		const reach = (from: Node | undefined, rowId: string, columnId: string) => {
			let node = nodes.get(rowId, columnId)
			if (!node) {
				node = { rowId, columnId, waiting: 0, readers: [] }
				nodes.set(rowId, columnId, node)
				queue.push(node)
			}
			if (!from || node.seen === from) return
			node.seen = from
			from.readers.push(node)
			node.waiting++
		}
		const readersOf = (rowId: string, columnId: string, from: Node | undefined) => {
			const row = cellLayer[rowId]
			for (const id in row) {
				const compiled = options.compile(row[id] ?? '', columns, maps)
				if (!('error' in compiled) && compiled.own.includes(columnId)) reach(from, rowId, id)
			}
			const byCell = index.byCell.get(rowId, columnId)
			if (byCell) for (const reader of byCell) reach(from, reader.rowId, reader.columnId)
			const spans = index.byColumn.get(columnId)
			const number = spans && maps.numbers.get(rowId)
			if (spans && number !== undefined) {
				for (const span of spans) {
					if (number >= span.lo && number <= span.hi) {
						reach(from, span.reader.rowId, span.reader.columnId)
					}
				}
			}
			const computed = columnReaders.get(columnId)
			if (computed) for (const id of computed) reach(from, rowId, id)
		}
		for (const entry of entries) reach(undefined, entry.rowId, entry.columnId)
		for (const change of changes) {
			if (typeof change.formula !== 'string') readersOf(change.rowId, change.columnId, undefined)
		}
		for (let at = 0; at < queue.length; at++) {
			const node = queue[at] as Node
			readersOf(node.rowId, node.columnId, node)
		}

		// The order: a cell after the cells that it reads. What is left reads in a circle.
		const order: Node[] = []
		for (const node of queue) if (node.waiting === 0) order.push(node)
		for (let at = 0; at < order.length; at++) {
			for (const next of (order[at] as Node).readers) if (--next.waiting === 0) order.push(next)
		}
		const circled = order.length < queue.length ? queue.filter((node) => node.waiting > 0) : []
		for (const entry of entries) {
			const node = nodes.get(entry.rowId, entry.columnId)
			if (!node || node.waiting === 0) continue
			const path = circlePath(node)
			if (path) {
				const address = (place: FormulaPlace) => {
					const letter = maps.letters.get(place.columnId)
					const number = maps.numbers.get(place.rowId)
					return letter && number ? `${letter}${number}` : place.columnId
				}
				return { issues: [{ code: 'circle', cells: path.map(address) }] }
			}
		}

		// The limit, before any cell is computed: the cells that each formula reads, its ranges whole.
		let reads = 0
		for (const node of order) {
			const formula = formulaOf(node.rowId, node.columnId) ?? columnLayer[node.columnId]
			const compiled = formula === undefined ? undefined : options.compile(formula, columns, maps)
			if (!compiled || 'error' in compiled) continue
			reads += compiled.own.length + compiled.cells.length
			for (const range of compiled.ranges) {
				const a = range.from === '*' ? 1 : maps.numbers.get(range.from)
				const b = range.to === '*' ? maps.rowIds.length : maps.numbers.get(range.to)
				if (a !== undefined && b !== undefined)
					reads += (Math.abs(b - a) + 1) * range.columns.length
			}
			if (reads > options.maxReads) {
				return { issues: [{ code: 'tooLarge', reads, limit: options.maxReads }] }
			}
		}
		const reader = cellReader(sheet, maps, values, () => {})

		const results: FormulaResult[] = []
		const cell = reader('')
		for (const node of order) {
			const own = formulaOf(node.rowId, node.columnId)
			const formula = own ?? columnLayer[node.columnId]
			if (formula === undefined) continue
			const compiled = options.compile(formula, columns, maps)
			cell.rowId = node.rowId
			const value = 'error' in compiled ? compiled.error : compiled.run(cell)
			values.set(node.rowId, node.columnId, value)
			// A computed cell is no report: the column holds its formula.
			if (own === undefined) continue
			const previous = sheet.value(node.rowId, node.columnId)
			if (!same(previous, value))
				results.push({ rowId: node.rowId, columnId: node.columnId, value, previous })
		}
		for (const node of circled) {
			if (formulaOf(node.rowId, node.columnId) === undefined) continue
			const previous = sheet.value(node.rowId, node.columnId)
			if (previous !== '#CYCLE!') {
				results.push({ rowId: node.rowId, columnId: node.columnId, value: '#CYCLE!', previous })
			}
		}
		return { results }
	}
}

/**
 * The reader of the cells of a sheet for a formula at a row: the values of
 * `values` first, then the values of now. `count` hears how many cells each
 * read takes.
 */
export function cellReader(
	sheet: FormulaSheet,
	maps: Addresses,
	values: CellMap<unknown>,
	count: (cells: number) => void,
): (rowId: string) => CellReader & { rowId: string } {
	const valueOf = (rowId: string, columnId: string) =>
		values.has(rowId, columnId) ? values.get(rowId, columnId) : sheet.value(rowId, columnId)
	const read = (rowId: string, columnId: string): unknown => {
		count(1)
		if (!maps.numbers.has(rowId)) return '#REF!'
		return valueOf(rowId, columnId)
	}
	return (rowId) => {
		const cell = {
			rowId,
			read,
			range(from: ColumnNode, to: ColumnNode) {
				// A stored range names its rows by id, or every row with `*`.
				const a = from.row === '*' ? 1 : maps.numbers.get(from.row ?? cell.rowId)
				const b = to.row === '*' ? maps.rowIds.length : maps.numbers.get(to.row ?? cell.rowId)
				if (a === undefined || b === undefined) return '#REF!'
				const lo = Math.min(a, b)
				const hi = Math.max(a, b)
				const ids = between(from.id, to.id, maps)
				count((hi - lo + 1) * ids.length)
				const cells: unknown[] = []
				for (let number = lo; number <= hi; number++) {
					const row = maps.rowIds[number - 1] ?? ''
					for (const id of ids) cells.push(valueOf(row, id))
				}
				return new FormulaRange(cells)
			},
		}
		return cell
	}
}

/** The ids of the columns between two columns, both in it, in the order of their letters. */
export function between(a: string, b: string, maps: Addresses): readonly string[] {
	const from = maps.order.indexOf(a)
	const to = maps.order.indexOf(b)
	if (from < 0 || to < 0) return a === b ? [a] : []
	return maps.order.slice(Math.min(from, to), Math.max(from, to) + 1)
}

/** A path from a cell back to itself through its readers, without recursion. Each cell of the path reads the one after it. */
function circlePath(start: Node): FormulaPlace[] | undefined {
	const back = new Map<Node, Node>()
	const queue = [start]
	for (let at = 0; at < queue.length; at++) {
		const node = queue[at] as Node
		for (const next of node.readers) {
			if (next.waiting === 0) continue
			if (next === start) {
				const path: FormulaPlace[] = [start]
				for (let step: Node | undefined = node; step && step !== start; step = back.get(step)) {
					path.push(step)
				}
				path.push(start)
				return path
			}
			if (back.has(next)) continue
			back.set(next, node)
			queue.push(next)
		}
	}
	return undefined
}
