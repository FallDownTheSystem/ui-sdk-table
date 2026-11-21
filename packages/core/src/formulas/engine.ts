import type {
	FormulaColumn,
	FormulaEngine,
	FormulaIssue,
	FormulaPlace,
	FormulaSheet,
} from '../formula/types'
import type { ColumnDef } from '../rows/types'
import { columnCircle, withColumnFormulas, type ColumnCompiler } from './columns'
import { compileTree, type FormulaOptions } from './compile'
import { FORMULA_FUNCTIONS } from './functions'
import { formulaShows } from './kinds'
import { parseTree, type FormulaNode } from './parser'
import { headerNames, printTree } from './print'
import { revertFormulas, setFormulas } from './state'
import { formulaSigns, STORED_SIGNS } from './tokens'
import { describeFormulaIssue } from './words'

export type FormulaEngineOptions = FormulaOptions

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

	const engine: FormulaEngine = {
		parse(text, at, sheet) {
			if (!('rowId' in at)) {
				const parsed = parseTree(text, {
					columns: columnsOf(sheet),
					signs: formulaSigns(sheet.locale()),
					self: at.columnId,
				})
				if ('issues' in parsed) return parsed
				return { formula: printTree(parsed.tree, STORED_SIGNS, (id) => id) }
			}
			return { issues: [{ code: 'otherRow', at: 0, name: text } satisfies FormulaIssue] }
		},
		print(formula, _at, sheet) {
			const columns = columnsOf(sheet)
			const parsed = parseTree(formula, { columns, signs: STORED_SIGNS })
			if ('issues' in parsed) return formula
			return printTree(parsed.tree, formulaSigns(sheet.locale()), headerNames(columns))
		},
		column(formula, columnId, columns): FormulaColumn | { issues: FormulaIssue[] } {
			const known = columns as readonly ColumnDef<never>[]
			const parsed = parseTree(formula, { columns: known, signs: STORED_SIGNS, self: columnId })
			if ('issues' in parsed) return parsed
			const run = compileTree(parsed.tree, known, options)
			const shows = formulaShows(formula, known, options.timeZone)
			return { value: keptByRow(run), reads: columnsRead(parsed.tree), shows }
		},
		evaluate() {
			throw new Error('This engine computes the formulas of columns only.')
		},
		follow() {
			return { results: [] }
		},
		reads(_formula: string, _at: FormulaPlace) {
			return undefined
		},
		functions: () => FORMULA_FUNCTIONS,
		withColumns: (columns, layer) => withColumnFormulas(columns, layer, compile),
		columnCircle: (columnId, formula, columns, layer) =>
			columnCircle(columnId, formula, columns, layer, compile),
		setFormulas,
		revertFormulas,
		describe: describeFormulaIssue,
	}
	return engine
}
