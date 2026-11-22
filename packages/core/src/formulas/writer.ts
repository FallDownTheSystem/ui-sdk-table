import type { FormulaReference, FormulaReferenceMark } from '../formula/types'
import type { ColumnDef } from '../rows/types'
import type { Addresses } from './graph'
import { argumentAt, FORMULA_FUNCTIONS, type FormulaFunctionInfo } from './functions'
import { namedColumns, resolveColumn, type FormulaAddresses } from './parser'
import { formulaSigns, tokenize, type FormulaSigns, type Token } from './tokens'

// The pure helpers of a formula field that a person types into: what is at
// the caret, where a reference goes, and which cells the references of a
// text name. They read a text that is not a whole formula yet.

/** What a token of a formula text is, for a field that colours or completes it. */
export type FormulaTokenKind =
	/** A name before `(`. */
	| 'function'
	/** A word that is no function call, no address and no value yet, such as `SU` while a person types `SUM`. */
	| 'name'
	/** An address such as `B2`, the letters of a column in `B:B`, or a column in brackets such as `[price]`. */
	| 'reference'
	| 'number'
	| 'text'
	| 'boolean'
	| 'error'
	| 'operator'
	| 'separator'

/** A token of a formula text, with its place in the text: from `start` up to `end`, without it. */
export type FormulaToken = {
	kind: FormulaTokenKind
	/** The text of the token as the person typed it. */
	text: string
	start: number
	end: number
}

/** What the caret of a formula field is at. */
export type FormulaHelp = {
	/**
	 * The innermost call that the caret is inside: its name, where its name
	 * starts, the index of the argument at the caret from 0, and the place of
	 * that argument in `info.arguments`. `info` is `undefined` for a name that
	 * is no function, and `argument` past the last argument.
	 */
	call: {
		name: string
		start: number
		index: number
		argument: number | undefined
		info: FormulaFunctionInfo | undefined
	} | null
	/**
	 * The token that ends at the caret or holds it, or `null`. A list of
	 * functions filters by its text when its kind is `name` or `function`,
	 * and a choice replaces it, from `start` to `end`.
	 */
	token: FormulaToken | null
	/**
	 * Whether a reference can go at the caret: the text is a formula, and the
	 * caret follows `=`, `(`, a sign between arguments or an operator.
	 */
	reference: boolean
}

/** Where a person can type the reading options of `formulaHelp`. */
export type FormulaHelpOptions = {
	/** The locale of the field: it decides the decimal sign and the sign between arguments. */
	locale?: string
}

const ADDRESS = /^\$?[A-Z]{1,3}\$?\d+$/i
const LETTERS = /^\$?[A-Z]{1,3}$/i
const BY_NAME = new Map(FORMULA_FUNCTIONS.map((info) => [info.name, info]))

/** The tokens of a text that starts with `=`, read as a person types, or `undefined` for a text that is no formula. */
function tokensOf(text: string, signs: FormulaSigns): Token[] | undefined {
	const offset = /^\s*=/.exec(text)?.[0].length
	if (offset === undefined) return undefined
	const read = tokenize(text.slice(offset), signs, offset, true)
	return 'tokens' in read ? read.tokens : []
}

const isOpen = (token: Token) => 'open' in token && token.open === true

const isOperator = (token: Token | undefined, value: string) =>
	token?.type === 'operator' && token.value === value

function kindOf(tokens: readonly Token[], index: number): FormulaTokenKind {
	const token = tokens[index]
	if (!token) return 'operator'
	switch (token.type) {
		case 'word': {
			const upper = token.value.toUpperCase()
			if (isOperator(tokens[index + 1], '(')) return 'function'
			if (upper === 'TRUE' || upper === 'FALSE') return 'boolean'
			if (ADDRESS.test(token.value)) return 'reference'
			const ranged = isOperator(tokens[index + 1], ':') || isOperator(tokens[index - 1], ':')
			return ranged && LETTERS.test(token.value) ? 'reference' : 'name'
		}
		case 'bracket':
			return 'reference'
		default:
			return token.type
	}
}

