import { isFormulaError } from '../../formula/errors'
import { clean, isDate, isEmpty, toNumber } from '../values'
import {
	ANY,
	countArg,
	numberArg,
	numbersOf,
	type FormulaArgs,
	type FormulaFunction,
} from './shared'

// Each function gives what a spreadsheet gives, also at the edges (a half, a
// negative number, a negative step). The expected values of the tests come
// from the function reference of Microsoft Excel.

type Rounding = 'half' | 'up' | 'down'

/** Rounds to a count of digits after the point, or before it with a negative count. A half goes away from zero. */
function round(value: number, digits: number, way: Rounding): number {
	if (digits > 300) return value
	if (digits < -300) return 0
	const factor = 10 ** Math.abs(digits)
	const size = Math.abs(value)
	// 1.005 * 100 is 100.49999999999999 in binary; the spreadsheet sees 100.5.
	const scaled = clean(digits >= 0 ? size * factor : size / factor)
	const whole =
		way === 'half' ? Math.round(scaled) : way === 'up' ? Math.ceil(scaled) : Math.floor(scaled)
	const result = digits >= 0 ? whole / factor : whole * factor
	return value < 0 ? -result : result
}

function rounding(way: Rounding, help: string): FormulaFunction {
	return {
		min: 2,
		max: 2,
		args: 'number, digits',
		help,
		call: (args) => {
			const value = numberArg(args, 0)
			if (typeof value !== 'number') return value
			const digits = countArg(args, 1, 0)
			if (typeof digits !== 'number') return digits
			return round(value, digits, way)
		},
	}
}

function oneNumber(help: string, run: (value: number) => unknown): FormulaFunction {
	return {
		min: 1,
		max: 1,
		args: 'number',
		help,
		call: (args) => {
			const value = numberArg(args, 0)
			return typeof value === 'number' ? run(value) : value
		},
	}
}

function twoNumbers(
	names: string,
	help: string,
	run: (a: number, b: number) => unknown,
): FormulaFunction {
	return {
		min: 2,
		max: 2,
		args: names,
		help,
		call: (args) => {
			const a = numberArg(args, 0)
			if (typeof a !== 'number') return a
			const b = numberArg(args, 1)
			return typeof b === 'number' ? run(a, b) : b
		},
	}
}

function ofNumbers(
	args: string,
	help: string,
	run: (numbers: number[]) => unknown,
): FormulaFunction {
	return {
		min: 1,
		max: ANY,
		args,
		help,
		call: (list: FormulaArgs) => {
			const numbers = numbersOf(list)
			return Array.isArray(numbers) ? run(numbers) : numbers
		},
	}
}

export const MATH_FUNCTIONS: Record<string, FormulaFunction> = {
	SUM: ofNumbers('number1, [number2], …', 'The sum of the numbers.', (numbers) =>
		numbers.reduce((sum, value) => sum + value, 0),
	),
	AVERAGE: ofNumbers('number1, [number2], …', 'The mean of the numbers.', (numbers) =>
		numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : '#DIV/0!',
	),
	MIN: ofNumbers('number1, [number2], …', 'The smallest number, or 0 without numbers.', (numbers) =>
		numbers.length ? Math.min(...numbers) : 0,
	),
	MAX: ofNumbers('number1, [number2], …', 'The largest number, or 0 without numbers.', (numbers) =>
		numbers.length ? Math.max(...numbers) : 0,
	),
	COUNT: {
		min: 1,
		max: ANY,
		args: 'value1, [value2], …',
		help: 'How many of the values are numbers.',
		call: (args) => {
			let count = 0
			for (let index = 0; index < args.length; index++) {
				const value = args.value(index)
				if (typeof value === 'number') count += Number.isFinite(value) ? 1 : 0
				else if (args.column(index) || isFormulaError(value) || isEmpty(value) || isDate(value)) {
					continue
				}
				// A boolean or a text of a number written into the formula counts.
				else if (typeof toNumber(value) === 'number') count++
			}
			return count
		},
	},
	COUNTA: {
		min: 1,
		max: ANY,
		args: 'value1, [value2], …',
		help: 'How many of the values are not empty. An error counts.',
		call: (args) => {
			let count = 0
			for (let index = 0; index < args.length; index++) {
				const value = args.value(index)
				if (!(args.column(index) && isEmpty(value)) && value !== null && value !== undefined) {
					count++
				}
			}
			return count
		},
	},
	ROUND: rounding('half', 'The number rounded to a count of digits; a half goes away from zero.'),
	ROUNDUP: rounding('up', 'The number rounded away from zero to a count of digits.'),
	ROUNDDOWN: rounding('down', 'The number rounded toward zero to a count of digits.'),
	FLOOR: twoNumbers(
		'number, step',
		'The number rounded down to a multiple of the step.',
		(value, step) => {
			if (step === 0) return '#DIV/0!'
			if (value > 0 && step < 0) return '#NUM!'
			// With a negative number and a positive step this goes away from zero,
			// with both negative toward zero, as in a spreadsheet.
			return Math.floor(clean(value / step)) * step
		},
	),
	CEILING: twoNumbers(
		'number, step',
		'The number rounded up to a multiple of the step.',
		(value, step) => {
			if (step === 0) return 0
			if (value > 0 && step < 0) return '#NUM!'
			return Math.ceil(clean(value / step)) * step
		},
	),
	ABS: oneNumber('The number without its sign.', Math.abs),
	INT: oneNumber('The number rounded down to a whole number: INT(-2.5) is -3.', Math.floor),
	MOD: twoNumbers(
		'number, divisor',
		'What is left after a division, with the sign of the divisor.',
		(value, divisor) =>
			divisor === 0 ? '#DIV/0!' : clean(value - divisor * Math.floor(clean(value / divisor))),
	),
}
