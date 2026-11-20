import {
	byCell,
	createChange,
	createCommit,
	createSelection,
	definePrimitive,
	direct,
	isRTL,
	live,
	selects,
	type ChangeDetails,
	type CommitDetails,
} from '@ui-sdk/core'
import { createTableGrid, GRID_KEYS, type GridArea, type GridCell } from './behaviors/grid'
import { createColumnPins } from './behaviors/pin'
import { createColumnReorder, type ReorderDraft } from './behaviors/reorder'
import { createColumnResize, type ResizeDraft } from './behaviors/resize'
import {
	fullColumnOrder,
	headerCellMap,
	layoutColumns,
	mergeColumnTrack,
	type ColumnLayout,
	type ColumnPin,
	type ColumnPinning,
	type HeaderCell,
} from './columns/layout'
import { formatValue } from './format'
import { defaultMessages, type TableMessages } from './messages'
import {
	cellValue,
	createRowModel,
	memo,
	sameContent,
	stabilize,
	toText,
	walkRows,
	type ColumnDef,
	type DataRow,
	type FilterState,
	type FlatRow,
	type GroupRow,
	type PageState,
	type SortRule,
	type TableRow,
} from './rows'

export type TableReason =
	| 'press'
	| 'item-press'
	| 'list-navigation'
	| 'input-change'
	| 'imperative'
	| 'reset'
	| 'drag'
	| 'move-key'
	| 'resize-key'
	| 'escape-key'

export type TableChangeDetails = ChangeDetails<TableReason>
export type TableCommitDetails = CommitDetails<TableReason>

export type ColumnVisibility = Readonly<Record<string, boolean>>
export type ColumnWidths = Readonly<Record<string, number>>

export type SortDirection = 'asc' | 'desc'

/** The methods of a table that code outside it, or an agent, can call. */
export type TableController = {
	sortBy(columnId: string, direction?: SortDirection | null, options?: { append?: boolean }): void
	toggleSort(columnId: string, options?: { append?: boolean; event?: Event }): void
	setSearch(text: string): void
	setColumnFilter(columnId: string, value: unknown): void
	clearFilters(): void
	setGroupBy(columnIds: readonly string[]): void
	setPage(page: number): void
	setPageSize(pageSize: number): void
	nextPage(): void
	previousPage(): void
	firstPage(): void
	lastPage(): void
	expand(rowId: string): void
	collapse(rowId: string): void
	toggleExpanded(rowId: string, event?: Event): void
	expandAll(): void
	collapseAll(): void
	select(rowId: string): void
	toggleSelected(rowId: string, event?: Event): void
	selectAll(): void
	clearSelection(): void
	/** Shows or hides a column, or every column of a header group. */
	setColumnVisibility(columnId: string, visible: boolean): void
	toggleColumnVisibility(columnId: string): void
	showAllColumns(): void
	/** Moves a column to a place among the columns that can move, from 0. */
	moveColumn(columnId: string, index: number): void
	setColumnOrder(columnIds: readonly string[]): void
	/** Gives a column a width in pixels. `null` takes the width away again. */
	setColumnWidth(columnId: string, width: number | null): void
	resetColumnWidths(): void
	/** Pins a column to the start or the end of the table. `null` frees it. */
	pinColumn(columnId: string, side: ColumnPin | null): void
}

export type TableOptions<Row = unknown> = {
	rows?: readonly Row[]
	columns?: readonly ColumnDef<Row>[]
	/** A stable id for a row. Without it, the `id` property of the row is used. */
	getRowId?: (row: Row, index: number, parent: DataRow<Row> | null) => string | number
	/** The child rows of a row. With it, the table is a tree. */
	getChildren?: (row: Row) => readonly Row[] | undefined
	locale?: string
	searchMode?: 'contains' | 'fuzzy'
	fuzzyThreshold?: number
	/** Also sort the tree children of each row. Defaults to true. */
	sortChildren?: boolean
	canGroup?: (row: Row) => boolean
	/** Row selection. Without it, rows cannot be selected. */
	selection?: 'single' | 'multiple'
	canSelect?: (row: Row) => boolean
	/** Whether a person can resize columns. A column can say otherwise. Defaults to false. */
	resizable?: boolean
	/** Whether a person can move columns. A column can say otherwise. Defaults to false. */
	reorderable?: boolean
	/** The smallest width of a column that has no `minWidth`, in pixels. Defaults to 48. */
	columnMinWidth?: number
	columnMaxWidth?: number
	/** Texts of the table in another language, or with other words. */
	messages?: Partial<TableMessages>
	controller?: TableController

	sort?: readonly SortRule[]
	defaultSort?: readonly SortRule[]
	onSortChange?: (value: readonly SortRule[], details: TableChangeDetails) => void

	filter?: FilterState
	defaultFilter?: FilterState
	onFilterChange?: (value: FilterState, details: TableChangeDetails) => void

	groupBy?: readonly string[]
	defaultGroupBy?: readonly string[]
	onGroupByChange?: (value: readonly string[], details: TableChangeDetails) => void

	/** With a page, the table shows one page of rows. Without it, all rows. */
	page?: PageState
	defaultPage?: PageState
	onPageChange?: (value: PageState | undefined, details: TableChangeDetails) => void

	/** The ids of the expanded tree rows and groups. */
	expanded?: readonly string[]
	defaultExpanded?: readonly string[]
	onExpandedChange?: (value: readonly string[], details: TableChangeDetails) => void

	/** The ids of the selected rows. */
	selected?: string[]
	defaultSelected?: string[]
	onSelectedChange?: (value: string[], details: TableChangeDetails) => void

	/** Columns with `false` are hidden. The id of a header group hides all its columns. */
	columnVisibility?: ColumnVisibility
	defaultColumnVisibility?: ColumnVisibility
	onColumnVisibilityChange?: (value: ColumnVisibility, details: TableChangeDetails) => void

	/** Column ids in display order. Columns that are not listed come after, in definition order. */
	columnOrder?: readonly string[]
	defaultColumnOrder?: readonly string[]
	onColumnOrderChange?: (value: readonly string[], details: TableChangeDetails) => void

	/** Column widths in pixels, by column id. A column without an entry has the width of its definition. */
	columnWidths?: ColumnWidths
	defaultColumnWidths?: ColumnWidths
	/** Runs for each step of a resize. */
	onColumnWidthsChange?: (value: ColumnWidths, details: TableChangeDetails) => void
	/** Runs once when a resize ends: on release of the handle, and after each key. */
	onColumnWidthsCommit?: (value: ColumnWidths, details: TableCommitDetails) => void

	/** The columns that stay at the start or the end edge while the rest scrolls. */
	columnPinning?: ColumnPinning
	defaultColumnPinning?: ColumnPinning
	onColumnPinningChange?: (value: ColumnPinning, details: TableChangeDetails) => void
}

