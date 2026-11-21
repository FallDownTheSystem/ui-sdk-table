import type { ColumnDef } from '../rows/types'
import type { FormulaNode } from './parser'
import { namedColumns, resolveColumn } from './parser'
import type { FormulaSigns } from './tokens'

/** A name in brackets, with `\` before each sign that the brackets give a meaning. */
export const escapeName = (name: string) => name.replace(/[\]@$*\\]/g, '\\$&')

/**
 * The text of a tree in the signs of a locale. `nameOf` gives the name of a
 * column in brackets. The text has one space after each separator and none
 * around an operator.
 */
export function printTree(
	node: FormulaNode,
	signs: FormulaSigns,
	nameOf: (id: string) => string,
): string {
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
				return `[${part.fixed ? '$' : ''}${escapeName(nameOf(part.id))}]`
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
