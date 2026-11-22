import { isFormulaError } from '../../formula/errors'
import { clean, FormulaRange, isDate, isEmpty, toFormulaText, toNumber } from '../values'
import { clockParts, readDate } from './dates'
import type { FormulaArgs } from './shared'

// The format codes of `TEXT`: a stated part of the codes of Excel, the same
// in every locale. A number: `0`, `#`, a decimal point, a comma between the
// digits of the whole part (thousands), and `%`. A date: `y`, `m`, `d`,
// `h`, `m` (minutes after `h` or before `s`), `s` and `AM/PM`, with the
// months and days in English. Both take text in quotes, a character after
// `\`, and the characters ` $-+()/:` (and `.` and `,` in a date). Any other
// code, and a code of more than one section, is `#VALUE!`.

type Token =
	| { kind: 'digit'; zero: boolean }
	| { kind: 'point' }
	| { kind: 'comma' }
	| { kind: 'percent' }
	| { kind: 'text'; text: string }
	| { kind: 'date'; letter: string; count: number }
	| { kind: 'ampm'; small: boolean }

const LITERALS = new Set([' ', '$', '-', '+', '(', ')', '/', ':'])
const DATE_LETTERS = new Set(['y', 'm', 'd', 'h', 's'])

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// A formula of a column runs one code for each row, so a code is read once. The list is small and capped.
const read = new Map<string, Token[] | undefined>()
function tokensOf(code: string): Token[] | undefined {
	if (read.has(code)) return read.get(code)
	if (read.size >= 256) read.clear()
	const tokens = tokenize(code)
	read.set(code, tokens)
	return tokens
}

function tokenize(code: string): Token[] | undefined {
	const tokens: Token[] = []
	for (let index = 0; index < code.length; index++) {
		const char = code[index] ?? ''
		const lower = char.toLowerCase()
		if (char === '"') {
			const end = code.indexOf('"', index + 1)
			if (end < 0) return undefined
			tokens.push({ kind: 'text', text: code.slice(index + 1, end) })
			index = end
		} else if (char === '\\') {
			const next = code[index + 1]
			if (next === undefined) return undefined
			tokens.push({ kind: 'text', text: next })
			index++
		} else if (char === '0' || char === '#') tokens.push({ kind: 'digit', zero: char === '0' })
		else if (char === '.') tokens.push({ kind: 'point' })
		else if (char === ',') tokens.push({ kind: 'comma' })
		else if (char === '%') tokens.push({ kind: 'percent' })
		else if (code.slice(index, index + 5).toUpperCase() === 'AM/PM') {
			tokens.push({ kind: 'ampm', small: char === 'a' })
			index += 4
		} else if (DATE_LETTERS.has(lower)) {
			let count = 1
			while (code[index + count]?.toLowerCase() === lower) count++
			tokens.push({ kind: 'date', letter: lower, count })
			index += count - 1
		} else if (LITERALS.has(char)) tokens.push({ kind: 'text', text: char })
		else return undefined
	}
	return tokens
}

/** A whole number as a text with a comma between each three digits. */
const grouped = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function formatNumber(value: number, tokens: Token[]): string | undefined {
	const point = tokens.findIndex((token) => token.kind === 'point')
	const whole = point < 0 ? tokens : tokens.slice(0, point)
	const part = point < 0 ? [] : tokens.slice(point + 1)
	if (part.some((token) => token.kind === 'point' || token.kind === 'comma')) return undefined
	const places = (list: Token[]) =>
		list.flatMap((token, index) => (token.kind === 'digit' ? [index] : []))
	const wholePlaces = places(whole)
	const first = wholePlaces[0] ?? -1
	const last = wholePlaces[wholePlaces.length - 1] ?? -1
	// A comma between two digits groups the thousands. Elsewhere, Excel divides by 1,000: not here.
	let group = false
	for (let index = 0; index < whole.length; index++) {
		if (whole[index]?.kind !== 'comma') continue
		if (index < first || index > last) return undefined
		group = true
	}
	const digitsOf = whole.filter((token) => token.kind !== 'comma')
	// Thousands need the digits side by side: `#,##0`, not `0 0,00`.
	const held = places(digitsOf)
	const inside = digitsOf.slice(held[0] ?? 0, (held[held.length - 1] ?? -1) + 1)
	if (group && inside.some((token) => token.kind !== 'digit')) return undefined
	let scaled = value
	for (const token of tokens) if (token.kind === 'percent') scaled = clean(scaled * 100)
	const decimals = places(part).length
	const size = Math.abs(scaled) * 10 ** decimals
	if (size >= 1e21) return undefined
	// A half goes away from zero, after the last binary digits come off.
	let digits = String(Math.round(clean(size)))
	if (decimals) digits = digits.padStart(decimals + 1, '0')
	const negative = scaled < 0 && /[1-9]/.test(digits)
	let wholeDigits = decimals ? digits.slice(0, -decimals) : digits
	let partDigits = decimals ? digits.slice(-decimals) : ''

	// The whole part: as many digits as the zeros from the first one ask for.
	const holders = digitsOf.filter((token) => token.kind === 'digit') as { zero: boolean }[]
	const firstZero = holders.findIndex((holder) => holder.zero)
	const least = firstZero < 0 ? 0 : holders.length - firstZero
	if (wholeDigits === '0') wholeDigits = ''
	wholeDigits = wholeDigits.padStart(least, '0')
	let text = ''
	if (group) {
		let placed = false
		for (const token of digitsOf) {
			if (token.kind === 'digit') {
				if (!placed) text += grouped(wholeDigits)
				placed = true
			} else text += token.kind === 'percent' ? '%' : token.kind === 'text' ? token.text : ''
		}
	} else {
		// From the right, one digit for each place; the first place takes the digits that are left.
		let holder = 0
		for (const token of digitsOf) {
			if (token.kind !== 'digit') {
				text += token.kind === 'percent' ? '%' : token.kind === 'text' ? token.text : ''
				continue
			}
			const fromRight = holders.length - 1 - holder
			const end = wholeDigits.length - fromRight
			text += holder === 0 ? wholeDigits.slice(0, Math.max(0, end)) : (wholeDigits[end - 1] ?? '')
			holder++
		}
	}
	if (point >= 0) {
		// A `#` at the end shows no zero.
		const partHolders = part.filter((token) => token.kind === 'digit') as { zero: boolean }[]
		let keep = partDigits.length
		while (keep > 0 && partDigits[keep - 1] === '0' && !partHolders[keep - 1]?.zero) keep--
		partDigits = partDigits.slice(0, keep)
		text += '.'
		let at = 0
		for (const token of part) {
			if (token.kind === 'digit') text += partDigits[at++] ?? ''
			else text += token.kind === 'percent' ? '%' : token.kind === 'text' ? token.text : ''
		}
	}
	return (negative ? '-' : '') + text
}

