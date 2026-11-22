import { isFormulaError, type FormulaError } from '../../formula/errors'
import { isEmpty, type FormulaRange } from '../values'
import { criterion } from './criteria'
import { ANY, rangeArg, type FormulaArgs, type FormulaFunction } from './shared'

// The functions over ranges with criteria, as in Excel. The ranges of one
// call must have the same rows and columns, as `COUNTIFS` asks in Excel;
// `SUMIF` and `AVERAGEIF` ask it too, where Excel would stretch a smaller
// range of values. A cell of an error in a range of criteria matches no
// criterion but one that names that error.

/** The ranges and the tests of the pairs from `first` on, or the error that stops the call. */
function conditions(
	args: FormulaArgs,
	first: number,
	shape?: FormulaRange,
): { ranges: FormulaRange[]; tests: ((value: unknown) => boolean)[] } | FormulaError {
	const ranges: FormulaRange[] = []
	const tests: ((value: unknown) => boolean)[] = []
	for (let index = first; index + 1 < args.length; index += 2) {
		const range = rangeArg(args, index)
		if (typeof range === 'string') return range
		const like = shape ?? ranges[0]
		if (like && (like.values.length !== range.values.length || like.columns !== range.columns)) {
			return '#VALUE!'
		}
		const given = args.value(index + 1)
		const test = criterion(given, !!args.column(index + 1), args.context.time)
		if (typeof test === 'string') return test
		ranges.push(range)
		tests.push(test)
	}
	return { ranges, tests }
}

/** The places of the cells that match every criterion. */
function matching(found: { ranges: FormulaRange[]; tests: ((value: unknown) => boolean)[] }) {
	const places: number[] = []
	const size = found.ranges[0]?.values.length ?? 0
	outer: for (let at = 0; at < size; at++) {
		for (let index = 0; index < found.ranges.length; index++) {
			if (!found.tests[index]?.(found.ranges[index]?.values[at])) continue outer
		}
		places.push(at)
	}
	return places
}

/** The numbers of the matching cells: a cell that holds no number is left out, and an error stops the call. */
function numbersAt(values: readonly unknown[], places: readonly number[]): number[] | FormulaError {
	const numbers: number[] = []
	for (const at of places) {
		const value = values[at]
		if (isFormulaError(value)) return value
		if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value)
	}
	return numbers
}

const sum = (numbers: readonly number[]) => numbers.reduce((total, value) => total + value, 0)
const mean = (numbers: readonly number[]) =>
	numbers.length ? sum(numbers) / numbers.length : '#DIV/0!'

/** `SUMIF` and `AVERAGEIF`: a range, a criterion, and the values, else the range itself. */
function ofOne(help: string, run: (numbers: number[]) => unknown): FormulaFunction {
	return {
		min: 2,
		max: 3,
		args: 'range, criterion, [values]',
		help,
		call: (args) => {
			const values = args.length > 2 ? rangeArg(args, 2) : rangeArg(args, 0)
			if (typeof values === 'string') return values
			const found = conditions(args, 0, values)
			if (typeof found === 'string') return found
			const numbers = numbersAt(values.values, matching(found))
			return Array.isArray(numbers) ? run(numbers) : numbers
		},
	}
}

/** `SUMIFS` and `AVERAGEIFS`: the values, then pairs of a range and a criterion. */
function ofMany(help: string, run: (numbers: number[]) => unknown): FormulaFunction {
	return {
		min: 3,
		max: ANY,
		odd: true,
		args: 'values, range1, criterion1, [range2, criterion2], …',
		help,
		call: (args) => {
			const values = rangeArg(args, 0)
			if (typeof values === 'string') return values
			const found = conditions(args, 1, values)
			if (typeof found === 'string') return found
			const numbers = numbersAt(values.values, matching(found))
			return Array.isArray(numbers) ? run(numbers) : numbers
		},
	}
}

export const CONDITION_FUNCTIONS: Record<string, FormulaFunction> = {
	COUNTIF: {
		min: 2,
		max: 2,
		args: 'range, criterion',
		help: 'How many cells of the range match the criterion, such as 5, ">5", "<>done" or "a*".',
		call: (args) => {
			const found = conditions(args, 0)
			return typeof found === 'string' ? found : matching(found).length
		},
	},
	COUNTIFS: {
		min: 2,
		max: ANY,
		even: true,
		args: 'range1, criterion1, [range2, criterion2], …',
		help: 'How many places match every criterion in its range. The ranges have the same size.',
		call: (args) => {
			const found = conditions(args, 0)
			return typeof found === 'string' ? found : matching(found).length
		},
	},
	SUMIF: ofOne(
		'The sum of the numbers of the values (else of the range) where the range matches the criterion.',
		sum,
	),
	SUMIFS: ofMany(
		'The sum of the numbers of the values where every range matches its criterion.',
		sum,
	),
	AVERAGEIF: ofOne(
		'The mean of the numbers of the values (else of the range) where the range matches the criterion.',
		mean,
	),
	AVERAGEIFS: ofMany(
		'The mean of the numbers of the values where every range matches its criterion.',
		mean,
	),
	COUNTBLANK: {
		min: 1,
		max: 1,
		args: 'range',
		help: 'How many cells of the range are empty. A cell with an empty text is empty.',
		call: (args) => {
			const range = rangeArg(args, 0)
			if (typeof range === 'string') return range
			let count = 0
			for (const value of range.values) if (isEmpty(value)) count++
			return count
		},
	},
}
