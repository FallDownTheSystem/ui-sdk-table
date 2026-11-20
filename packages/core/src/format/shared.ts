import type { FormatContext } from './types'

/** Returned by a formatter for a value it cannot format, so the caller shows `invalidValue`. */
export const INVALID: unique symbol = Symbol('invalid')
export type Invalid = typeof INVALID

/** Formats one non-empty value with options already resolved for one locale. */
export type CellFormatter = (value: unknown, context: FormatContext | undefined) => string | Invalid

/** Resolves options once per options object and locale; may throw on options Intl rejects. */
export type PrepareFormatter<O> = (options: O, locale: string) => CellFormatter
