export type FormatName =
	| 'integer'
	| 'decimal'
	| 'number'
	| 'currency'
	| 'percentage'
	| 'date'
	| 'time'
	| 'datetime'
	| 'url'
	| 'email'
	| 'boolean'
	| 'truncate'
	| 'relativeTime'
	| 'period'
	| 'text'

export interface CommonFormatOptions {
	/** The text for `null`. Defaults to an empty text. */
	nullValue?: string
	/** The text for `undefined`. Defaults to an empty text. */
	undefinedValue?: string
	/** The text for an empty text. Defaults to an empty text. */
	emptyValue?: string
	/** The text for a value that the format cannot read. Defaults to an empty text. */
	invalidValue?: string
	/** Text before the formatted value. */
	prefix?: string
	/** Text after the formatted value. */
	suffix?: string
	/** Overrides `FormatContext.locale` for this column. */
	locale?: string
}

export type RoundingMode = 'ceil' | 'floor' | 'round' | 'trunc'

export interface NumberFormatOptions extends CommonFormatOptions {
	/** How a number rounds: `round` (half away from zero), `ceil`, `floor` or `trunc`. */
	roundingMode?: RoundingMode
	/** A factor that the value is multiplied by before it is shown. 0 changes nothing. */
	multiplier?: number
	/** The `style` of `Intl.NumberFormat` for `integer`, `decimal` and `number`. Defaults to `decimal`. */
	style?: 'decimal' | 'percent' | 'currency' | 'unit'
	/** The `notation` of `Intl.NumberFormat`, such as `compact` for 1.2K. */
	notation?: 'standard' | 'scientific' | 'engineering' | 'compact'
	/** With `notation: 'compact'`: `short` (1.2K) or `long` (1.2 thousand). */
	compactDisplay?: 'short' | 'long'
	/** Whether thousands are grouped, as in 1,000. Defaults to true. */
	useGrouping?: boolean
	/** The fewest digits before the decimal sign, filled with zeros. */
	minimumIntegerDigits?: number
	/** The fewest decimals. Defaults to 2 for `decimal`, `number` and `currency`, and 0 for `percentage`. `integer` shows none. */
	minimumFractionDigits?: number
	/** The most decimals. Defaults to 2 for `decimal`, `number` and `currency`, and 0 for `percentage`, or the minimum when it is larger. */
	maximumFractionDigits?: number
	/** The fewest significant digits, as in `Intl.NumberFormat`. */
	minimumSignificantDigits?: number
	/** The most significant digits, as in `Intl.NumberFormat`. */
	maximumSignificantDigits?: number
}

export interface CurrencyFormatOptions extends NumberFormatOptions {
	/** The currency as an ISO 4217 code, such as `USD`. Defaults to `EUR` with `showUnit`. */
	currency?: string
	/** How the currency shows with `showUnit`: `symbol` (the default), `code`, `name` or `narrowSymbol`. */
	currencyDisplay?: 'symbol' | 'code' | 'name' | 'narrowSymbol'
	/** `accounting` writes a negative amount in parentheses where the locale does so. */
	currencySign?: 'standard' | 'accounting'
	/** Without it the value is formatted as a plain decimal. */
	showUnit?: boolean
}

export interface PercentageFormatOptions extends NumberFormatOptions {
	/** `'fraction'` (default) reads 0.25 as 25 %; `'percent'` reads 25 as 25 %. */
	scale?: 'fraction' | 'percent'
	/** Without it the value is formatted without the % sign. */
	showUnit?: boolean
}

export interface DateFormatOptions extends CommonFormatOptions {
	/** The length of the date, as in `Intl.DateTimeFormat`. Defaults to `medium` when no field of the date is set. */
	dateStyle?: 'full' | 'long' | 'medium' | 'short'
	/** The length of the time, as in `Intl.DateTimeFormat`. Defaults to `short` when no field of the time is set. */
	timeStyle?: 'full' | 'long' | 'medium' | 'short'
	/** The weekday, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`. */
	weekday?: 'long' | 'short' | 'narrow'
	/** The year, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`. */
	year?: 'numeric' | '2-digit'
	/** The month, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`. */
	month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
	/** The day, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`. */
	day?: 'numeric' | '2-digit'
	/** The hour, as in `Intl.DateTimeFormat`. A field wins over `timeStyle`. */
	hour?: 'numeric' | '2-digit'
	/** The minute, as in `Intl.DateTimeFormat`. A field wins over `timeStyle`. */
	minute?: 'numeric' | '2-digit'
	/** The second, as in `Intl.DateTimeFormat`. A field wins over `timeStyle`. */
	second?: 'numeric' | '2-digit'
	/** Whether the clock has 12 hours. Without it, the locale decides. */
	hour12?: boolean
	/** The zone of the clock that a moment shows in, such as `Europe/Paris`. A `YYYY-MM-DD` value is a day and shows that day in every zone. Without it, local time. */
	timeZone?: string
	/** Writes the name of the zone after the time. */
	timeZoneName?: 'long' | 'short'
}

