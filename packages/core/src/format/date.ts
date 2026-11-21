import { getDateTimeFormat } from './intl'
import { INVALID, type CellFormatter, type PrepareFormatter } from './shared'
import type { DateFormatOptions } from './types'

const dateOnly = /^\d{4}-\d{2}-\d{2}$/

/**
 * Accepts a Date, an epoch-millisecond number or a string `Date` can parse. A bare
 * `YYYY-MM-DD` is local midnight of that day: `Date` alone would read it as UTC midnight,
 * which is the previous day west of Greenwich.
 */
export function toDate(value: unknown): Date | undefined {
	let date: Date
	if (value instanceof Date) date = value
	else if (typeof value === 'number') date = new Date(value)
	else if (typeof value === 'string')
		date = new Date(dateOnly.test(value) ? `${value}T00:00:00` : value)
	else return undefined
	return Number.isNaN(date.getTime()) ? undefined : date
}

function hasDateFields(options: DateFormatOptions): boolean {
	return Boolean(options.day || options.month || options.year || options.weekday)
}

function hasTimeFields(options: DateFormatOptions): boolean {
	return Boolean(options.hour || options.minute || options.second)
}

const DEFAULT_DATE_FIELDS = { year: 'numeric', month: 'numeric', day: 'numeric' } as const
const DEFAULT_TIME_FIELDS = { hour: 'numeric', minute: '2-digit' } as const

type Halves = [date: Intl.DateTimeFormatOptions, time: Intl.DateTimeFormatOptions]

/**
 * The date and time halves of the Intl options, without the time zone. Intl throws when a
 * style is mixed with individual fields, so once either half names fields, a half that is
 * needed but unset gets default fields rather than a style.
 */
function halves(options: DateFormatOptions, needDate: boolean, needTime: boolean): Halves {
	const dateFields = hasDateFields(options)
	const timeFields = hasTimeFields(options)
	const zoneName = { hour12: options.hour12, timeZoneName: options.timeZoneName }
	if (dateFields || timeFields) {
		const date = dateFields
			? { weekday: options.weekday, year: options.year, month: options.month, day: options.day }
			: needDate
				? DEFAULT_DATE_FIELDS
				: {}
		const time = timeFields
			? { hour: options.hour, minute: options.minute, second: options.second }
			: needTime
				? DEFAULT_TIME_FIELDS
				: {}
		return [date, { ...time, ...zoneName }]
	}
	return [
		{ dateStyle: options.dateStyle ?? (needDate ? 'medium' : undefined) },
		{ timeStyle: options.timeStyle ?? (needTime ? 'short' : undefined), ...zoneName },
	]
}

function formats(
	locale: string,
	[date, time]: Halves,
	split: boolean,
	timeZone: string | undefined,
): Intl.DateTimeFormat[] {
	if (!split) return [getDateTimeFormat(locale, { ...date, ...time, timeZone })]
	// The time zone goes to both halves, or the date half would roll over at local midnight.
	return [
		getDateTimeFormat(locale, { ...date, timeZone }),
		getDateTimeFormat(locale, { ...time, timeZone }),
	]
}

function build(
	locale: string,
	parts: Halves,
	split: boolean,
	timeZone: string | undefined,
): (value: Date) => string {
	const [first, second] = formats(locale, parts, split, timeZone)
	if (!first) return () => ''
	return second
		? (value) => `${first.format(value)} ${second.format(value)}`
		: (value) => first.format(value)
}

const shapes = {
	date: [true, false],
	time: [false, true],
	datetime: [true, true],
} as const

/**
 * The Intl formats that a date format writes a value with, in a given time zone and with
 * no zone name: one format, or a date and a time that a space joins. The export reads them
 * to give a file the pattern of the screen. It throws when Intl refuses the options.
 */
export function dateFormats(
	name: keyof typeof shapes,
	options: DateFormatOptions,
	locale: string,
	timeZone: string,
): Intl.DateTimeFormat[] {
	const [needDate, needTime] = shapes[name]
	const [date, time] = halves(options, needDate, needTime)
	return formats(
		locale,
		[date, { ...time, timeZoneName: undefined }],
		name === 'datetime' && isFinnish(locale),
		timeZone,
	)
}

/**
 * A `YYYY-MM-DD` value is a calendar day, not an instant, so it must show that day whatever
 * the system zone or the column's `timeZone`: it is read as UTC midnight and always formatted
 * in UTC, with no zone name, since no zone applies to it.
 */
function prepareDate(
	locale: string,
	options: DateFormatOptions,
	parts: Halves,
	split: boolean,
): CellFormatter {
	const instant = build(locale, parts, split, options.timeZone)
	const calendarDay = build(
		locale,
		[parts[0], { ...parts[1], timeZoneName: undefined }],
		split,
		'UTC',
	)
	return (value) => {
		if (typeof value === 'string' && dateOnly.test(value)) {
			const day = new Date(`${value}T00:00:00Z`)
			return Number.isNaN(day.getTime()) ? INVALID : calendarDay(day)
		}
		const date = toDate(value)
		return date ? instant(date) : INVALID
	}
}

// Finnish joins date and time with "klo", which reads as noise in a dense table column.
function isFinnish(locale: string): boolean {
	return locale === 'fi' || locale.startsWith('fi-')
}

export const date: PrepareFormatter<DateFormatOptions> = (options, locale) =>
	prepareDate(locale, options, halves(options, true, false), false)

export const time: PrepareFormatter<DateFormatOptions> = (options, locale) =>
	prepareDate(locale, options, halves(options, false, true), false)

export const datetime: PrepareFormatter<DateFormatOptions> = (options, locale) =>
	prepareDate(locale, options, halves(options, true, true), isFinnish(locale))