type TableState = {
	sort: readonly SortRule[]
	filter: FilterState
	groupBy: readonly string[]
	page: PageState | undefined
	expanded: readonly string[]
	selected: string[]
	columnVisibility: ColumnVisibility
	columnOrder: readonly string[]
	columnWidths: ColumnWidths
	columnPinning: ColumnPinning
	/**
	 * The ids of the columns that a person can move, in display order: the
	 * visible columns that are not pinned. The reorder behavior moves this list.
	 */
	columnTrack: string[]
	/** The move of a column that is going on, with the order it shows. */
	columnDrag: ReorderDraft | null
	/** The pointer drag of a resize handle that is going on. */
	columnResize: ResizeDraft | null
	active: GridCell | null
	/**
	 * Goes up when `rows` or `columns` is a new array. Parts read rows through
	 * the api, not from state, so this number is what tells them to read again;
	 * 50,000 rows in state would be compared on each change.
	 */
	revision: number
}

const NO_ROWS: readonly unknown[] = []
const NO_COLUMNS: readonly ColumnDef[] = []
const NO_SORT: readonly SortRule[] = []
const NO_FILTER: FilterState = {}
const NO_IDS: readonly string[] = []
const NO_VISIBILITY: ColumnVisibility = {}
const NO_WIDTHS: ColumnWidths = {}
const NO_PINNING: ColumnPinning = {}

const DEFAULT_COLUMN_WIDTH = 150
const DEFAULT_COLUMN_MIN_WIDTH = 48
const RESIZE_STEP = 10
const RESIZE_LARGE_STEP = 50

/** The ids of the columns that a person can move: the visible ones that are not pinned. */
function columnTrack(layout: ColumnLayout): string[] {
	return layout.leaves.filter((column) => !layout.pins.has(column.id)).map((column) => column.id)
}

/** Every state key that a part reads only through its own entry or not at all. */
const QUIET = {
	selected: [],
	active: [],
	columnWidths: [],
	columnTrack: [],
	columnResize: [],
} as const

function listed(ids: Iterable<string>): string {
	const list = [...ids]
	const shown = list.slice(0, 20).join(', ')
	return list.length > 20 ? `${shown}, and ${list.length - 20} more` : shown || 'none'
}

