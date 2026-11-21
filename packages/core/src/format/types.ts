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
	nullValue?: string
	undefinedValue?: string
	emptyValue?: string
	invalidValue?: string
	prefix?: string
	suffix?: string
	/** Overrides `FormatContext.locale` for this column. */
	locale?: string
}

export type RoundingMode = 'ceil' | 'floor' | 'round' | 'trunc'

export interface NumberFormatOptions extends CommonFormatOptions {
	roundingMode?: RoundingMode
	multiplier?: number
	style?: 'decimal' | 'percent' | 'currency' | 'unit'
	notation?: 'standard' | 'scientific' | 'engineering' | 'compact'
	compactDisplay?: 'short' | 'long'
	useGrouping?: boolean
	minimumIntegerDigits?: number
	minimumFractionDigits?: number
	maximumFractionDigits?: number
	minimumSignificantDigits?: number
	maximumSignificantDigits?: number
}

export interface CurrencyFormatOptions extends NumberFormatOptions {
	currency?: string
	currencyDisplay?: 'symbol' | 'code' | 'name' | 'narrowSymbol'
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
	dateStyle?: 'full' | 'long' | 'medium' | 'short'
	timeStyle?: 'full' | 'long' | 'medium' | 'short'
	weekday?: 'long' | 'short' | 'narrow'
	year?: 'numeric' | '2-digit'
	month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
	day?: 'numeric' | '2-digit'
	hour?: 'numeric' | '2-digit'
	minute?: 'numeric' | '2-digit'
	second?: 'numeric' | '2-digit'
	hour12?: boolean
	timeZone?: string
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
	localeMatcher?: 'best fit' | 'lookup'
	numeric?: 'always' | 'auto'
	style?: 'long' | 'short' | 'narrow'
	unit?: RelativeTimeUnit
	/** When false the value is already a difference in `unit`, not a point in time. */
	calculateDifference?: boolean
	capitalize?: boolean
	/** The moment differences are measured from. Defaults to the current time. */
	now?: number | Date
}

export interface UrlFormatOptions extends CommonFormatOptions {
	url?: string
	text?: string
	openInNewTab?: boolean
	/** `true` adds a bare `download` attribute; a string names the file. */
	download?: boolean | string
	urlSelector?: (row: unknown) => string
	textSelector?: (row: unknown) => string
	attributes?: Record<string, string>
}

export interface EmailFormatOptions extends CommonFormatOptions {
	asLink?: boolean
	maskDomain?: boolean
	textSelector?: (row: unknown) => string
}

export interface BooleanFormatOptions extends CommonFormatOptions {
	trueValue?: string
	falseValue?: string
}

export interface TruncateFormatOptions extends CommonFormatOptions {
	/** Maximum number of characters kept; unset or 0 keeps the whole text. */
	truncate?: number
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
