import { getNumberFormat } from './intl'
import { INVALID, type CellFormatter, type PrepareFormatter } from './shared'
import type {
	CurrencyFormatOptions,
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
 * Numbers and numeric strings go through `compute`; any other type is shown as its string
 * form, since a cell holding an unexpected type is more useful visible than blank.
 */
function numericFormatter(compute: (value: number) => string): CellFormatter {
	return (value) => {
		if (typeof value !== 'number' && typeof value !== 'string') return String(value)
		// Number() rather than parseFloat: '1,234.5' or '12abc' must not show as 1 or 12.
		let parsed = value
		if (typeof value === 'string') {
			const text = value.trim()
			if (text === '') return INVALID
			parsed = Number(text)
		}
		if (typeof parsed !== 'number' || Number.isNaN(parsed)) return INVALID
		return compute(parsed)
	}
}

export const integer: PrepareFormatter<NumberFormatOptions> = (options, locale) => {
	const format = getNumberFormat(
		locale,
		intlNumberOptions(options, options.style ?? 'decimal', 0, 0),
	)
	const round = options.roundingMode ? roundingFunctions[options.roundingMode] : undefined
	return numericFormatter((value) => {
		const scaled = multiply(value, options.multiplier)
		return format.format(round ? round(scaled) : scaled)
	})
}

export const decimal: PrepareFormatter<NumberFormatOptions> = (options, locale) => {
	const [min, max] = fractionDigits(2, options.minimumFractionDigits, options.maximumFractionDigits)
	const format = getNumberFormat(
		locale,
		intlNumberOptions(options, options.style ?? 'decimal', min, max),
	)
	return numericFormatter((value) => format.format(multiply(value, options.multiplier)))
}

export const currency: PrepareFormatter<CurrencyFormatOptions> = (options, locale) => {
	const [min, max] = fractionDigits(2, options.minimumFractionDigits, options.maximumFractionDigits)
	const intlOptions = options.showUnit
		? {
				...intlNumberOptions(options, 'currency', min, max),
				currency: options.currency || 'EUR',
				currencyDisplay: options.currencyDisplay ?? 'symbol',
				currencySign: options.currencySign,
			}
		: intlNumberOptions(options, 'decimal', min, max)
	const format = getNumberFormat(locale, intlOptions)
	return numericFormatter((value) => format.format(multiply(value, options.multiplier)))
}

export const percentage: PrepareFormatter<PercentageFormatOptions> = (options, locale) => {
	const fraction = options.scale !== 'percent'
	const showUnit = options.showUnit ?? false
	const [min, max] = fractionDigits(0, options.minimumFractionDigits, options.maximumFractionDigits)
	const format = getNumberFormat(
		locale,
		intlNumberOptions(options, showUnit ? 'percent' : 'decimal', min, max),
	)
	// Intl's percent style multiplies by 100 itself, so only the other two pairings need a factor.
	const factor = showUnit === fraction ? 1 : fraction ? 100 : 0.01
	return numericFormatter((value) => {
		const scaled = multiply(value, options.multiplier)
		// 0.285 * 100 is 28.499999999999996, which would round to 28 while Intl's own percent
		// scaling gives 29 %; dropping the last binary digits keeps both paths on the same digit.
		return format.format(factor === 1 ? scaled : Number((scaled * factor).toPrecision(15)))
	})
}
