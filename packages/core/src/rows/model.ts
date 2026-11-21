import { totalRows } from './aggregate'
import { createRowPredicate, filterRows, isEmptyFilter } from './filter'
import { flattenRows, type FlatRow } from './flatten'
import { groupRows } from './group'
import { memo, stabilize } from './memo'
import { createRowNodes, omitRows, type RowNodeOptions, type RowNodes } from './nodes'
import { clampPage, pageCount, paginate } from './paginate'
import { sortRows } from './sort'
import type {
	ColumnDef,
	DataRow,
	FilterState,
	GroupRow,
	PageState,
	SortRule,
	TableRow,
} from './types'

/**
 * What the row model reads. Each value is a function, so the model always
 * sees the current state. A feature whose function is left out adds no stage:
 * a table without `groupBy` never runs the grouping code.
 *
 * A stage runs again when a state function returns a different object. So
 * return the same object while the state is the same, and replace the object
 * to change the state: a change inside an object is not seen. `filterText`,
 * `canGroup` and `getRowId` must give the same answer for the same row.
 */
export type RowModelOptions<Row> = RowNodeOptions<Row> & {
	rows: () => readonly Row[]
	columns: () => readonly ColumnDef<Row>[]
	locale?: () => string | undefined
	filter?: () => FilterState | undefined
	/** The text a person sees in a cell, for the search and the text filters. */
	filterText?: (row: Row, column: ColumnDef<Row>) => string
	searchMode?: () => 'contains' | 'fuzzy' | undefined
	/** See `FilterOptions.fuzzyThreshold`. */
	fuzzyThreshold?: () => number | undefined
	sort?: () => readonly SortRule[] | undefined
	sortChildren?: () => boolean | undefined
	groupBy?: () => readonly string[] | undefined
	canGroup?: (row: Row) => boolean
	page?: () => PageState | undefined
	isExpanded?: (node: TableRow<Row>) => boolean
	/** A value that changes when the answers of `isExpanded` change, such as the expansion state itself. */
	expansion?: () => unknown
	/** Whether a data row without children has a detail row. Return the same function while its answers are the same. */
	hasDetail?: () => ((row: Row) => boolean) | undefined
	/**
	 * The ids of rows that leave the list after the filter, such as rows that
	 * are pinned and shown in a place of their own. Groups, pages and the
	 * visible rows do not hold them. `filtered` and the totals still do.
	 */
	omit?: () => ReadonlySet<string> | undefined
	/**
	 * The stages that a server already did. `rows` then come in sort order,
	 * filtered, or as one page, and the model does not do that stage again. The
	 * sort, filter and page states stay: they say what the caller asks the
	 * server for.
	 */
	manual?: () => ManualStages | undefined
	/**
	 * How many rows the server has after its filter. With a manual page stage,
	 * the pages come from this number. Without it, the model knows only that
	 * a full page can have a next page.
	 */
	serverRowCount?: () => number | undefined
	/**
	 * Whether the rows of the page are on their way. An empty list then says
	 * nothing about the last page of the server.
	 */
	loading?: () => boolean | undefined
}

export type ManualStages = { sort?: boolean; filter?: boolean; page?: boolean }

export type RowModel<Row> = {
	/** Every row of the data with its id, before any stage. */
	source: () => RowNodes<Row>
	/** Every row, in sort order. */
	sorted: () => readonly DataRow<Row>[]
	/** The sorted rows that pass the search and the column filters. */
	filtered: () => readonly DataRow<Row>[]
	/** The filtered rows without the rows of `omit`. */
	listed: () => readonly DataRow<Row>[]
	grouped: () => readonly TableRow<Row>[]
	paged: () => readonly TableRow<Row>[]
	/** The visible rows in order, with expanded children in place. */
	flat: () => FlatRow<Row>[]
	rowById: (id: string) => DataRow<Row> | undefined
	/** How many top-level rows or groups the pages divide. With a manual page stage, the count of the server. */
	rowCount: () => number
	pageCount: () => number
	/** The page that `paged` shows: the page of the state, moved inside the pages that exist. */
	page: () => number
	/**
	 * Column totals: of a group's rows, or of all filtered rows without an
	 * argument. Tree children count too, expanded or not. A parent that stays
	 * only because a child passed the filter is on the screen, so it counts.
	 */
	aggregate: (group?: GroupRow<Row>) => Record<string, unknown>
	/**
	 * The rows that the facets of a column count: the rows that pass the search
	 * and the filters of every other column. The filter of the column itself
	 * is left out, so a filter never takes away its own choices. The order of
	 * the rows is not a part of the answer: a count has none. A column without
	 * a filter of its own gets the list of `filtered`, or of `source` when
	 * nothing filters, and costs nothing more. A column that filters has a
	 * stage of its own, which runs on the first call and again only when the
	 * search or another filter changed.
	 */
	facetRows: (columnId: string) => readonly DataRow<Row>[]
}

