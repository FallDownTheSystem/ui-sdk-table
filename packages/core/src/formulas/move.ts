import type { FormulaPlace } from '../formula/types'
import type { ColumnDef } from '../rows/types'
import type { Addresses } from './graph'
import { parseTree, type ColumnNode, type FormulaNode } from './parser'
import { bracketRef, printTree } from './print'
import { STORED_SIGNS } from './tokens'

const GONE: FormulaNode = { kind: 'error', value: '#REF!', at: 0 }

/**
 * A stored formula for another cell, by the rules of a spreadsheet. A copy
 * (and a fill) moves each part without `$` as far as the cell moved, in
 * letters and numbers of the document; past the edge a part is `#REF!`. A
 * cut keeps every cell that the formula read: "this row" becomes the row
 * that the formula came from.
 */
export function moveFormula(
	formula: string,
	from: FormulaPlace,
	to: FormulaPlace,
	columns: readonly ColumnDef[],
	maps: Addresses,
	mode: 'copy' | 'cut',
): string {
	const rows = (maps.numbers.get(to.rowId) ?? 0) - (maps.numbers.get(from.rowId) ?? 0)
	const cols = maps.order.indexOf(to.columnId) - maps.order.indexOf(from.columnId)
	// A fill down of a formula of its own row: nothing in it moves, and 50,000 cells share its text.
	if (mode === 'copy' && !cols && !otherRows(formula)) return formula
	const parsed = parseTree(formula, {
		columns: columns as readonly ColumnDef<never>[],
		signs: STORED_SIGNS,
		addresses: {
			rowId: from.rowId,
			columnOf: (letters) => maps.columns.get(letters),
			letterOf: (id) => maps.letters.get(id),
			rowOf: (number) => maps.rowIds[number - 1],
			numberOf: (id) => maps.numbers.get(id),
			rows: maps.rowIds.length,
		},
		keepGone: true,
	})
	if ('issues' in parsed) return formula

	/** The reference in the new cell, or `undefined` past the edge of the document. */
	const moved = (node: ColumnNode): ColumnNode | undefined => {
		if (mode === 'cut') {
			// The cell that it read: "this row" is the row it came from.
			if (node.row !== undefined || from.rowId === to.rowId) return node
			return { ...node, row: from.rowId }
		}
		let id = node.id
		if (!node.fixed && cols) {
			const place = maps.order.indexOf(node.id)
			const next = place < 0 ? undefined : maps.order[place + cols]
			if (next === undefined) return undefined
			id = next
		}
		let row = node.row
		if (row !== undefined && row !== '*' && !node.rowFixed && rows) {
			const number = maps.numbers.get(row)
			row = number === undefined ? row : maps.rowIds[number - 1 + rows]
			if (row === undefined) return undefined
		}
		// A reference to the row of the new cell is "this row", as the parser reads it.
		if (row === to.rowId && !node.rowFixed) row = undefined
		const next: ColumnNode = { ...node, id }
		if (row === undefined) delete next.row
		else next.row = row
		return next
	}

	const walk = (node: FormulaNode): FormulaNode => {
		switch (node.kind) {
			case 'column':
				return moved(node) ?? GONE
			case 'range': {
				const a = moved(node.from)
				const b = moved(node.to)
				return a && b ? { ...node, from: a, to: b } : GONE
			}
			case 'unary':
			case 'percent':
				return { ...node, operand: walk(node.operand) }
			case 'group':
				return { ...node, inner: walk(node.inner) }
			case 'binary':
				return { ...node, left: walk(node.left), right: walk(node.right) }
			case 'call':
				return { ...node, args: node.args.map(walk) }
			default:
				return node
		}
	}
	return printTree(
		walk(parsed.tree),
		STORED_SIGNS,
		bracketRef((id) => id),
	)
}

/** Whether a stored formula names another row than its own: a part with `@`, which a move along the rows changes. */
function otherRows(formula: string): boolean {
	// `@` inside a text or a name with `\\@` gives a walk, never a wrong text.
	return formula.includes('@')
}
