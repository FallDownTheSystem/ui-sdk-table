import { describe, expect, test } from 'vite-plus/test'
import { getDateTimeFormat, getNumberFormat, getRelativeTimeFormat, intlCacheKey } from './intl'
import {
	formatValue,
	linkOf,
	isNumericFormat,
	mergeFormatOptions,
	type FormatName,
	type FormatOptionsByName,
} from './index'

// Intl separates digit groups and time parts with no-break spaces and writes U+2212 for minus.
function plain(text: string): string {
	return text.replace(/\s/g, ' ').replace(/−/g, '-')
}

const fallbacks = {
	nullValue: 'null',
	undefinedValue: 'undef',
	emptyValue: 'empty',
	invalidValue: 'invalid',
}

const MOMENT = '2025-03-21T12:34:56Z'
const NOW = Date.parse(MOMENT)
const UTC = { timeZone: 'UTC' } as const

describe('missing values', () => {
	const names: FormatName[] = [
		'integer',
		'decimal',
		'number',
		'currency',
		'percentage',
		'date',
		'time',
		'datetime',
		'url',
		'email',
		'boolean',
		'truncate',
		'relativeTime',
		'text',
	]

	test.each(names)('%s shows the fallback texts, without prefix or suffix', (name) => {
		const options = { ...fallbacks, prefix: '<', suffix: '>' }
		expect(formatValue(null, name, options)).toBe('null')
		expect(formatValue(undefined, name, options)).toBe('undef')
		expect(formatValue('', name, options)).toBe('empty')
	})

	test.each(names)('%s defaults the fallback texts to empty', (name) => {
		expect(formatValue(null, name)).toBe('')
		expect(formatValue(undefined, name)).toBe('')
		expect(formatValue('', name)).toBe('')
	})
})

describe('integer', () => {
	test('rounds and groups', () => {
		expect(formatValue(1234.6, 'integer')).toBe('1,235')
		expect(formatValue('42.2', 'integer')).toBe('42')
	})

	test('applies multiplier then rounding mode', () => {
		expect(formatValue(1.21, 'integer', { multiplier: 10, roundingMode: 'floor' })).toBe('12')
		expect(formatValue(2.5, 'integer', { roundingMode: 'round' })).toBe('3')
		expect(formatValue(2.1, 'integer', { roundingMode: 'ceil' })).toBe('3')
		expect(formatValue(1234, 'integer', { useGrouping: false })).toBe('1234')
	})

	test('invalid input shows invalidValue without decoration', () => {
		expect(formatValue('abc', 'integer', { ...fallbacks, prefix: '$' })).toBe('invalid')
		expect(formatValue('abc', 'integer')).toBe('')
	})

	test('a partly numeric string is invalid, not its leading number', () => {
		for (const name of ['integer', 'decimal', 'currency', 'percentage'] as const) {
			expect(formatValue('1,234.5', name, fallbacks)).toBe('invalid')
			expect(formatValue('12abc', name, fallbacks)).toBe('invalid')
			expect(formatValue('   ', name, fallbacks)).toBe('invalid')
		}
		expect(formatValue(' 12.5 ', 'decimal')).toBe('12.50')
	})

	test('a non-numeric type is shown as text', () => {
		expect(formatValue(true, 'integer')).toBe('true')
	})
})

describe('decimal and number', () => {
	test('defaults to two fraction digits', () => {
		expect(formatValue(1234.5, 'decimal')).toBe('1,234.50')
		expect(formatValue(1234.5, 'number')).toBe('1,234.50')
	})

	test('a single fraction bound does not cross the default', () => {
		expect(formatValue(1.567, 'decimal', { maximumFractionDigits: 0 })).toBe('2')
		expect(formatValue(1.5, 'decimal', { minimumFractionDigits: 3 })).toBe('1.500')
	})

	test('roundingMode reaches the fraction digits', () => {
		expect(formatValue(1.239, 'decimal', { roundingMode: 'floor' })).toBe('1.23')
		expect(formatValue(1.235, 'decimal', { roundingMode: 'round' })).toBe('1.24')
	})

	test('prefix, suffix and compact notation', () => {
		expect(formatValue(3, 'decimal', { prefix: '~', suffix: ' kg' })).toBe('~3.00 kg')
		expect(formatValue(1500, 'number', { notation: 'compact', maximumFractionDigits: 1 })).toBe(
			'1.5K',
		)
	})

	test('fi-FI', () => {
		expect(plain(formatValue(-1234.5, 'number', {}, { locale: 'fi-FI' }))).toBe('-1 234,50')
	})

	test('invalid input', () => {
		expect(formatValue('x', 'decimal', fallbacks)).toBe('invalid')
	})
})