/**
 * The row pipeline: source, sort, filter, omit, group, page, flatten. Each stage
 * keeps its last result and runs again only when its input or its own state
 * changed, so a page change does not filter or sort again.
 *
 * Sort comes before filter on purpose. A filter keeps the order of its
 * input, so each keystroke in the search only filters; with the stages the
 * other way round, each keystroke would sort the matches again.
 */
export function createRowModel<Row>(options: RowModelOptions<Row>): RowModel<Row> {
	const source = memo((rows: readonly Row[]) => createRowNodes(rows, options))

	const predicateStage = () =>
		memo(
			(
				state: FilterState | undefined,
				columns: readonly ColumnDef<Row>[],
				locale: string | undefined,
				searchMode: 'contains' | 'fuzzy' | undefined,
				fuzzyThreshold: number | undefined,
			) =>
				createRowPredicate(state, {
					columns,
					locale,
					searchMode,
					fuzzyThreshold,
					text: options.filterText,
				}),
		)
	const predicate = predicateStage()

	const filterStage = memo((rows: readonly DataRow<Row>[], test: ((row: Row) => boolean) | null) =>
		test ? filterRows(rows, test) : rows,
	)

	const sortStage = memo(
		(
			rows: readonly DataRow<Row>[],
			rules: readonly SortRule[] | undefined,
			columns: readonly ColumnDef<Row>[],
			locale: string | undefined,
			sortChildren: boolean | undefined,
		) => (rules?.length ? sortRows(rows, rules, { columns, locale, sortChildren }) : rows),
	)

	const groupStage = memo(
		(
			rows: readonly DataRow<Row>[],
			groupBy: readonly string[] | undefined,
			columns: readonly ColumnDef<Row>[],
		): readonly TableRow<Row>[] =>
			groupBy?.length ? groupRows(rows, groupBy, { columns, canGroup: options.canGroup }) : rows,
	)

	const pageStage = memo(
		(rows: readonly TableRow<Row>[], page: number | undefined, pageSize: number | undefined) =>
			page === undefined || pageSize === undefined ? rows : paginate(rows, { page, pageSize }),
	)

	const omitStage = memo((rows: readonly DataRow<Row>[], ids: ReadonlySet<string> | undefined) =>
		ids?.size ? omitRows(rows, ids) : rows,
	)

	const flatStage = memo(
		(
			rows: readonly TableRow<Row>[],
			_expansion: unknown,
			hasDetail: ((row: Row) => boolean) | undefined,
		) => flattenRows(rows, options.isExpanded ?? (() => false), hasDetail),
	)

	if (options.isExpanded && !options.expansion) {
		throw new Error(
			'A row model with `isExpanded` also needs `expansion`: a function that returns a value which changes when the expanded rows change. Without it, the visible rows never update.',
		)
	}

	// Totals are kept for each list of rows. A group's list stays the same
	// object until the grouping stage runs again, so its totals stay too.
	const totals = new WeakMap<
		readonly DataRow<Row>[],
		{ columns: readonly ColumnDef<Row>[]; result: Record<string, unknown> }
	>()

	const manual = (stage: keyof ManualStages) => options.manual?.()?.[stage] === true

	// The number of top-level rows that the pages divide, and the last page.
	const total = (page: PageState | undefined): { rows: number; pages: number } => {
		if (!page || !manual('page')) {
			const here = grouped().length
			return { rows: here, pages: page ? pageCount(here, page.pageSize) : 1 }
		}
		const known = options.serverRowCount?.()
		if (known !== undefined && !Number.isNaN(known)) {
			return { rows: known, pages: pageCount(known, page.pageSize) }
		}
		// Without a count, a full page says that a next page can exist. The rows
		// that count are the rows that the server sent: a group, a pinned row or
		// a filter of this side makes the list shorter and the page no less full.
		const here = source(options.rows()).rows.length
		const current = Number.isFinite(page.page) ? Math.max(1, Math.trunc(page.page)) : 1
		const before = (current - 1) * page.pageSize
		// An empty page after the first: the server has no such page.
		if (here === 0 && current > 1 && !options.loading?.()) {
			return { rows: before, pages: current - 1 }
		}
		const more = here >= page.pageSize
		return { rows: before + here + (more ? 1 : 0), pages: current + (more ? 1 : 0) }
	}

	const sorted = () =>
		options.sort && !manual('sort')
			? sortStage(
					source(options.rows()).rows,
					options.sort(),
					options.columns(),
					options.locale?.(),
					options.sortChildren?.(),
				)
			: source(options.rows()).rows

	const filtered = () =>
		options.filter && !manual('filter')
			? filterStage(
					sorted(),
					predicate(
						options.filter(),
						options.columns(),
						options.locale?.(),
						options.searchMode?.(),
						options.fuzzyThreshold?.(),
					),
				)
			: sorted()

	const listed = () => (options.omit ? omitStage(filtered(), options.omit()) : filtered())

	const grouped = (): readonly TableRow<Row>[] =>
		options.groupBy ? groupStage(listed(), options.groupBy(), options.columns()) : listed()

	// One stage for each column that filters and whose facets were asked for.
	// The filter of the column itself is not in its key, so a new value of that
	// filter keeps the rows: only the search and the filters of the other
	// columns run it again. A column without a filter of its own needs no
	// stage: its rows are the rows that the table shows.
	type FacetStage = {
		others: (state: FilterState) => FilterState
		predicate: ReturnType<typeof predicateStage>
		rows: (
			rows: readonly DataRow<Row>[],
			test: ((row: Row) => boolean) | null,
		) => readonly DataRow<Row>[]
	}
	const facetStages = new Map<string, FacetStage>()

	const facetRows = (columnId: string): readonly DataRow<Row>[] => {
		const all = source(options.rows()).rows
		const state = options.filter?.()
		if (!state || manual('filter')) return all
		if (isEmptyFilter(state.columns?.[columnId])) {
			const test = predicate(
				state,
				options.columns(),
				options.locale?.(),
				options.searchMode?.(),
				options.fuzzyThreshold?.(),
			)
			// With no filter at all, the list of the data: a new sort is then no new list to count.
			return test ? filtered() : all
		}
		let stage = facetStages.get(columnId)
		if (!stage) {
			const stable = stabilize<FilterState>()
			stage = {
				others: memo((filter: FilterState) => {
					const { [columnId]: _own, ...columns } = filter.columns ?? {}
					return stable({ search: filter.search, columns })
				}),
				predicate: predicateStage(),
				rows: memo((rows: readonly DataRow<Row>[], test: ((row: Row) => boolean) | null) =>
					test ? filterRows(rows, test) : rows,
				),
			}
			facetStages.set(columnId, stage)
		}
		return stage.rows(
			all,
			stage.predicate(
				stage.others(state),
				options.columns(),
				options.locale?.(),
				options.searchMode?.(),
				options.fuzzyThreshold?.(),
			),
		)
	}

	const paged = () => {
		const page = options.page?.()
		return page && !manual('page') ? pageStage(grouped(), page.page, page.pageSize) : grouped()
	}

	return {
		source: () => source(options.rows()),
		sorted,
		filtered,
		listed,
		grouped,
		paged,
		flat: () => flatStage(paged(), options.expansion?.(), options.hasDetail?.()),
		rowById: (id) => source(options.rows()).byId.get(id),
		rowCount: () => total(options.page?.()).rows,
		pageCount: () => total(options.page?.()).pages,
		page: () => {
			const page = options.page?.()
			if (!page) return 1
			if (!manual('page')) return clampPage(page, grouped().length)
			const asked = Number.isFinite(page.page) ? Math.trunc(page.page) : 1
			return Math.min(Math.max(1, asked), total(page).pages)
		},
		facetRows,
		aggregate: (group) => {
			const rows = group ? group.leaves : filtered()
			const columns = options.columns()
			const kept = totals.get(rows)
			if (kept && kept.columns === columns) return kept.result
			const result = totalRows(rows, columns)
			totals.set(rows, { columns, result })
			return result
		},
	}
}