/**
 * What the caret of a formula field is at: the call it is inside, the token
 * there, and whether a reference fits. It reads a text that is not a whole
 * formula yet, such as `=SUM(B2;` or `=IF(A1>2, "ope`. `caret` is a place
 * in `text`, from 0.
 */
export function formulaHelp(
	text: string,
	caret: number,
	options: FormulaHelpOptions = {},
): FormulaHelp {
	const tokens = tokensOf(text, formulaSigns(options.locale))
	if (!tokens) return { call: null, token: null, reference: false }
	const at = Math.max(0, Math.min(text.length, caret))
	type Frame = { name?: string; start: number; index: number }
	const frames: Frame[] = []
	let before: Token | undefined
	let here: FormulaToken | null = null
	let inside = false
	tokens.forEach((token, index) => {
		if (token.at < at && at <= token.end) {
			here = {
				kind: kindOf(tokens, index),
				text: text.slice(token.at, token.end),
				start: token.at,
				end: token.end,
			}
		}
		// A text or a bracket without its end holds the caret.
		if (token.at < at && (at < token.end || isOpen(token))) inside = true
		if (token.end > at) return
		before = token
		if (isOperator(token, '(')) {
			const previous = tokens[index - 1]
			frames.push(
				previous?.type === 'word'
					? { name: previous.value.toUpperCase(), start: previous.at, index: 0 }
					: { start: token.at, index: 0 },
			)
		} else if (isOperator(token, ')')) frames.pop()
		else if (token.type === 'separator') {
			const top = frames.at(-1)
			if (top) top.index++
		}
	})
	let call: FormulaHelp['call'] = null
	for (let index = frames.length - 1; index >= 0; index--) {
		const frame = frames[index]
		if (frame?.name === undefined) continue
		const info = BY_NAME.get(frame.name)
		call = {
			name: frame.name,
			start: frame.start,
			index: frame.index,
			argument: info && argumentAt(info, frame.index),
			info,
		}
		break
	}
	const last = before as Token | undefined
	const reference =
		!inside &&
		(!last ||
			last.type === 'separator' ||
			(last.type === 'operator' && last.value !== ')' && last.value !== '%'))
	return { call, token: here, reference }
}

/**
 * Puts the text of an address, such as `B2:C5`, into a formula text in
 * place of the selection from `start` to `end` (the same place for a
 * caret). Gives the new text and the place of the reference in it; the
 * caret goes to its `end`. During a drag, pass the place of the last step
 * as the selection of the next one, so each step replaces the reference of
 * the step before.
 */
export function insertReference(
	text: string,
	selection: { start: number; end: number },
	address: string,
): { text: string; start: number; end: number } {
	const clamp = (place: number) => Math.max(0, Math.min(text.length, place))
	const start = clamp(Math.min(selection.start, selection.end))
	const end = clamp(Math.max(selection.start, selection.end))
	return {
		text: text.slice(0, start) + address + text.slice(end),
		start,
		end: start + address.length,
	}
}

/** An end of a reference: a cell, or a whole column with the row `*`. */
type End = { columnId: string; rowId: string; start: number; end: number }

/**
 * The references of a formula text at a cell, as a person types it, with the
 * cells they name. A reference to a column or a row that the document does
 * not hold is left out.
 */
