import type { XlsxFormulas } from '../export/xlsx'
import type { ColumnDef } from '../rows/types'
import { columnLetter } from '../sheet/chrome'
import { addressesFor, whereOf } from './graph'
import { parseTree, type ColumnNode, type FormulaNode } from './parser'
import { STORED_SIGNS } from './tokens'

/**
 * The functions that mean in Excel what they mean here, with the same
 * arguments, results and edges. A formula with any other function goes into
 * a file as its result: the periods, the parts of a date and the date math
 * read a zone or a day text that Excel does not have, and `FLOOR` and
 * `CEILING` differ between versions of Excel.
 */
export const EXCEL_FUNCTIONS: ReadonlySet<string> = new Set([
	'SUM',
	'AVERAGE',
	'MIN',
	'MAX',
	'COUNT',
	'COUNTA',
	'ROUND',
	'ROUNDUP',
	'ROUNDDOWN',
	'ABS',
	'INT',
	'MOD',
	'IF',
	'IFS',
	'SWITCH',
	'AND',
	'OR',
	'NOT',
	'IFERROR',
	'ISBLANK',
	'ISNUMBER',
	'ISTEXT',
	'ISERROR',
	'CONCAT',
	'LEN',
	'LEFT',
	'RIGHT',
	'MID',
	'UPPER',
	'LOWER',
	'TRIM',
])

// Excel knows every error code of the engine but this one.
const NOT_IN_EXCEL = '#CYCLE!'

class Result {}

/**
 * The formulas of a table as formulas of an Excel file, for the `formula`
 * option of `toXlsx`. A formula goes into the file only when all of it means
 * the same there: every cell that it reads is in the file and holds there
 * the value that it holds in the table, a range is one column whose rows are
 * in the file in the order of the document and next to each other, and
 * every function is one of `EXCEL_FUNCTIONS`. Else the cell holds its
 * result. The addresses are places in the file, so a sorted or filtered
 * file still gets the formulas that read their own row.
 */
export function excelFormulas(): XlsxFormulas {
	return (data, exact) => {
		const columns = data.columns.map((item) => item.column as ColumnDef)
		const columnIndex = new Map(data.columns.map((item, index) => [item.id, index]))
		const fileRow = new Map<string, number>()
		data.rows.forEach((row, index) => {
			if (row.kind === 'row' && row.id !== undefined) fileRow.set(row.id, index)
		})
		const document = data.document ?? []
		const maps = addressesFor(document, columns)
		const kept = new Map<string, FormulaNode | null>()

		const treeOf = (formula: string, rowId: string): FormulaNode | null => {
			// A formula of its own row reads the same in every row, so it is read once.
			const key = formula.includes('@') ? `${rowId}\u0000${formula}` : formula
			let tree = kept.get(key)
			if (tree === undefined) {
				const parsed = parseTree(formula, {
					columns: columns as readonly ColumnDef<never>[],
					signs: STORED_SIGNS,
					addresses: whereOf(rowId, maps),
					keepGone: true,
				})
				tree = 'tree' in parsed ? parsed.tree : null
				kept.set(key, tree)
			}
			return tree
		}

		return (rowIndex, index) => {
			const row = data.rows[rowIndex]
			const formula = row?.cells[index]?.formula
			const rowId = row?.id
			if (!row || row.kind !== 'row' || formula === undefined || rowId === undefined) {
				return undefined
			}
			const tree = treeOf(formula, rowId)
			if (!tree) return undefined
			const fail = (): never => {
				throw new Result()
			}
			const cellRef = (node: ColumnNode, at: number): string => {
				const column = columnIndex.get(node.id) ?? fail()
				if (!exact(at, column)) fail()
				return `${node.fixed ? '$' : ''}${columnLetter(column)}${node.rowFixed ? '$' : ''}${at + 2}`
			}
			const rowOf = (node: ColumnNode): number =>
				node.row === undefined ? rowIndex : (fileRow.get(node.row) ?? fail())
			const range = (from: ColumnNode, to: ColumnNode): string => {
				if (from.id !== to.id) fail()
				let first: number
				let last: number
				if (from.row === '*' || to.row === '*') {
					if (from.row !== to.row || document.length === 0) fail()
					first = 0
					last = document.length - 1
				} else {
					const a = maps.numbers.get(from.row ?? rowId) ?? fail()
					const b = maps.numbers.get(to.row ?? rowId) ?? fail()
					first = Math.min(a, b) - 1
					last = Math.max(a, b) - 1
				}
				// The rows of the range are next to each other in the file, in the order of the document.
				const top = fileRow.get(document[first] ?? '') ?? fail()
				for (let at = first; at <= last; at++) {
					const place = fileRow.get(document[at] ?? '') ?? fail()
					if (place !== top + at - first) fail()
					cellRef(from, place)
				}
				const ends = (node: ColumnNode, at: number) =>
					node.row === '*' ? cellRef({ ...node, row: undefined }, at) : cellRef(node, at)
				return `${ends(from, top)}:${ends(to, top + last - first)}`
			}
			const print = (node: FormulaNode): string => {
				switch (node.kind) {
					case 'number':
						return node.raw
					case 'text':
						return `"${node.value.replaceAll('"', '""')}"`
					case 'boolean':
						return node.value ? 'TRUE' : 'FALSE'
					case 'error':
						return node.value === NOT_IN_EXCEL ? fail() : node.value
					case 'column':
						return node.row === '*' ? range(node, node) : cellRef(node, rowOf(node))
					case 'range':
						return range(node.from, node.to)
					case 'unary':
						return node.op + print(node.operand)
					case 'percent':
						return `${print(node.operand)}%`
					case 'binary':
						return print(node.left) + node.op + print(node.right)
					case 'call':
						if (!EXCEL_FUNCTIONS.has(node.name)) fail()
						return `${node.name}(${node.args.map(print).join(',')})`
					case 'group':
						return `(${print(node.inner)})`
				}
			}
			try {
				return print(tree)
			} catch (stop) {
				if (stop instanceof Result) return undefined
				throw stop
			}
		}
	}
}
