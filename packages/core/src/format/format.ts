import { date, datetime, time } from './date'
import { currency, decimal, integer, percentage } from './number'
import { relativeTime } from './relative-time'
import { INVALID, type CellFormatter, type PrepareFormatter } from './shared'
import { boolean, email, text, truncate, url } from './special'
import type { CommonFormatOptions, FormatContext, FormatName, FormatOptionsByName } from './types'

const formatters: { [N in FormatName]: PrepareFormatter<FormatOptionsByName[N]> } = {
	integer,
	decimal,
	number: decimal,
	currency,
	percentage,
	date,
	time,
	datetime,
	url,
	email,
	boolean,
	truncate,
	relativeTime,
	text,
}

const numericFormats: ReadonlySet<FormatName> = new Set([
	'integer',
	'decimal',
	'number',
	'currency',
	'percentage',
])

export const DEFAULT_LOCALE = 'en-US'

/** True for formats whose cells hold numbers, which tables align to the end. */
export function isNumericFormat(name: FormatName): boolean {
	return numericFormats.has(name)
}

interface Prepared {
	name: FormatName
	locale: string
	format: CellFormatter
}

const alwaysInvalid: CellFormatter = () => INVALID

// Keyed by the options object itself, so a column that passes the same object for every cell
// resolves its Intl instances once and the hot path allocates nothing. Options are therefore
// treated as immutable once used; pass a new object to change them.
const prepared = new WeakMap<object, Prepared[]>()
const NO_OPTIONS: CommonFormatOptions = Object.freeze({})

function resolve<N extends FormatName>(
	name: N,
	options: FormatOptionsByName[N],
	locale: string,
): CellFormatter {
	let entries = prepared.get(options)
	if (!entries) {
		entries = []
		prepared.set(options, entries)
	}
	for (const entry of entries) {
		if (entry.name === name && entry.locale === locale) return entry.format
	}
	let format: CellFormatter
	try {
		format = formatters[name](options, locale)
	} catch {
		// Options Intl rejects (an unknown currency code, a style mixed with fields) fail every cell.
		format = alwaysInvalid
	}
	entries.push({ name, locale, format })
	return format
}

/**
 * Formats one value for display. `null`, `undefined` and `''` show `nullValue`,
 * `undefinedValue` and `emptyValue`; a value the format cannot read shows `invalidValue`;
 * all default to an empty string. The locale is `options.locale`, then `context.locale`,
 * then `'en-US'`. The result is always plain text; `linkOf` gives the link of a `url` or
 * `email` cell.
 */
export function formatValue<N extends FormatName>(
	value: unknown,
	name: N,
	options?: FormatOptionsByName[N],
	context?: FormatContext,
): string {
	const resolvedOptions: CommonFormatOptions = options ?? NO_OPTIONS
	if (value === null) return resolvedOptions.nullValue ?? ''
	if (value === undefined) return resolvedOptions.undefinedValue ?? ''
	if (value === '') return resolvedOptions.emptyValue ?? ''

	// A name outside the union can still arrive from untyped column config.
	if (!Object.hasOwn(formatters, name)) return formatValue(value, 'text', options, context)

	const locale = resolvedOptions.locale ?? context?.locale ?? DEFAULT_LOCALE
	let formatted: string | typeof INVALID
	try {
		formatted = resolve(name, options ?? NO_OPTIONS, locale)(value, context)
	} catch {
		formatted = INVALID
	}
	if (formatted === INVALID) return resolvedOptions.invalidValue ?? ''

	const { prefix, suffix } = resolvedOptions
	if (!prefix && !suffix) return formatted
	return `${prefix ?? ''}${formatted}${suffix ?? ''}`
}

const tableLevelKeys = [
	'nullValue',
	'undefinedValue',
	'emptyValue',
	'invalidValue',
	'locale',
] as const satisfies readonly (keyof CommonFormatOptions)[]

/**
 * Merges the three option layers of a column: the table's fallback texts and locale, then the
 * defaults for the column's format, then the column's own options. Later layers win; an
 * `undefined` value does not override. Call it once per column, not per cell, and pass the
 * result to `formatValue` every time so its prepared Intl instances are reused.
 */
export function mergeFormatOptions<N extends FormatName>(
	tableDefaults: CommonFormatOptions | undefined,
	perTypeDefaults: FormatOptionsByName[N] | undefined,
	columnOptions: FormatOptionsByName[N] | undefined,
): FormatOptionsByName[N] {
	const merged: Record<string, unknown> = {}
	if (tableDefaults) {
		for (const key of tableLevelKeys) {
			if (tableDefaults[key] !== undefined) merged[key] = tableDefaults[key]
		}
	}
	for (const layer of [perTypeDefaults, columnOptions]) {
		if (!layer) continue
		for (const [key, value] of Object.entries(layer)) {
			if (value !== undefined) merged[key] = value
		}
	}
	return merged
}
