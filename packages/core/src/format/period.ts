import { getDateTimeFormat } from './intl'
import { INVALID, type PrepareFormatter } from './shared'
import { DEFAULT_LABELS } from './special'
import type { PeriodFormatOptions } from './types'

const dateOnly = /^\d{4}-\d{2}-\d{2}$/
const DAY = 86_400_000

/**
 * The first day of the week of each type of `WEEKDAY`, and the number of that
 * day (0 is Sunday), as a spreadsheet counts them.
 */
const WEEKDAY_TYPES: Readonly<Record<number, readonly [first: number, base: number]>> = {
	1: [0, 1],
	2: [1, 1],
	3: [1, 0],
	11: [1, 1],
	12: [2, 1],
	13: [3, 1],
	14: [4, 1],
	15: [5, 1],
	16: [6, 1],
	17: [0, 1],
}

/** The fields of the text of a day, a month and a year. The Excel writer gives them a date pattern. */
export const PERIOD_FIELDS: Partial<Record<string, Intl.DateTimeFormatOptions>> = {
	day: { dateStyle: 'medium' },
	month: { year: 'numeric', month: 'long' },
	year: { year: 'numeric' },
}

// 2023-01-01 is a Sunday.
const SUNDAY = Date.UTC(2023, 0, 1)

/**
 * The text of a period: a group of days, weeks, months, quarters or years
 * whose value is its first day (`YYYY-MM-DD`), an hour whose value is the
 * moment at which it began, or a day of the week whose value is a number of
 * `WEEKDAY`. A week is a range of days, so the text says where the week
 * starts and needs no word for "week". A day text is shown in UTC, so it is
 * that day in every zone; an hour is shown in the `timeZone` of the options.
 */
export const period: PrepareFormatter<PeriodFormatOptions> = (options, locale) => {
	const unit = options.unit ?? 'day'
	const utc = (fields: Intl.DateTimeFormatOptions) =>
		getDateTimeFormat(locale, { ...fields, timeZone: 'UTC' })
	if (unit === 'hour') {
		const format = getDateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: options.timeZone,
		})
		return (value) => {
			const date =
				value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined
			return date && !Number.isNaN(date.getTime()) ? format.format(date) : INVALID
		}
	}
	if (unit === 'weekday') {
		const [first, base] = WEEKDAY_TYPES[options.weekdays ?? 1] ?? [0, 1]
		const format = utc({ weekday: 'long' })
		return (value) => {
			if (typeof value !== 'number' || !Number.isInteger(value)) return INVALID
			const offset = value - base
			if (offset < 0 || offset > 6) return INVALID
			return format.format(SUNDAY + ((first + offset) % 7) * DAY)
		}
	}
	const day = utc(PERIOD_FIELDS.day ?? {})
	const month = utc(PERIOD_FIELDS.month ?? {})
	const year = utc(PERIOD_FIELDS.year ?? {})
	return (value, context) => {
		if (typeof value !== 'string' || !dateOnly.test(value)) return INVALID
		const start = Date.parse(`${value}T00:00:00Z`)
		if (Number.isNaN(start)) return INVALID
		switch (unit) {
			case 'week':
				return day.formatRange(start, start + 6 * DAY)
			case 'month':
				return month.format(start)
			case 'quarter': {
				const date = new Date(start)
				const label = context?.labels?.quarter ?? DEFAULT_LABELS.quarter
				return label
					.replace('{quarter}', String(Math.floor(date.getUTCMonth() / 3) + 1))
					.replace('{year}', year.format(start))
			}
			case 'year':
				return year.format(start)
			default:
				return day.format(start)
		}
	}
}
