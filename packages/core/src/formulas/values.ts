import { isFormulaError, type FormulaError } from '../formula/errors'
import { isDay, toText } from '../rows/columns'

// The kinds of values of a formula are the values that a table holds: a
// number, a text, a boolean, an empty cell (`null`, `undefined`, `''`), a day
// (a `YYYY-MM-DD` text), a moment (a `Date`) and an error (its text). A
// formula makes no object of its own. A rule here follows a spreadsheet,
// except where the data of a table is not the data of a spreadsheet: a date
// is no number here.

export const isEmpty = (value: unknown): value is null | undefined | '' =>
	value === null || value === undefined || value === ''

/** Whether a value is a day text or a valid `Date`. */
export const isDate = (value: unknown): value is string | Date =>
	value instanceof Date ? !Number.isNaN(value.getTime()) : isDay(value)

/** Takes off the last binary digits of a result: `0.1 + 0.2` is 0.3, as a spreadsheet shows it. */
export const clean = (value: number) => Number(value.toPrecision(15))

// A number as code writes it. A text in a formula is read in the stored form,
// in every locale, so a result never depends on the locale.
const PLAIN_NUMBER = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i

/** A value as a number for `+ - * / ^` and the functions of numbers. */
export function toNumber(value: unknown): number | FormulaError {
	if (typeof value === 'number') return Number.isFinite(value) ? value : '#NUM!'
	if (isEmpty(value)) return 0
	if (typeof value === 'boolean') return value ? 1 : 0
	if (typeof value === 'string') {
		if (isFormulaError(value)) return value
		return PLAIN_NUMBER.test(value) ? Number(value) : '#VALUE!'
	}
	return '#VALUE!'
}

/** A value as a text for `&` and the functions of texts, or the error that it is. */
export function toFormulaText(value: unknown): string {
	if (isFormulaError(value)) return value
	if (isEmpty(value)) return ''
	if (typeof value === 'number') return Number.isFinite(value) ? String(clean(value)) : '#NUM!'
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
	return toText(value)
}

/** A value as the answer of a test: `TRUE`, a number that is not 0, the text `TRUE` in any case. */
export function toTest(value: unknown): boolean | FormulaError {
	if (typeof value === 'boolean') return value
	if (isEmpty(value)) return false
	if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : '#NUM!'
	if (typeof value === 'string') {
		if (isFormulaError(value)) return value
		const upper = value.toUpperCase()
		if (upper === 'TRUE') return true
		if (upper === 'FALSE') return false
	}
	return '#VALUE!'
}

/**
 * Two numbers in the 15 digits that a spreadsheet keeps, so `0.1+0.2=0.3` is
 * true. Two numbers with the same 15 digits differ by less than 1e-14 of
 * their size, so only numbers that close are rounded, which is rare.
 */
function compareNumbers(a: number, b: number): number {
	const difference = a - b
	if (difference === 0) return 0
	if (Math.abs(difference) > Math.max(Math.abs(a), Math.abs(b)) * 1e-13)
		return Math.sign(difference)
	return Math.sign(clean(a) - clean(b))
}

// One collator for every table: a comparison must not depend on the locale.
// Case is not a difference, an accent is, as in a spreadsheet.
const collator = new Intl.Collator('en', { sensitivity: 'accent' })

// The order of kinds that do not match: numbers, then texts, then booleans.
const rank = (value: unknown) =>
	typeof value === 'number' ? 0 : typeof value === 'boolean' ? 2 : 1

/**
 * Compares two values that are no errors, as `=`, `<` and the cases of
 * `SWITCH` do. An empty cell is 0 beside a number, `FALSE` beside a boolean
 * and no text beside a text. Two dates compare by time; a date beside any
 * other value is its text.
 */
export function compare(a: unknown, b: unknown, time: (date: string | Date) => number): number {
	if (typeof a === 'number' && typeof b === 'number') return compareNumbers(a, b)
	if (isEmpty(a) && isEmpty(b)) return 0
	if (isEmpty(a)) a = typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : ''
	if (isEmpty(b)) b = typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : ''
	if (isDate(a) && isDate(b)) return Math.sign(time(a) - time(b))
	if (a instanceof Date) a = toText(a)
	if (b instanceof Date) b = toText(b)
	const kinds = rank(a) - rank(b)
	if (kinds !== 0) return Math.sign(kinds)
	if (typeof a === 'number' && typeof b === 'number') return compareNumbers(a, b)
	if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
	return Math.sign(collator.compare(toText(a), toText(b)))
}

/** The value of a whole formula: a number without its last binary digits, and no number that is not finite. */
export function resultOf(value: unknown): unknown {
	if (typeof value !== 'number' || Number.isInteger(value)) return value
	return Number.isFinite(value) ? clean(value) : '#NUM!'
}
