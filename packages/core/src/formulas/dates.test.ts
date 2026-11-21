import { describe, expect, test } from 'vite-plus/test'
import { formatValue, type FormatName, type FormatOptions } from '../format'
import type { ColumnDef } from '../rows'
import { zoneClock } from '../rows/zone'
import {
	compileRowFormula,
	describeFormulaIssue,
	formulaColumn,
	formulaShows,
	parseFormula,
} from './index'
import { zoneClockOf } from './zone'

// The expected values of the functions with a name of a spreadsheet come from
// the function reference of Microsoft Excel. A date here is a day text or a
// `Date`, not a serial number, and a moment is read in the zone of its column.

type Order = {
	id: string
	created: Date | string | null
	day: string | null
	millis: number
	plain: number
	note: string
}

const HELSINKI = 'Europe/Helsinki'

const columns: ColumnDef<Order>[] = [
	{ id: 'created', header: 'Created', format: 'datetime', formatOptions: { timeZone: HELSINKI } },
	{ id: 'day', header: 'Day', format: 'date' },
	{
		id: 'zoned',
		key: 'day',
		header: 'Zoned day',
		format: 'date',
		formatOptions: { timeZone: 'Asia/Tokyo' },
	},
	{ id: 'millis', format: 'datetime', formatOptions: { timeZone: HELSINKI } },
	{ id: 'plain' },
	{ id: 'note' },
	{
		id: 'kathmandu',
		key: 'created',
		format: 'datetime',
		formatOptions: { timeZone: 'Asia/Kathmandu' },
	},
	{
		id: 'york',
		key: 'created',
		format: 'datetime',
		formatOptions: { timeZone: 'America/New_York' },
	},
]

const order = (created: Date | string | null, day: string | null = '2026-11-21'): Order => ({
	id: 'a',
	created,
	day,
	millis: Date.parse('2026-11-21T12:05:00Z'),
	plain: 46_000,
	note: 'hello',
})

const ROW = order(new Date('2026-11-21T12:05:00Z'))

function run(formula: string, row: Order = ROW, timeZone?: string) {
	const parsed = parseFormula(formula, { columns })
	if ('issues' in parsed)
		throw new Error(describeFormulaIssue(parsed.issues[0] ?? { code: 'empty' }))
	return compileRowFormula(parsed.formula, columns, { timeZone })(row)
}

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value)

