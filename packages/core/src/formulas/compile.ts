import { isFormulaError } from '../formula/errors'
import type { FormulaIssue } from '../formula/types'
import { cellValue, toTime } from '../rows/columns'
import type { ColumnDef } from '../rows/types'
import { FUNCTIONS, type CellReader, type FormulaArgs, type FormulaContext } from './functions'
import { namedColumns, parseTree, type FormulaNode } from './parser'
import { bracketRef, headerNames, printTree } from './print'
import { formulaSigns, STORED_SIGNS } from './tokens'
import { compare, FormulaRange, resultOf, toFormulaText, toNumber } from './values'
import { describeFormulaIssue } from './words'

// A formula becomes a tree of closures, never code for `eval` or
// `new Function`. It reads a row only through `cellValue` of a column that
// exists, so a text in a formula never names a property of an object.

type Run = (context: FormulaContext) => unknown

export type FormulaOptions = {
	/**
	 * The zone of a date that is no reference to a column with a zone of its
	 * own (`formatOptions.timeZone`), such as a date that a function gives.
	 * Without it, local time: a result that is saved should not depend on the
	 * computer that made it, so pass one when a formula reads a moment.
	 */
	timeZone?: string
}

export type FormulaTextOptions = {
	/**
	 * The locale of the text that a person types and reads: with a decimal
	 * comma, `1,5` is a number and `;` separates the values of a function.
	 * The stored form is the same in every locale. Without it, the stored form.
	 */
	locale?: string
}

function arithmetic(op: string, a: number, b: number): unknown {
	switch (op) {
		case '+':
			return a + b
		case '-':
			return a - b
		case '*':
			return a * b
		case '/':
			return b === 0 ? '#DIV/0!' : a / b
		default: {
			if (a === 0 && b === 0) return '#NUM!'
			const power = a ** b
			return Number.isFinite(power) ? power : '#NUM!'
		}
	}
}

function comparison(op: string, order: number): boolean {
	switch (op) {
		case '=':
			return order === 0
		case '<>':
			return order !== 0
		case '<':
			return order < 0
		case '<=':
			return order <= 0
		case '>':
			return order > 0
		default:
			return order >= 0
	}
}

function compileNode(node: FormulaNode, columns: ReadonlyMap<string, ColumnDef<never>>): Run {
	switch (node.kind) {
		case 'number':
		case 'text':
		case 'boolean':
		case 'error': {
			const value = node.value
			return () => value
		}
		case 'range': {
			const { from, to } = node
			return (context) => context.cell?.range(from, to) ?? '#REF!'
		}
		case 'column': {
			const column = columns.get(node.id)
			if (!column) throw new Error(`No column "${node.id}".`)
			const { id, row } = node
			if (row === '*') return (context) => context.cell?.range(node, node) ?? '#REF!'
			return (context) => {
				const cell = context.cell
				if (cell) return cell.read(row ?? cell.rowId, id)
				return row === undefined ? cellValue(context.row as never, column) : '#REF!'
			}
		}
		case 'group':
			return compileNode(node.inner, columns)
		case 'unary': {
			const operand = compileNode(node.operand, columns)
			if (node.op === '+') return operand
			return (context) => {
				const value = toNumber(operand(context))
				return typeof value === 'number' ? -value : value
			}
		}
		case 'percent': {
			const operand = compileNode(node.operand, columns)
			return (context) => {
				const value = toNumber(operand(context))
				return typeof value === 'number' ? value / 100 : value
			}
		}
		case 'binary': {
			const left = compileNode(node.left, columns)
			const right = compileNode(node.right, columns)
			const op = node.op
			if (op === '&') {
				return (context) => {
					const a = toFormulaText(left(context))
					if (isFormulaError(a)) return a
					const b = toFormulaText(right(context))
					return isFormulaError(b) ? b : a + b
				}
			}
			if (op === '+' || op === '-' || op === '*' || op === '/' || op === '^') {
				return (context) => {
					const a = toNumber(left(context))
					if (typeof a !== 'number') return a
					const b = toNumber(right(context))
					return typeof b === 'number' ? arithmetic(op, a, b) : b
				}
			}
			return (context) => {
				const a = left(context)
				if (isFormulaError(a)) return a
				const b = right(context)
				if (isFormulaError(b)) return b
				if (a instanceof FormulaRange || b instanceof FormulaRange) return '#VALUE!'
				return comparison(op, compare(a, b, context.time))
			}
		}
		case 'call': {
			const fn = FUNCTIONS[node.name]
			if (!fn) throw new Error(`No function "${node.name}".`)
			const parts = node.args.map((arg) => compileNode(arg, columns))
			const refs = node.args.map((arg) => (arg.kind === 'column' ? columns.get(arg.id) : undefined))
			// One arguments object for each call in the formula, so a row allocates
			// nothing. A call never runs inside itself: a column that reads its own
			// formula is refused.
			const args: { -readonly [Key in keyof FormulaArgs]: FormulaArgs[Key] } = {
				length: parts.length,
				value: (index) => parts[index]?.(args.context),
				column: (index) => refs[index] as ColumnDef | undefined,
				context: { row: undefined, time: () => Number.NaN, zone: undefined },
			}
			return (context) => {
				const outer = args.context
				args.context = context
				try {
					return fn.call(args)
				} finally {
					args.context = outer
				}
			}
		}
	}
}

