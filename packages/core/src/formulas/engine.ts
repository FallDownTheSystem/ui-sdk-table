import type {
	CellFormulaPatch,
	FormulaColumn,
	FormulaEngine,
	FormulaJoin,
	FormulaIssue,
	FormulaPlace,
	FormulaSheet,
} from '../formula/types'
import type { ColumnDef } from '../rows/types'
import { columnCircle, withColumnFormulas, type ColumnCompiler } from './columns'
import { compileTree, type FormulaOptions } from './compile'
import { FORMULA_FUNCTIONS } from './functions'
import { formulaShows } from './kinds'
import {
	addressesFor,
	CellMap,
	cellReader,
	createCompiler,
	createFollow,
	whereOf,
	type Addresses,
} from './graph'
import { namedColumns, parseTree, type FormulaNode } from './parser'
import { addressRef, bracketRef, headerNames, printTree } from './print'
import { moveFormula } from './move'
import { formulaSummary } from './summary'
import { changedCells, everyFormula } from './recheck'
import { revertFormulas, setFormulas } from './state'
import { formulaSigns, STORED_SIGNS } from './tokens'
import { describeFormulaError, describeFormulaIssue } from './words'
import { referenceMarks, referencesOf } from './writer'

export type FormulaEngineOptions = FormulaOptions & {
	/**
	 * The most cells that one change may read, 5,000,000 by default. A
	 * formula in each row that sums from the first row to its own reads the
	 * square of the rows; past the limit the change is refused with words.
	 */
	maxReads?: number
}

