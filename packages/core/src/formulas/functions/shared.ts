import { isFormulaError, type FormulaError } from '../../formula/errors'
import type { ColumnDef } from '../../rows/types'
import type { ColumnNode } from '../parser'
import { FormulaRange, isDate, isEmpty, toNumber } from '../values'

/**
 * The cells that a formula of a cell reads: by ids, with the values of now.
 * A formula of a column has none, and reads the row object.
 */
export type CellReader = {
	/** The row of the formula. */
	rowId: string
	/** The value of a cell, or `#REF!` for a row or a column that is gone. */
	read(rowId: string, columnId: string): unknown
	/** The cells between two references, both ends in it, or `#REF!`. */
	range(from: ColumnNode, to: ColumnNode): FormulaRange | FormulaError
}

/** What a function reads while a formula runs. */
export type FormulaContext = {
	row: unknown
	cell?: CellReader
	/** The time of a date in the zone that the formula uses: the start of a day, or the moment of a `Date`. */
	time: (date: string | Date) => number
	/** The zone of a date that is no reference to a column: the `timeZone` of the formula, or local time. */
	zone: string | undefined
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

/**
 * Visits each value of the arguments: the cells of a range one by one, as
 * references, and every other argument as it is. A visit that returns a value
 * stops the walk, and that value is the answer.
 */
export function eachArg(
	args: FormulaArgs,
	visit: (value: unknown, ref: boolean) => unknown,
): unknown {
	for (let index = 0; index < args.length; index++) {
		const value = args.value(index)
		if (value instanceof FormulaRange) {
			for (const cell of value.values) {
				const stop = visit(cell, true)
				if (stop !== undefined) return stop
			}
			continue
		}
		const stop = visit(value, !!args.column(index))
		if (stop !== undefined) return stop
	}
	return undefined
}

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
	const stop = eachArg(args, (value, ref) => {
		if (isFormulaError(value)) return value
		if (ref) {
			if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value)
			return
		}
		// An empty value from a function is the empty cell that it read.
		if (isEmpty(value)) return
		if (isDate(value)) return '#VALUE!'
		const number = toNumber(value)
		if (typeof number !== 'number') return number
		numbers.push(number)
	})
	return stop === undefined ? numbers : (stop as FormulaError)
}
