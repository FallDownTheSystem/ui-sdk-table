import { afterEach, describe, expect, test } from 'vite-plus/test'
import { createRowPredicate, filterRows } from './filter'
import { createRowNodes } from './nodes'
import type { ColumnDef } from './types'

type Flight = { id: string; at: Date | string }

// 02:00 UTC on 5 January is still the evening of 4 January in Los Angeles.
const early = new Date(Date.UTC(2024, 0, 5, 2, 0))
const rows: Flight[] = [
	{ id: 'instant', at: early },
	{ id: 'day', at: '2024-01-05' },
]
const zoned = (timeZone?: string): ColumnDef<Flight> => ({
	id: 'at',
	format: 'date',
	formatOptions: timeZone ? { timeZone } : undefined,
})

// The package has no types of Node, and the test changes the zone of the process.
const process = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
	.process

const zone = process.env.TZ
afterEach(() => {
	if (zone === undefined) delete process.env.TZ
	else process.env.TZ = zone
})

function passing(column: ColumnDef<Flight>, from: string, to: string) {
	const nodes = createRowNodes(rows, {}).rows
	const predicate = createRowPredicate({ columns: { at: { from, to } } }, { columns: [column] })
	return predicate ? filterRows(nodes, predicate).map((node) => node.id) : []
}

describe.each(['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC'])(
	'a range of dates, with the process in %s',
	(processZone) => {
		test('a day of the range is a day in the zone of the column', () => {
			process.env.TZ = processZone
			// The cell shows "Jan 5" in UTC, so the fifth finds it and the fourth does not.
			expect(passing(zoned('UTC'), '2024-01-05', '2024-01-05')).toEqual(['instant', 'day'])
			expect(passing(zoned('UTC'), '2024-01-04', '2024-01-04')).toEqual([])
			// In Los Angeles the same moment shows as "Jan 4". A calendar day has no zone and stays.
			expect(passing(zoned('America/Los_Angeles'), '2024-01-04', '2024-01-04')).toEqual(['instant'])
			expect(passing(zoned('America/Los_Angeles'), '2024-01-05', '2024-01-05')).toEqual(['day'])
		})

		test('a column without a zone reads a day in the zone of the process', () => {
			process.env.TZ = processZone
			const shown = new Date(early.getTime())
			const pad = (part: number) => String(part).padStart(2, '0')
			const local = `${shown.getFullYear()}-${pad(shown.getMonth() + 1)}-${pad(shown.getDate())}`
			expect(passing(zoned(), local, local)).toContain('instant')
			expect(passing(zoned(), '2024-01-05', '2024-01-05')).toContain('day')
		})
	},
)

test('the zone of the process changes inside a test', () => {
	process.env.TZ = 'America/Los_Angeles'
	expect(new Date(2024, 0, 5).getTimezoneOffset()).toBe(480)
	process.env.TZ = 'Pacific/Kiritimati'
	expect(new Date(2024, 0, 5).getTimezoneOffset()).toBe(-840)
})

test('a day that the clocks change on starts and ends at its own midnights', async () => {
	const { dayEnd, dayOf, toTime } = await import('./columns')
	// Helsinki goes from +2 to +3 on 31 March 2024, so the day has 23 hours.
	const start = toTime('2024-03-31', 'Europe/Helsinki')
	const end = dayEnd('2024-03-31', 'Europe/Helsinki')
	expect(start).toBe(Date.UTC(2024, 2, 30, 22))
	expect(end).toBe(Date.UTC(2024, 2, 31, 21) - 1)
	expect(dayOf(start ?? 0, 'Europe/Helsinki')).toBe('2024-03-31')
	expect(dayOf((start ?? 0) - 1, 'Europe/Helsinki')).toBe('2024-03-30')
	expect(dayOf(end ?? 0, 'Europe/Helsinki')).toBe('2024-03-31')
})

test('a zone that the runtime does not know is no zone', async () => {
	const { timeZoneOf } = await import('./columns')
	expect(timeZoneOf({ formatOptions: { timeZone: 'Mars/Olympus' } })).toBeUndefined()
	expect(timeZoneOf({ formatOptions: { timeZone: 'Europe/Helsinki' } })).toBe('Europe/Helsinki')
	expect(timeZoneOf({})).toBeUndefined()
})

test('a bound with a time of day is a moment, also for a cell that holds a day', () => {
	const nodes = createRowNodes(rows, {}).rows
	const from = new Date(2024, 0, 5, 12)
	const predicate = createRowPredicate({ columns: { at: { from } } }, { columns: [zoned('UTC')] })
	// Noon of the fifth is after local midnight of the fifth, where the calendar day sits.
	expect(predicate ? filterRows(nodes, predicate).map((node) => node.id) : []).not.toContain('day')
})
