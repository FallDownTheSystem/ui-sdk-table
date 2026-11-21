import { getNumberFormat } from './intl'
import { INVALID, type PrepareFormatter } from './shared'
import type {
	CurrencyFormatOptions,
	FormatOptionsByName,
	NumberFormatOptions,
	PercentageFormatOptions,
	RoundingMode,
} from './types'

// Intl has no plain 'round'; half-away-from-zero is what Math.round users expect for display.
const intlRoundingModes: Record<RoundingMode, Intl.NumberFormatOptions['roundingMode']> = {
	ceil: 'ceil',
	floor: 'floor',
	round: 'halfExpand',
	trunc: 'trunc',
}

const roundingFunctions: Record<RoundingMode, (value: number) => number> = {
	ceil: Math.ceil,
	floor: Math.floor,
	round: Math.round,
	trunc: Math.trunc,
}

/**
 * Applies a default to whichever fraction bound is missing without crossing the one that is
 * given, since Intl throws when the minimum ends up above the maximum.
 */
function fractionDigits(
	defaultDigits: number,
	minimum: number | undefined,
	maximum: number | undefined,
): [number, number] {
	const min = minimum ?? (maximum === undefined ? defaultDigits : Math.min(defaultDigits, maximum))
	return [min, maximum ?? Math.max(defaultDigits, min)]
}

function intlNumberOptions(
	options: NumberFormatOptions,
	style: Intl.NumberFormatOptions['style'],
	minimumFractionDigits: number | undefined,
	maximumFractionDigits: number | undefined,
): Intl.NumberFormatOptions {
	return {
		style,
		useGrouping: options.useGrouping !== false,
		minimumIntegerDigits: options.minimumIntegerDigits,
		minimumFractionDigits,
		maximumFractionDigits,
		minimumSignificantDigits: options.minimumSignificantDigits,
		maximumSignificantDigits: options.maximumSignificantDigits,
		notation: options.notation,
		compactDisplay: options.compactDisplay,
		roundingMode: options.roundingMode ? intlRoundingModes[options.roundingMode] : undefined,
	}
}

function multiply(value: number, multiplier: number | undefined): number {
	return multiplier !== undefined && multiplier !== 0 ? value * multiplier : value
}

/**
 * How a number format writes a number: the Intl format, and what happens to the value
 * before it. The export reads the same plan, so a file and the screen agree.
 */
export type NumberPlan = { intl: Intl.NumberFormat; scale: (value: number) => number }

export type NumericFormatName = 'integer' | 'decimal' | 'number' | 'currency' | 'percentage'

function integerPlan(options: NumberFormatOptions, locale: string): NumberPlan {
	const intl = getNumberFormat(locale, intlNumberOptions(options, options.style ?? 'decimal', 0, 0))
	const round = options.roundingMode ? roundingFunctions[options.roundingMode] : undefined
	return {
		intl,
		scale: (value) => {
			const scaled = multiply(value, options.multiplier)
			// Plus zero: a small negative number rounds up to minus zero, which would show as "-0".
			return round ? round(scaled) + 0 : scaled
		},
	}
}

function decimalPlan(options: NumberFormatOptions, locale: string): NumberPlan {
	const [min, max] = fractionDigits(2, options.minimumFractionDigits, options.maximumFractionDigits)
	return {
		intl: getNumberFormat(locale, intlNumberOptions(options, options.style ?? 'decimal', min, max)),
		scale: (value) => multiply(value, options.multiplier),
	}
}

function currencyPlan(options: CurrencyFormatOptions, locale: string): NumberPlan {
	const [min, max] = fractionDigits(2, options.minimumFractionDigits, options.maximumFractionDigits)
	const intlOptions = options.showUnit
		? {
				...intlNumberOptions(options, 'currency', min, max),
				currency: options.currency || 'EUR',
				currencyDisplay: options.currencyDisplay ?? 'symbol',
				currencySign: options.currencySign,
			}
		: intlNumberOptions(options, 'decimal', min, max)
	return {
		intl: getNumberFormat(locale, intlOptions),
		scale: (value) => multiply(value, options.multiplier),
	}
}

function percentagePlan(options: PercentageFormatOptions, locale: string): NumberPlan {
	const fraction = options.scale !== 'percent'
	const showUnit = options.showUnit ?? false
	const [min, max] = fractionDigits(0, options.minimumFractionDigits, options.maximumFractionDigits)
	// Intl's percent style multiplies by 100 itself, so only the other two pairings need a factor.
	const factor = showUnit === fraction ? 1 : fraction ? 100 : 0.01
	return {
		intl: getNumberFormat(
			locale,
			intlNumberOptions(options, showUnit ? 'percent' : 'decimal', min, max),
		),
		scale: (value) => {
			const scaled = multiply(value, options.multiplier)
			// 0.285 * 100 is 28.499999999999996, which would round to 28 while Intl's own percent
			// scaling gives 29 %; dropping the last binary digits keeps both paths on the same digit.
			return factor === 1 ? scaled : Number((scaled * factor).toPrecision(15))
		},
	}
}

const plans: {
	[N in NumericFormatName]: (options: FormatOptionsByName[N], locale: string) => NumberPlan
} = {
	integer: integerPlan,
	decimal: decimalPlan,
	number: decimalPlan,
	currency: currencyPlan,
	percentage: percentagePlan,
}

/** The plan of a number format. It throws when Intl refuses the options, as the format does. */
export function numberPlan<N extends NumericFormatName>(
	name: N,
	options: FormatOptionsByName[N],
	locale: string,
): NumberPlan {
	return plans[name](options, locale)
}

/** The number that a number format reads from a cell value, or `undefined` when it reads none. */
export function readNumber(value: unknown): number | undefined {
	if (typeof value === 'number') return Number.isNaN(value) ? undefined : value
	if (typeof value !== 'string') return undefined
	// Number() rather than parseFloat: '1,234.5' or '12abc' must not show as 1 or 12.
	const text = value.trim()
	if (text === '') return undefined
	const parsed = Number(text)
	return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Numbers and numeric strings go through the plan; any other type is shown as its string
 * form, since a cell holding an unexpected type is more useful visible than blank.
 */
function prepare<Options>(
	plan: (options: Options, locale: string) => NumberPlan,
): PrepareFormatter<Options> {
	return (options, locale) => {
		const { intl, scale } = plan(options, locale)
		return (value) => {
			if (typeof value !== 'number' && typeof value !== 'string') return String(value)
			const parsed = readNumber(value)
			return parsed === undefined ? INVALID : intl.format(scale(parsed))
		}
	}
}

export const integer = prepare(integerPlan)
export const decimal = prepare(decimalPlan)
export const currency = prepare(currencyPlan)
export const percentage = prepare(percentagePlan)