function failWith(text: string, issues: readonly FormulaIssue[], where: string): never {
	const words = issues.map((issue) => describeFormulaIssue(issue)).join(' ')
	throw new Error(`The formula "${text}"${where} cannot be read: ${words}`)
}

/**
 * Reads the text of a formula and gives it in the stored form: the ids of
 * the columns in brackets, `.` as the decimal sign and `,` between the
 * values of a function. Or the issues, as data.
 */
export function parseFormula(
	text: string,
	options: FormulaTextOptions & { columns: readonly ColumnDef<never>[]; self?: string },
): { formula: string } | { issues: FormulaIssue[] } {
	const parsed = parseTree(text, {
		columns: options.columns,
		signs: formulaSigns(options.locale),
		self: options.self,
	})
	if ('issues' in parsed) return parsed
	return {
		formula: printTree(
			parsed.tree,
			STORED_SIGNS,
			bracketRef((id) => id),
		),
	}
}

/**
 * The text of a stored formula as a person reads it, in the signs of the
 * locale: with the headers of the columns (`form: 'header'`, the default),
 * or with their ids.
 */
export function printFormula(
	formula: string,
	options: FormulaTextOptions & { columns: readonly ColumnDef<never>[]; form?: 'header' | 'id' },
): string {
	const parsed = parseTree(formula, { columns: options.columns, signs: STORED_SIGNS })
	if ('issues' in parsed) failWith(formula, parsed.issues, '')
	const names = options.form === 'id' ? (id: string) => id : headerNames(options.columns)
	return printTree(parsed.tree, formulaSigns(options.locale), bracketRef(names))
}

/**
 * Makes a function that computes a formula for one row, with no table and
 * no browser: a server can run the formula of a column with it. The formula
 * is in the stored form, the same in every locale (`parseFormula` reads the
 * text of a person into it), and reads the columns of its own row by id or
 * by header. It throws when the formula cannot be read, with the words of
 * the issue.
 */
export function compileRowFormula<Row>(
	formula: string,
	columns: readonly ColumnDef<Row>[],
	options: FormulaOptions & { self?: string } = {},
): (row: Row) => unknown {
	const known = columns as readonly ColumnDef<never>[]
	const parsed = parseTree(formula, { columns: known, signs: STORED_SIGNS, self: options.self })
	if ('issues' in parsed) {
		failWith(formula, parsed.issues, options.self ? ` of column "${options.self}"` : '')
	}
	return compileTree(parsed.tree, known, options) as (row: Row) => unknown
}

/** A function of a row for a tree that was read already. */
export function compileTree(
	tree: FormulaNode,
	columns: readonly ColumnDef<never>[],
	options: FormulaOptions,
): (row: unknown) => unknown {
	const run = compileContext(tree, columns, options)
	return (row) => run({ row })
}

/** A function of a cell for a tree that was read already: it reads the cells through `cell`. */
export function compileCellTree(
	tree: FormulaNode,
	columns: readonly ColumnDef<never>[],
	options: FormulaOptions,
): (cell: CellReader) => unknown {
	const run = compileContext(tree, columns, options)
	return (cell) => run({ row: undefined, cell })
}

function compileContext(
	tree: FormulaNode,
	columns: readonly ColumnDef<never>[],
	options: FormulaOptions,
): (place: { row: unknown; cell?: CellReader }) => unknown {
	const byId = new Map(namedColumns(columns).map((column) => [column.id, column]))
	const run = compileNode(tree, byId)
	const timeZone = options.timeZone
	const time = (date: string | Date) =>
		date instanceof Date ? date.getTime() : (toTime(date, timeZone) ?? Number.NaN)
	return ({ row, cell }) => resultOf(run({ row, cell, time, zone: timeZone }))
}