describe('the periods of a date', () => {
	// The moment 2026-11-21 14:05 in Helsinki (12:05 UTC), a Saturday.
	test.each([
		['=DAYOF([created])', '2026-11-21'],
		// Without a type the week starts on Sunday, as WEEKNUM of a spreadsheet.
		['=WEEKOF([created])', '2026-11-15'],
		['=WEEKOF([created], 1)', '2026-11-15'],
		['=WEEKOF([created], 2)', '2026-11-16'],
		['=WEEKOF([created], 11)', '2026-11-16'],
		['=WEEKOF([created], 12)', '2026-11-17'],
		['=WEEKOF([created], 13)', '2026-11-18'],
		['=WEEKOF([created], 14)', '2026-11-19'],
		['=WEEKOF([created], 15)', '2026-11-20'],
		['=WEEKOF([created], 16)', '2026-11-21'],
		['=WEEKOF([created], 17)', '2026-11-15'],
		['=WEEKOF([created], 21)', '2026-11-16'],
		['=WEEKOF([created], 3)', '#NUM!'],
		['=WEEKOF([created], 0)', '#NUM!'],
		['=MONTHOF([created])', '2026-11-01'],
		['=QUARTEROF([created])', '2026-10-01'],
		['=YEAROF([created])', '2026-01-01'],
		['=HOUROF([created])', '2026-11-21T12:00:00.000Z'],
	])('%s is %s', (formula, value) => {
		expect(iso(run(formula))).toBe(value)
	})

	test('WEEKOF of the day of the reference of Microsoft Excel starts where WEEKNUM does', () => {
		// WEEKNUM(2012-03-09) is 10 with type 1 and 11 with type 2: a Friday whose week starts on Sunday the 4th or Monday the 5th.
		const row = order(null, '2012-03-09')
		expect(run('=WEEKOF([day])', row)).toBe('2012-03-04')
		expect(run('=WEEKOF([day], 2)', row)).toBe('2012-03-05')
	})

	test('a week across a new year is one period, its first day', () => {
		expect(run('=WEEKOF([day], 2)', order(null, '2026-01-01'))).toBe('2025-12-29')
		expect(run('=WEEKOF([day], 2)', order(null, '2025-12-31'))).toBe('2025-12-29')
		expect(run('=WEEKOF([day], 2)', order(null, '2027-01-01'))).toBe('2026-12-28')
		expect(run('=WEEKOF([day])', order(null, '2027-01-01'))).toBe('2026-12-27')
	})

	test('a moment falls on the day of the clock of its zone, also at the edge of a month', () => {
		// 00:30 on the first of December in Helsinki is still November in UTC and in New York.
		const row = order(new Date('2026-11-30T22:30:00Z'))
		expect(run('=MONTHOF([created])', row)).toBe('2026-12-01')
		expect(run('=MONTHOF([york])', row)).toBe('2026-11-01')
		expect(run('=DAYOF([created])', row)).toBe('2026-12-01')
	})

	test('a day of 23 and of 25 hours is one day, and the hour that comes twice is two hours', () => {
		// Helsinki moves its clock on 2026-03-29 and 2026-10-25.
		for (const time of ['2026-03-28T22:30:00Z', '2026-03-29T20:59:59Z']) {
			expect(run('=DAYOF([created])', order(new Date(time)))).toBe('2026-03-29')
		}
		for (const time of ['2026-10-24T21:00:00Z', '2026-10-25T21:59:59Z']) {
			expect(run('=DAYOF([created])', order(new Date(time)))).toBe('2026-10-25')
		}
		const first = order(new Date('2026-10-25T00:30:00Z'))
		const second = order(new Date('2026-10-25T01:30:00Z'))
		expect(run('=HOUR([created])', first)).toBe(3)
		expect(run('=HOUR([created])', second)).toBe(3)
		expect(iso(run('=HOUROF([created])', first))).toBe('2026-10-25T00:00:00.000Z')
		expect(iso(run('=HOUROF([created])', second))).toBe('2026-10-25T01:00:00.000Z')
	})

	test('an hour in a zone with a part of an hour begins at its own minute', () => {
		const row = order(new Date('2026-06-01T10:20:00Z'))
		expect(run('=HOUR([kathmandu])', row)).toBe(16)
		expect(run('=MINUTE([kathmandu])', row)).toBe(5)
		expect(iso(run('=HOUROF([kathmandu])', row))).toBe('2026-06-01T10:15:00.000Z')
	})

	test('a day text has no zone, and a number is a moment only in a column of dates', () => {
		expect(run('=DAYOF([zoned])')).toBe('2026-11-21')
		expect(run('=DAYOF([day])')).toBe('2026-11-21')
		expect(run('=DAYOF([millis])')).toBe('2026-11-21')
		expect(run('=HOUR([millis])')).toBe(14)
		expect(run('=DAYOF([plain])')).toBe('#VALUE!')
		expect(run('=DAYOF([note])')).toBe('#VALUE!')
		expect(run('=DAYOF("2026-02-30")')).toBe('#VALUE!')
		expect(run('=DAYOF("2026-11-21T23:30:00Z")', ROW, HELSINKI)).toBe('2026-11-22')
		expect(run('=DAYOF("2026-11-21T23:30:00Z")', ROW, 'UTC')).toBe('2026-11-21')
	})

	test('a date that is no reference reads the zone of the formula', () => {
		const inner = '=DAYOF(DATEADD([created], 10, "hour"))'
		expect(run(inner, ROW, HELSINKI)).toBe('2026-11-22')
		expect(run(inner, ROW, 'America/New_York')).toBe('2026-11-21')
	})

	test('an empty date gives an empty cell, so rows without a date are one group', () => {
		const row = order(null, null)
		for (const name of ['DAYOF', 'WEEKOF', 'MONTHOF', 'YEAR', 'WEEKDAY', 'ISOWEEKNUM']) {
			expect(run(`=${name}([created])`, row)).toBeNull()
		}
	})

	test('a date is no number: `+` on a date is #VALUE!, use DATEADD and DAYS', () => {
		expect(run('=[created]+1')).toBe('#VALUE!')
		expect(run('=[day]+1')).toBe('#VALUE!')
	})
})

