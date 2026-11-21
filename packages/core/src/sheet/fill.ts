import { decimalsOf, roundTo } from '@ui-sdk/core/number'
import { toText } from '../rows'

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** A day as a count of days, or `undefined` for a text that is no day of the calendar. */
function dayNumber(value: unknown): number | undefined {
	const match = typeof value === 'string' ? DAY.exec(value) : null
	if (!match) return undefined
	const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	// `2026-02-30` is no day: the calendar would make it the second of March.
	return new Date(time).toISOString().slice(0, 10) === value ? time / DAY_MS : undefined
}

const dayText = (days: number) => new Date(days * DAY_MS).toISOString().slice(0, 10)

/** The step from each number to the next, when it is the same step everywhere. */
function oneStep(numbers: readonly number[], decimals: number): number | undefined {
	const [first, second] = numbers
	if (first === undefined || second === undefined) return undefined
	const step = roundTo(second - first, decimals)
	for (let index = 1; index < numbers.length; index++) {
		const before = numbers[index - 1]
		const now = numbers[index]
		if (before === undefined || now === undefined) return undefined
		if (roundTo(now - before, decimals) !== step) return undefined
	}
	return step
}

/** Every value as a number of one kind, or `undefined` when one of them is of another kind. */
function allOf<Kind>(
	source: readonly unknown[],
	read: (value: unknown) => Kind | undefined,
): Kind[] | undefined {
	const out: Kind[] = []
	for (const value of source) {
		const found = read(value)
		if (found === undefined) return undefined
		out.push(found)
	}
	return out
}

/**
 * The values for `count` more cells after a line of source cells, the
 * nearest cell first. With `back`, the cells are before the line: above it,
 * or toward the start of the row.
 *
 * Two or more numbers with one step go on with that step, and so do two or
 * more days (`YYYY-MM-DD`) with one step in days, and two or more dates with
 * one step in time. Everything else repeats: one cell, texts, a line of
 * mixed kinds, numbers without one step. A value that repeats is the value
 * of its source cell itself; only a date is a new object.
 */
export function fillValues(source: readonly unknown[], count: number, back = false): unknown[] {
	const size = source.length
	if (!size || count <= 0) return []
	const at = (step: number, index: number, first: number, last: number) =>
		back ? first - step * (index + 1) : last + step * (index + 1)
	const line = (make: (index: number) => unknown) =>
		Array.from({ length: count }, (_, index) => make(index))

	if (size > 1) {
		const numbers = allOf(source, (value) =>
			typeof value === 'number' && Number.isFinite(value) ? value : undefined,
		)
		if (numbers) {
			// The step of 0.1 and 0.2 is 0.1 and not 0.1 and a little: a step has the decimals of its numbers.
			const decimals = Math.max(...numbers.map(decimalsOf))
			const step = oneStep(numbers, decimals)
			const first = numbers[0] ?? 0
			const last = numbers[size - 1] ?? 0
			// Plus zero: a series that reaches zero from above must not write "-0".
			if (step !== undefined) {
				return line((index) => roundTo(at(step, index, first, last), decimals) + 0)
			}
		}
		const days = allOf(source, dayNumber)
		if (days) {
			const step = oneStep(days, 0)
			const first = days[0] ?? 0
			const last = days[size - 1] ?? 0
			if (step !== undefined) return line((index) => dayText(at(step, index, first, last)))
		}
		const times = allOf(source, (value) =>
			value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : undefined,
		)
		if (times) {
			const step = oneStep(times, 0)
			const first = times[0] ?? 0
			const last = times[size - 1] ?? 0
			if (step !== undefined) return line((index) => new Date(at(step, index, first, last)))
		}
	}
	// A line that repeats backwards ends with its last cell next to the source.
	return line((index) => {
		const value = source[back ? size - 1 - (index % size) : index % size]
		return value instanceof Date ? new Date(value.getTime()) : value
	})
}

/**
 * The texts for `count` more cells after a line of source cells: the values
 * of `fillValues` as the editor of a cell writes them. A text goes to a cell
 * through the `parse` and the schema of its own column, as a paste does.
 */
export function fillLine(source: readonly unknown[], count: number, back = false): string[] {
	return fillValues(source, count, back).map(toText)
}