/** The ids of the columns that a tree reads, each once. */
export function columnsRead(tree: FormulaNode): string[] {
	const found = new Set<string>()
	const walk = (node: FormulaNode) => {
		switch (node.kind) {
			case 'column':
				found.add(node.id)
				return
			case 'unary':
			case 'percent':
				return walk(node.operand)
			case 'group':
				return walk(node.inner)
			case 'range':
				walk(node.from)
				return walk(node.to)
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
	return [...found]
}

const ADDRESS = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/

/** A value function that computes each row object once and keeps the value for it. */
export function keptByRow(run: (row: unknown) => unknown): (row: unknown) => unknown {
	const kept = new WeakMap<object, unknown>()
	return (row) => {
		if (typeof row !== 'object' || row === null) return run(row)
		if (kept.has(row)) return kept.get(row)
		const value = run(row)
		kept.set(row, value)
		return value
	}
}

/**
 * The formula engine of a table: pass it as the `formulas` option, once (a
 * new engine at each render is a new state). It reads the formulas of the
 * table, and the table asks it for the value of each formula.
 */
export function createFormulaEngine(options: FormulaEngineOptions = {}): FormulaEngine {
	const columnsOf = (sheet: FormulaSheet) => sheet.columns() as readonly ColumnDef<never>[]
	const compile: ColumnCompiler = (formula, columnId, columns) =>
		engine.column(formula, columnId, columns)

	// The maps are kept for each list of row ids, and made again for other columns.
	const kept = new WeakMap<readonly string[], { defs: readonly ColumnDef[]; maps: Addresses }>()
	function addressesOf(sheet: FormulaSheet): Addresses {
		const rowIds = sheet.rowIds()
		const defs = sheet.columns()
		const found = kept.get(rowIds)
		if (found && found.defs === defs) return found.maps
		const maps = addressesFor(rowIds, defs)
		kept.set(rowIds, { defs, maps })
		return maps
	}
	const where = (place: FormulaPlace, sheet: FormulaSheet) =>
		whereOf(place.rowId, addressesOf(sheet))
	const compileCell = createCompiler(options)
	const follow = createFollow({ compile: compileCell, maxReads: options.maxReads ?? 5_000_000 })

	const engine: FormulaEngine = {
		parse(text, at, sheet) {
			const parsed = parseTree(text, {
				columns: columnsOf(sheet),
				signs: formulaSigns(sheet.locale()),
				self: 'rowId' in at ? undefined : at.columnId,
				addresses: 'rowId' in at ? where(at, sheet) : undefined,
			})
			if ('issues' in parsed) return parsed
			return {
				formula: printTree(
					parsed.tree,
					STORED_SIGNS,
					bracketRef((id) => id),
				),
			}
		},
		print(formula, at, sheet) {
			const columns = columnsOf(sheet)
			const place = 'rowId' in at ? where(at, sheet) : undefined
			const parsed = parseTree(formula, {
				columns,
				signs: STORED_SIGNS,
				addresses: place,
				keepGone: true,
			})
			if ('issues' in parsed) return formula
			const names = headerNames(columns)
			const ref = place ? addressRef(place, names) : bracketRef(names)
			return printTree(parsed.tree, formulaSigns(sheet.locale()), ref)
		},
		column(formula, columnId, columns): FormulaColumn | { issues: FormulaIssue[] } {
			const known = columns as readonly ColumnDef<never>[]
			const parsed = parseTree(formula, { columns: known, signs: STORED_SIGNS, self: columnId })
			if ('issues' in parsed) return parsed
			const run = compileTree(parsed.tree, known, options)
			const shows = formulaShows(formula, known, options.timeZone)
			return { value: keptByRow(run), reads: columnsRead(parsed.tree), shows }
		},
		evaluate(formula, at, sheet) {
			const maps = addressesOf(sheet)
			const compiled = compileCell(formula, sheet.columns(), maps)
			if ('error' in compiled) return compiled.error
			return compiled.run(cellReader(sheet, maps, new CellMap(), () => {})(at.rowId))
		},
		follow: (changes, formulas, sheet) => follow(changes, formulas, sheet, addressesOf(sheet)),
		reads(formula, at, sheet) {
			const maps = addressesOf(sheet)
			const compiled = compileCell(formula, sheet.columns(), maps)
			if ('error' in compiled) return []
			const places: FormulaPlace[] = compiled.own.map((columnId) => ({ rowId: at.rowId, columnId }))
			places.push(...compiled.cells)
			for (const range of compiled.ranges) {
				const a = range.from === '*' ? 1 : maps.numbers.get(range.from)
				const b = range.to === '*' ? maps.rowIds.length : maps.numbers.get(range.to)
				if (a === undefined || b === undefined) continue
				for (let number = Math.min(a, b); number <= Math.max(a, b); number++) {
					const rowId = maps.rowIds[number - 1] ?? ''
					for (const columnId of range.columns) places.push({ rowId, columnId })
				}
			}
			return places
		},
		functions: () => FORMULA_FUNCTIONS,
		summary: (formulas, limit) => formulaSummary(formulas, limit),
		evaluateText(text, at, sheet) {
			if (typeof text !== 'string' || !text.startsWith('=')) {
				throw new Error('A formula is a text that starts with `=`, such as `=B2*C2`.')
			}
			const parsed = engine.parse(text, at, sheet)
			if ('issues' in parsed) {
				throw new Error(parsed.issues.map((issue) => describeFormulaIssue(issue)).join(' '))
			}
			return engine.evaluate(parsed.formula, at, sheet)
		},
		withColumns: (columns, layer) => withColumnFormulas(columns, layer, compile),
		columnCircle: (columnId, formula, columns, layer) =>
			columnCircle(columnId, formula, columns, layer, compile),
		setFormulas,
		revertFormulas,
		move: (formula, from, to, sheet, mode) =>
			moveFormula(formula, from, to, sheet.columns(), addressesOf(sheet), mode),
		describe: describeFormulaIssue,
		errorText: describeFormulaError,
		recalculated: (cells) =>
			cells === 0
				? 'Every formula holds its value.'
				: `${cells} ${cells === 1 ? 'cell' : 'cells'} got the value of ${cells === 1 ? 'its' : 'their'} formula.`,
		entry(text, at, sheet) {
			if (text.startsWith("'=")) return { text: text.slice(1) }
			if (text.length < 2 || text[0] !== '=') return undefined
			return engine.parse(text, at, sheet)
		},
		field(formula, plain, at, sheet) {
			if (formula !== undefined) return engine.print(formula, at, sheet)
			return plain.startsWith('=') ? `'${plain}` : plain
		},
		recheck(rows, formulas, sheet) {
			if (!formulas.cells) return { results: [] }
			const changes = changedCells(rows, sheet.columns(), formulas)
			if (!changes) return { results: [] }
			const entries = changes === 'all' ? everyFormula(formulas) : changes
			return follow(entries, formulas, sheet, addressesOf(sheet), true)
		},
		join(changes, before, sheet) {
			const cells: CellFormulaPatch[] = []
			for (const change of changes) {
				if (change.formula !== undefined) {
					cells.push({ rowId: change.rowId, columnId: change.columnId, formula: change.formula })
				} else if (before.cells?.[change.rowId]?.[change.columnId] !== undefined) {
					// A value over a formula cell: the value stays, and the formula goes.
					cells.push({ rowId: change.rowId, columnId: change.columnId, formula: null })
				}
			}
			const formulas = cells.length ? setFormulas(before, { cells }) : before
			if (!formulas.cells) return { formulas, results: [] }
			const followed = engine.follow(changes, formulas, sheet)
			if ('issues' in followed) return followed
			const results: FormulaJoin['results'] = followed.results
			// A cell that got a formula is in the report, also when its value stays.
			const entered = new CellMap<string>()
			for (const change of changes) {
				if (typeof change.formula === 'string')
					entered.set(change.rowId, change.columnId, change.formula)
			}
			const found = new CellMap<boolean>()
			for (const result of results) {
				const formula = entered.get(result.rowId, result.columnId)
				if (formula === undefined) continue
				result.formula = formula
				found.set(result.rowId, result.columnId, true)
			}
			const same: FormulaJoin['results'] = []
			for (const change of changes) {
				if (typeof change.formula !== 'string' || found.has(change.rowId, change.columnId)) continue
				const value = sheet.value(change.rowId, change.columnId)
				same.push({
					rowId: change.rowId,
					columnId: change.columnId,
					formula: change.formula,
					value,
					previous: value,
				})
			}
			if (same.length) results.unshift(...same)
			return { formulas, results }
		},
		rowNumber: (rowId, sheet) => addressesOf(sheet).numbers.get(rowId),
		rangeAddress(from, to, columns, sheet) {
			const maps = addressesOf(sheet)
			const letters = [from, to].map((place) => maps.letters.get(place.columnId))
			const numbers = [from, to].map((place) => maps.numbers.get(place.rowId))
			const [a, b] = letters
			const [top, bottom] = numbers.toSorted((x = 0, y = 0) => x - y)
			if (!a || !b || (!columns && (top === undefined || bottom === undefined))) return undefined
			// The columns in the order of the document, as the rows are.
			const [left, right] =
				maps.order.indexOf(from.columnId) <= maps.order.indexOf(to.columnId) ? [a, b] : [b, a]
			if (columns) return `${left}:${right}`
			return left === right && top === bottom ? `${left}${top}` : `${left}${top}:${right}${bottom}`
		},
		marks: (references, sheet) => referenceMarks(references, addressesOf(sheet)),
		references: (text, at, sheet) => {
			const maps = addressesOf(sheet)
			return referencesOf(
				text,
				formulaSigns(sheet.locale()),
				whereOf(at.rowId, maps),
				sheet.columns(),
				maps.order,
			)
		},
		address(place, sheet) {
			const maps = addressesOf(sheet)
			const letter = maps.letters.get(place.columnId)
			const number = maps.numbers.get(place.rowId)
			return letter === undefined || number === undefined ? undefined : `${letter}${number}`
		},
		cellAt(address, sheet) {
			const maps = addressesOf(sheet)
			const parts = typeof address === 'string' ? ADDRESS.exec(address.trim().toUpperCase()) : null
			const columnId = parts ? maps.columns.get(parts[2] ?? '') : undefined
			if (!parts || columnId === undefined) {
				const named = namedColumns(columnsOf(sheet)).flatMap((column) => {
					const letter = maps.letters.get(column.id)
					return letter ? [letter] : []
				})
				return {
					issues: [{ code: 'unknownColumn', at: 0, name: String(address), valid: named }],
				}
			}
			const rowId = maps.rowIds[Number(parts[4]) - 1]
			if (rowId === undefined) {
				return {
					issues: [{ code: 'unknownCell', at: 0, name: String(address), rows: maps.rowIds.length }],
				}
			}
			return { rowId, columnId }
		},
	}
	return engine
}
