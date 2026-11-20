// Intl constructors are slow next to `format()`, and a table formats every cell of
// every visible row, so each distinct locale + options pair is built once. The set
// of pairs is bounded by the column configurations, so the caches are not evicted.
const numberFormats = new Map<string, Intl.NumberFormat>()
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>()
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>()

/** Same key for the same flat options regardless of property order; undefined values drop out. */
export function intlCacheKey(locale: string, options: object): string {
	return `${locale}|${JSON.stringify(options, Object.keys(options).sort())}`
}

export function getNumberFormat(
	locale: string,
	options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
	const key = intlCacheKey(locale, options)
	let format = numberFormats.get(key)
	if (!format) {
		format = new Intl.NumberFormat(locale, options)
		numberFormats.set(key, format)
	}
	return format
}

export function getDateTimeFormat(
	locale: string,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	const key = intlCacheKey(locale, options)
	let format = dateTimeFormats.get(key)
	if (!format) {
		format = new Intl.DateTimeFormat(locale, options)
		dateTimeFormats.set(key, format)
	}
	return format
}

export function getRelativeTimeFormat(
	locale: string,
	options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
	const key = intlCacheKey(locale, options)
	let format = relativeTimeFormats.get(key)
	if (!format) {
		format = new Intl.RelativeTimeFormat(locale, options)
		relativeTimeFormats.set(key, format)
	}
	return format
}
