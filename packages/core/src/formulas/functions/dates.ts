import { isFormulaError, type FormulaError } from '../../formula/errors'
import { isDay, timeZoneOf } from '../../rows/columns'
import { isEmpty } from '../values'
import { fromWall, wallTime } from '../zone'
import { countArg, numberArg, type FormulaArgs, type FormulaFunction } from './shared'

// The dates of a table are a day text (`YYYY-MM-DD`) or a moment (a `Date`),
// not the serial numbers of a spreadsheet. A day text has no zone: its
// fields are read as they are. A moment is read on the clock of a zone: the
// zone of the column of a reference, else the `timeZone` of the formula,
// else local time. No result depends on the locale: the first day of a week
// is said by the formula itself, as in a spreadsheet.

const DAY = 86_400_000
const HOUR = 3_600_000

/** A date as the fields of its calendar day, with the clock of a moment. */
type Read = {
	year: number
	month: number
	day: number
	/** The time of day in milliseconds, 0 for a day text. */
	clock: number
	/** The moment, or `undefined` for a day text. */
	time?: number
	zone: string | undefined
}

// `timeZoneOf` asks `Intl` whether the zone exists, which costs as much as
// reading a clock: once for each column object, not for each row.
const zones = new WeakMap<object, string | undefined>()
function zoneOf(column: Parameters<typeof timeZoneOf>[0]): string | undefined {
	if (!zones.has(column)) zones.set(column, timeZoneOf(column))
	return zones.get(column)
}

const DATE_FORMATS: ReadonlySet<string> = new Set(['date', 'time', 'datetime'])
const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Reads a date argument, or gives `null` for an empty one and the error for a value that is no date. */
function readDate(args: FormulaArgs, index: number): Read | null | FormulaError {
	const value = args.value(index)
	if (isFormulaError(value)) return value
	if (isEmpty(value)) return null
	const column = args.column(index)
	const zone = (column && zoneOf(column)) ?? args.context.zone
	if (isDay(value)) {
		const [year, month, day] = value.split('-').map(Number) as [number, number, number]
		// `2026-02-30` has the shape of a day and is none.
		const check = new Date(Date.UTC(year, month - 1, day))
		if (check.getUTCMonth() !== month - 1) return '#VALUE!'
		return { year, month, day, clock: 0, zone }
	}
	let time: number
	if (value instanceof Date) time = value.getTime()
	// A number is a moment only in a column that the table shows as a date, as `toDate` reads it.
	else if (typeof value === 'number' && column?.format && DATE_FORMATS.has(column.format))
		time = value
	else if (typeof value === 'string' && ISO_MOMENT.test(value)) time = Date.parse(value)
	else return '#VALUE!'
	if (!Number.isFinite(time)) return '#VALUE!'
	const wall = wallTime(time, zone)
	const date = new Date(wall)
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
		clock: ((wall % DAY) + DAY) % DAY,
		time,
		zone,
	}
}

const pad = (part: number, length = 2) => String(part).padStart(length, '0')

