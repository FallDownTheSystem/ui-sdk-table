import type { PageState } from './types'

export function pageCount(total: number, pageSize: number): number {
	if (!(pageSize > 0)) return 1
	return Math.max(1, Math.ceil(total / pageSize))
}

/** The page a state points at, moved inside the pages that exist. Pages start at 1. */
export function clampPage(state: PageState, total: number): number {
	const page = Number.isFinite(state.page) ? Math.trunc(state.page) : 1
	return Math.min(Math.max(1, page), pageCount(total, state.pageSize))
}

/**
 * One page of the top-level rows. A group or a tree row stays whole with its
 * children. A page size that is not above zero means all rows.
 */
export function paginate<T>(rows: readonly T[], state: PageState): readonly T[] {
	if (!(state.pageSize > 0)) return rows
	const page = clampPage(state, rows.length)
	if (page === 1 && rows.length <= state.pageSize) return rows
	const start = (page - 1) * state.pageSize
	return rows.slice(start, start + state.pageSize)
}
