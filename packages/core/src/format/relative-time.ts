import { toDate } from './date'
import { getRelativeTimeFormat } from './intl'
import { INVALID, type PrepareFormatter } from './shared'
import type { RelativeTimeFormatOptions, RelativeTimeUnit } from './types'

const DAY = 86_400_000

// Calendar-free averages: a relative label such as "in 3 months" does not need month lengths.
const unitMilliseconds: Record<RelativeTimeUnit, number> = {
	year: DAY * 365,
	quarter: DAY * 91.25,
	month: DAY * 30.4375,
	week: DAY * 7,
	day: DAY,
	hour: 3_600_000,
	minute: 60_000,
	second: 1000,
}

// Smaller numbers are differences, not epoch milliseconds (1e12 ms is September 2001).
const TIMESTAMP_THRESHOLD = 1_000_000_000_000

function pointInTime(value: unknown): number | undefined {
	if (value instanceof Date) return value.getTime()
	if (typeof value === 'number') return value > TIMESTAMP_THRESHOLD ? value : undefined
	// A numeric string is a difference; Date.parse would read '5' as the year 2005.
	if (typeof value === 'string' && !Number.isFinite(Number(value))) return toDate(value)?.getTime()
	return undefined
}

export const relativeTime: PrepareFormatter<RelativeTimeFormatOptions> = (options, locale) => {
	const format = getRelativeTimeFormat(locale, {
		localeMatcher: options.localeMatcher ?? 'best fit',
		numeric: options.numeric ?? 'always',
		style: options.style ?? 'long',
	})
	const unit = options.unit ?? 'day'
	const unitLength = unitMilliseconds[unit]
	return (value) => {
		let difference: number
		const time = options.calculateDifference === false ? undefined : pointInTime(value)
		if (time === undefined) {
			difference = Number(value)
		} else {
			const now = options.now === undefined ? Date.now() : Number(options.now)
			difference = Math.round((time - now) / unitLength)
		}
		if (!Number.isFinite(difference)) return INVALID
		const text = format.format(difference, unit)
		return options.capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text
	}
}
