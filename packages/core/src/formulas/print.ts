import type { ColumnDef } from '../rows/types'
import type { ColumnNode, FormulaAddresses, FormulaNode } from './parser'
import { namedColumns, resolveColumn } from './parser'
import type { FormulaSigns } from './tokens'

/** A name in brackets, with `\` before each sign that the brackets give a meaning. */
export const escapeName = (name: string) => name.replace(/[\]@$*\\]/g, '\\$&')

/** How a reference is written. `alone` is false for an end of a range. */
export type RefText = (node: ColumnNode, alone: boolean) => string

/** A reference in brackets: `[price]`, `[$price@$r3]`, `[price@*]`, with `nameOf` for the name of the column. */
export function bracketRef(nameOf: (id: string) => string): RefText {
	return (node) => {
		const row =
			node.row === undefined
				? ''
				: node.row === '*'
					? '@*'
					: `@${node.rowFixed ? '$' : ''}${escapeName(node.row)}`
		return `[${node.fixed ? '$' : ''}${escapeName(nameOf(node.id))}${row}]`
	}
}

/**
 * A reference as an address of the document, such as `B7`, `$B$3` or `B`
 * for a whole column. A column without a letter is written in brackets, and
 * a row that is gone is `#REF!`.
 */
export function addressRef(where: FormulaAddresses, nameOf: (id: string) => string): RefText {
	const brackets = bracketRef(nameOf)
	return (node, alone) => {
		const letter = where.letterOf(node.id)
		if (letter === undefined) return brackets(node, alone)
		const column = `${node.fixed ? '$' : ''}${letter}`
		if (node.row === '*') return alone ? `${column}:${column}` : column
		const number = where.numberOf(node.row ?? where.rowId)
		if (number === undefined) return '#REF!'
		return `${column}${node.rowFixed ? '$' : ''}${number}`
	}
}

/**
 * The text of a tree in the signs of a locale. `ref` writes a reference.
 * The text has one space after each separator and none around an operator.
 */
export function printTree(node: FormulaNode, signs: FormulaSigns, ref: RefText): string {
	const print = (part: FormulaNode): string => {
		switch (part.kind) {
			case 'number':
				return signs.decimal === ',' ? part.raw.replace('.', ',') : part.raw
			case 'text':
				return `"${part.value.replaceAll('"', '""')}"`
			case 'boolean':
				return part.value ? 'TRUE' : 'FALSE'
			case 'error':
				return part.value
			case 'column':
				return ref(part, true)
			case 'range':
				return `${ref(part.from, false)}:${ref(part.to, false)}`
			case 'unary':
				return part.op + print(part.operand)
			case 'percent':
				return `${print(part.operand)}%`
			case 'binary':
				return print(part.left) + part.op + print(part.right)
			case 'call':
				return `${part.name}(${part.args.map(print).join(`${signs.separators[0] ?? ','} `)})`
			case 'group':
				return `(${print(part.inner)})`
		}
	}
	return `=${print(node)}`
}

/**
 * The name of each column that a person reads: its header when that header
 * leads back to the column, else its id. A header that two columns share,
 * or that is the id of another column, does not.
 */
export function headerNames(columns: readonly ColumnDef<never>[]): (id: string) => string {
	const named = namedColumns(columns)
	const names = new Map<string, string>()
	for (const column of named) {
		const header = column.header
		const found = header === undefined ? undefined : resolveColumn(header, named)
		names.set(
			column.id,
			found && 'id' in found && found.id === column.id && header ? header : column.id,
		)
	}
	return (id) => names.get(id) ?? id
}