export const table = definePrimitive({
	name: 'table',
	options: {
		rows: 'value',
		columns: 'value',
		getRowId: 'value',
		getChildren: 'value',
		locale: 'string',
		searchMode: 'string',
		fuzzyThreshold: 'number',
		sortChildren: 'boolean',
		canGroup: 'value',
		selection: 'string',
		canSelect: 'value',
		resizable: 'boolean',
		reorderable: 'boolean',
		columnMinWidth: 'number',
		columnMaxWidth: 'number',
		messages: 'value',
		controller: 'value',
		sort: 'value',
		defaultSort: 'value',
		onSortChange: 'callback',
		filter: 'value',
		defaultFilter: 'value',
		onFilterChange: 'callback',
		groupBy: 'value',
		defaultGroupBy: 'value',
		onGroupByChange: 'callback',
		page: 'value',
		defaultPage: 'value',
		onPageChange: 'callback',
		expanded: 'value',
		defaultExpanded: 'value',
		onExpandedChange: 'callback',
		selected: 'value',
		defaultSelected: 'value',
		onSelectedChange: 'callback',
		columnVisibility: 'value',
		defaultColumnVisibility: 'value',
		onColumnVisibilityChange: 'callback',
		columnOrder: 'value',
		defaultColumnOrder: 'value',
		onColumnOrderChange: 'callback',
		columnWidths: 'value',
		defaultColumnWidths: 'value',
		onColumnWidthsChange: 'callback',
		onColumnWidthsCommit: 'callback',
		columnPinning: 'value',
		defaultColumnPinning: 'value',
		onColumnPinningChange: 'callback',
	},
	controlled: [
		'sort',
		'filter',
		'groupBy',
		'page',
		'expanded',
		'selected',
		'columnVisibility',
		'columnOrder',
		'columnWidths',
		'columnPinning',
	],
	commits: ['columnWidths'],
	live: ['columnResize'],
	state: (options: TableOptions): TableState => {
		const columnVisibility =
			options.columnVisibility ?? options.defaultColumnVisibility ?? NO_VISIBILITY
		const columnOrder = options.columnOrder ?? options.defaultColumnOrder ?? NO_IDS
		const columnPinning = options.columnPinning ?? options.defaultColumnPinning ?? NO_PINNING
		return {
			sort: options.sort ?? options.defaultSort ?? NO_SORT,
			filter: options.filter ?? options.defaultFilter ?? NO_FILTER,
			groupBy: options.groupBy ?? options.defaultGroupBy ?? NO_IDS,
			page: options.page ?? options.defaultPage,
			expanded: options.expanded ?? options.defaultExpanded ?? NO_IDS,
			selected: options.selected ?? options.defaultSelected ?? [],
			columnVisibility,
			columnOrder,
			columnWidths: options.columnWidths ?? options.defaultColumnWidths ?? NO_WIDTHS,
			columnPinning,
			columnTrack: columnTrack(
				layoutColumns(options.columns ?? NO_COLUMNS, {
					visibility: columnVisibility,
					order: columnOrder,
					pinning: columnPinning,
				}),
			),
			columnDrag: null,
			columnResize: null,
			active: null,
			revision: 0,
		}
	},
	sync: (options) => {
		const synced: Partial<TableState> = {}
		if (options.sort !== undefined) synced.sort = options.sort
		if (options.filter !== undefined) synced.filter = options.filter
		if (options.groupBy !== undefined) synced.groupBy = options.groupBy
		if (options.page !== undefined) synced.page = options.page
		if (options.expanded !== undefined) synced.expanded = options.expanded
		if (options.selected !== undefined) synced.selected = options.selected
		if (options.columnVisibility !== undefined) synced.columnVisibility = options.columnVisibility
		if (options.columnOrder !== undefined) synced.columnOrder = options.columnOrder
		if (options.columnWidths !== undefined) synced.columnWidths = options.columnWidths
		if (options.columnPinning !== undefined) synced.columnPinning = options.columnPinning
		return synced
	},
	api: (context) => {
		const state = () => context.store.get()
		const options = () => context.options()
		const change = createChange(context)
		const commit = createCommit(context)
		const message = <Key extends keyof TableMessages>(key: Key): TableMessages[Key] =>
			options().messages?.[key] ?? defaultMessages[key]

		let seenRows = options().rows
		let seenColumns = options().columns
		context.onOptions((next) => {
			if (next.rows === seenRows && next.columns === seenColumns) return
			seenRows = next.rows
			seenColumns = next.columns
			context.store.set({ revision: state().revision + 1 })
		})

		const stableVisibility = stabilize<ColumnVisibility>()
		const stableOrder = stabilize<readonly string[]>()
		const stablePinning = stabilize<ColumnPinning>()
		const layoutOf = () =>
			memo(
				(
					columns: readonly ColumnDef[],
					visibility: ColumnVisibility,
					order: readonly string[],
					pinning: ColumnPinning,
				) => layoutColumns(columns, { visibility, order, pinning }),
			)
		const committedLayout = layoutOf()
		const movingLayout = layoutOf()
		const movingOrder = memo(
			(columns: readonly ColumnDef[], order: readonly string[], track: readonly string[]) =>
				mergeColumnTrack(fullColumnOrder(columns, order), track),
		)
		const definitions = () => options().columns ?? NO_COLUMNS
		/** The columns as the state orders them, without a move that is going on. */
		const committed = () =>
			committedLayout(
				definitions(),
				stableVisibility(state().columnVisibility),
				stableOrder(state().columnOrder),
				stablePinning(state().columnPinning),
			)
		/**
		 * The columns as the table shows them. Every part reads the columns from
		 * here, so the header, the cells, the footer and the keyboard agree.
		 */
		const layout = (): ColumnLayout => {
			const drag = state().columnDrag
			if (!drag) return committed()
			const order = stableOrder(state().columnOrder)
			return movingLayout(
				definitions(),
				stableVisibility(state().columnVisibility),
				movingOrder(definitions(), order, drag.order),
				stablePinning(state().columnPinning),
			)
		}
		const headerMap = memo(headerCellMap)
		/** The header cell that covers a place of the header. */
		const headerAt = (row: number, col: number) => headerMap(layout())[row]?.[col]

		function column(id: string, purpose: string): ColumnDef {
			const found = layout().byId.get(id)
			if (!found) {
				throw new Error(
					`No column "${id}" to ${purpose}. Columns: ${listed(layout().byId.keys())}.`,
				)
			}
			return found
		}

		const label = (columnId: string) => {
			const found = layout().byId.get(columnId) ?? layout().groups.get(columnId)
			return found?.header ?? columnId
		}

		function text(row: unknown, column: ColumnDef): string {
			const value = cellValue(row, column)
			return column.format
				? formatValue(value, column.format, column.formatOptions, { locale: options().locale })
				: toText(value)
		}

		const idSet = memo((ids: readonly string[]) => new Set(ids))

		const stableSort = stabilize<readonly SortRule[]>()
		const stableFilter = stabilize<FilterState>()
		const stableGroupBy = stabilize<readonly string[]>()
		/** The state that decides which rows the table lists, with one object for one content. */
		const list = () => ({
			sort: stableSort(state().sort),
			filter: stableFilter(state().filter),
			groupBy: stableGroupBy(state().groupBy),
		})

		const model = createRowModel<unknown>({
			rows: () => options().rows ?? NO_ROWS,
			columns: definitions,
			// Read at each use, so a table that gets these options later still works.
			get getRowId() {
				return options().getRowId
			},
			get getChildren() {
				return options().getChildren
			},
			locale: () => options().locale,
			filter: () => list().filter,
			filterText: text,
			searchMode: () => options().searchMode,
			fuzzyThreshold: () => options().fuzzyThreshold,
			sort: () => list().sort,
			sortChildren: () => options().sortChildren ?? true,
			groupBy: () => list().groupBy,
			canGroup: (row) => options().canGroup?.(row) ?? true,
			page: () => state().page,
			isExpanded: (node) => idSet(state().expanded).has(node.id),
			expansion: () => state().expanded,
		})

		const flatIndex = memo(
			(flat: readonly FlatRow<unknown>[]) => new Map(flat.map((row, index) => [row.id, index])),
		)

		// Every group and tree row that can open, on all pages.
		const expandable = memo((rows: readonly TableRow<unknown>[]) => {
			const ids = new Set<string>()
			const walk = (list: readonly TableRow<unknown>[]) => {
				for (const node of list) {
					if (!node.children?.length) continue
					ids.add(node.id)
					walk(node.children)
				}
			}
			walk(rows)
			return ids
		})

		// Every data row that passes the filter, in order, for range selection and "select all".
		const selectableOrder = memo((rows: readonly DataRow<unknown>[]) => {
			const ids: string[] = []
			walkRows(rows, (node) => ids.push(node.id))
			return ids
		})

		function canSelect(id: string): boolean {
			const node = model.rowById(id)
			return !!node && (options().canSelect?.(node.row) ?? true)
		}

		const selection = createSelection(context, {
			key: 'selected',
			set: (value, details) => change('selected', value, details),
			order: () => selectableOrder(model.filtered()),
			multiple: () => options().selection === 'multiple',
			selectable: canSelect,
		})

		const headerRowCount = () => layout().headerRows.length
		/** Without rows, the body holds one row that says so. */
		const bodyRowCount = () => model.flat().length || 1
		const hasTotals = memo((columns: readonly ColumnDef[]) =>
			columns.some((column) => column.aggregate !== undefined),
		)
		/** The footer is one row of column totals, and it exists when a column has a total. */
		const footerRowCount = () => (hasTotals(layout().leaves) ? 1 : 0)
		const rowCount = () => headerRowCount() + bodyRowCount() + footerRowCount()

		function area(cell: GridCell): GridArea {
			const columns = layout()
			const head = columns.headerRows.length
			if (cell.row < head) {
				const header = headerAt(cell.row, cell.col)
				if (header) {
					return {
						row: header.row,
						col: header.col,
						rowSpan: header.rowSpan,
						colSpan: header.colSpan,
					}
				}
			}
			// A group row is one cell as wide as the table, and so is the row that says "no rows".
			const flat = model.flat()
			const wide = flat.length ? flat[cell.row - head]?.node.kind === 'group' : cell.row === head
			if (wide) {
				return { row: cell.row, col: 0, rowSpan: 1, colSpan: Math.max(1, columns.leaves.length) }
			}
			return { row: cell.row, col: cell.col, rowSpan: 1, colSpan: 1 }
		}

		const grid = createTableGrid(context, {
			key: 'active',
			rows: rowCount,
			cols: () => layout().leaves.length,
			pageSize: () => state().page?.pageSize ?? 10,
			area,
		})

		const reorderable = (columnId: string) =>
			layout().byId.get(columnId)?.reorderable ?? options().reorderable ?? false
		const resizable = (columnId: string) =>
			layout().byId.get(columnId)?.resizable ?? options().resizable ?? false

		const reorder = createColumnReorder(context, {
			track: 'columnTrack',
			draft: 'columnDrag',
			set: (track, details) =>
				change(
					'columnOrder',
					mergeColumnTrack(fullColumnOrder(definitions(), state().columnOrder), track),
					details,
				),
			disabled: (columnId) => !reorderable(columnId),
			label,
			message: (event) => message('columnMoved')(event),
		})

		/** The width that the table asks for a column: from a resize, else from its definition. */
		const widthOf = (columnId: string): number | undefined =>
			state().columnWidths[columnId] ?? layout().byId.get(columnId)?.width
		const minWidthOf = (columnId: string) =>
			layout().byId.get(columnId)?.minWidth ?? options().columnMinWidth ?? DEFAULT_COLUMN_MIN_WIDTH
		const maxWidthOf = (columnId: string) =>
			layout().byId.get(columnId)?.maxWidth ?? options().columnMaxWidth

		// The widths on the screen when a resize starts. A column that never had a
		// width gets the one it has on the screen, so the other columns hold their
		// place while one column changes.
		let frozen: ColumnWidths = NO_WIDTHS
		// The widths that the last step of a resize asked for. When the caller
		// owns the widths, the state does not hold them yet at the end of the
		// resize, and the commit must report what the person did.
		let asked: ColumnWidths | undefined

		/** Prepares a resize of a column and returns the width it starts from. */
		function startResize(columnId: string): number {
			asked = undefined
			const measured = pins.widths()
			const widths: Record<string, number> = {}
			for (const leaf of layout().leaves) {
				const width = measured.get(leaf.id)
				if (width !== undefined && state().columnWidths[leaf.id] === undefined) {
					widths[leaf.id] = Math.round(width)
				}
			}
			frozen = widths
			return measured.get(columnId) ?? widthOf(columnId) ?? DEFAULT_COLUMN_WIDTH
		}

		const resize = createColumnResize(context, {
			draft: 'columnResize',
			set: (columnId, width, details) => {
				const next = { ...frozen, ...state().columnWidths, [columnId]: Math.round(width) }
				const accepted = change('columnWidths', next, details)
				if (accepted) asked = next
				return accepted
			},
			commit: (details) =>
				commit('columnWidths', asked ?? state().columnWidths, {
					reason: details.reason,
					event: details.event,
				}),
			snapshot: () => state().columnWidths,
			restore: (snapshot, details) => change('columnWidths', snapshot as ColumnWidths, details),
			min: minWidthOf,
			max: maxWidthOf,
			step: () => RESIZE_STEP,
			largeStep: () => RESIZE_LARGE_STEP,
			label,
			message: (event) => message('columnResized')({ column: event.label, width: event.width }),
		})

		const pinnedColumns = memo((columns: ColumnLayout) =>
			columns.leaves.flatMap((leaf) => {
				const side = columns.pins.get(leaf.id)
				return side ? [{ id: leaf.id, side }] : []
			}),
		)
		const pins = createColumnPins(context, {
			pinned: () => pinnedColumns(layout()),
			width: widthOf,
		})

		function requireSelection(): void {
			if (options().selection) return
			throw new Error(
				"This table has no row selection. Set its `selection` option to 'single' or 'multiple'.",
			)
		}

		function requireRow(id: string, purpose: string): DataRow<unknown> {
			const node = model.rowById(id)
			if (node) return node
			throw new Error(`No row "${id}" to ${purpose}. Rows: ${listed(model.source().byId.keys())}.`)
		}

		function requireSelectable(id: string): void {
			requireSelection()
			requireRow(id, 'select')
			// Without this, the selection behavior skips the row and the caller gets no reason.
			if (!canSelect(id))
				throw new Error(`Row "${id}" cannot be selected: \`canSelect\` refuses it.`)
		}

		function requireExpandable(id: string): void {
			const ids = expandable(model.grouped())
			if (ids.has(id)) return
			throw new Error(`No row or group "${id}" that can expand. They are: ${listed(ids)}.`)
		}

		// A new filter, sort or grouping gives a new list, so the person starts on
		// its first page. The rule follows the state, not the actions: a filter
		// that comes in through `v-model` or a controlled option changes the list
		// too, and never runs an action.
		//
		// "New" means new content. A caller that writes `:filter="{ search }"`
		// passes a new object on each render, and that is not a new list.
		let seen = list()
		context.onDestroy(
			context.store.subscribe((liveOnly, _delivered, changed) => {
				if (liveOnly) return
				const next = list()
				const newList =
					next.sort !== seen.sort || next.filter !== seen.filter || next.groupBy !== seen.groupBy
				seen = next
				// After `seen`: this can move the active cell, which runs this function
				// again inside itself, and that run must not see a new list a second time.
				followColumns()
				const page = state().page
				if (!page || (!newList && !changed.includes('revision'))) return
				// A page that arrives together with the list is the page the caller wants,
				// for example a filter and a page that both come from a URL.
				const first = newList && !changed.includes('page')
				const target = first ? 1 : Math.min(page.page, model.pageCount())
				if (target !== page.page) change('page', { ...page, page: target }, { reason: 'reset' })
			}),
		)

		// The column and the header height that the active cell was on. The active
		// cell is a place, a row and a column number. When columns move, hide or
		// pin, the place holds another column; the person looked at a column, so
		// the active cell goes with it.
		let seenLayout = layout()
		let activeColumn: string | undefined

		function followColumns(): void {
			const columns = layout()
			const track = columnTrack(committed())
			if (!sameContent(track, state().columnTrack)) context.store.set({ columnTrack: track })
			const active = state().active
			if (active && columns !== seenLayout) {
				const before = seenLayout.headerRows.length
				const head = columns.headerRows.length
				const moved = activeColumn === undefined ? undefined : columns.index.get(activeColumn)
				const col = moved ?? active.col
				const row =
					active.row < before ? Math.min(active.row, head - 1) : active.row - before + head
				if (row !== active.row || col !== active.col) context.store.set({ active: { row, col } })
			}
			seenLayout = columns
			grid.settle()
			const now = state().active
			activeColumn = now ? columns.leaves[now.col]?.id : undefined
		}
		context.onOptions(() => {
			// The options are not in place yet when this runs, so the check waits one turn.
			queueMicrotask(followColumns)
		})

		function columnOrGroup(id: string, purpose: string): ColumnDef {
			const columns = layout()
			const found = columns.groups.get(id) ?? columns.byId.get(id)
			if (found) return found
			const groups = columns.groups.size ? ` Header groups: ${listed(columns.groups.keys())}.` : ''
			throw new Error(
				`No column "${id}" to ${purpose}. Columns: ${listed(columns.byId.keys())}.${groups}`,
			)
		}

		/** The first column under some header groups that cannot be hidden. */
		function fixedLeaf(columns: readonly ColumnDef[]): ColumnDef | undefined {
			for (const item of columns) {
				const found = item.columns?.length
					? fixedLeaf(item.columns)
					: item.hideable === false
						? item
						: undefined
				if (found) return found
			}
			return undefined
		}

		/** The header groups above a column or a group, from the outside in. */
		function parentsOf(id: string): ColumnDef[] {
			const find = (list: readonly ColumnDef[], path: ColumnDef[]): ColumnDef[] | undefined => {
				for (const item of list) {
					if (item.id === id) return path
					const found = item.columns?.length ? find(item.columns, [...path, item]) : undefined
					if (found) return found
				}
				return undefined
			}
			return find(definitions(), []) ?? []
		}

		function requireShownParents(id: string): void {
			const hidden = parentsOf(id).find((group) => state().columnVisibility[group.id] === false)
			if (!hidden) return
			throw new Error(
				`Column "${id}" stays hidden while header group "${hidden.id}" is hidden. Show "${hidden.id}" first.`,
			)
		}

		function requireVisible(columnId: string, purpose: string): void {
			column(columnId, purpose)
			if (layout().index.has(columnId)) return
			throw new Error(
				`Column "${columnId}" is hidden, so there is nothing to ${purpose}. Visible columns: ${listed(layout().index.keys())}.`,
			)
		}

		function setSort(next: readonly SortRule[], reason: TableReason, event?: Event): void {
			if (!sameContent(next, state().sort)) change('sort', next, { reason, event })
		}

		function setFilter(next: FilterState, reason: TableReason, event?: Event): void {
			if (!sameContent(next, state().filter)) change('filter', next, { reason, event })
		}

		function setExpanded(id: string, open: boolean, reason: TableReason, event?: Event): void {
			const current = state().expanded
			const isOpen = current.includes(id)
			if (isOpen === open) return
			const next = open ? [...current, id] : current.filter((other) => other !== id)
			change('expanded', next, { reason, event })
		}

		function goToPage(page: number, reason: TableReason): void {
			const current = state().page
			if (!current) {
				throw new Error('This table has no pages. Set its `page` or `defaultPage` option.')
			}
			if (!Number.isInteger(page)) {
				throw new Error(`A page must be a whole number from 1 to ${model.pageCount()}.`)
			}
			const clamped = Math.min(Math.max(1, page), model.pageCount())
			change('page', { ...current, page: clamped }, { reason })
		}

		const controller: TableController = {
			sortBy(columnId, direction = 'asc', { append = false } = {}) {
				column(columnId, 'sort by')
				if (direction !== null && direction !== 'asc' && direction !== 'desc') {
					throw new Error(`A sort direction is "asc", "desc" or null, not "${String(direction)}".`)
				}
				const rest = append ? state().sort.filter((rule) => rule.id !== columnId) : []
				const next = direction ? [...rest, { id: columnId, desc: direction === 'desc' }] : rest
				setSort(next, 'imperative')
			},
			toggleSort(columnId, toggle = {}) {
				const { append = false, event } = toggle
				column(columnId, 'sort by')
				const current = state().sort.find((rule) => rule.id === columnId)
				// The order of one press after the other: ascending, descending, not sorted.
				const direction = !current ? 'asc' : current.desc ? null : 'desc'
				const rule = direction && { id: columnId, desc: direction === 'desc' }
				const sort = state().sort
				let next: readonly SortRule[]
				if (!append) next = rule ? [rule] : []
				else if (!rule) next = sort.filter((other) => other.id !== columnId)
				// A column that is already in the sort keeps its place among the rules.
				else if (current) next = sort.map((other) => (other.id === columnId ? rule : other))
				else next = [...sort, rule]
				setSort(next, event ? 'press' : 'imperative', event)
			},
			setSearch(search) {
				if (typeof search !== 'string') throw new Error('The search text must be a string.')
				setFilter({ ...state().filter, search }, 'imperative')
			},
			setColumnFilter(columnId, value) {
				column(columnId, 'filter')
				setFilter(
					{ ...state().filter, columns: { ...state().filter.columns, [columnId]: value } },
					'imperative',
				)
			},
			clearFilters() {
				setFilter(NO_FILTER, 'imperative')
			},
			setGroupBy(columnIds) {
				if (!Array.isArray(columnIds)) throw new Error('`setGroupBy` takes a list of column ids.')
				for (const id of columnIds) column(String(id), 'group by')
				change('groupBy', [...columnIds], { reason: 'imperative' })
			},
			setPage: (page) => goToPage(page, 'imperative'),
			setPageSize(pageSize) {
				if (!Number.isInteger(pageSize) || pageSize < 1) {
					throw new Error('A page size must be a whole number above 0.')
				}
				change('page', { page: 1, pageSize }, { reason: 'imperative' })
			},
			nextPage: () => goToPage(model.page() + 1, 'imperative'),
			previousPage: () => goToPage(model.page() - 1, 'imperative'),
			firstPage: () => goToPage(1, 'imperative'),
			lastPage: () => goToPage(model.pageCount(), 'imperative'),
			expand(rowId) {
				requireExpandable(rowId)
				setExpanded(rowId, true, 'imperative')
			},
			collapse(rowId) {
				requireExpandable(rowId)
				setExpanded(rowId, false, 'imperative')
			},
			toggleExpanded(rowId, event) {
				requireExpandable(rowId)
				setExpanded(rowId, !state().expanded.includes(rowId), event ? 'press' : 'imperative', event)
			},
			expandAll() {
				change('expanded', [...expandable(model.grouped())], { reason: 'imperative' })
			},
			collapseAll() {
				change('expanded', NO_IDS, { reason: 'imperative' })
			},
			select(rowId) {
				requireSelectable(rowId)
				selection.choose(rowId, { reason: 'imperative' })
			},
			toggleSelected(rowId, event) {
				requireSelectable(rowId)
				selection.toggle(rowId, { reason: event ? 'item-press' : 'imperative', event })
			},
			selectAll() {
				requireSelection()
				if (options().selection !== 'multiple') {
					throw new Error("`selectAll` needs the `selection` option to be 'multiple'.")
				}
				const all = selectableOrder(model.filtered()).filter(canSelect)
				// Rows that the filter hides keep their selection: the person did not see them go.
				const shown = new Set(all)
				const hidden = state().selected.filter((id) => !shown.has(id))
				change('selected', [...hidden, ...all], { reason: 'imperative' })
			},
			clearSelection() {
				change('selected', [], { reason: 'imperative' })
			},
			setColumnVisibility(columnId, visible) {
				const found = columnOrGroup(columnId, visible ? 'show' : 'hide')
				if (typeof visible !== 'boolean') {
					throw new Error('`setColumnVisibility` takes a column id and true or false.')
				}
				if (visible) requireShownParents(columnId)
				else {
					if (found.hideable === false) throw new Error(`Column "${columnId}" cannot be hidden.`)
					const fixed = found.columns?.length ? fixedLeaf(found.columns) : undefined
					if (fixed) {
						throw new Error(
							`Column "${fixed.id}" cannot be hidden, so header group "${columnId}" cannot be hidden.`,
						)
					}
					const next = layoutColumns(definitions(), {
						visibility: { ...state().columnVisibility, [columnId]: false },
					})
					if (!next.leaves.length) {
						throw new Error(
							`Column "${columnId}" is the last visible column. A table needs one column.`,
						)
					}
				}
				const next: Record<string, boolean> = { ...state().columnVisibility, [columnId]: visible }
				// A column that shows is not in the record: the record stays small and
				// equal for two states that look the same.
				if (visible) delete next[columnId]
				if (!sameContent(next, state().columnVisibility)) {
					change('columnVisibility', next, { reason: 'imperative' })
				}
			},
			toggleColumnVisibility(columnId) {
				columnOrGroup(columnId, 'show or hide')
				// Under a hidden group, a toggle would write a second "hidden" and show nothing.
				requireShownParents(columnId)
				controller.setColumnVisibility(columnId, state().columnVisibility[columnId] === false)
			},
			showAllColumns() {
				if (Object.keys(state().columnVisibility).length) {
					change('columnVisibility', NO_VISIBILITY, { reason: 'imperative' })
				}
			},
			moveColumn(columnId, index) {
				requireVisible(columnId, 'move')
				const track = state().columnTrack
				if (!track.includes(columnId)) {
					throw new Error(
						`Column "${columnId}" is pinned, and a pinned column keeps its place. Free it with \`pinColumn\` first.`,
					)
				}
				if (!Number.isInteger(index) || index < 0 || index >= track.length) {
					throw new Error(
						`A column moves to a place from 0 to ${track.length - 1} among: ${listed(track)}.`,
					)
				}
				reorder.move(columnId, index)
			},
			setColumnOrder(columnIds) {
				if (!Array.isArray(columnIds))
					throw new Error('`setColumnOrder` takes a list of column ids.')
				for (const id of columnIds) column(String(id), 'order')
				const twice = columnIds.find((id, position) => columnIds.indexOf(id) !== position)
				if (twice !== undefined) throw new Error(`Column "${twice}" is in the order twice.`)
				if (!sameContent(columnIds, state().columnOrder)) {
					change('columnOrder', [...columnIds], { reason: 'imperative' })
				}
			},
			setColumnWidth(columnId, width) {
				column(columnId, 'resize')
				const next: Record<string, number> = { ...state().columnWidths }
				if (width === null) delete next[columnId]
				else if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
					const max = maxWidthOf(columnId) ?? Infinity
					next[columnId] = Math.round(Math.min(max, Math.max(minWidthOf(columnId), width)))
				} else {
					throw new Error('A column width is a number of pixels above 0, or null for no width.')
				}
				if (sameContent(next, state().columnWidths)) return
				// The commit holds the widths that were asked for: when the caller owns
				// the widths, the state does not have them yet.
				if (change('columnWidths', next, { reason: 'imperative' })) {
					commit('columnWidths', next, { reason: 'imperative' })
				}
			},
			resetColumnWidths() {
				if (!Object.keys(state().columnWidths).length) return
				if (change('columnWidths', NO_WIDTHS, { reason: 'imperative' })) {
					commit('columnWidths', NO_WIDTHS, { reason: 'imperative' })
				}
			},
			pinColumn(columnId, side) {
				column(columnId, 'pin')
				if (side !== null && side !== 'start' && side !== 'end') {
					throw new Error(
						`A column is pinned to "start" or "end", or freed with null, not "${String(side)}".`,
					)
				}
				const current = state().columnPinning
				// A column that is pinned there already keeps its place among the pinned columns.
				if (side && current[side]?.includes(columnId)) return
				const without = (ids: readonly string[] = []) => ids.filter((id) => id !== columnId)
				const next = {
					start: side === 'start' ? [...without(current.start), columnId] : without(current.start),
					end: side === 'end' ? [columnId, ...without(current.end)] : without(current.end),
				}
				const same =
					sameContent(next.start, current.start ?? []) && sameContent(next.end, current.end ?? [])
				if (!same) change('columnPinning', next, { reason: 'imperative' })
			},
		}

		/** Changes the width of a column by a number of pixels, as a key on its header does. */
		function resizeColumnBy(columnId: string, delta: number, event?: Event): boolean {
			requireVisible(columnId, 'resize')
			return resize.resizeBy(columnId, delta, startResize(columnId), {
				reason: event ? 'resize-key' : 'imperative',
				event,
			})
		}

		return {
			...controller,
			model,
			grid,
			selection,
			reorder,
			resize,
			pins,
			message,
			/**
			 * The visible rows in order. The header rows come first in the grid, so
			 * grid row `n` is `rows()[n - headerRowCount()]`.
			 */
			rows: () => model.flat(),
			row: (id: string): FlatRow<unknown> | undefined => {
				const index = flatIndex(model.flat()).get(id)
				return index === undefined ? undefined : model.flat()[index]
			},
			/** The visible columns in display order. */
			columns: () => layout().leaves,
			/** A column by id, also when it is hidden. */
			column: (id: string) => layout().byId.get(id),
			/** The header rows, with the cells that span header groups. */
			headerRows: (): HeaderCell[][] => layout().headerRows,
			headerAt,
			headerRowCount,
			footerRowCount,
			/** Every row of the grid: the header rows, the body rows and the footer row. */
			gridRowCount: rowCount,
			/** Every column that holds cells, hidden ones too, in definition order. */
			allColumns: () => layout().all,
			isColumnVisible: (id: string) => layout().index.has(id),
			columnPin: (id: string): ColumnPin | undefined => layout().pins.get(id),
			/** Whether the column is the pinned column next to the columns that scroll. */
			isPinEdge: (id: string): boolean => {
				const pinned = pinnedColumns(layout())
				const side = layout().pins.get(id)
				const same = pinned.filter((column) => column.side === side)
				return (side === 'start' ? same.at(-1) : same[0])?.id === id
			},
			columnLabel: label,
			columnWidth: widthOf,
			columnMinWidth: minWidthOf,
			columnMaxWidth: maxWidthOf,
			canResize: resizable,
			canReorder: (id: string) => reorderable(id) && state().columnTrack.includes(id),
			startResize,
			resizeColumnBy,
			/** The text of a cell as a person sees it, with the format of its column. */
			text,
			isSelected: (id: string) => idSet(state().selected).has(id),
			isExpanded: (id: string) => idSet(state().expanded).has(id),
			canSelect: (id: string) => !!options().selection && canSelect(id),
			selectionMode: () => options().selection,
			sortOf: (columnId: string): SortDirection | undefined => {
				const rule = state().sort.find((item) => item.id === columnId)
				return rule ? (rule.desc ? 'desc' : 'asc') : undefined
			},
			isTree: () => !!options().getChildren || state().groupBy.length > 0,
			/** Column totals of a group, or of all filtered rows. */
			totals: (group?: GroupRow<unknown>) => model.aggregate(group),
			/** A total as text. A count is a plain number, whatever the format of its column. */
			totalText: (column: ColumnDef, value: unknown): string => {
				const counts = column.aggregate === 'count' || column.aggregate === 'uniqueCount'
				if (!column.format || counts || typeof column.aggregate === 'function') return toText(value)
				return formatValue(value, column.format, column.formatOptions, { locale: options().locale })
			},
		}
	},
	slots: (slot) => ({
		root: slot({
			role: (_state, { api }) => (api.isTree() ? 'treegrid' : 'grid'),
			roles: ['grid', 'treegrid'],
			keys: { none: 'Focus stays on a cell, and the keydown of the cell handles the keys.' },
			bind: (el, { api }) => api.grid.bindRoot(el),
			// Selection and cell focus change one row or two cells. The root must not render for them.
			selects: selects({ selected: [], active: [], columnTrack: [], columnResize: [] }),
			// A resize changes the width of the table at each step, and the rows must
			// not render for it. So the two attributes that follow the widths are
			// kept current on the element, without a render of the root.
			direct: direct(['style', 'data-sized']),
			attrs: (_state, { api }) => {
				const columns = api.columns()
				// With a width for every column, the table has a width of its own: the
				// sum. Then a resize changes one column and no other.
				const widths = columns.map((column) => api.columnWidth(column.id))
				const sized = columns.length > 0 && widths.every((width) => width !== undefined)
				const total = widths.reduce<number>((sum, width) => sum + (width ?? 0), 0)
				return {
					'aria-rowcount': String(api.gridRowCount()),
					'aria-colcount': String(columns.length),
					'aria-multiselectable': api.selectionMode() === 'multiple' ? 'true' : undefined,
					'data-sized': sized ? '' : undefined,
					style: sized ? `--table-width:${total}px` : undefined,
				}
			},
			state: (state, { api }) => ({
				revision: state.revision,
				sort: state.sort,
				filter: state.filter,
				groupBy: state.groupBy,
				expanded: state.expanded,
				columnVisibility: state.columnVisibility,
				columnOrder: state.columnOrder,
				columnPinning: state.columnPinning,
				columnDrag: state.columnDrag,
				page: api.model.page(),
				pageSize: state.page?.pageSize,
				pageCount: api.model.pageCount(),
				rowCount: api.model.rowCount(),
			}),
		}),
		// The head, the body and the foot hold the offsets of the pinned columns.
		head: slot({ role: 'rowgroup', bind: (el, { api }) => api.pins.bindGroup(el) }),
		body: slot({ role: 'rowgroup', bind: (el, { api }) => api.pins.bindGroup(el) }),
		foot: slot({ role: 'rowgroup', bind: (el, { api }) => api.pins.bindGroup(el) }),
		/** A `col` element. It gives its column a width, and it holds no cell. */
		col: slot<{ value: string }>({
			props: { value: 'string' },
			selects: selects({
				...QUIET,
				columnWidths: ({ key }) => [key],
				sort: [],
				filter: [],
				groupBy: [],
				page: [],
				expanded: [],
				columnDrag: [],
			}),
			attrs: (_state, { key, api }) => {
				const width = api.columnWidth(key)
				return {
					'data-column': key,
					'data-pinned': api.columnPin(key),
					style: width === undefined ? undefined : `--table-column-width:${width}px`,
				}
			},
		}),
		// The header rows are a slot of their own, so no row id of the data can be mistaken for one.
		headerRow: slot<{ index: number }>({
			props: { index: 'number' },
			role: 'row',
			attrs: (_state, { props }) => ({ 'aria-rowindex': String(props.index + 1) }),
		}),
		/** A row that holds no data row: the footer row, or the row that says "no rows". */
		plainRow: slot<{ index: number }>({
			props: { index: 'number' },
			role: 'row',
			attrs: (_state, { props }) => ({ 'aria-rowindex': String(props.index + 1) }),
		}),
		// Rows and cells take their key from `value`, not from `id`: an `id` is
		// written to the element, and two tables on a page can hold the same row id.
		row: slot<{ value: string; index: number }>({
			props: { value: 'string', index: 'number' },
			role: 'row',
			// A row reads `selected` and `expanded` only for its own id.
			selects: selects({
				...QUIET,
				selected: ({ key }) => [key],
				expanded: ({ key }) => [key],
				columnDrag: [],
			}),
			attrs: (_state, { key, props, api }) => {
				const row = api.row(key)
				const index = { 'aria-rowindex': String(props.index + 1) }
				if (!row) return index
				const isRow = row.node.kind === 'row'
				const selected = isRow && api.isSelected(key)
				const tree = api.isTree()
				return {
					...index,
					'aria-selected': isRow && api.canSelect(key) ? String(selected) : undefined,
					'aria-expanded': row.expandable ? String(row.expanded) : undefined,
					'aria-level': tree ? String(row.level + 1) : undefined,
					'aria-posinset': tree ? String(row.position) : undefined,
					'aria-setsize': tree ? String(row.setSize) : undefined,
					'data-kind': row.node.kind,
					'data-selected': selected ? '' : undefined,
					'data-expanded': row.expanded ? '' : undefined,
				}
			},
			state: (_state, { key, api }) => {
				const row = api.row(key)
				return {
					selected: api.isSelected(key),
					expanded: row?.expanded ?? false,
					expandable: row?.expandable ?? false,
					level: row?.level ?? 0,
				}
			},
		}),
		/**
		 * A cell of the header or of the body. `row` and `col` are its place in
		 * the grid, from 0, with the header rows first. A cell that spans gives
		 * its first row and column, and `rowspan` and `colspan`.
		 *
		 * A person moves, resizes and pins a column by its header cell. So one
		 * header cell element must stay with one column: key the cells of a
		 * header row by the column, not by the position.
		 */
		cell: slot<{
			value: string
			row: number
			col: number
			header?: boolean
			colspan?: number
			rowspan?: number
		}>({
			props: {
				value: 'string',
				row: 'number',
				col: 'number',
				header: 'boolean',
				colspan: 'number',
				rowspan: 'number',
			},
			role: (_state, { props }) => (props.header ? 'columnheader' : 'gridcell'),
			roles: ['columnheader', 'gridcell'],
			focus: 'roving',
			keys: [...GRID_KEYS, 'Enter', 'F2', 'Escape', ' ', 'alt+ArrowLeft', 'alt+ArrowRight'],
			selects: selects({ ...QUIET, active: byCell, expanded: [] }),
			// A move of focus changes these two on the cell it leaves and on the cell
			// it reaches. Neither cell has to render its content again for that.
			attrs: (state, { props, api }) => {
				const header = props.header ? api.headerAt(props.row, props.col) : undefined
				const column = props.header ? header?.column : api.columns()[props.col]
				const wide = (props.colspan ?? 1) > 1
				// The header of one column, and not a header group.
				const leaf = !!header?.leaf
				const sortable = leaf && !!column?.sortable
				const sort = sortable && column ? api.sortOf(column.id) : undefined
				// A header group is pinned with the columns under it. It starts at its
				// column that is nearest to the edge, and its other end is the one that
				// can be next to the columns that scroll.
				const leaves = api.columns()
				const first = header ? leaves[header.col] : column
				const last = header ? leaves[header.col + header.colSpan - 1] : column
				const pin = header ? header.pin : wide || !column ? undefined : api.columnPin(column.id)
				const near = pin === 'end' ? last : first
				const far = pin === 'end' ? first : last
				const offset = pin && near ? api.pins.offset(near.id) : undefined
				return {
					tabindex: api.grid.tabIndex(state, props),
					colspan: wide ? String(props.colspan) : undefined,
					rowspan: (props.rowspan ?? 1) > 1 ? String(props.rowspan) : undefined,
					'aria-colindex': String(props.col + 1),
					'aria-sort': sortable
						? sort === 'asc'
							? 'ascending'
							: sort === 'desc'
								? 'descending'
								: 'none'
						: undefined,
					'data-column': column?.id,
					'data-active': api.grid.isActive(state, props) ? '' : undefined,
					'data-sorted': sort,
					'data-pinned': pin,
					'data-pinned-edge': pin && far && api.isPinEdge(far.id) ? '' : undefined,
					'data-moving': leaf && column && api.reorder.moving(state, column.id) ? '' : undefined,
					'data-grabbed': leaf && column && api.reorder.dragging(state, column.id) ? '' : undefined,
					style: offset ? `--table-pin-offset:${offset}` : undefined,
				}
			},
			on: {
				keydown: (event, { api, props, el }) => {
					const onCell = event.target === el
					const header = props.header ? api.headerAt(props.row, props.col) : undefined
					const column = header?.column
					const leaf = !!header?.leaf && !!column
					// A column that is picked up owns every key until it is dropped.
					if (onCell && leaf && api.reorder.keydown(event, column.id)) return
					// Alt with an arrow changes the width of the column, from its header.
					if (
						onCell &&
						leaf &&
						event.altKey &&
						(event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
						api.canResize(column.id)
					) {
						event.preventDefault()
						const wider = (event.key === 'ArrowRight') !== (!!el && isRTL(el))
						const step = event.shiftKey ? RESIZE_LARGE_STEP : RESIZE_STEP
						api.resizeColumnBy(column.id, wider ? step : -step, event)
						return
					}
					// Enter on a sortable header sorts. It comes before the move into the
					// cell, because a header often holds a sort button for the pointer.
					if (onCell && leaf && event.key === 'Enter' && column.sortable) {
						event.preventDefault()
						api.toggleSort(column.id, { append: event.shiftKey, event })
						return
					}
					const row = props.header ? undefined : api.rows()[props.row - api.headerRowCount()]
					// Enter on a group row opens the group, for the same reason: the row holds a button.
					if (onCell && event.key === 'Enter' && row?.node.kind === 'group') {
						event.preventDefault()
						api.toggleExpanded(row.id, event)
						return
					}
					if (api.grid.cellKeydown(event, el)) return
					// Keys from a control inside the cell belong to that control.
					if (!onCell || !row) return
					if (event.key === 'Enter' && row.expandable) {
						event.preventDefault()
						api.toggleExpanded(row.id, event)
					} else if (event.key === ' ' && row.node.kind === 'row' && api.canSelect(row.id)) {
						event.preventDefault()
						const why = { reason: 'list-navigation' as const, event }
						if (event.shiftKey) api.selection.extend(row.id, why)
						else api.selection.toggle(row.id, why)
					}
				},
				// Focus can arrive without a key or a pointer: from a script, or from a
				// screen reader. The active cell must follow it, or the next arrow key
				// starts from the wrong cell.
				focus: (event, { api, props }) => {
					const active = api.grid.active()
					if (active?.row === props.row && active.col === props.col) return
					api.grid.focus(props, { reason: 'imperative', event })
				},
				pointerdown: (event, { api, props, el }) => {
					const target = event.target instanceof Element ? event.target : undefined
					// A press on the resize handle resizes. It must not move focus or start a column move.
					if (target?.closest('[data-slot="table-resizer"]')) return
					const header = props.header ? api.headerAt(props.row, props.col) : undefined
					// A press on a control inside the cell must leave focus on that control.
					const control =
						target && target !== el && target.closest('a[href], button, input, select, textarea')
					if (!control || !el?.contains(control)) {
						api.grid.focus(props, { reason: 'item-press', event })
					}
					// The whole header cell is the grip of its column. A drag starts only
					// after the pointer moves, so a press on a sort button stays a press.
					// A press in a text field selects text or moves the caret there.
					const field = target?.closest('input, select, textarea, [contenteditable]')
					if (header?.leaf && !field) api.reorder.pointerdown(event, header.column.id)
				},
			},
			bind: (el, { api, props }) => {
				const cleanups = [api.grid.bind(el, props)]
				const header = props.header ? api.headerAt(props.row, props.col) : undefined
				if (header?.leaf) {
					const columnId = header.column.id
					cleanups.push(api.reorder.bind(el, columnId), api.pins.bind(el, columnId))
				}
				return () => cleanups.forEach((cleanup) => cleanup())
			},
		}),
		/** The handle at the edge of a header cell that resizes its column. `value` is the column id. */
		resizer: slot<{ value: string }>({
			props: { value: 'string' },
			role: 'separator',
			focus: 'tab-stop',
			keys: ['ArrowLeft', 'ArrowRight', 'shift+ArrowLeft', 'shift+ArrowRight'],
			selects: selects({
				...QUIET,
				columnWidths: ({ key }) => [key],
				sort: [],
				filter: [],
				groupBy: [],
				page: [],
				expanded: [],
				columnDrag: [],
			}),
			attrs: (_state, { key, api }) => ({
				...api.resize.handleAttrs(),
				tabindex: '0',
				'aria-orientation': 'vertical',
				'aria-label': api.message('resizeColumn')(api.columnLabel(key)),
				'aria-valuenow': String(Math.round(api.columnWidth(key) ?? DEFAULT_COLUMN_WIDTH)),
				// A width in pixels is outside the range from 0 to 100 that a separator
				// has without a maximum, so the handle also says its value in words.
				'aria-valuetext': api.message('columnResized')({
					column: api.columnLabel(key),
					width: Math.round(api.columnWidth(key) ?? DEFAULT_COLUMN_WIDTH),
				}),
				'aria-valuemin': String(api.columnMinWidth(key)),
				'aria-valuemax':
					api.columnMaxWidth(key) === undefined ? undefined : String(api.columnMaxWidth(key)),
				'data-column': key,
			}),
			live: live((state, { key, api }) => ({
				'data-dragging': api.resize.dragging(state, key) ? '' : undefined,
			})),
			on: {
				pointerdown: (event, { api, key, el }) => {
					if (!el || event.button !== 0) return
					api.resize.pointerdown(event, key, el, api.startResize(key))
					// Without this, the press also selects the text of the header. It comes
					// after the start of the drag: a drag does not start from a press that
					// is already prevented.
					event.preventDefault()
				},
				keydown: (event, { api, key, el }) => {
					if (!el) return
					if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
					// The arrow belongs to the handle, not to the grid around it.
					event.stopPropagation()
					if (event.altKey || event.ctrlKey || event.metaKey) return
					api.resize.keydown(event, key, el, api.startResize(key))
				},
			},
		}),
	}),
	agent: {
		actions: [
			'sortBy',
			'toggleSort',
			'setSearch',
			'setColumnFilter',
			'clearFilters',
			'setGroupBy',
			'setPage',
			'setPageSize',
			'nextPage',
			'previousPage',
			'firstPage',
			'lastPage',
			'expand',
			'collapse',
			'toggleExpanded',
			'expandAll',
			'collapseAll',
			'select',
			'toggleSelected',
			'selectAll',
			'clearSelection',
			'setColumnVisibility',
			'toggleColumnVisibility',
			'showAllColumns',
			'moveColumn',
			'setColumnOrder',
			'setColumnWidth',
			'resetColumnWidths',
			'pinColumn',
		],
	},
})