/** The day text of a calendar day, which may roll over (a month 13, a day 0), or `#NUM!` outside the years 0 to 9999. */
function dayText(year: number, month: number, day: number): string {
	const date = new Date(utcDay(year, month, day))
	const full = date.getUTCFullYear()
	if (full < 0 || full > 9999) return '#NUM!'
	return `${pad(full, 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** The moment of a day in UTC. `Date.UTC` reads the years 0 to 99 as 1900 to 1999, and they are not. */
function utcDay(year: number, month: number, day: number): number {
	if (year >= 100) return Date.UTC(year, month - 1, day)
	const date = new Date(0)
	date.setUTCFullYear(year, month - 1, day)
	return date.getTime()
}

/** The number of a calendar day, counted from 1970-01-01. */
const dayNumber = (read: Read) => Math.round(utcDay(read.year, read.month, read.day) / DAY)

/** 0 for Sunday to 6 for Saturday, as `Date#getDay` counts. */
const weekday = (read: Read) => (((dayNumber(read) + 4) % 7) + 7) % 7

/** The ISO 8601 week of a day: the year it belongs to, and its number in that year. */
function isoWeek(read: Read): { year: number; week: number } {
	const number = dayNumber(read)
	// The Thursday of the week decides the year of the week.
	const thursday = number - ((weekday(read) + 6) % 7) + 3
	const year = new Date(thursday * DAY).getUTCFullYear()
	const first = new Date(0)
	first.setUTCFullYear(year, 0, 1)
	return { year, week: Math.floor((thursday - first.getTime() / DAY) / 7) + 1 }
}

/**
 * The type of `WEEKDAY` of a spreadsheet: the first day (0 is Sunday) and the
 * number that day has. These are the types of Microsoft Excel.
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

/** The second argument of `WEEKNUM` of a spreadsheet, as the first day of a week (0 is Sunday). */
const WEEK_STARTS: Readonly<Record<number, number>> = {
	1: 0,
	2: 1,
	11: 1,
	12: 2,
	13: 3,
	14: 4,
	15: 5,
	16: 6,
	17: 0,
	21: 1,
}

/** A function of one date and an optional number, with the rules of an empty and a wrong value. */
function ofDate(
	help: string,
	run: (read: Read, args: FormulaArgs) => unknown,
	extra?: string,
): FormulaFunction {
	return {
		min: 1,
		max: extra ? 2 : 1,
		args: extra ? `date, [${extra}]` : 'date',
		help,
		call: (args) => {
			const read = readDate(args, 0)
			if (read === null) return null
			if (typeof read === 'string') return read
			return run(read, args)
		},
	}
}

/** The number of a table of types, or `#NUM!` for a type that the table does not have. */
function typeArg<T>(args: FormulaArgs, table: Readonly<Record<number, T>>): T | FormulaError {
	const type = args.length > 1 && !isEmpty(args.value(1)) ? numberArg(args, 1) : 1
	if (typeof type !== 'number') return type
	return table[type] ?? '#NUM!'
}

const UNITS = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute'] as const

export const DATE_FUNCTIONS: Record<string, FormulaFunction> = {
	DAYOF: ofDate('The day of the date, as a day: a group of the same days.', (read) =>
		dayText(read.year, read.month, read.day),
	),
	WEEKOF: ofDate(
		'The first day of the week of the date: a group of weeks. The type says the first day as in WEEKNUM: 1 Sunday (the default), 2 Monday.',
		(read, args) => {
			const first = typeArg(args, WEEK_STARTS)
			if (typeof first !== 'number') return first
			return dayText(read.year, read.month, read.day - ((weekday(read) - first + 7) % 7))
		},
		'type',
	),
	MONTHOF: ofDate('The first day of the month of the date: a group of months.', (read) =>
		dayText(read.year, read.month, 1),
	),
	QUARTEROF: ofDate('The first day of the quarter of the date: a group of quarters.', (read) =>
		dayText(read.year, Math.floor((read.month - 1) / 3) * 3 + 1, 1),
	),
	YEAROF: ofDate('The first day of the year of the date: a group of years.', (read) =>
		dayText(read.year, 1, 1),
	),
	HOUROF: ofDate(
		'The moment at which the hour of the date began on the clock: a group of hours.',
		(read) => {
			if (read.time === undefined) {
				return new Date(fromWall(Date.UTC(read.year, read.month - 1, read.day), read.zone))
			}
			// The minutes and seconds of the clock come off, also in a zone with a part of an hour.
			return new Date(read.time - (read.clock % HOUR) - (read.time % 1000))
		},
	),
	YEAR: ofDate('The year of the date.', (read) => read.year),
	QUARTER: ofDate(
		'The quarter of the date, 1 to 4.',
		(read) => Math.floor((read.month - 1) / 3) + 1,
	),
	MONTH: ofDate('The month of the date, 1 to 12.', (read) => read.month),
	DAY: ofDate('The day of the month of the date, 1 to 31.', (read) => read.day),
	HOUR: ofDate('The hour of the date on the clock, 0 to 23.', (read) =>
		Math.floor(read.clock / HOUR),
	),
	MINUTE: ofDate('The minute of the date on the clock, 0 to 59.', (read) =>
		Math.floor((read.clock % HOUR) / 60_000),
	),
	WEEKDAY: ofDate(
		'The day of the week as a number. The type as in a spreadsheet: 1 Sunday is 1 (the default), 2 Monday is 1, 3 Monday is 0.',
		(read, args) => {
			const type = typeArg(args, WEEKDAY_TYPES)
			if (typeof type === 'string') return type
			const [first, base] = type
			return ((weekday(read) - first + 7) % 7) + base
		},
		'type',
	),
	ISOWEEKNUM: ofDate('The ISO 8601 week of the date, 1 to 53.', (read) => isoWeek(read).week),
	ISOYEAR: ofDate(
		'The year that the ISO 8601 week of the date belongs to: 2027-01-01 is in a week of 2026.',
		(read) => isoWeek(read).year,
	),
	DATE: {
		min: 3,
		max: 3,
		args: 'year, month, day',
		help: 'The day of a year, a month and a day. A month 13 or a day 0 rolls over.',
		call: (args) => {
			let year = countArg(args, 0, 0)
			if (typeof year !== 'number') return year
			const month = countArg(args, 1, 1)
			if (typeof month !== 'number') return month
			const day = countArg(args, 2, 1)
			if (typeof day !== 'number') return day
			// A spreadsheet adds 1900 to a year under 1900, and has no year after 9999.
			if (year < 0 || year > 9999) return '#NUM!'
			if (year < 1900) year += 1900
			const text = dayText(year, month, day)
			return text < '1900-01-01' ? '#NUM!' : text
		},
	},
	DAYS: {
		min: 2,
		max: 2,
		args: 'end, start',
		help: 'The number of days from the start to the end.',
		call: (args) => {
			const end = readDate(args, 0)
			if (typeof end === 'string') return end
			const start = readDate(args, 1)
			if (typeof start === 'string') return start
			if (end === null || start === null) return '#VALUE!'
			return dayNumber(end) - dayNumber(start)
		},
	},
	DATEADD: {
		min: 3,
		max: 3,
		args: 'date, count, unit',
		help: `The date moved by a count of a unit: ${UNITS.map((unit) => `"${unit}"`).join(', ')}. A month at its end stays at the end of a shorter month.`,
		call: (args) => {
			const read = readDate(args, 0)
			if (read === null) return null
			if (typeof read === 'string') return read
			const count = countArg(args, 1, 0)
			if (typeof count !== 'number') return count
			const unit = String(args.value(2)).toLowerCase()
			if (!(UNITS as readonly string[]).includes(unit)) return '#VALUE!'
			if (unit === 'hour' || unit === 'minute') {
				const time = read.time ?? fromWall(Date.UTC(read.year, read.month - 1, read.day), read.zone)
				return new Date(time + count * (unit === 'hour' ? HOUR : 60_000))
			}
			let { year, month, day } = read
			if (unit === 'day' || unit === 'week') day += count * (unit === 'week' ? 7 : 1)
			else {
				month += count * (unit === 'year' ? 12 : unit === 'quarter' ? 3 : 1)
				// The last day of a shorter month, as EDATE of a spreadsheet gives it.
				const last = new Date(Date.UTC(2000, 0, 1))
				last.setUTCFullYear(year, month, 0)
				day = Math.min(day, last.getUTCDate())
			}
			const text = dayText(year, month, day)
			if (read.time === undefined || isFormulaError(text)) return text
			;[year, month, day] = text.split('-').map(Number) as [number, number, number]
			return new Date(fromWall(Date.UTC(year, month - 1, day) + read.clock, read.zone))
		},
	},
}