export function referencesOf(
	text: string,
	signs: FormulaSigns,
	where: FormulaAddresses,
	columns: readonly ColumnDef[],
	order: readonly string[],
): FormulaReference[] {
	const tokens = tokensOf(text, signs) ?? []
	const named = namedColumns(columns as readonly ColumnDef<never>[])
	const first = where.rowOf(1)
	const lastRow = where.rowOf(where.rows)

	function endOf(token: Token | undefined, whole: boolean): End | undefined {
		if (token?.type === 'bracket' && !isOpen(token)) {
			const parts = /^\$?((?:\\.|[^@\\])*)(?:@\$?((?:\\.|[^\\])*))?$/.exec(token.value)
			const name = (parts?.[1] ?? '').replace(/\\(.)/g, '$1').trim()
			const found = resolveColumn(name, named)
			const row = parts?.[2]?.replace(/\\(.)/g, '$1') ?? where.rowId
			if (!found || 'shared' in found) return undefined
			if (row !== '*' && where.numberOf(row) === undefined) return undefined
			return { columnId: found.id, rowId: row, start: token.at, end: token.end }
		}
		if (token?.type !== 'word') return undefined
		const parts = /^\$?([A-Z]{1,3})(?:\$?(\d+))?$/i.exec(token.value)
		const columnId = parts?.[1] && where.columnOf(parts[1].toUpperCase())
		if (!parts || !columnId || whole !== (parts[2] === undefined)) return undefined
		const rowId = whole ? '*' : where.rowOf(Number(parts[2]))
		return rowId === undefined ? undefined : { columnId, rowId, start: token.at, end: token.end }
	}

	const found: FormulaReference[] = []
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index]
		// A word before `(` is a function, even when it looks like an address, such as `LOG10(`.
		if (token?.type === 'word' && isOperator(tokens[index + 1], '(')) continue
		const ranged = isOperator(tokens[index + 1], ':')
		const whole = token?.type === 'word' && ranged && LETTERS.test(token.value)
		const from = endOf(token, whole)
		if (!from) continue
		let to = from
		if (ranged) {
			const other = endOf(tokens[index + 2], whole)
			if (other && (other.rowId === '*') === (from.rowId === '*')) {
				to = other
				index += 2
			}
		}
		const columnsWhole = from.rowId === '*'
		// The first and the last cell: the rows and the columns in the order of the document.
		const rowOf = (end: End, top: boolean) =>
			end.rowId === '*' ? (top ? first : lastRow) : end.rowId
		const [a, b] = [rowOf(from, true), rowOf(to, false)]
		if (a === undefined || b === undefined) continue
		const [top, bottom] = (where.numberOf(a) ?? 0) <= (where.numberOf(b) ?? 0) ? [a, b] : [b, a]
		const [left, right] =
			order.indexOf(from.columnId) <= order.indexOf(to.columnId)
				? [from.columnId, to.columnId]
				: [to.columnId, from.columnId]
		found.push({
			start: from.start,
			end: to.end,
			text: text.slice(from.start, to.end),
			from: { rowId: top, columnId: left },
			to: { rowId: bottom, columnId: right },
			columns: columnsWhole,
		})
	}
	return found
}

/**
 * Which reference holds a cell, and at which edges of its block. The blocks
 * are places in the document, read once from the maps of the engine, so a
 * question costs two map reads and a look at each reference: a reference of
 * whole columns over 50,000 rows makes no list of its cells.
 */
export function referenceMarks(
	references: readonly FormulaReference[],
	maps: Addresses,
): (rowId: string, columnId: string) => FormulaReferenceMark | undefined {
	const cols = new Map(maps.order.map((id, index) => [id, index]))
	const blocks = references.map((ref) => ({
		top: maps.numbers.get(ref.from.rowId) ?? 0,
		bottom: maps.numbers.get(ref.to.rowId) ?? -1,
		left: cols.get(ref.from.columnId) ?? 0,
		right: cols.get(ref.to.columnId) ?? -1,
	}))
	return (rowId, columnId) => {
		const row = maps.numbers.get(rowId)
		const col = cols.get(columnId)
		if (row === undefined || col === undefined) return undefined
		const index = blocks.findIndex(
			(block) => row >= block.top && row <= block.bottom && col >= block.left && col <= block.right,
		)
		const block = blocks[index]
		if (!block) return undefined
		const edges = [
			row === block.top ? 'top' : '',
			row === block.bottom ? 'bottom' : '',
			col === block.left ? 'left' : '',
			col === block.right ? 'right' : '',
		]
		return { index, edges: edges.filter(Boolean).join(' ') }
	}
}