const pad = (part: number, length = 2) => String(part).padStart(length, '0')

function formatDate(parts: ReturnType<typeof clockParts>, tokens: Token[]): string | undefined {
	const dates = tokens.filter((token) => token.kind === 'date')
	const twelve = tokens.some((token) => token.kind === 'ampm')
	let text = ''
	for (const token of tokens) {
		if (token.kind === 'text') text += token.text
		else if (token.kind === 'point') text += '.'
		else if (token.kind === 'comma') text += ','
		else if (token.kind === 'ampm') {
			const after = parts.hour >= 12 ? 'PM' : 'AM'
			text += token.small ? after.toLowerCase() : after
		} else if (token.kind === 'date') {
			const { letter, count } = token
			if (letter === 'y') text += count <= 2 ? pad(parts.year % 100) : pad(parts.year, 4)
			else if (letter === 'd') {
				const name = DAYS[parts.weekday] ?? ''
				text +=
					count === 1
						? parts.day
						: count === 2
							? pad(parts.day)
							: count === 3
								? name.slice(0, 3)
								: name
			} else if (letter === 'h') {
				const hour = twelve ? parts.hour % 12 || 12 : parts.hour
				text += count === 1 ? hour : pad(hour)
			} else if (letter === 's') text += count === 1 ? parts.second : pad(parts.second)
			else {
				// `m` is the minute after an hour or before a second, else the month.
				const at = dates.indexOf(token)
				const minute =
					count <= 2 && (dates[at - 1]?.letter === 'h' || dates[at + 1]?.letter === 's')
				if (minute) text += count === 1 ? parts.minute : pad(parts.minute)
				else if (count > 5) return undefined
				else {
					const name = MONTHS[parts.month - 1] ?? ''
					text +=
						count === 1
							? parts.month
							: count === 2
								? pad(parts.month)
								: count === 3
									? name.slice(0, 3)
									: count === 4
										? name
										: name.slice(0, 1)
				}
			}
		} else return undefined
	}
	return text
}

/**
 * The value as a text in a format code. A text that is no number and no
 * date stays as it is, as in Excel, and a boolean is `TRUE` or `FALSE`. A
 * date of a table is no number, so a date with a number code and a number
 * with a date code are `#VALUE!`.
 */
export function formatText(args: FormulaArgs, code: string): string {
	const value = args.value(0)
	if (isFormulaError(value)) return value
	if (value instanceof FormulaRange) return '#VALUE!'
	if (/^general$/i.test(code)) return toFormulaText(value)
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
	const tokens = tokensOf(code)
	if (!tokens) return '#VALUE!'
	const dated = tokens.some((token) => token.kind === 'date' || token.kind === 'ampm')
	const numbered = tokens.some((token) => token.kind === 'digit')
	if (dated === numbered) return '#VALUE!'
	if (dated) {
		if (isEmpty(value)) return ''
		// The value is read once: a call of `NOW` in it gives one moment.
		const read = readDate({ ...args, value: () => value, column: (index) => args.column(index) }, 0)
		if (read === null) return ''
		if (typeof read === 'string') {
			return typeof value === 'string' && typeof toNumber(value) !== 'number' ? value : read
		}
		return formatDate(clockParts(read), tokens) ?? '#VALUE!'
	}
	if (isDate(value)) return '#VALUE!'
	const number = toNumber(value)
	if (typeof number !== 'number') return typeof value === 'string' ? value : number
	return formatNumber(number, tokens) ?? '#VALUE!'
}
