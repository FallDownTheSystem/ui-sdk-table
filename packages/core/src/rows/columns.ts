import type { ColumnDef } from './types'

/** The columns that hold cells, in order, with header groups removed. */
export function leafColumns<Row>(columns: readonly ColumnDef<Row>[]): ColumnDef<Row>[] {
	const leaves: ColumnDef<Row>[] = []
	const walk = (list: readonly ColumnDef<Row>[]) => {
		for (const column of list) {
			if (column.columns?.length) walk(column.columns)
			else leaves.push(column)
		}
	}
	walk(columns)
	return leaves
}

export function cellValue<Row>(row: Row, column: ColumnDef<Row>): unknown {
	if (column.value) return column.value(row)
	if (typeof row !== 'object' || row === null) return undefined
	return (row as Record<string, unknown>)[column.key ?? column.id]
}

/**
 * A cell value as plain text, for matching, sorting and group keys. A value
 * that is an object has no useful default text, so it becomes JSON.
 */
export function toText(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value)
	}
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
	if (Array.isArray(value)) return value.map((part) => toText(part)).join(', ')
	return JSON.stringify(value) ?? ''
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const zoneClocks = new Map<string, Intl.DateTimeFormat>()

/** The date and the time of day that a clock in a zone shows at a moment, as if they were UTC. */
function zoneClock(time: number, timeZone: string): number {
	let clock = zoneClocks.get(timeZone)
	if (!clock) {
		clock = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
		})
		zoneClocks.set(timeZone, clock)
	}
	const read: Record<string, number> = {}
	for (const part of clock.formatToParts(time)) read[part.type] = Number(part.value)
	return Date.UTC(
		read.year ?? 0,
		(read.month ?? 1) - 1,
		read.day ?? 1,
		read.hour ?? 0,
		read.minute ?? 0,
		read.second ?? 0,
	)
}

/**
 * The zone of a column of dates: the `timeZone` of its format options. A name
 * that the runtime does not know is no zone, as for a column without one.
 */
export function timeZoneOf(column: { formatOptions?: unknown }): string | undefined {
	const options = column.formatOptions
	const zone =
		typeof options === 'object' && options !== null
			? (options as { timeZone?: unknown }).timeZone
			: undefined
	if (typeof zone !== 'string' || zone === '') return undefined
	try {
		zoneClock(0, zone)
		return zone
	} catch {
		return undefined
	}
}

function dayStart(value: unknown, addDays: number, timeZone?: string): number | undefined {
	const parts = typeof value === 'string' ? DATE_ONLY.exec(value) : null
	if (!parts) return undefined
	const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]) + addDays]
	if (timeZone === undefined) {
		const time = new Date(year, month, day).getTime()
		return Number.isNaN(time) ? undefined : time
	}
	const wall = Date.UTC(year, month, day)
	if (Number.isNaN(wall)) return undefined
	// The zone is ahead of UTC by what its clock shows more. The second step
	// corrects a first guess that fell on the other side of a clock change.
	let time = wall - (zoneClock(wall, timeZone) - wall)
	time = wall - (zoneClock(time, timeZone) - time)
	return time
}

/** Whether a value is a calendar day without a time of day, as `YYYY-MM-DD`. */
export function isDay(value: unknown): value is string {
	return typeof value === 'string' && DATE_ONLY.test(value)
}

/**
 * The last millisecond of a `YYYY-MM-DD` day, in local time or in a zone, or
 * `undefined` for any other value. It comes from the start of the next day,
 * because a day is 23 or 25 hours long when the clocks change.
 */
export function dayEnd(value: unknown, timeZone?: string): number | undefined {
	const next = dayStart(value, 1, timeZone)
	return next === undefined ? undefined : next - 1
}

/** The day that a moment falls on, as `YYYY-MM-DD`, in local time or in a zone. */
export function dayOf(time: number, timeZone?: string): string {
	const pad = (part: number, length = 2) => String(part).padStart(length, '0')
	if (timeZone === undefined) {
		const date = new Date(time)
		return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	}
	const clock = new Date(zoneClock(time, timeZone))
	return `${pad(clock.getUTCFullYear(), 4)}-${pad(clock.getUTCMonth() + 1)}-${pad(clock.getUTCDate())}`
}

/**
 * A cell value as a point in time, or `undefined` when it is not a date. A
 * `YYYY-MM-DD` text is the start of that day in local time, like a date a
 * person picks, or in the zone that is given; the filter and the facets must
 * agree on this.
 */
export function toTime(value: unknown, timeZone?: string): number | undefined {
	const day = dayStart(value, 0, timeZone)
	if (day !== undefined) return day
	const time =
		value instanceof Date
			? value.getTime()
			: typeof value === 'string' || typeof value === 'number'
				? new Date(value).getTime()
				: NaN
	return Number.isNaN(time) ? undefined : time
}

/**
 * A key that is the same for two values a person sees as the same, as a
 * group is: `1` and `'1'` share a key, and so do two `Date` objects for one
 * moment. A value without a text has the empty key.
 */
export function valueKey(value: unknown): string {
	return toText(value)
}

/**
 * Finds columns by id and fails with the valid ids, so a caller (a person or
 * an agent) can correct the id without reading the column definitions.
 */
export function requireColumns<Row>(
	columns: readonly ColumnDef<Row>[],
	ids: readonly string[],
	purpose: string,
): ColumnDef<Row>[] {
	const byId = new Map(columns.map((column) => [column.id, column]))
	return ids.map((id) => {
		const column = byId.get(id)
		if (!column) {
			throw new Error(
				`No column "${id}" to ${purpose}. Columns: ${[...byId.keys()].join(', ') || 'none'}.`,
			)
		}
		return column
	})
}
