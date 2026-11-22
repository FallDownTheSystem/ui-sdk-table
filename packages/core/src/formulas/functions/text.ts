import { isFormulaError } from '../../formula/errors'
import { FormulaRange, isEmpty, toFormulaText, toNumber, toTest } from '../values'
import { wildcard } from './criteria'
import { formatText } from './format'
import { ANY, countArg, eachArg, type FormulaArgs, type FormulaFunction } from './shared'

// A text is counted in UTF-16 code units, as a spreadsheet counts it.

function oneText(help: string, run: (text: string) => unknown): FormulaFunction {
	return {
		min: 1,
		max: 1,
		args: 'text',
		help,
		call: (args) => {
			const text = toFormulaText(args.value(0))
			return isFormulaError(text) ? text : run(text)
		},
	}
}

/** The text of the first argument and a count of characters; a negative count is `#VALUE!`. */
function cut(args: FormulaArgs, run: (text: string, count: number) => string): string {
	const text = toFormulaText(args.value(0))
	if (isFormulaError(text)) return text
	const count = countArg(args, 1, 1)
	if (typeof count !== 'number') return count
	return count < 0 ? '#VALUE!' : run(text, count)
}

/** The longest text that Excel keeps in a cell. */
const MAX_TEXT = 32767

/**
 * The place of a text in another, from 1, at or after a start, or `#VALUE!`.
 * `FIND` tells capital and small letters apart and has no wildcards;
 * `SEARCH` does not tell them apart and has the wildcards of Excel.
 */
function place(args: FormulaArgs, search: boolean): number | string {
	const wanted = toFormulaText(args.value(0))
	if (isFormulaError(wanted)) return wanted
	const within = toFormulaText(args.value(1))
	if (isFormulaError(within)) return within
	const start = countArg(args, 2, 1)
	if (typeof start !== 'number') return start
	if (start < 1 || start > within.length) return '#VALUE!'
	if (wanted === '') return start
	if (!search) {
		const at = within.indexOf(wanted, start - 1)
		return at < 0 ? '#VALUE!' : at + 1
	}
	// A pattern of a whole text, made to find its first place inside a text.
	const pattern = wildcard(wanted)
	const source = pattern
		? pattern.source.slice(1, -1)
		: wanted.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
	const found = new RegExp(source, 'iu').exec(within.slice(start - 1))
	return found ? found.index + start : '#VALUE!'
}

