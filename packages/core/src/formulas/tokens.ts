import { FORMULA_ERRORS, type FormulaError } from '../formula/errors'
import type { FormulaIssue } from '../formula/types'

/**
 * The signs of the text that a person types and reads. The stored form of a
 * formula always has `.` as the decimal sign and `,` between arguments; a
 * locale whose decimal sign is `,` types `1,24` and puts `;` between
 * arguments, as a spreadsheet does there.
 */
export type FormulaSigns = {
	decimal: '.' | ','
	/** The signs that separate arguments. The first one is the one the printer writes. */
	separators: readonly (',' | ';')[]
}

/** The signs of the stored form, in every locale. */
export const STORED_SIGNS: FormulaSigns = Object.freeze({
	decimal: '.',
	separators: Object.freeze([',', ';'] as const),
})

const COMMA_SIGNS: FormulaSigns = Object.freeze({
	decimal: ',',
	separators: Object.freeze([';'] as const),
})

const signsByLocale = new Map<string, FormulaSigns>()

/**
 * The signs of a locale, from the decimal sign that `Intl` writes for it, as
 * a number cell of the table reads a typed number. A locale whose decimal
 * sign is neither `.` nor `,` types formulas with `.`.
 */
export function formulaSigns(locale: string | undefined): FormulaSigns {
	if (locale === undefined) return STORED_SIGNS
	let found = signsByLocale.get(locale)
	if (!found) {
		let decimal = '.'
		try {
			decimal =
				new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')
					?.value ?? '.'
		} catch {
			// A locale that Intl does not know types formulas as the stored form.
		}
		found = decimal === ',' ? COMMA_SIGNS : STORED_SIGNS
		signsByLocale.set(locale, found)
	}
	return found
}

export type Token =
	/** `raw` is the number as it was written, with `.` as the decimal sign. */
	| { type: 'number'; value: number; raw: string; at: number; end: number }
	| { type: 'text'; value: string; at: number; end: number }
	| { type: 'error'; value: FormulaError; at: number; end: number }
	/** The inside of `[...]`, with its escapes. */
	| { type: 'bracket'; value: string; at: number; end: number }
	/** A name of a function, `TRUE`, an address such as `$B$7`, or a column such as `B`. */
	| { type: 'word'; value: string; at: number; end: number }
	| { type: 'operator'; value: string; at: number; end: number }
	| { type: 'separator'; value: ',' | ';'; at: number; end: number }

const OPERATORS = [
	'<>',
	'<=',
	'>=',
	'+',
	'-',
	'*',
	'/',
	'^',
	'&',
	'=',
	'<',
	'>',
	'%',
	'(',
	')',
	':',
]
const WORD = /[$A-Za-z_][$A-Za-z0-9_.]*/y
const ERRORS_BY_LENGTH = [...FORMULA_ERRORS].sort((a, b) => b.length - a.length)

function numberShape(decimal: string): RegExp {
	// A `.` may end or start a number (`1.`, `.5`), as in a spreadsheet. A `,`
	// needs digits on both sides, so `[a],2` is a separator in the wrong place
	// and never the number 0.2.
	return decimal === '.'
		? /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y
		: /\d+(?:,\d+)?(?:[eE][+-]?\d+)?/y
}

/**
 * Splits the text of a formula, without its `=`, into tokens. `offset` is
 * where the text starts in the whole formula, for the places in an issue.
 */
export function tokenize(
	text: string,
	signs: FormulaSigns,
	offset = 0,
): { tokens: Token[] } | { issues: FormulaIssue[] } {
	const tokens: Token[] = []
	const number = numberShape(signs.decimal)
	let at = 0
	const fail = (issue: FormulaIssue) => ({ issues: [issue] })
	while (at < text.length) {
		const char = text[at] ?? ''
		if (/\s/.test(char)) {
			at++
			continue
		}
		const start = at + offset
		number.lastIndex = at
		const digits = /[\d.]/.test(char) ? number.exec(text) : null
		if (digits && digits[0] !== '') {
			const end = at + digits[0].length
			// A decimal sign of another locale, as `1.5` where `,` is the decimal sign.
			if (signs.decimal === ',' && /^\.\d/.test(text.slice(end))) {
				return fail({ code: 'decimalSign', at: end + offset, expected: ',' })
			}
			// `.5` is kept as `0.5`, so a locale with a decimal comma can write it as `0,5`.
			const raw = digits[0].replace(',', '.').replace(/^\./, '0.')
			tokens.push({
				type: 'number',
				value: Number(raw),
				raw,
				at: start,
				end: end + offset,
			})
			at = end
			continue
		}
		if (char === '"') {
			let value = ''
			let end = at + 1
			for (;;) {
				const close = text.indexOf('"', end)
				if (close < 0) return fail({ code: 'syntax', at: start, found: 'text' })
				value += text.slice(end, close)
				if (text[close + 1] === '"') {
					value += '"'
					end = close + 2
					continue
				}
				end = close + 1
				break
			}
			tokens.push({ type: 'text', value, at: start, end: end + offset })
			at = end
			continue
		}
		if (char === '[') {
			let end = at + 1
			while (end < text.length && text[end] !== ']') end += text[end] === '\\' ? 2 : 1
			if (end >= text.length) return fail({ code: 'syntax', at: start, found: '[' })
			tokens.push({
				type: 'bracket',
				value: text.slice(at + 1, end),
				at: start,
				end: end + 1 + offset,
			})
			at = end + 1
			continue
		}
		if (char === '#') {
			const upper = text.slice(at).toUpperCase()
			const error = ERRORS_BY_LENGTH.find((code) => upper.startsWith(code))
			if (!error) return fail({ code: 'syntax', at: start, found: '#' })
			tokens.push({ type: 'error', value: error, at: start, end: start + error.length })
			at += error.length
			continue
		}
		if (char === ',' || char === ';') {
			if (!signs.separators.includes(char)) {
				return fail({ code: 'separator', at: start, expected: signs.separators[0] ?? ';' })
			}
			tokens.push({ type: 'separator', value: char, at: start, end: start + 1 })
			at++
			continue
		}
		WORD.lastIndex = at
		const word = WORD.exec(text)
		if (word) {
			tokens.push({ type: 'word', value: word[0], at: start, end: start + word[0].length })
			at += word[0].length
			continue
		}
		const operator = OPERATORS.find((sign) => text.startsWith(sign, at))
		if (!operator) return fail({ code: 'syntax', at: start, found: char })
		tokens.push({ type: 'operator', value: operator, at: start, end: start + operator.length })
		at += operator.length
	}
	return { tokens }
}
