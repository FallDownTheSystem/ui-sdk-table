const zoneClocks = new Map<string, Intl.DateTimeFormat>()

/** The date and the time of day that a clock in a zone shows at a moment, as if they were UTC. */
export function zoneClock(time: number, timeZone: string): number {
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
