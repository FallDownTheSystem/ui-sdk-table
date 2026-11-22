import { isFormulaError, type FormulaError } from '../../formula/errors'
import { compare, isEmpty, toTest, type FormulaRange } from '../values'
import { kindOf, textMatches, wildcard } from './criteria'
import { countArg, rangeArg, type FormulaArgs, type FormulaFunction } from './shared'

// The lookups of Excel. A cell of a table holds one value and the rows are
// the owner's, so a lookup gives one cell: a result of more than one cell,
// which Excel spills into the cells beside it, is `#VALUE!` here. A value
// matches a cell of its own kind only, and texts match without a difference
// of capital and small letters. The approximate modes give what Excel gives
// on sorted data; on data that is not sorted they look at every cell.

/**
 * `exact`: the same value. `wild`: the same value, and a text with
 * wildcards. `below`: the same value, else the largest value under it.
 * `above`: the same value, else the smallest value over it.
 */
type Mode = 'exact' | 'wild' | 'below' | 'above'

/**
 * The place of the value in the cells, or -1. The cells are walked in their
 * order, or from the end with `reverse`. Among equal values the first found
 * wins, or the last with `last`, as the approximate search of Excel gives.
 */
function find(
	cells: readonly unknown[],
	lookup: unknown,
	mode: Mode,
	time: (date: string | Date) => number,
	{ reverse = false, last = false } = {},
): number {
	const kind = kindOf(lookup)
	const text = kind === 'text' && mode === 'wild' ? String(lookup) : undefined
	const pattern = text === undefined ? undefined : wildcard(text)
	let best = -1
	const size = cells.length
	for (let step = 0; step < size; step++) {
		const at = reverse ? size - 1 - step : step
		const cell = cells[at]
		if (text !== undefined) {
			if (textMatches(cell, text, pattern, time)) return at
			continue
		}
		if (kindOf(cell) !== kind) continue
		const order = compare(cell, lookup, time)
		if (mode === 'exact' || mode === 'wild') {
			if (order === 0) return at
			continue
		}
		if (mode === 'below' ? order > 0 : order < 0) continue
		if (best < 0) {
			best = at
			continue
		}
		const than = compare(cell, cells[best], time)
		if ((mode === 'below' ? than > 0 : than < 0) || (than === 0 && last)) best = at
	}
	return best
}

/** The value to look up, or the error that stops the call: an error, and an empty value, which finds nothing. */
function lookupArg(args: FormulaArgs): unknown {
	const value = args.value(0)
	if (isFormulaError(value)) return { stop: value }
	if (isEmpty(value)) return { stop: '#N/A' }
	return value
}

const stopped = (value: unknown): value is { stop: FormulaError } =>
	typeof value === 'object' && value !== null && 'stop' in value

/** The cells of a range of one row or one column, or `undefined` for a range of both. */
const line = (range: FormulaRange) =>
	range.columns === 1 || range.rows === 1 ? range.values : undefined

export const LOOKUP_FUNCTIONS: Record<string, FormulaFunction> = {
	MATCH: {
		min: 2,
		max: 3,
		args: 'value, range, [type]',
		help: 'The place of the value in a range of one row or column, from 1. Type 0: the same value, with wildcards. 1 (the default): the largest value up to it, in a range sorted up. -1: the smallest value from it, in a range sorted down.',
		call: (args) => {
			const lookup = lookupArg(args)
			if (stopped(lookup)) return lookup.stop
			const range = rangeArg(args, 1)
			if (typeof range === 'string') return range
			const type = countArg(args, 2, 1)
			if (typeof type !== 'number') return type
			const cells = line(range)
			if (!cells) return '#N/A'
			const mode: Mode = type === 0 ? 'wild' : type > 0 ? 'below' : 'above'
			const at = find(cells, lookup, mode, args.context.time, { last: true })
			return at < 0 ? '#N/A' : at + 1
		},
	},
	VLOOKUP: {
		min: 3,
		max: 4,
		args: 'value, range, column, [approximate]',
		help: 'The value in a column of the range, from 1, in the row whose first cell holds the value. With approximate TRUE (the default) the first column is sorted up and the largest value up to it is found; FALSE finds the same value, with wildcards.',
		call: (args) => {
			const lookup = lookupArg(args)
			if (stopped(lookup)) return lookup.stop
			const range = rangeArg(args, 1)
			if (typeof range === 'string') return range
			const column = countArg(args, 2, 1)
			if (typeof column !== 'number') return column
			if (column < 1) return '#VALUE!'
			if (column > range.columns) return '#REF!'
			const approximate = args.length > 3 ? toTest(args.value(3)) : true
			if (typeof approximate !== 'boolean') return approximate
			const first: unknown[] = []
			for (let row = 0; row < range.rows; row++) first.push(range.values[row * range.columns])
			const at = approximate
				? find(first, lookup, 'below', args.context.time, { last: true })
				: find(first, lookup, 'wild', args.context.time)
			return at < 0 ? '#N/A' : range.values[at * range.columns + column - 1]
		},
	},
	XLOOKUP: {
		min: 3,
		max: 6,
		args: 'value, range, results, [if not found], [match], [search]',
		help: 'The cell of the results at the place of the value in a range of one row or column. Match 0 (the default): the same value; -1 or the next smaller; 1 or the next larger; 2 with wildcards. Search 1 from the first cell, -1 from the last. The results give one cell.',
		call: (args) => {
			const lookup = lookupArg(args)
			if (stopped(lookup)) return lookup.stop
			const range = rangeArg(args, 1)
			if (typeof range === 'string') return range
			const results = rangeArg(args, 2)
			if (typeof results === 'string') return results
			const match = args.length > 4 ? countArg(args, 4, 0) : 0
			if (typeof match !== 'number') return match
			const search = args.length > 5 ? countArg(args, 5, 1) : 1
			if (typeof search !== 'number') return search
			const modes: Record<number, Mode> = { 0: 'exact', [-1]: 'below', 1: 'above', 2: 'wild' }
			const mode = modes[match]
			if (!mode || ![1, -1, 2, -2].includes(search)) return '#VALUE!'
			const cells = line(range)
			if (!cells) return '#VALUE!'
			// The results run the same way as the range, one cell for each of its cells.
			const down = range.columns === 1
			const fits = down
				? results.rows === range.rows && results.columns === 1
				: results.columns === range.columns && results.rows === 1
			if (!fits) return '#VALUE!'
			const at = find(cells, lookup, mode, args.context.time, { reverse: search === -1 })
			if (at >= 0) return results.values[at]
			return args.length > 3 ? args.value(3) : '#N/A'
		},
	},
	INDEX: {
		min: 2,
		max: 3,
		args: 'range, row, [column]',
		help: 'The cell of the range at a row and a column, from 1. In a range of one row, the second argument is the column. A row or a column 0 gives more than one cell unless the range has only one.',
		call: (args) => {
			const range = rangeArg(args, 0)
			if (typeof range === 'string') return range
			let row = countArg(args, 1, 0)
			if (typeof row !== 'number') return row
			let column = countArg(args, 2, 0)
			if (typeof column !== 'number') return column
			if (args.length === 2 && range.rows === 1 && range.columns > 1) {
				column = row
				row = 1
			}
			if (row < 0 || column < 0) return '#VALUE!'
			if (row > range.rows || column > range.columns) return '#REF!'
			if (row === 0 && range.rows === 1) row = 1
			if (column === 0 && range.columns === 1) column = 1
			// A whole row or column of the range would spill.
			if (row === 0 || column === 0) return '#VALUE!'
			return range.values[(row - 1) * range.columns + column - 1]
		},
	},
}
