import type { FormulaError } from '../formula/errors'
import type { FormulaIssue } from '../formula/types'
import { leafColumns } from '../rows/columns'
import type { ColumnDef } from '../rows/types'
import { FUNCTIONS } from './functions'
import { tokenize, type FormulaSigns, type Token } from './tokens'

export const MAX_LENGTH = 8192
export const MAX_DEPTH = 64

type At = { at: number }

/** A formula as a tree. Brackets stay in the tree, so the printer gives the text back. */
export type FormulaNode =
	| ({ kind: 'number'; value: number; raw: string } & At)
	| ({ kind: 'text'; value: string } & At)
	| ({ kind: 'boolean'; value: boolean } & At)
	| ({ kind: 'error'; value: FormulaError } & At)
	/** A cell of the own row, by the id of its column. `fixed` is a `$` before the column. */
	| ({ kind: 'column'; id: string; fixed: boolean } & At)
	| ({ kind: 'unary'; op: '-' | '+'; operand: FormulaNode } & At)
	| ({ kind: 'percent'; operand: FormulaNode } & At)
	| ({ kind: 'binary'; op: string; left: FormulaNode; right: FormulaNode } & At)
	| ({ kind: 'call'; name: string; args: FormulaNode[] } & At)
	| ({ kind: 'group'; inner: FormulaNode } & At)

// The order of a spreadsheet: comparisons, then `&`, then `+ -`, `* /`, `^`.
// A negation binds closer than `^` (`-2^2` is 4), and `^` goes from the left.
export const PRECEDENCE: Readonly<Record<string, number>> = {
	'=': 1,
	'<>': 1,
	'<': 1,
	'<=': 1,
	'>': 1,
	'>=': 1,
	'&': 2,
	'+': 3,
	'-': 3,
	'*': 4,
	'/': 4,
	'^': 5,
}

// An address of a cell, `B7` or `$B$7`, and the letters of a column, `B`.
const ADDRESS = /^\$?[A-Z]{1,3}\$?\d+$/i
const LETTERS = /^\$?[A-Z]{1,3}$/i

export type ParseOptions = {
	columns: readonly ColumnDef<never>[]
	signs: FormulaSigns
	/** The column whose formula this is. A reference to it is a circle. */
	self?: string
}

/** The columns that a formula can name: the columns with cells, without the column of row numbers. */
export function namedColumns(columns: readonly ColumnDef<never>[]): ColumnDef<never>[] {
	return leafColumns(columns).filter((column) => !column.rowHeader)
}

/**
 * Finds the column of a name in brackets: its id, else its header in any
 * case when one column has it, else its id in any case.
 */
export function resolveColumn(
	name: string,
	columns: readonly ColumnDef<never>[],
): { id: string } | { shared: string[] } | undefined {
	if (columns.some((column) => column.id === name)) return { id: name }
	const lower = name.toLowerCase()
	const byHeader = columns.filter((column) => column.header?.toLowerCase() === lower)
	if (byHeader.length > 1) return { shared: byHeader.map((column) => column.id) }
	const found = byHeader[0] ?? columns.find((column) => column.id.toLowerCase() === lower)
	return found ? { id: found.id } : undefined
}

class Stop {
	constructor(readonly issue: FormulaIssue) {}
}

/**
 * Reads the text of a formula, with or without its `=`, in the signs of a
 * locale. A reference in brackets is a column of the own row, by its id or
 * its header. An address, a range and a reference to another row are read and
 * refused: a formula here reads its own row.
 */