describe('currency', () => {
	test('formats as a decimal unless showUnit is set', () => {
		expect(formatValue(1234.5, 'currency')).toBe('1,234.50')
		expect(formatValue(1234.5, 'currency', { showUnit: true })).toBe('€1,234.50')
	})

	test('currency options', () => {
		expect(
			formatValue(-1234.5, 'currency', {
				showUnit: true,
				currency: 'USD',
				currencySign: 'accounting',
			}),
		).toBe('($1,234.50)')
		expect(
			formatValue(5, 'currency', { showUnit: true, currency: 'USD', currencyDisplay: 'code' }),
		).toMatch(/^USD\s5\.00$/)
	})

	test('fi-FI', () => {
		expect(plain(formatValue(1234.5, 'currency', { showUnit: true }, { locale: 'fi-FI' }))).toBe(
			'1 234,50 €',
		)
	})

	test('an unknown currency code fails every cell', () => {
		const options = { ...fallbacks, showUnit: true, currency: 'not-a-code' }
		expect(formatValue(1, 'currency', options)).toBe('invalid')
		expect(formatValue(2, 'currency', options)).toBe('invalid')
	})
})

describe('percentage', () => {
	test('fraction scale, the default', () => {
		expect(formatValue(0.255, 'percentage')).toBe('26')
		expect(formatValue(0.255, 'percentage', { showUnit: true })).toBe('26%')
		expect(formatValue(15, 'percentage')).toBe('1,500')
		expect(formatValue(15, 'percentage', { showUnit: true })).toBe('1,500%')
		expect(formatValue(0.255, 'percentage', { maximumFractionDigits: 1 })).toBe('25.5')
	})

	test('both unit paths round the same way', () => {
		expect(formatValue(0.285, 'percentage')).toBe('29')
		expect(formatValue(0.285, 'percentage', { showUnit: true })).toBe('29%')
		expect(formatValue(28.5, 'percentage', { scale: 'percent', showUnit: true })).toBe('29%')
	})

	test('percent scale', () => {
		expect(formatValue(25, 'percentage', { scale: 'percent' })).toBe('25')
		expect(formatValue(25, 'percentage', { scale: 'percent', showUnit: true })).toBe('25%')
		expect(formatValue(0.5, 'percentage', { scale: 'percent', showUnit: true })).toBe('1%')
	})

	test('a minimum fraction bound raises the default maximum', () => {
		expect(formatValue(0.5, 'percentage', { minimumFractionDigits: 2 })).toBe('50.00')
	})

	test('invalid input', () => {
		expect(formatValue('x', 'percentage', fallbacks)).toBe('invalid')
	})
})

