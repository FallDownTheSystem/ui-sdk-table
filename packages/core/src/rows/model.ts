import { aggregateRows } from './aggregate'
import { createRowPredicate, filterRows } from './filter'
import { flattenRows, type FlatRow } from './flatten'
import { groupRows } from './group'
import { memo } from './memo'
import { createRowNodes, omitRows, walkRows, type RowNodeOptions, type RowNodes } from './nodes'
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
}

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
	/** How many top-level rows or groups the pages divide. */
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

	const predicate = memo(
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

	const sorted = () =>
		options.sort
			? sortStage(
					source(options.rows()).rows,
					options.sort(),
					options.columns(),
					options.locale?.(),
					options.sortChildren?.(),
				)
			: source(options.rows()).rows

	const filtered = () =>
		options.filter
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

	const paged = () => {
		const page = options.page?.()
		return page ? pageStage(grouped(), page.page, page.pageSize) : grouped()
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
		rowCount: () => grouped().length,
		pageCount: () => {
			const page = options.page?.()
			return page ? pageCount(grouped().length, page.pageSize) : 1
		},
		page: () => {
			const page = options.page?.()
			return page ? clampPage(page, grouped().length) : 1
		},
		aggregate: (group) => {
			const rows = group ? group.leaves : filtered()
			const columns = options.columns()
			const kept = totals.get(rows)
			if (kept && kept.columns === columns) return kept.result
			const all: DataRow<Row>[] = []
			walkRows(rows, (node) => all.push(node))
			const result = aggregateRows(all, columns)
			totals.set(rows, { columns, result })
			return result
		},
	}
}
