import { isFormulaError } from '../../formula/errors'
import { toFormulaText } from '../values'
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
}
