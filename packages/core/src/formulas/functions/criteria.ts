import { isFormulaError } from '../../formula/errors'
import { isDay } from '../../rows/columns'
import { compare, FormulaRange, isDate, isEmpty } from '../values'

// The criteria of `COUNTIF` and its family, and the matching of `MATCH`,
// `VLOOKUP` and `XLOOKUP`, as Excel defines them. A date of a table is no
// number, so it matches only a date: a day text in a criterion, or a date
// as the value of a lookup.

/** What a cell holds, for a match: only values of the same kind match. */
export type Kind = 'empty' | 'error' | 'number' | 'boolean' | 'date' | 'text'

export function kindOf(value: unknown): Kind {
	if (isEmpty(value)) return 'empty'
	if (typeof value === 'number') return 'number'
	if (typeof value === 'boolean') return 'boolean'
	if (isFormulaError(value)) return 'error'
	if (isDate(value)) return 'date'
	return 'text'
}

// A number as code writes it, as `toNumber` reads a text.
const PLAIN_NUMBER = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i

/**
 * A text with the wildcards of Excel as a test of a whole text: `*` is any
 * characters, `?` one character, and `~` before one of the three is that
 * character. Capital and small letters are the same. `undefined` for a text
 * without a wildcard, which is compared as a value.
 */
export function wildcard(text: string): RegExp | undefined {
	if (!/[*?~]/.test(text)) return undefined
	let source = ''
	for (let index = 0; index < text.length; index++) {
		const char = text[index] ?? ''
		const next = text[index + 1]
		if (char === '~' && (next === '*' || next === '?' || next === '~')) {
			source += `\\${next}`
			index++
		} else if (char === '*') source += '[^]*'
		else if (char === '?') source += '[^]'
		else source += char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
	}
	return new RegExp(`^${source}$`, 'iu')
}

/** Whether a cell matches a text that may hold wildcards: only a text cell does. */
export function textMatches(
	value: unknown,
	text: string,
	pattern: RegExp | undefined,
	time: (date: string | Date) => number,
): boolean {
	if (kindOf(value) !== 'text') return false
	return pattern ? pattern.test(String(value)) : compare(value, text, time) === 0
}

const OPERATORS = ['>=', '<=', '<>', '>', '<', '='] as const
type Operator = (typeof OPERATORS)[number]

function test(op: Operator, order: number): boolean {
	switch (op) {
		case '=':
			return order === 0
		case '<>':
			return order !== 0
		case '>':
			return order > 0
		case '<':
			return order < 0
		case '>=':
			return order >= 0
		default:
			return order <= 0
	}
}

/**
 * A criterion as a test of a cell. A text can start with `=`, `<>`, `<`,
 * `<=`, `>` or `>=`; the rest is a number, `TRUE` or `FALSE`, a day, an
 * error or a text with wildcards. `=` with a number also takes a text of that
 * number. `<>` takes every cell that `=` does not, an empty one too. An empty
 * text takes the empty cells; a reference to an empty cell is 0, as in Excel.
 */
export function criterion(
	given: unknown,
	ref: boolean,
	time: (date: string | Date) => number,
): ((value: unknown) => boolean) | '#VALUE!' {
	if (given instanceof FormulaRange) return '#VALUE!'
	let op: Operator = '='
	let operand: unknown = given
	if (isEmpty(given)) operand = ref || given !== '' ? 0 : ''
	else if (typeof given === 'string' && !isFormulaError(given) && !isDay(given as unknown)) {
		const written: string = given
		const found = OPERATORS.find((each) => written.startsWith(each))
		if (found) op = found
		const text = written.slice(found?.length ?? 0)
		const upper = text.toUpperCase()
		operand =
			text === ''
				? ''
				: PLAIN_NUMBER.test(text)
					? Number(text)
					: upper === 'TRUE' || upper === 'FALSE'
						? upper === 'TRUE'
						: text
	}
	const kind = kindOf(operand)
	let equal: (value: unknown) => boolean
	let order: ((value: unknown) => number) | undefined
	if (kind === 'empty') {
		equal = isEmpty
	} else if (kind === 'number') {
		const number = operand as number
		equal = (value) =>
			typeof value === 'number'
				? compare(value, number, time) === 0
				: typeof value === 'string' &&
					PLAIN_NUMBER.test(value) &&
					compare(Number(value), number, time) === 0
		order = (value) => (typeof value === 'number' ? compare(value, number, time) : Number.NaN)
	} else if (kind === 'text') {
		const text = operand as string
		const pattern = wildcard(text)
		equal = (value) => textMatches(value, text, pattern, time)
		order = (value) => (kindOf(value) === 'text' ? compare(value, text, time) : Number.NaN)
	} else {
		// A boolean, a day, a moment or an error: a cell of the same kind.
		equal = (value) => kindOf(value) === kind && compare(value, operand, time) === 0
		if (kind !== 'error') {
			order = (value) => (kindOf(value) === kind ? compare(value, operand, time) : Number.NaN)
		}
	}
	if (op === '=') return equal
	if (op === '<>') return (value) => !equal(value)
	const rank = order
	// A comparison with an empty text or an error takes no cell.
	if (!rank) return () => false
	return (value) => {
		const found = rank(value)
		return !Number.isNaN(found) && test(op, found)
	}
}
