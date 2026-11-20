import type { PrepareFormatter } from './shared'
import type {
	BooleanFormatOptions,
	CommonFormatOptions,
	EmailFormatOptions,
	FormatContext,
	TruncateFormatOptions,
	UrlFormatOptions,
} from './types'

export const DEFAULT_LABELS = {
	booleanTrue: 'Yes',
	booleanFalse: 'No',
} as const

/** What a renderer needs to draw a link; every field is plain text, never markup. */
export interface FormatLink {
	href: string
	text: string
	newTab: boolean
	download?: string | true
	attributes?: Record<string, string>
}

// Schemes that run code when the link is followed.
const unsafeUrl = /^(?:javascript|vbscript|data):/i
const attributeName = /^[A-Za-z_:][-A-Za-z0-9_.:]*$/

// Browsers ignore whitespace and control characters inside a scheme, so they must not hide one.
function isSafeUrl(url: string): boolean {
	let visible = ''
	for (const char of url) {
		const code = char.charCodeAt(0)
		if (code > 0x20 && code !== 0x7f) visible += char
		if (visible.length > 11) break
	}
	return !unsafeUrl.test(visible)
}

function urlHref(value: unknown, options: UrlFormatOptions, row: unknown): string {
	return row && options.urlSelector ? options.urlSelector(row) || '' : options.url || String(value)
}

function urlText(value: unknown, options: UrlFormatOptions, row: unknown): string {
	return row && options.textSelector
		? options.textSelector(row) || ''
		: options.text || String(value)
}

function emailText(address: string, options: EmailFormatOptions, row: unknown): string {
	const selected = row && options.textSelector ? options.textSelector(row) || '' : ''
	if (selected) return selected
	const parts = address.split('@')
	return options.maskDomain && parts.length === 2 ? `${parts[0] ?? ''}@...` : address
}

// Attribute names come from column config; a malformed one would break the element a renderer builds.
const validAttributes = new WeakMap<Record<string, string>, Record<string, string>>()

function safeAttributes(attributes: Record<string, string>): Record<string, string> {
	let valid = validAttributes.get(attributes)
	if (!valid) {
		valid = {}
		for (const [name, value] of Object.entries(attributes)) {
			if (attributeName.test(name)) valid[name] = value
		}
		validAttributes.set(attributes, valid)
	}
	return valid
}

// Not a type guard on purpose: narrowing `unknown` to `{}` makes String() look like an object cast.
function isMissing(value: unknown): boolean {
	return value === null || value === undefined || value === ''
}

/**
 * The link for a `url` or `email` cell, or `null` when there is no safe target to link to
 * (and always for `email` without `asLink`). `text` is the same display text `formatValue`
 * returns, without prefix and suffix, which a renderer places outside the link.
 */
export function linkOf(
	value: unknown,
	name: 'url' | 'email',
	options?: UrlFormatOptions | EmailFormatOptions,
	context?: FormatContext,
): FormatLink | null {
	if (isMissing(value)) return null
	const row = context?.row
	try {
		if (name === 'email') {
			const emailOptions: EmailFormatOptions = options ?? {}
			if (!emailOptions.asLink) return null
			const address = String(value)
			return {
				href: `mailto:${address}`,
				text: emailText(address, emailOptions, row),
				newTab: false,
			}
		}
		const urlOptions: UrlFormatOptions = options ?? {}
		const href = urlHref(value, urlOptions, row)
		if (!href || !isSafeUrl(href)) return null
		const link: FormatLink = {
			href,
			text: urlText(value, urlOptions, row),
			newTab: urlOptions.openInNewTab ?? false,
		}
		if (typeof urlOptions.download === 'string') link.download = urlOptions.download
		else if (urlOptions.download) link.download = true
		if (urlOptions.attributes) link.attributes = safeAttributes(urlOptions.attributes)
		return link
	} catch {
		return null
	}
}

export const url: PrepareFormatter<UrlFormatOptions> = (options) => (value, context) =>
	urlText(value, options, context?.row)

export const email: PrepareFormatter<EmailFormatOptions> = (options) => (value, context) =>
	emailText(String(value), options, context?.row)

// Text that spells "no" is a common export of booleans from CSV and form data.
const falseWords: ReadonlySet<string> = new Set(['false', '0', 'no', 'off', ''])

function isTrue(value: unknown): boolean {
	return typeof value === 'string' ? !falseWords.has(value.trim().toLowerCase()) : Boolean(value)
}

export const boolean: PrepareFormatter<BooleanFormatOptions> = (options) => (value, context) =>
	isTrue(value)
		? options.trueValue || context?.labels?.booleanTrue || DEFAULT_LABELS.booleanTrue
		: options.falseValue || context?.labels?.booleanFalse || DEFAULT_LABELS.booleanFalse

export const truncate: PrepareFormatter<TruncateFormatOptions> = (options) => (value) => {
	const text = String(value)
	const length = options.truncate
	if (!length || text.length <= length) return text
	return text.substring(0, length) + (options.truncateSuffix || '...')
}

export const text: PrepareFormatter<CommonFormatOptions> = () => (value) => String(value)
