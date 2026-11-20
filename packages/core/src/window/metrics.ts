/**
 * Where each row of a list starts and how high it is, for a list of which
 * only a part is rendered.
 */
export type RowMetrics = {
	count(): number
	/** The distance from the top of the list to the top of a row. `offset(count())` is the height of the list. */
	offset(index: number): number
	size(index: number): number
	total(): number
	/** The row that covers a distance from the top of the list. Inside the list for any distance. */
	indexAt(offset: number): number
	/**
	 * Records the height that a row has on the screen. Returns how much the
	 * height changed, or 0 when the row is unknown or the height is the same.
	 */
	measure(id: string, size: number): number
	/** The position of a row, or -1. */
	indexOf(id: string): number
	/** The mean height of a row, from the rows measured so far. */
	mean(): number
}

/** Every row has the same height, so no row is measured and each answer is one multiplication. */
export function fixedMetrics(rows: readonly { id: string }[], rowHeight: number): RowMetrics {
	const count = rows.length
	const size = Math.max(1, rowHeight)
	let index: Map<string, number> | undefined
	return {
		count: () => count,
		offset: (at) => Math.max(0, Math.min(count, at)) * size,
		size: () => size,
		total: () => count * size,
		indexAt: (offset) => Math.max(0, Math.min(count - 1, Math.floor(offset / size))),
		measure: () => 0,
		indexOf(id) {
			index ??= new Map(rows.map((row, position) => [row.id, position]))
			return index.get(id) ?? -1
		},
		mean: () => size,
	}
}

/**
 * Rows have their own heights. A row that was never on the screen counts
 * with `estimate`. Heights are kept by row id in `known`, which the caller
 * owns: after a sort or a filter, a row that was measured keeps its height.
 */
export function measuredMetrics(
	rows: readonly { id: string }[],
	estimate: number,
	known: Map<string, number>,
): RowMetrics {
	const count = rows.length
	const fallback = Math.max(1, estimate)
	const index = new Map<string, number>()
	const sizes = new Float64Array(count)
	let measured = 0
	let measuredTotal = 0
	for (let position = 0; position < count; position++) {
		const id = (rows[position] as { id: string }).id
		index.set(id, position)
		const size = known.get(id)
		if (size !== undefined) {
			measured++
			measuredTotal += size
		}
		sizes[position] = size ?? fallback
	}

	// `starts[n]` is the top of row `n`, and it is correct for every `n` up to `valid`.
	const starts = new Float64Array(count + 1)
	let valid = 0

	function fill(to: number): void {
		for (let position = valid; position < to; position++) {
			starts[position + 1] = (starts[position] as number) + (sizes[position] as number)
		}
		valid = Math.max(valid, to)
	}

	function offset(at: number): number {
		const position = Math.max(0, Math.min(count, at))
		if (position > valid) fill(position)
		return starts[position] as number
	}

	return {
		count: () => count,
		offset,
		size: (at) => sizes[at] ?? fallback,
		total: () => offset(count),
		indexAt(distance) {
			if (count === 0) return 0
			if (distance >= offset(count)) return count - 1
			// The last row whose top is at or before the distance.
			let low = 0
			let high = count - 1
			while (low < high) {
				const middle = (low + high + 1) >> 1
				if (offset(middle) <= distance) low = middle
				else high = middle - 1
			}
			return low
		},
		measure(id, size) {
			const position = index.get(id)
			if (position === undefined || !(size > 0)) return 0
			const before = sizes[position] as number
			if (!known.has(id)) measured++
			else measuredTotal -= known.get(id) ?? 0
			measuredTotal += size
			known.set(id, size)
			// Less than a part of a pixel is noise from zoom and from borders that rows share.
			if (Math.abs(before - size) < 0.01) return 0
			sizes[position] = size
			valid = Math.min(valid, position)
			return size - before
		},
		indexOf: (id) => index.get(id) ?? -1,
		mean: () => (measured ? measuredTotal / measured : fallback),
	}
}

/** The rows to render, from `start` up to and not including `end`. */
export type RowRange = { start: number; end: number }

/**
 * The rows that cover a part of the list, with `overscan` more rows on each
 * side. `from` and `to` are distances from the top of the list.
 */
export function rangeFor(
	metrics: RowMetrics,
	from: number,
	to: number,
	overscan: number,
): RowRange {
	const count = metrics.count()
	if (count === 0) return { start: 0, end: 0 }
	const first = metrics.indexAt(Math.max(0, from))
	const last = metrics.indexAt(Math.max(0, to))
	return {
		start: Math.max(0, first - overscan),
		end: Math.min(count, last + 1 + overscan),
	}
}

export type WindowSegment =
	| { kind: 'rows'; from: number; to: number }
	/** The rows that are not rendered between two parts that are. A spacer stands in for them. */
	| { kind: 'gap'; key: string; from: number; to: number }

/**
 * What the body renders, in order: the rows of the range, the rows of
 * `keep` outside it, and a gap for each run of rows that is left out.
 *
 * There is always a first and a last gap, also when they are empty, and the
 * keys of the gaps are their positions. So a spacer element stays in the page
 * while the range moves, and the renderer never has to move a row element.
 */
export function windowSegments(
	range: RowRange,
	keep: readonly number[],
	count: number,
): WindowSegment[] {
	const runs: { from: number; to: number }[] = []
	const extra = [...new Set(keep)]
		.filter((index) => index >= 0 && index < count && (index < range.start || index >= range.end))
		.sort((a, b) => a - b)
	const add = (from: number, to: number) => {
		const last = runs.at(-1)
		if (last && last.to === from) last.to = to
		else if (to > from) runs.push({ from, to })
	}
	for (const index of extra) if (index < range.start) add(index, index + 1)
	add(Math.max(0, range.start), Math.min(count, range.end))
	for (const index of extra) if (index >= range.end) add(index, index + 1)

	const segments: WindowSegment[] = []
	let at = 0
	let gaps = 0
	for (const run of runs) {
		if (run.from > at || gaps === 0) {
			segments.push({ kind: 'gap', key: `gap-${gaps++}`, from: at, to: run.from })
		}
		segments.push({ kind: 'rows', from: run.from, to: run.to })
		at = run.to
	}
	// Without a row to render, the first gap is still there, and it is empty.
	if (gaps === 0) segments.push({ kind: 'gap', key: `gap-${gaps++}`, from: 0, to: 0 })
	segments.push({ kind: 'gap', key: `gap-${gaps}`, from: at, to: count })
	return segments
}
