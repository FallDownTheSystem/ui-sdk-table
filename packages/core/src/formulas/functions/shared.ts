import { isFormulaError, type FormulaError } from '../../formula/errors'
import type { ColumnDef } from '../../rows/types'
import { isDate, isEmpty, toNumber } from '../values'

/** What a function reads while a formula runs. */
export type FormulaContext = {
	row: unknown
	/** The time of a date in the zone that the formula uses: the start of a day, or the moment of a `Date`. */
	time: (date: string | Date) => number
}

/** The arguments of one call. A function reads only the ones it needs. */
export type FormulaArgs = {
	readonly length: number
	value(index: number): unknown
	/** The column of an argument that is a reference to a cell, else `undefined`. */
	column(index: number): ColumnDef | undefined
	readonly context: FormulaContext
}

export type FormulaFunction = {
	/** How many arguments the function takes. `max` 255 means "any number". */
	min: number
	max: number
	/** The arguments come in pairs. */
	even?: boolean
	/** The arguments, as a person reads them: `number, digits`. */
	args: string
	/** One line that says what the function gives. */
	help: string
	call(args: FormulaArgs): unknown
}

export const ANY = 255

export const isError = isFormulaError

/** A number argument, or the error that stops the call. */
export function numberArg(args: FormulaArgs, index: number): number | FormulaError {
	return toNumber(args.value(index))
}

/** A whole number argument, cut toward zero as a spreadsheet cuts a count. */
export function countArg(
	args: FormulaArgs,
	index: number,
	fallback: number,
): number | FormulaError {
	if (index >= args.length) return fallback
	const value = toNumber(args.value(index))
	return typeof value === 'number' ? Math.trunc(value) : value
}

/**
 * The numbers of the arguments of `SUM`, `AVERAGE`, `MIN` and `MAX`, as a
 * spreadsheet reads them. A cell that holds a text, a boolean, a date or
 * nothing is left out. A value written into the formula counts: `TRUE` is 1
 * and `"3"` is 3, and any other text is an error. An error stops the call.
 */
export function numbersOf(args: FormulaArgs): number[] | FormulaError {
	const numbers: number[] = []
	for (let index = 0; index < args.length; index++) {
		const value = args.value(index)
		if (isFormulaError(value)) return value
		if (args.column(index)) {
			if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value)
			continue
		}
		// An empty value from a function is the empty cell that it read.
		if (isEmpty(value)) continue
		if (isDate(value)) return '#VALUE!'
		const number = toNumber(value)
		if (typeof number !== 'number') return number
		numbers.push(number)
	}
	return numbers
}