export type RelativeTimeUnit =
	| 'year'
	| 'quarter'
	| 'month'
	| 'week'
	| 'day'
	| 'hour'
	| 'minute'
	| 'second'

export interface RelativeTimeFormatOptions extends CommonFormatOptions {
	/** As in `Intl.RelativeTimeFormat`. Defaults to `best fit`. */
	localeMatcher?: 'best fit' | 'lookup'
	/** `auto` writes "yesterday" for -1 day; `always` (the default) writes "1 day ago". */
	numeric?: 'always' | 'auto'
	/** The length of the words: `long` (the default), `short` or `narrow`. */
	style?: 'long' | 'short' | 'narrow'
	/** The unit of the difference. Defaults to `day`. */
	unit?: RelativeTimeUnit
	/** When false the value is already a difference in `unit`, not a point in time. */
	calculateDifference?: boolean
	/** Writes the first letter as a capital. */
	capitalize?: boolean
	/** The moment differences are measured from. Defaults to the current time. */
	now?: number | Date
}

export interface UrlFormatOptions extends CommonFormatOptions {
	/** One address for every cell, in place of the value. */
	url?: string
	/** One text for every cell, in place of the value. */
	text?: string
	/** Whether the link opens in a new tab. Defaults to false. */
	openInNewTab?: boolean
	/** `true` adds a bare `download` attribute; a string names the file. */
	download?: boolean | string
	/** The address of the cell, from its row. */
	urlSelector?: (row: unknown) => string
	/** The text of the cell, from its row. */
	textSelector?: (row: unknown) => string
	/** More attributes of the link. A name that is no valid attribute name is left out. */
	attributes?: Record<string, string>
}

export interface EmailFormatOptions extends CommonFormatOptions {
	/** Whether `linkOf` gives a `mailto:` link for the cell. */
	asLink?: boolean
	/** Shows the address without its domain, as `ada@...`. */
	maskDomain?: boolean
	/** The text of the cell, from its row. */
	textSelector?: (row: unknown) => string
}

export interface BooleanFormatOptions extends CommonFormatOptions {
	/** The text for a true value. Defaults to `Yes`. */
	trueValue?: string
	/** The text for a false value. Defaults to `No`. */
	falseValue?: string
}

export interface TruncateFormatOptions extends CommonFormatOptions {
	/** Maximum number of characters kept; unset or 0 keeps the whole text. */
	truncate?: number
	/** The text after a cut text. Defaults to `...`. */
	truncateSuffix?: string
}

export type PeriodUnit = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'weekday'

export interface PeriodFormatOptions extends CommonFormatOptions {
	/** Which period the value is: the first day of a day, week, month, quarter or year, the moment of an hour, or a number of a day of the week. Defaults to `day`. */
	unit?: PeriodUnit
	/** With `unit: 'weekday'`: the type of `WEEKDAY` that gave the number, 1 (Sunday is 1, the default), 2 (Monday is 1), 3 (Monday is 0) or 11 to 17. */
	weekdays?: number
	/** With `unit: 'hour'`: the zone of the clock that the hour is shown in. */
	timeZone?: string
}

export interface FormatOptionsByName {
	integer: NumberFormatOptions
	decimal: NumberFormatOptions
	number: NumberFormatOptions
	currency: CurrencyFormatOptions
	percentage: PercentageFormatOptions
	date: DateFormatOptions
	time: DateFormatOptions
	datetime: DateFormatOptions
	url: UrlFormatOptions
	email: EmailFormatOptions
	boolean: BooleanFormatOptions
	truncate: TruncateFormatOptions
	relativeTime: RelativeTimeFormatOptions
	period: PeriodFormatOptions
	text: CommonFormatOptions
}

export type FormatOptions<N extends FormatName = FormatName> = FormatOptionsByName[N]

/** Per-format defaults, the middle layer of `mergeFormatOptions`. */
export type FormatDefaults = { [N in FormatName]?: FormatOptionsByName[N] }

/** Every word a formatter can emit on its own. */
export interface FormatLabels {
	booleanTrue: string
	booleanFalse: string
	/** The text of a quarter of the format `period`, with `{quarter}` and `{year}` in it: `Q{quarter} {year}`. */
	quarter: string
}

export interface FormatContext {
	locale?: string
	labels?: Partial<FormatLabels>
	/** The row the value came from; `urlSelector` and `textSelector` read it. */
	row?: unknown
}
