import { isFormulaError } from '../../formula/errors'
import { compare, isDate, isEmpty, toTest } from '../values'
import { ANY, type FormulaArgs, type FormulaFunction } from './shared'

/**
 * The tests of `AND` and `OR`, as a spreadsheet reads them: every argument is
 * read, so an error in any of them is the answer. A cell that holds a text or
 * nothing is left out; without any test the answer is `#VALUE!`.
 */
function tests(args: FormulaArgs): boolean[] | string {
	const found: boolean[] = []
	for (let index = 0; index < args.length; index++) {
		const value = args.value(index)
		if (isFormulaError(value)) return value
		if (args.column(index) && (typeof value === 'string' || isEmpty(value))) continue
		const test = toTest(value)
		if (typeof test !== 'boolean') return test
		found.push(test)
	}
	return found.length ? found : '#VALUE!'
}

function is(help: string, test: (value: unknown, args: FormulaArgs) => boolean): FormulaFunction {
	return { min: 1, max: 1, args: 'value', help, call: (args) => test(args.value(0), args) }
}

export const LOGIC_FUNCTIONS: Record<string, FormulaFunction> = {
	IF: {
		min: 2,
		max: 3,
		args: 'test, then, [else]',
		help: 'The second value when the test is true, else the third, or FALSE without one.',
		call: (args) => {
			const test = toTest(args.value(0))
			if (typeof test !== 'boolean') return test
			if (test) return args.value(1)
			return args.length > 2 ? args.value(2) : false
		},
	},
	IFS: {
		min: 2,
		max: ANY,
		even: true,
		args: 'test1, value1, [test2, value2], …',
		help: 'The value of the first test that is true, or #N/A when none is. TRUE as the last test is the default.',
		call: (args) => {
			for (let index = 0; index + 1 < args.length; index += 2) {
				const test = toTest(args.value(index))
				if (typeof test !== 'boolean') return test
				if (test) return args.value(index + 1)
			}
			return '#N/A'
		},
	},
	SWITCH: {
		min: 3,
		max: ANY,
		args: 'value, case1, result1, [case2, result2], …, [default]',
		help: 'The result of the first case that equals the value, else the default, or #N/A without one.',
		call: (args) => {
			const value = args.value(0)
			if (isFormulaError(value)) return value
			let index = 1
			for (; index + 1 < args.length; index += 2) {
				const match = args.value(index)
				if (isFormulaError(match)) return match
				if (compare(value, match, args.context.time) === 0) return args.value(index + 1)
			}
			return index < args.length ? args.value(index) : '#N/A'
		},
	},
	AND: {
		min: 1,
		max: ANY,
		args: 'test1, [test2], …',
		help: 'TRUE when every test is true.',
		call: (args) => {
			const found = tests(args)
			return Array.isArray(found) ? found.every(Boolean) : found
		},
	},
	OR: {
		min: 1,
		max: ANY,
		args: 'test1, [test2], …',
		help: 'TRUE when one of the tests is true.',
		call: (args) => {
			const found = tests(args)
			return Array.isArray(found) ? found.some(Boolean) : found
		},
	},
	NOT: {
		min: 1,
		max: 1,
		args: 'test',
		help: 'TRUE for a test that is false, FALSE for one that is true.',
		call: (args) => {
			const test = toTest(args.value(0))
			return typeof test === 'boolean' ? !test : test
		},
	},
	IFERROR: {
		min: 2,
		max: 2,
		args: 'value, else',
		help: 'The value, or the second value when the first is an error.',
		call: (args) => {
			const value = args.value(0)
			return isFormulaError(value) ? args.value(1) : value
		},
	},
	ISBLANK: is(
		'TRUE for a cell that holds nothing.',
		(value, args) => value === null || value === undefined || (value === '' && !!args.column(0)),
	),
	ISNUMBER: is('TRUE for a number. A date is no number.', (value) => typeof value === 'number'),
	ISTEXT: is(
		'TRUE for a text. A day and an error are no texts.',
		(value) => typeof value === 'string' && !isFormulaError(value) && !isDate(value),
	),
	ISERROR: is('TRUE for an error value.', (value) => isFormulaError(value)),
}