export function parseTree(
	text: string,
	options: ParseOptions,
): { tree: FormulaNode } | { issues: FormulaIssue[] } {
	if (text.length > MAX_LENGTH) return { issues: [{ code: 'tooLong', limit: MAX_LENGTH }] }
	const offset = /^\s*=?/.exec(text)?.[0].length ?? 0
	if (text.slice(offset).trim() === '') return { issues: [{ code: 'empty' }] }
	const read = tokenize(text.slice(offset), options.signs, offset)
	if ('issues' in read) return read
	const tokens = read.tokens
	const columns = namedColumns(options.columns)
	let index = 0
	let depth = 0

	const peek = (): Token | undefined => tokens[index]
	const source = (token: Token) => text.slice(token.at, token.end)
	const fail = (issue: FormulaIssue): never => {
		throw new Stop(issue)
	}
	const unexpected = (token: Token | undefined): never =>
		fail(
			token
				? { code: 'syntax', at: token.at, found: source(token) }
				: { code: 'syntax', at: text.length, found: '' },
		)
	const expect = (value: string) => {
		const token = peek()
		if (token?.type !== 'operator' || token.value !== value) unexpected(token)
		index++
	}
	const deeper = (at: number) => {
		if (++depth > MAX_DEPTH) fail({ code: 'tooDeep', at, limit: MAX_DEPTH })
	}

	function reference(token: Token & { type: 'bracket' }): FormulaNode {
		const raw = token.value
		let fixed = false
		let name = ''
		for (let at = 0; at < raw.length; at++) {
			const char = raw[at]
			if (char === '\\') name += raw[++at] ?? ''
			else if (char === '$' && at === 0) fixed = true
			else if (char === '@') fail({ code: 'otherRow', at: token.at, name: source(token) })
			else name += char
		}
		name = name.trim()
		const found = resolveColumn(name, columns)
		if (!found) {
			fail({
				code: 'unknownColumn',
				at: token.at,
				name,
				valid: columns.map((column) => column.header ?? column.id),
			})
		} else if ('shared' in found) {
			fail({ code: 'sharedHeader', at: token.at, name, valid: found.shared })
		} else {
			if (found.id === options.self) fail({ code: 'cycle', at: token.at, name })
			return { kind: 'column', id: found.id, fixed, at: token.at }
		}
		return unexpected(token)
	}

	function call(token: Token): FormulaNode {
		const name = token.value.toString().toUpperCase()
		const fn = FUNCTIONS[name]
		if (!fn) {
			fail({ code: 'unknownFunction', at: token.at, name, valid: Object.keys(FUNCTIONS).sort() })
		}
		deeper(token.at)
		expect('(')
		const args: FormulaNode[] = []
		const close = peek()
		if (!(close?.type === 'operator' && close.value === ')')) {
			for (;;) {
				args.push(expression(0))
				if (peek()?.type !== 'separator') break
				index++
			}
		}
		expect(')')
		depth--
		if (fn && (args.length < fn.min || args.length > fn.max || (fn.even && args.length % 2))) {
			fail({
				code: 'arguments',
				at: token.at,
				name,
				min: fn.min,
				max: fn.max,
				even: fn.even,
				given: args.length,
			})
		}
		return { kind: 'call', name, args, at: token.at }
	}

	function primary(): FormulaNode {
		const token = peek()
		if (!token) return unexpected(token)
		index++
		switch (token.type) {
			case 'number':
				return { kind: 'number', value: token.value, raw: token.raw, at: token.at }
			case 'text':
				return { kind: 'text', value: token.value, at: token.at }
			case 'error':
				return { kind: 'error', value: token.value, at: token.at }
			case 'bracket':
				return reference(token)
			case 'word': {
				const next = peek()
				if (next?.type === 'operator' && next.value === '(') return call(token)
				const upper = token.value.toUpperCase()
				if (upper === 'TRUE' || upper === 'FALSE') {
					return { kind: 'boolean', value: upper === 'TRUE', at: token.at }
				}
				const range = next?.type === 'operator' && next.value === ':'
				if (ADDRESS.test(token.value) || (range && LETTERS.test(token.value))) {
					return fail({ code: 'otherRow', at: token.at, name: token.value })
				}
				return fail({ code: 'unknownName', at: token.at, name: token.value })
			}
			case 'operator':
				if (token.value === '(') {
					deeper(token.at)
					const inner = expression(0)
					expect(')')
					depth--
					return { kind: 'group', inner, at: token.at }
				}
				return unexpected(token)
			default:
				return unexpected(token)
		}
	}

	function unary(): FormulaNode {
		const token = peek()
		if (token?.type === 'operator' && (token.value === '-' || token.value === '+')) {
			index++
			deeper(token.at)
			const operand = unary()
			depth--
			return { kind: 'unary', op: token.value, operand, at: token.at }
		}
		let node = primary()
		for (;;) {
			const next = peek()
			if (next?.type !== 'operator') break
			if (next.value === '%') {
				index++
				node = { kind: 'percent', operand: node, at: next.at }
			} else if (next.value === ':') {
				const end = tokens[index + 1]
				fail({ code: 'otherRow', at: node.at, name: text.slice(node.at, end?.end ?? next.end) })
			} else break
		}
		return node
	}

	function expression(min: number): FormulaNode {
		let left = unary()
		for (;;) {
			const token = peek()
			const level = token?.type === 'operator' ? PRECEDENCE[token.value] : undefined
			if (!token || level === undefined || level < min) break
			index++
			const right = expression(level + 1)
			left = { kind: 'binary', op: String(token.value), left, right, at: token.at }
		}
		return left
	}

	try {
		const tree = expression(0)
		if (index < tokens.length) unexpected(peek())
		return { tree }
	} catch (error) {
		if (error instanceof Stop) return { issues: [error.issue] }
		throw error
	}
}
