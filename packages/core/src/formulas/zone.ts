import { zoneClock } from '../rows/zone'

const DAY = 86_400_000

/** The clock of a zone with its offset kept for each day of UTC. */
export type ZoneClock = (time: number) => number

const clocks = new Map<string, ZoneClock>()

/**
 * The date and the time of day that a clock in a zone shows at a moment, as
 * if they were UTC, the same as `zoneClock` of the table. The offset of a
 * zone is read for each day of UTC from the clock at the start and at the
 * end of the day: two reads of `Intl` for a day, where `zoneClock` costs one
 * for each moment. A day in which the offset changes reads the clock for
 * each moment. The answer is cut to whole seconds, as the clock shows them.
 */
export function zoneClockOf(timeZone: string): ZoneClock {
	let found = clocks.get(timeZone)
	if (!found) {
		const offsets = new Map<number, number | null>()
		found = (time) => {
			const second = Math.floor(time / 1000) * 1000
			const day = Math.floor(second / DAY)
			let offset = offsets.get(day)
			if (offset === undefined) {
				const start = day * DAY
				const end = start + DAY - 1000
				const first = zoneClock(start, timeZone) - start
				offset = zoneClock(end, timeZone) - end === first ? first : null
				offsets.set(day, offset)
			}
			return offset === null ? zoneClock(second, timeZone) : second + offset
		}
		clocks.set(timeZone, found)
	}
	return found
}

/** The clock at a moment in a zone, or in local time without one. */
export function wallTime(time: number, timeZone: string | undefined): number {
	if (timeZone !== undefined) return zoneClockOf(timeZone)(time)
	const second = Math.floor(time / 1000) * 1000
	return second - new Date(second).getTimezoneOffset() * 60_000
}

/**
 * The moment at which a clock in a zone shows a time, the reverse of
 * `wallTime`. A time that the clock skips (the hour that a spring change
 * leaves out) gives the moment after the skip; a time that comes twice
 * gives the first one.
 */
export function fromWall(wall: number, timeZone: string | undefined): number {
	if (timeZone === undefined) {
		const date = new Date(wall)
		return new Date(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate(),
			date.getUTCHours(),
			date.getUTCMinutes(),
			date.getUTCSeconds(),
		).getTime()
	}
	const clock = zoneClockOf(timeZone)
	// The zone is ahead of UTC by what its clock shows more. The second step
	// corrects a first guess that fell on the other side of a clock change.
	let time = wall - (clock(wall) - wall)
	time = wall - (clock(time) - time)
	return time
}