export const TEXT_FUNCTIONS: Record<string, FormulaFunction> = {
	CONCAT: {
		min: 1,
		max: ANY,
		args: 'text1, [text2], …',
		help: 'The texts joined together.',
		call: (args) => {
			let joined = ''
			const stop = eachArg(args, (value) => {
				const text = toFormulaText(value)
				if (isFormulaError(text)) return text
				joined += text
			})
			return stop ?? joined
		},
	},
	LEN: oneText('How many characters the text has.', (text) => text.length),
	LEFT: {
		min: 1,
		max: 2,
		args: 'text, [count]',
		help: 'The first characters of the text, one without a count.',
		call: (args) => cut(args, (text, count) => text.slice(0, count)),
	},
	RIGHT: {
		min: 1,
		max: 2,
		args: 'text, [count]',
		help: 'The last characters of the text, one without a count.',
		call: (args) =>
			cut(args, (text, count) => (count === 0 ? '' : text.slice(Math.max(0, text.length - count)))),
	},
	MID: {
		min: 3,
		max: 3,
		args: 'text, start, count',
		help: 'The characters of the text from a place, counted from 1.',
		call: (args) => {
			const text = toFormulaText(args.value(0))
			if (isFormulaError(text)) return text
			const start = countArg(args, 1, 1)
			if (typeof start !== 'number') return start
			const count = countArg(args, 2, 0)
			if (typeof count !== 'number') return count
			if (start < 1 || count < 0) return '#VALUE!'
			return text.slice(start - 1, start - 1 + count)
		},
	},
	UPPER: oneText('The text in capital letters.', (text) => text.toUpperCase()),
	LOWER: oneText('The text in small letters.', (text) => text.toLowerCase()),
	TRIM: oneText('The text without spaces at its ends, and with one space between words.', (text) =>
		text.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' '),
	),
	TEXTJOIN: {
		min: 3,
		max: ANY,
		args: 'delimiter, skip empty, text1, [text2], …',
		help: 'The texts joined with the delimiter between them. With skip empty TRUE an empty text is left out. A range of delimiters is used in turn.',
		call: (args) => {
			const given = args.value(0)
			const delimiters: string[] = []
			for (const value of given instanceof FormulaRange ? given.values : [given]) {
				const text = toFormulaText(value)
				if (isFormulaError(text)) return text
				delimiters.push(text)
			}
			const skip = toTest(args.value(1))
			if (typeof skip !== 'boolean') return skip
			const texts: string[] = []
			for (let index = 2; index < args.length; index++) {
				const value = args.value(index)
				for (const each of value instanceof FormulaRange ? value.values : [value]) {
					const text = toFormulaText(each)
					if (isFormulaError(text)) return text
					if (!(skip && text === '')) texts.push(text)
				}
			}
			let joined = texts[0] ?? ''
			for (let index = 1; index < texts.length; index++) {
				joined += (delimiters[(index - 1) % delimiters.length] ?? '') + texts[index]
			}
			return joined.length > MAX_TEXT ? '#VALUE!' : joined
		},
	},
	SUBSTITUTE: {
		min: 3,
		max: 4,
		args: 'text, old, new, [which]',
		help: 'The text with the old text put in place of the new, every time or only the one of a count, from 1. Capital and small letters differ.',
		call: (args) => {
			const parts: string[] = []
			for (let index = 0; index < 3; index++) {
				const text = toFormulaText(args.value(index))
				if (isFormulaError(text)) return text
				parts.push(text)
			}
			const [text = '', old = '', fresh = ''] = parts
			const which = args.length > 3 ? countArg(args, 3, 1) : undefined
			if (typeof which === 'string') return which
			if (which !== undefined && which < 1) return '#VALUE!'
			if (old === '') return text
			if (which === undefined) return text.split(old).join(fresh)
			let at = -1
			for (let count = 0; count < which; count++) {
				at = text.indexOf(old, at + (count ? old.length : 1))
				if (at < 0) return text
			}
			return text.slice(0, at) + fresh + text.slice(at + old.length)
		},
	},
	FIND: {
		min: 2,
		max: 3,
		args: 'find, within, [start]',
		help: 'The place of a text in another, from 1, or #VALUE!. Capital and small letters differ, and there are no wildcards.',
		call: (args) => place(args, false),
	},
	SEARCH: {
		min: 2,
		max: 3,
		args: 'find, within, [start]',
		help: 'The place of a text in another, from 1, or #VALUE!. Capital and small letters are the same, and * and ? are wildcards.',
		call: (args) => place(args, true),
	},
	VALUE: {
		min: 1,
		max: 1,
		args: 'text',
		help: 'The number of a text as a formula writes it: 12.5, -3, 1e3. Any other text is #VALUE!.',
		call: (args) => {
			const value = args.value(0)
			if (typeof value === 'number' || isFormulaError(value)) return toNumber(value)
			// An empty cell is 0; an empty text in the formula is no number.
			if (isEmpty(value)) return args.column(0) ? 0 : '#VALUE!'
			if (typeof value !== 'string') return '#VALUE!'
			return toNumber(value)
		},
	},
	TEXT: {
		min: 2,
		max: 2,
		args: 'value, format',
		help: 'The value as a text in a format of Excel: 0, #, the comma of thousands, decimals and % for a number; y, m, d, h, m, s and AM/PM for a date.',
		call: (args) => {
			const code = toFormulaText(args.value(1))
			if (isFormulaError(code)) return code
			return formatText(args, code)
		},
	},
}