describe('date, time and datetime', () => {
	test('accepts a Date, an ISO string and a timestamp', () => {
		expect(formatValue(new Date(MOMENT), 'date', UTC)).toBe('Mar 21, 2025')
		expect(formatValue(MOMENT, 'date', UTC)).toBe('Mar 21, 2025')
		expect(formatValue(NOW, 'date', UTC)).toBe('Mar 21, 2025')
	})

	test('styles and fields', () => {
		expect(formatValue(MOMENT, 'date', { ...UTC, dateStyle: 'short' })).toBe('3/21/25')
		expect(formatValue(MOMENT, 'date', { ...UTC, year: 'numeric', month: 'long' })).toBe(
			'March 2025',
		)
		expect(plain(formatValue(MOMENT, 'time', UTC))).toBe('12:34 PM')
		expect(
			formatValue(MOMENT, 'time', { ...UTC, hour: '2-digit', minute: '2-digit', hour12: false }),
		).toBe('12:34')
		expect(plain(formatValue(MOMENT, 'datetime', UTC))).toBe('Mar 21, 2025, 12:34 PM')
	})

	test('fi-FI, with no "klo" between date and time', () => {
		const fi = { locale: 'fi-FI' }
		expect(formatValue(MOMENT, 'date', UTC, fi)).toBe('21.3.2025')
		expect(formatValue(MOMENT, 'time', UTC, fi)).toBe('12.34')
		expect(formatValue(MOMENT, 'datetime', UTC, fi)).toBe('21.3.2025 12.34')
	})

	test('the time zone applies to the date half of a Finnish datetime', () => {
		const late = '2025-03-21T23:30:00Z'
		expect(formatValue(late, 'datetime', { timeZone: 'Europe/Helsinki' }, { locale: 'fi' })).toBe(
			'22.3.2025 1.30',
		)
	})

	test('a date-only string names the same calendar day in any zone', () => {
		expect(formatValue('2025-03-21', 'date', { dateStyle: 'short' })).toBe('3/21/25')
		expect(formatValue('2025-03-21', 'date', { day: 'numeric' })).toBe('21')
		// A calendar day has no zone, so the column's timeZone must not move it to another day.
		for (const timeZone of ['UTC', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
			expect(formatValue('2025-03-21', 'date', { timeZone, dateStyle: 'short' })).toBe('3/21/25')
		}
		expect(
			plain(
				formatValue('2025-03-21', 'datetime', {
					timeZone: 'America/New_York',
					timeZoneName: undefined,
				}),
			),
		).toBe('Mar 21, 2025, 12:00 AM')
		expect(
			formatValue('2025-03-21', 'datetime', { timeZone: 'Asia/Tokyo' }, { locale: 'fi' }),
		).toBe('21.3.2025 0.00')
		expect(formatValue('2025-02-30x', 'date', fallbacks)).toBe('invalid')
	})

	test('datetime with fields on one side only fills the other side with fields', () => {
		expect(
			plain(
				formatValue(MOMENT, 'datetime', {
					...UTC,
					year: 'numeric',
					month: 'numeric',
					day: 'numeric',
				}),
			),
		).toBe('3/21/2025, 12:34 PM')
		expect(
			plain(formatValue(MOMENT, 'datetime', { ...UTC, hour: '2-digit', minute: '2-digit' })),
		).toBe('3/21/2025, 12:34 PM')
		expect(
			formatValue(
				MOMENT,
				'datetime',
				{ ...UTC, day: 'numeric', month: 'numeric' },
				{ locale: 'fi' },
			),
		).toBe('21.3. 12.34')
		expect(plain(formatValue(MOMENT, 'date', { ...UTC, hour: 'numeric' }))).toBe('3/21/2025, 12 PM')
		expect(formatValue(MOMENT, 'time', { ...UTC, day: 'numeric' })).not.toBe('')
	})

	test('invalid input', () => {
		for (const name of ['date', 'time', 'datetime'] as const) {
			expect(formatValue('not a date', name, fallbacks)).toBe('invalid')
			expect(formatValue(Number.NaN, name, fallbacks)).toBe('invalid')
			expect(formatValue(true, name, fallbacks)).toBe('invalid')
		}
	})

	test('options Intl rejects show invalidValue', () => {
		expect(formatValue(MOMENT, 'date', { ...fallbacks, timeZone: 'Nowhere/Nothing' })).toBe(
			'invalid',
		)
	})
})

describe('relativeTime', () => {
	const at = { now: NOW }

	test('measures from now in the chosen unit', () => {
		expect(formatValue(NOW - 3 * 86_400_000, 'relativeTime', at)).toBe('3 days ago')
		expect(
			formatValue(new Date(NOW + 2 * 3_600_000), 'relativeTime', { ...at, unit: 'hour' }),
		).toBe('in 2 hours')
		expect(formatValue('2025-03-14T12:34:56Z', 'relativeTime', { ...at, unit: 'week' })).toBe(
			'1 week ago',
		)
	})

	test('a date-only string is local midnight', () => {
		const now = new Date(2025, 2, 24).getTime()
		expect(formatValue('2025-03-21', 'relativeTime', { now })).toBe('3 days ago')
	})

	test('numbers and numeric strings are differences', () => {
		expect(formatValue(-1, 'relativeTime', { numeric: 'auto' })).toBe('yesterday')
		expect(formatValue('5', 'relativeTime', at)).toBe('in 5 days')
		expect(
			formatValue(NOW, 'relativeTime', {
				calculateDifference: false,
				unit: 'second',
				style: 'short',
			}),
		).not.toBe('')
	})

	test('style, capitalize and locale', () => {
		expect(formatValue(-1, 'relativeTime', { numeric: 'auto', capitalize: true })).toBe('Yesterday')
		expect(formatValue(2, 'relativeTime', { unit: 'month', style: 'short' })).toBe('in 2 mo.')
		expect(formatValue(-3, 'relativeTime', {}, { locale: 'fi-FI' })).toBe('3 päivää sitten')
	})

	test('invalid input', () => {
		expect(formatValue('soon', 'relativeTime', fallbacks)).toBe('invalid')
		expect(formatValue(new Date(Number.NaN), 'relativeTime', fallbacks)).toBe('invalid')
	})
})

describe('url', () => {
	test('formatValue returns the display text', () => {
		expect(formatValue('https://a.test', 'url')).toBe('https://a.test')
		expect(formatValue('https://a.test', 'url', { text: 'Site', prefix: '<' })).toBe('<Site')
		expect(formatValue('"><img src=x>', 'url')).toBe('"><img src=x>')
		expect(formatValue('javascript:alert(1)', 'url')).toBe('javascript:alert(1)')
	})

	test('linkOf describes the link', () => {
		expect(linkOf('https://a.test', 'url')).toEqual({
			href: 'https://a.test',
			text: 'https://a.test',
			newTab: false,
		})
		expect(
			linkOf('/f.csv', 'url', {
				text: 'Report',
				openInNewTab: true,
				download: 'report.csv',
				attributes: { class: 'x', 'bad name': 'y', 'data-id': '1' },
			}),
		).toEqual({
			href: '/f.csv',
			text: 'Report',
			newTab: true,
			download: 'report.csv',
			attributes: { class: 'x', 'data-id': '1' },
		})
		expect(linkOf('/f.csv', 'url', { download: true })?.download).toBe(true)
	})

	test('linkOf refuses script URLs and missing values', () => {
		expect(linkOf('javascript:alert(1)', 'url')).toBeNull()
		expect(linkOf(' java	script:alert(1)', 'url', { text: 'x' })).toBeNull()
		expect(linkOf('DATA:text/html,x', 'url')).toBeNull()
		expect(linkOf(null, 'url')).toBeNull()
		expect(linkOf('', 'url')).toBeNull()
	})

	test('selectors read the row from the context', () => {
		const options: FormatOptionsByName['url'] = {
			urlSelector: (row) => (row as { id: number }).id.toString(),
			textSelector: () => 'Open',
		}
		const context = { row: { id: 7 } }
		expect(formatValue('ignored', 'url', options, context)).toBe('Open')
		expect(linkOf('ignored', 'url', options, context)).toEqual({
			href: '7',
			text: 'Open',
			newTab: false,
		})
	})
})

describe('email', () => {
	test('plain, masked and selected text', () => {
		expect(formatValue('a@b.fi', 'email')).toBe('a@b.fi')
		expect(formatValue('a@b.fi', 'email', { maskDomain: true })).toBe('a@...')
		expect(formatValue('a@b.fi', 'email', { asLink: true })).toBe('a@b.fi')
		expect(formatValue('a@b.fi', 'email', { textSelector: () => 'Ann' }, { row: {} })).toBe('Ann')
		expect(formatValue('<i>@b', 'email')).toBe('<i>@b')
	})

	test('linkOf gives a mailto link only with asLink', () => {
		expect(linkOf('a@b.fi', 'email')).toBeNull()
		expect(linkOf('a@b.fi', 'email', { asLink: true, maskDomain: true })).toEqual({
			href: 'mailto:a@b.fi',
			text: 'a@...',
			newTab: false,
		})
	})
})

describe('boolean', () => {
	test('English defaults', () => {
		expect(formatValue(true, 'boolean')).toBe('Yes')
		expect(formatValue(0, 'boolean')).toBe('No')
		expect(formatValue('yes', 'boolean')).toBe('Yes')
	})

	test('strings that spell false', () => {
		for (const value of ['false', 'FALSE', ' False ', '0', 'no', 'Off', '  ']) {
			expect(formatValue(value, 'boolean')).toBe('No')
		}
		expect(formatValue('true', 'boolean')).toBe('Yes')
		expect(formatValue('nope', 'boolean')).toBe('Yes')
	})

	test('labels from the context, options win over labels', () => {
		const context = { labels: { booleanTrue: 'Kyllä', booleanFalse: 'Ei' } }
		expect(formatValue(true, 'boolean', {}, context)).toBe('Kyllä')
		expect(formatValue(false, 'boolean', {}, context)).toBe('Ei')
		expect(formatValue(true, 'boolean', { trueValue: '✓' }, context)).toBe('✓')
		expect(formatValue(false, 'boolean', {}, { labels: { booleanTrue: 'Y' } })).toBe('No')
	})
})

describe('truncate', () => {
	test('cuts at the length and appends the suffix', () => {
		expect(formatValue('abcdefgh', 'truncate', { truncate: 3 })).toBe('abc...')
		expect(formatValue('abcdefgh', 'truncate', { truncate: 3, truncateSuffix: '…' })).toBe('abc…')
		expect(formatValue('abc', 'truncate', { truncate: 3 })).toBe('abc')
		expect(formatValue('abcdefgh', 'truncate')).toBe('abcdefgh')
		expect(formatValue(0, 'truncate')).toBe('0')
	})
})

describe('text', () => {
	test('stringifies and decorates', () => {
		expect(formatValue('a', 'text', { prefix: '[', suffix: ']' })).toBe('[a]')
		expect(formatValue(5, 'text')).toBe('5')
	})

	test('an unknown name falls back to text', () => {
		const name = 'nope' as FormatName
		expect(formatValue(5, name, { suffix: '!' })).toBe('5!')
		expect(formatValue(5, 'toString' as FormatName)).toBe('5')
	})
})

describe('locale', () => {
	test('options.locale wins over the context, which wins over en-US', () => {
		expect(plain(formatValue(1.5, 'decimal', { locale: 'fi-FI' }, { locale: 'de-DE' }))).toBe(
			'1,50',
		)
		expect(formatValue(1234.5, 'decimal', {}, { locale: 'de-DE' })).toBe('1.234,50')
		expect(formatValue(1234.5, 'decimal')).toBe('1,234.50')
	})
})

describe('helpers', () => {
	test('isNumericFormat', () => {
		for (const name of ['integer', 'decimal', 'number', 'currency', 'percentage'] as const) {
			expect(isNumericFormat(name)).toBe(true)
		}
		expect(isNumericFormat('date')).toBe(false)
		expect(isNumericFormat('text')).toBe(false)
	})

	test('mergeFormatOptions layers table, type and column options', () => {
		const merged = mergeFormatOptions<'currency'>(
			{ nullValue: '-', locale: 'fi-FI', prefix: 'ignored' },
			{ showUnit: true, currency: 'USD', nullValue: 'n/a' },
			{ currency: 'SEK', showUnit: undefined },
		)
		expect(merged).toEqual({ nullValue: 'n/a', locale: 'fi-FI', showUnit: true, currency: 'SEK' })
		expect(mergeFormatOptions(undefined, undefined, undefined)).toEqual({})
	})
})

describe('Intl cache', () => {
	test('returns the same instance for the same locale and options in any key order', () => {
		const a = getNumberFormat('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 3 })
		const b = getNumberFormat('fi-FI', { maximumFractionDigits: 3, minimumFractionDigits: 1 })
		expect(b).toBe(a)
		expect(
			getNumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 }),
		).not.toBe(a)
		expect(getDateTimeFormat('fi-FI', { dateStyle: 'short' })).toBe(
			getDateTimeFormat('fi-FI', { dateStyle: 'short', timeZone: undefined }),
		)
		expect(getRelativeTimeFormat('en-US', { numeric: 'auto' })).toBe(
			getRelativeTimeFormat('en-US', { numeric: 'auto' }),
		)
		expect(intlCacheKey('en-US', { b: 1, a: 2, c: undefined })).toBe('en-US|{"a":2,"b":1}')
	})

	test('formatValue reuses one formatter for repeated calls with the same options object', () => {
		const options = { minimumFractionDigits: 4 }
		const first = formatValue(1, 'decimal', options)
		expect(formatValue(1, 'decimal', options)).toBe(first)
		expect(first).toBe('1.0000')
	})
})