describe('the parts of a date', () => {
	test.each([
		['=YEAR([created])', 2026],
		['=QUARTER([created])', 4],
		['=MONTH([created])', 11],
		['=DAY([created])', 21],
		['=HOUR([created])', 14],
		['=MINUTE([created])', 5],
		['=HOUR([day])', 0],
		// 2026-11-21 is a Saturday.
		['=WEEKDAY([created])', 7],
		['=WEEKDAY([created], 2)', 6],
		['=WEEKDAY([created], 3)', 5],
		['=WEEKDAY([created], 16)', 1],
		['=WEEKDAY([created], 4)', '#NUM!'],
		['=MONTH([created])=11', true],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})

	test('WEEKDAY gives what the reference of Microsoft Excel gives for 2008-02-14, a Thursday', () => {
		const row = order(null, '2008-02-14')
		expect(run('=WEEKDAY([day])', row)).toBe(5)
		expect(run('=WEEKDAY([day], 2)', row)).toBe(4)
		expect(run('=WEEKDAY([day], 3)', row)).toBe(3)
		const types = [11, 12, 13, 14, 15, 16, 17].map((type) => run(`=WEEKDAY([day], ${type})`, row))
		expect(types).toEqual([4, 3, 2, 1, 7, 6, 5])
	})

	test.each([
		['2012-03-09', 10, 2012],
		['2024-12-30', 1, 2025],
		['2025-12-28', 52, 2025],
		['2025-12-29', 1, 2026],
		['2026-01-01', 1, 2026],
		['2026-12-31', 53, 2026],
		['2027-01-01', 53, 2026],
		['2027-01-03', 53, 2026],
		['2027-01-04', 1, 2027],
		['2021-01-03', 53, 2020],
		['2020-12-31', 53, 2020],
	])('ISOWEEKNUM and ISOYEAR of %s are %s and %s', (day, week, year) => {
		const row = order(null, day)
		expect(run('=ISOWEEKNUM([day])', row)).toBe(week)
		expect(run('=ISOYEAR([day])', row)).toBe(year)
	})
})

describe('the arithmetic of dates', () => {
	test.each([
		['=DATE(2008, 1, 2)', '2008-01-02'],
		['=DATE(2008, 14, 2)', '2009-02-02'],
		['=DATE(2008, -3, 2)', '2007-09-02'],
		['=DATE(2008, 1, 35)', '2008-02-04'],
		['=DATE(2008, 1, -15)', '2007-12-16'],
		['=DATE(108, 1, 2)', '2008-01-02'],
		['=DATE(2024, 3, 0)', '2024-02-29'],
		['=DATE(10000, 1, 1)', '#NUM!'],
		['=DATE(-1, 1, 1)', '#NUM!'],
		['=DATE(1900, 1, 0)', '#NUM!'],
		['=DAYS("2021-03-15", "2021-02-01")', 42],
		['=DAYS("2021-02-01", "2021-03-15")', -42],
		['=DAYS(DATE(2026, 12, 25), [created])', 34],
		['=DATEADD("2026-01-31", 1, "month")', '2026-02-28'],
		['=DATEADD("2024-01-31", 1, "month")', '2024-02-29'],
		['=DATEADD("2026-11-21", -2, "week")', '2026-11-07'],
		['=DATEADD("2026-11-21", 1, "quarter")', '2027-02-21'],
		['=DATEADD("2026-11-21", 1, "Year")', '2027-11-21'],
		['=DATEADD("2026-11-21", 1, "fortnight")', '#VALUE!'],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})

	test('DATEADD keeps the clock of a moment across a change of the clock, and an hour is an hour', () => {
		// Noon in Helsinki on 2026-03-28 (+2) and on the 29th (+3).
		const row = order(new Date('2026-03-28T10:00:00Z'))
		expect(iso(run('=DATEADD([created], 1, "day")', row))).toBe('2026-03-29T09:00:00.000Z')
		expect(iso(run('=DATEADD([created], 24, "hour")', row))).toBe('2026-03-29T10:00:00.000Z')
		expect(iso(run('=DATEADD([created], 30, "minute")', row))).toBe('2026-03-28T10:30:00.000Z')
	})
})

describe('the format of a period', () => {
	const text = (value: unknown, options: FormatOptions<'period'>, locale = 'en-US') =>
		formatValue(value, 'period', options, { locale }).replace(/[\u2009\u202f\u00a0]/g, ' ')

	test.each([
		['day', '2026-11-21', 'Nov 21, 2026', '21.11.2026'],
		['week', '2026-11-16', 'Nov 16 – 22, 2026', '16.–22.11.2026'],
		['week', '2025-12-29', 'Dec 29, 2025 – Jan 4, 2026', '29.12.2025–4.1.2026'],
		['month', '2026-11-01', 'November 2026', 'marraskuu 2026'],
		['quarter', '2026-10-01', 'Q4 2026', 'Q4 2026'],
		['year', '2026-01-01', '2026', '2026'],
	] as const)('the text of a %s %s', (unit, value, english, finnish) => {
		expect(text(value, { unit })).toBe(english)
		expect(text(value, { unit }, 'fi-FI')).toBe(finnish)
	})

	test('an hour shows in its zone, a weekday follows the type of WEEKDAY, and a quarter takes a label', () => {
		const hour = new Date('2026-11-21T12:00:00Z')
		expect(text(hour, { unit: 'hour', timeZone: HELSINKI })).toBe('Nov 21, 2026, 2:00 PM')
		expect(text(hour, { unit: 'hour', timeZone: HELSINKI }, 'fi-FI')).toBe('21.11.2026 klo 14.00')
		expect(text(1, { unit: 'weekday' })).toBe('Sunday')
		expect(text(1, { unit: 'weekday', weekdays: 2 })).toBe('Monday')
		expect(text(0, { unit: 'weekday', weekdays: 3 })).toBe('Monday')
		expect(text(1, { unit: 'weekday', weekdays: 12 })).toBe('Tuesday')
		expect(text(7, { unit: 'weekday', weekdays: 2 }, 'fi-FI')).toBe('sunnuntai')
		expect(text(8, { unit: 'weekday' })).toBe('')
		const quarter = formatValue(
			'2026-04-01',
			'period',
			{ unit: 'quarter' },
			{
				locale: 'fi-FI',
				labels: { quarter: '{quarter}. neljännes {year}' },
			},
		)
		expect(quarter).toBe('2. neljännes 2026')
		expect(text('not a day', { unit: 'month', invalidValue: '?' })).toBe('?')
	})

	test('the value of a period is the same in every locale, and only its text differs', () => {
		const week = formulaColumn({ id: 'week', formula: '=WEEKOF([created], 2)' }, columns)
		const value = week.value?.(ROW)
		expect(value).toBe('2026-11-16')
		const texts = ['en-US', 'fi-FI', 'ar-EG'].map((locale) =>
			formatValue(value, 'period', { unit: 'week' }, { locale }),
		)
		expect(new Set(texts).size).toBe(3)
		// The default week starts on Sunday in every locale too.
		expect(formulaColumn({ id: 'week', formula: '=WEEKOF([created])' }, columns).value?.(ROW)).toBe(
			'2026-11-15',
		)
	})
})

describe('the format that a formula gives its column', () => {
	const shows = (formula: string) => formulaShows(formula, columns, undefined)
	test.each<[string, { format: FormatName; formatOptions: object } | undefined]>([
		['=WEEKOF([created], 2)', { format: 'period', formatOptions: { unit: 'week' } }],
		['=(MONTHOF([created]))', { format: 'period', formatOptions: { unit: 'month' } }],
		[
			'=HOUROF([created])',
			{ format: 'period', formatOptions: { unit: 'hour', timeZone: HELSINKI } },
		],
		[
			'=WEEKDAY([created], 2)',
			{ format: 'period', formatOptions: { unit: 'weekday', weekdays: 2 } },
		],
		['=WEEKDAY([created])', { format: 'period', formatOptions: { unit: 'weekday', weekdays: 1 } }],
		['=WEEKDAY([created], [plain])', undefined],
		[
			'=IF([plain]>1, MONTHOF([created]), MONTHOF([day]))',
			{ format: 'period', formatOptions: { unit: 'month' } },
		],
		['=IF([plain]>1, MONTHOF([created]), YEAROF([day]))', undefined],
		['=IF([plain]>1, MONTHOF([created]))', undefined],
		[
			'=IFS([plain]>1, YEAROF([created]), TRUE, YEAROF([day]))',
			{ format: 'period', formatOptions: { unit: 'year' } },
		],
		[
			'=SWITCH([plain], 1, DAYOF([day]), DAYOF([created]))',
			{ format: 'period', formatOptions: { unit: 'day' } },
		],
		['=SWITCH([plain], 1, DAYOF([day]), 2)', undefined],
		['=YEAR([created])', undefined],
	])('%s', (formula, expected) => {
		expect(shows(formula)).toEqual(expected)
	})

	test('a column gets the format, and a format of its definition wins', () => {
		const month = formulaColumn({ id: 'month', formula: '=MONTHOF([created])' }, columns)
		expect(month).toMatchObject({ format: 'period', formatOptions: { unit: 'month' } })
		const own = formulaColumn(
			{ id: 'month', formula: '=MONTHOF([created])', format: 'date' },
			columns,
		)
		expect(own.format).toBe('date')
		expect(own.formatOptions).toBeUndefined()
	})
})

describe('the clock of a zone kept by day', () => {
	test('agrees with the clock of the table to the second, in 10 zones from 1970 to 2040', () => {
		const zones = [
			HELSINKI,
			'America/New_York',
			'Australia/Lord_Howe',
			'Asia/Kathmandu',
			'America/Sao_Paulo',
			'Pacific/Apia',
			'Africa/Casablanca',
			'Asia/Tehran',
			'Antarctica/Troll',
			'America/St_Johns',
		]
		let wrong = 0
		let checked = 0
		for (const zone of zones) {
			const kept = zoneClockOf(zone)
			// A step of a little under 5 hours meets every hour of the day over the years.
			for (
				let time = Date.UTC(1970, 0, 1);
				time < Date.UTC(2040, 0, 1);
				time += 17_999_000 + 13_000
			) {
				checked++
				const second = Math.floor(time / 1000) * 1000
				if (kept(time) !== zoneClock(second, zone)) wrong++
			}
		}
		expect(checked).toBeGreaterThan(1_200_000)
		expect(wrong).toBe(0)
	}, 120_000)
})
