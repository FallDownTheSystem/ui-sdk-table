import {
	announce,
	byCell,
	createChange,
	createCommit,
	createSelection,
	definePrimitive,
	direct,
	dispatch,
	isRTL,
	live,
	selects,
	type ChangeDetails,
	type CommitDetails,
} from '@ui-sdk/core'
import { createCellEdit, type SaveResult } from './behaviors/edit'
import { createTableGrid, GRID_KEYS, type GridArea, type GridCell } from './behaviors/grid'
import { createColumnPins } from './behaviors/pin'
import {
	byCellRange,
	createTableRange,
	textToCells,
	type CellBounds,
	type CellRange,
} from './behaviors/range'
import { createColumnReorder, type ReorderDraft } from './behaviors/reorder'
import { createColumnResize, type ResizeDraft } from './behaviors/resize'
import { createStickyRows } from './behaviors/sticky'
import {
	createRowWindow,
	firstRowWindow,
	type RowAlign,
	type RowWindowState,
} from './behaviors/window'
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
import {
	cellKey,
	editText,
	parseCellKey,
	resolveValue,
	sameValue,
	type CellEdit,
	type Checked,
} from './edit'
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

/** Why cells got new values: a key or a loss of focus in the editor, a paste, or a call from code. */
export type TableEditReason = 'enter-key' | 'tab-key' | 'focus-out' | 'paste' | 'imperative'
export type TableEditDetails = ChangeDetails<TableEditReason>

/** A cell of the data, by the id of its row and of its column. */
export type CellRef = { rowId: string; columnId: string }

export type ColumnVisibility = Readonly<Record<string, boolean>>
export type ColumnWidths = Readonly<Record<string, number>>

export type SortDirection = 'asc' | 'desc'

export type RowPin = 'top' | 'bottom'
/** The ids of the rows that stay at the top or the bottom edge while the other rows scroll. */
export type RowPinning = { top?: readonly string[]; bottom?: readonly string[] }

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
	/** Pins a row to the top or the bottom of the rows. `null` frees it. */
	pinRow(rowId: string, edge: RowPin | null): void
	/** Scrolls a row into view, in one step, also when the row is not rendered yet. */
	scrollToRow(rowId: string, align?: RowAlign): void
	/**
	 * Gives a cell a new value, with the check of its column, and reports it
	 * through `onCellEdit`. A text is read as the editor reads it. It throws
	 * with the reason when the value is refused; when the schema of the column
	 * answers with a promise, the result is a promise that rejects.
	 */
	editCell(rowId: string, columnId: string, value: unknown): void | Promise<void>
	/** Opens the editor of a cell that is in view. */
	startEdit(rowId: string, columnId: string): void
	/** Closes the editor without a save. */
	cancelEdit(): void
	/** Selects the cells from one cell to another, or one cell. Needs the `cellSelection` option. */
	selectCells(from: CellRef, to?: CellRef): void
	clearCellSelection(): void
	/** The text of the selected cells, with tabs between cells and line breaks between rows. */
	copyCells(): string
	/**
	 * Puts tab-separated text into the cells from the first selected cell on,
	 * as a paste does. It throws with the reason when a value is refused, and
	 * then no cell changes.
	 */
	pasteCells(text: string): void | Promise<void>
}

type CellActions =
	| 'editCell'
	| 'startEdit'
	| 'cancelEdit'
	| 'selectCells'
	| 'clearCellSelection'
	| 'copyCells'
	| 'pasteCells'

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

	/**
	 * Render only the rows near the scroll frame, with a spacer for the rest.
	 * The frame is the nearest parent that scrolls, or the page. Defaults to false.
	 */
	rowWindow?: boolean
	/**
	 * One height for every row, in pixels. Without it, the row window measures
	 * each row. With `hasDetail` it measures too, because a detail row has a
	 * height of its own, and this height is what a row counts with before.
	 */
	rowHeight?: number
	/** The height of a row that the row window did not measure yet, in pixels. Defaults to 36. */
	estimatedRowHeight?: number
	/** How many rows more than the frame shows the row window renders on each side. Defaults to 8. */
	overscan?: number
	/** Whether the header rows stay at the top of the scroll frame. Defaults to false. */
	stickyHeader?: boolean
	/** Whether the footer row stays at the bottom of the scroll frame. Defaults to false. */
	stickyFooter?: boolean
	/**
	 * Which rows have a detail row: one wide row under the row, which opens and
	 * closes as a tree row does. Pass the same function while its answers are
	 * the same: a new function makes the table list its rows again.
	 */
	hasDetail?: (row: Row) => boolean

	/**
	 * The rows that stay at the top or the bottom edge. A filter or a page does
	 * not hide them. The totals are of the rows that pass the filter, so a
	 * pinned row that the filter refuses is in view and not in the totals. A
	 * row with child rows cannot be pinned.
	 */
	rowPinning?: RowPinning
	defaultRowPinning?: RowPinning
	onRowPinningChange?: (value: RowPinning, details: TableChangeDetails) => void

	/** Whether a person can edit cells. A column can say otherwise. Defaults to false. */
	editable?: boolean
	/**
	 * Runs when cells got new values: one cell from the editor or from
	 * `editCell`, many cells from a paste. The table does not change the rows.
	 * Put the values into your rows and pass the new rows; `applyEdits` does
	 * that for plain rows. `details.cancel()` refuses the edit.
	 */
	onCellEdit?: (edits: readonly CellEdit<Row>[], details: TableEditDetails) => void

	/** Whether a person can select a range of cells, to copy it or to paste into it. Defaults to false. */
	cellSelection?: boolean
	/**
	 * The selected range of cells, from the cell where it started to the cell
	 * it reaches, or `null`. A cell is a place in the grid: `row` counts the
	 * header rows first, as `aria-rowindex` does, from 0. A range holds body
	 * rows only. It goes away when other rows or columns come to its places.
	 */
	cellRange?: CellRange | null
	defaultCellRange?: CellRange | null
	/** Runs for each step of a drag, and for each other change of the range. */
	onCellRangeChange?: (value: CellRange | null, details: TableChangeDetails) => void
	/** Runs once when a drag that changed the range ends. */
	onCellRangeCommit?: (value: CellRange | null, details: TableCommitDetails) => void
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
	rowPinning: RowPinning
	cellRange: CellRange | null
	/** The id of the cell that is edited (`cellKey`), or `null`. */
	editing: string | null
	/** Why the text of the editor was refused, by cell id. One entry at most. */
	editErrors: Readonly<Record<string, string>>
	/** The rows of the list that the row window renders. */
	rowWindow: RowWindowState
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
const NO_ROW_PINNING: RowPinning = {}
const NO_ERRORS: Readonly<Record<string, string>> = {}
const NO_FLAT: FlatRow<unknown>[] = []

const DEFAULT_ROW_HEIGHT = 36
const DEFAULT_OVERSCAN = 8
const ROW_ALIGNS: readonly RowAlign[] = ['start', 'center', 'end', 'nearest']

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
	rowWindow: [],
	cellRange: [],
	editing: [],
	editErrors: [],
} as const

/** For a part that reads no state at all. */
const SILENT = {
	...QUIET,
	revision: [],
	sort: [],
	filter: [],
	groupBy: [],
	page: [],
	expanded: [],
	columnVisibility: [],
	columnOrder: [],
	columnPinning: [],
	columnDrag: [],
	rowPinning: [],
} as const

/** One cleanup for several. */
const together =
	(...cleanups: (() => void)[]) =>
	() =>
		cleanups.forEach((cleanup) => cleanup())

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
		rowWindow: 'boolean',
		rowHeight: 'number',
		estimatedRowHeight: 'number',
		overscan: 'number',
		stickyHeader: 'boolean',
		stickyFooter: 'boolean',
		hasDetail: 'value',
		rowPinning: 'value',
		defaultRowPinning: 'value',
		onRowPinningChange: 'callback',
		editable: 'boolean',
		onCellEdit: 'callback',
		cellSelection: 'boolean',
		cellRange: 'value',
		defaultCellRange: 'value',
		onCellRangeChange: 'callback',
		onCellRangeCommit: 'callback',
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
		'rowPinning',
		'cellRange',
	],
	commits: ['columnWidths', 'cellRange'],
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
			rowPinning: options.rowPinning ?? options.defaultRowPinning ?? NO_ROW_PINNING,
			rowWindow: firstRowWindow(
				options.rowHeight ?? options.estimatedRowHeight ?? DEFAULT_ROW_HEIGHT,
				options.overscan ?? DEFAULT_OVERSCAN,
			),
			columnTrack: columnTrack(
				layoutColumns(options.columns ?? NO_COLUMNS, {
					visibility: columnVisibility,
					order: columnOrder,
					pinning: columnPinning,
				}),
			),
			columnDrag: null,
			columnResize: null,
			cellRange: options.cellRange ?? options.defaultCellRange ?? null,
			editing: null,
			editErrors: NO_ERRORS,
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
		if (options.rowPinning !== undefined) synced.rowPinning = options.rowPinning
		if (options.cellRange !== undefined) synced.cellRange = options.cellRange
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

		const stableRowPinning = stabilize<RowPinning>()
		const rowPinning = () => stableRowPinning(state().rowPinning)
		// A row with child rows cannot be pinned: its children would leave the
		// list with it, and no place shows them. `pinRow` refuses such a row, and
		// an id of one in the option pins nothing.
		const pinnedIds = memo(
			(pinning: RowPinning, source: { byId: ReadonlyMap<string, DataRow<unknown>> }) =>
				new Set(
					[...(pinning.top ?? []), ...(pinning.bottom ?? [])].filter((id) => {
						const node = source.byId.get(id)
						return !!node && !node.children?.length
					}),
				),
		)

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
			hasDetail: () => options().hasDetail,
			// A pinned row has a place of its own, so it leaves the list.
			omit: (): ReadonlySet<string> => pinnedIds(rowPinning(), model.source()),
		})

		// The pinned rows that exist, for each edge. A row that is named for both edges is at the top.
		const pinnedRows = memo((pinning: RowPinning, source: ReturnType<typeof model.source>) => {
			const seen = new Set<string>()
			const at = (edge: RowPin): FlatRow<unknown>[] => {
				const nodes = (pinning[edge] ?? []).flatMap((id) => {
					const node = source.byId.get(id)
					if (!node || node.children?.length || seen.has(id)) return []
					seen.add(id)
					return [node]
				})
				return nodes.map((node, position) => ({
					id: node.id,
					node,
					level: 0,
					parentId: null,
					position: position + 1,
					setSize: nodes.length,
					expandable: false,
					expanded: false,
					pinned: edge,
				}))
			}
			const top = at('top')
			const bottom = at('bottom')
			return top.length || bottom.length ? { top, bottom } : { top: NO_FLAT, bottom: NO_FLAT }
		})
		const pinned = () => pinnedRows(rowPinning(), model.source())
		/**
		 * Every row of the body in order: the rows pinned to the top, the rows of
		 * the list, the rows pinned to the bottom. The grid counts its rows in
		 * this list.
		 */
		const joinRows = memo(
			(
				top: readonly FlatRow<unknown>[],
				list: FlatRow<unknown>[],
				bottom: readonly FlatRow<unknown>[],
			) => (top.length || bottom.length ? [...top, ...list, ...bottom] : list),
		)
		const bodyRows = () => joinRows(pinned().top, model.flat(), pinned().bottom)

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

		// Every data row that a person can reach, in the order of the screen, for
		// range selection and "select all": the rows pinned to the top, the rows
		// that pass the filter, the rows pinned to the bottom.
		const selectableIds = memo(
			(
				rows: readonly DataRow<unknown>[],
				pins: { top: readonly FlatRow<unknown>[]; bottom: readonly FlatRow<unknown>[] },
			) => {
				const ids = pins.top.map((row) => row.id)
				walkRows(rows, (node) => ids.push(node.id))
				for (const row of pins.bottom) ids.push(row.id)
				return ids
			},
		)
		const selectableOrder = () => selectableIds(model.listed(), pinned())

		function canSelect(id: string): boolean {
			const node = model.rowById(id)
			return !!node && (options().canSelect?.(node.row) ?? true)
		}

		const selection = createSelection(context, {
			key: 'selected',
			set: (value, details) => change('selected', value, details),
			order: selectableOrder,
			multiple: () => options().selection === 'multiple',
			selectable: canSelect,
		})

		const headerRowCount = () => layout().headerRows.length
		/** Without rows, the body holds one row that says so. */
		const bodyRowCount = () => bodyRows().length || 1
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
			// So is a detail row.
			const flat = bodyRows()
			const at = flat[cell.row - head]
			const wide = flat.length ? at?.node.kind === 'group' || !!at?.detail : cell.row === head
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
			// A key can move focus to a row that the row window does not render.
			// A row under the pointer is where the person looks, so a press on a
			// row that an edge of the frame cuts must not move the rows.
			reveal: (cell, byKey) => {
				const row = bodyRows()[cell.row - headerRowCount()]
				if (!row || row.pinned || !(options().rowWindow ?? false)) return
				if (byKey || !rowWindow.rendered(row.id)) rowWindow.scrollTo(row.id)
			},
		})

		const stickyRows = memo((rows: { top: FlatRow<unknown>[]; bottom: FlatRow<unknown>[] }) =>
			[...rows.top, ...rows.bottom].flatMap((row) =>
				row.pinned ? [{ key: row.id, edge: row.pinned }] : [],
			),
		)
		const sticky = createStickyRows(context, { keyed: () => stickyRows(pinned()) })

		/** The row of the list that holds the active cell. It stays rendered, so the table keeps its tab stop. */
		const activeRow = (): readonly string[] => {
			const active = state().active
			const row = active ? bodyRows()[active.row - headerRowCount()] : undefined
			return row && !row.pinned ? [row.id] : NO_IDS
		}
		const rowWindow = createRowWindow(context, {
			key: 'rowWindow',
			enabled: () => options().rowWindow ?? false,
			rows: () => model.flat(),
			// A detail row has a height of its own. So with detail rows, the rows
			// are measured, and the one row height is what a row counts with before.
			rowHeight: () => (options().hasDetail ? undefined : options().rowHeight),
			estimate: () => options().rowHeight ?? options().estimatedRowHeight ?? DEFAULT_ROW_HEIGHT,
			overscan: () => options().overscan ?? DEFAULT_OVERSCAN,
			keep: activeRow,
			cover: () => sticky.cover(),
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

		const hasEditing = memo(
			(columns: readonly ColumnDef[], all: boolean) =>
				all || columns.some((column) => column.editable !== undefined && column.editable !== false),
		)
		/** Whether some cell of the table can be edited. */
		const editing = () => hasEditing(layout().all, options().editable ?? false)

		function canEdit(node: DataRow<unknown>, column: ColumnDef): boolean {
			const rule = column.editable ?? options().editable ?? false
			return typeof rule === 'function' ? rule(node.row) : rule
		}

		/** The data row and the column of a cell id, when both exist. */
		function cellOf(id: string): { node: DataRow<unknown>; column: ColumnDef } | undefined {
			const ref = parseCellKey(id)
			const node = ref && model.rowById(ref.rowId)
			const column = ref && layout().byId.get(ref.columnId)
			return node && column ? { node, column } : undefined
		}

		/** The place of a cell in the grid, when its row and its column are in view. */
		function placeOf(id: string): GridCell | undefined {
			const ref = parseCellKey(id)
			if (!ref) return undefined
			const row = flatIndex(bodyRows()).get(ref.rowId)
			const col = layout().index.get(ref.columnId)
			if (row === undefined || col === undefined) return undefined
			return { row: headerRowCount() + row, col }
		}

		/** The id of the cell of a data row at a place of the grid. */
		function cellIdAt(row: number, col: number): string | undefined {
			const flat = bodyRows()[row - headerRowCount()]
			const column = layout().leaves[col]
			if (!flat || !column || flat.node.kind !== 'row' || flat.detail) return undefined
			return cellKey(flat.id, column.id)
		}

		const inBody = (row: number) =>
			row >= headerRowCount() && row < headerRowCount() + bodyRows().length

		const editReason = (reason: string): TableEditReason =>
			reason === 'enter-key' || reason === 'tab-key' || reason === 'focus-out' || reason === 'paste'
				? reason
				: 'imperative'

		/** Tells the caller about new values. Returns whether a listener refused them. */
		function report(edits: CellEdit[], reason: string, event?: Event): boolean {
			return dispatch(context, 'onCellEdit', edits, { reason: editReason(reason), event })
		}

		/**
		 * Checks a new value of a cell and reports it. The answer is `true`, or
		 * the reason why the value is refused. The table never writes the value
		 * into the row: the caller does, when `onCellEdit` runs.
		 */
		function saveCell(
			node: DataRow<unknown>,
			column: ColumnDef,
			input: { text: string } | { value: unknown },
			reason: string,
			event?: Event,
		): SaveResult | Promise<SaveResult> {
			const finish = (checked: Checked): SaveResult => {
				if ('issues' in checked) return checked.issues[0] ?? message('invalidValue')()
				const previous = cellValue(node.row, column)
				if (sameValue(previous, checked.value)) return true
				const edits = [
					{
						rowId: node.id,
						columnId: column.id,
						row: node.row,
						column,
						value: checked.value,
						previous,
					},
				]
				return report(edits, reason, event) ? message('editRefused')() : true
			}
			const failed = (error: unknown) => (error instanceof Error ? error.message : String(error))
			try {
				const checked = resolveValue(input, node.row, column, message('notNumber'))
				return checked instanceof Promise ? checked.then(finish).catch(failed) : finish(checked)
			} catch (error) {
				// A `parse` or a schema that throws refuses the value with its own words.
				return failed(error)
			}
		}

		/** The cell after or before a cell, in reading order, inside the rows of the body. */
		function nextCell(from: GridCell, back: boolean): GridCell | undefined {
			const last = layout().leaves.length - 1
			let row = from.row
			let col = from.col + (back ? -1 : 1)
			if (col < 0 || col > last) {
				row += back ? -1 : 1
				col = back ? last : 0
			}
			if (!inBody(row)) return undefined
			const spot = area({ row, col })
			return { row: spot.row, col: spot.col }
		}

		const edit = createCellEdit(context, {
			key: 'editing',
			errors: 'editErrors',
			text: (id) => {
				const cell = cellOf(id)
				return cell ? editText(cell.node.row, cell.column) : ''
			},
			canEdit: (id) => {
				const cell = cellOf(id)
				return !!cell && canEdit(cell.node, cell.column)
			},
			save: (id, text, details) => {
				const cell = cellOf(id)
				// The row or the column went away while the editor was open, so there is nothing to save.
				if (!cell) return true
				return saveCell(cell.node, cell.column, { text }, details.reason, details.event)
			},
			// The person looks at the field, so a refusal is said at once.
			refused: (_id, reason) => announce(reason, { priority: 'assertive' }),
			// The input goes away with the edit, so focus goes to a cell: the one
			// that was edited, or after Tab the next one, as in a spreadsheet.
			done: (id, details) => {
				const at = placeOf(id)
				if (!at) return
				const back = details.event instanceof KeyboardEvent && details.event.shiftKey
				const tab = details.saved && details.reason === 'tab-key'
				const to = tab ? (nextCell(at, back) ?? at) : at
				grid.focus(to, { reason: tab ? 'list-navigation' : 'imperative', event: details.event })
			},
		})

		const cellSelection = () => options().cellSelection ?? false
		const range = createTableRange(context, {
			key: 'cellRange',
			grid,
			rows: rowCount,
			cols: () => layout().leaves.length,
			body: () => {
				const count = bodyRows().length
				const first = headerRowCount()
				return count ? { first, last: first + count - 1 } : undefined
			},
			set: (next, details) => change('cellRange', next, details),
			commit: (next, details) => commit('cellRange', next, details),
			reveal: (cell) => {
				const row = bodyRows()[cell.row - headerRowCount()]
				if (row && !row.pinned && (options().rowWindow ?? false)) rowWindow.scrollTo(row.id)
			},
			message: ({ top, left, bottom, right }) =>
				message('cellsSelected')({ rows: bottom - top + 1, columns: right - left + 1 }),
		})

		/** The selected cells: the range, or the active cell alone. `undefined` outside the rows of the body. */
		function selectedCells(): CellBounds | undefined {
			const bounds = range.bounds(state())
			if (!bounds || !inBody(bounds.top) || !inBody(bounds.bottom)) return undefined
			return bounds
		}

		/**
		 * The text of the selected cells. Each value is the text that its editor
		 * shows, without the format of the column, so a paste of the text into
		 * the same columns gives the same values.
		 */
		function copyText(): string {
			if (!selectedCells()) return ''
			const head = headerRowCount()
			const rows = bodyRows()
			const leaves = layout().leaves
			return range.text(state(), ({ row, col }) => {
				const flat = rows[row - head]
				const column = leaves[col]
				if (!flat || !column || flat.node.kind !== 'row' || flat.detail) return ''
				return editText(flat.node.row, column)
			})
		}

		/**
		 * Puts text into cells, from the first selected cell on. One value fills
		 * every selected cell. Each value goes through the check of its column,
		 * and one refusal stops the paste before any cell changes: half of a
		 * paste is worse than none. Cells that cannot be edited are skipped.
		 */
		function pasteText(text: string, event?: Event): void | Promise<void> {
			const bounds = selectedCells()
			if (!bounds) throw new Error(message('pasteNowhere')())
			const block = textToCells(text)
			const width = Math.max(0, ...block.map((line) => line.length))
			const single = block.length === 1 && width === 1
			const head = headerRowCount()
			const rows = bodyRows()
			const leaves = layout().leaves
			const bottom = single
				? bounds.bottom
				: Math.min(head + rows.length - 1, bounds.top + block.length - 1)
			const right = single ? bounds.right : Math.min(leaves.length - 1, bounds.left + width - 1)
			const targets: { node: DataRow<unknown>; column: ColumnDef; text: string }[] = []
			for (let row = bounds.top; row <= bottom; row++) {
				const flat = rows[row - head]
				if (!flat || flat.node.kind !== 'row' || flat.detail) continue
				for (let col = bounds.left; col <= right; col++) {
					const column = leaves[col]
					const value = single ? block[0]?.[0] : block[row - bounds.top]?.[col - bounds.left]
					if (!column || value === undefined || !canEdit(flat.node, column)) continue
					targets.push({ node: flat.node, column, text: value })
				}
			}
			if (!targets.length) throw new Error(message('pasteNowhere')())
			const finish = (checked: readonly Checked[]): void => {
				const edits: CellEdit[] = []
				checked.forEach((result, index) => {
					const target = targets[index]
					if (!target) return
					if ('issues' in result) {
						throw new Error(
							message('pasteRefused')({
								column: label(target.column.id),
								text: target.text,
								message: result.issues[0] ?? message('invalidValue')(),
							}),
						)
					}
					const previous = cellValue(target.node.row, target.column)
					if (sameValue(previous, result.value)) return
					edits.push({
						rowId: target.node.id,
						columnId: target.column.id,
						row: target.node.row,
						column: target.column,
						value: result.value,
						previous,
					})
				})
				if (edits.length && report(edits, 'paste', event)) {
					throw new Error(message('editRefused')())
				}
				if (cellSelection()) {
					const pasted = {
						anchor: { row: bounds.top, col: bounds.left },
						end: { row: bottom, col: right },
					}
					// Without the event: the range changes because of the paste, and a
					// paste is not a reason that a change of state knows.
					range.select(pasted, { reason: 'imperative' })
				}
				announce(message('cellsPasted')({ cells: edits.length }))
			}
			const checks = targets.map((target) =>
				resolveValue({ text: target.text }, target.node.row, target.column, message('notNumber')),
			)
			return checks.some((check) => check instanceof Promise)
				? Promise.all(checks.map((check) => Promise.resolve(check))).then(finish)
				: finish(checks as Checked[])
		}

		function onCopy(event: ClipboardEvent): void {
			const bounds = selectedCells()
			if (!bounds) return
			// Without a range, a person who selected text with the pointer copies that text.
			const page = event.target instanceof Node ? event.target.ownerDocument : null
			if (!state().cellRange && page?.getSelection()?.isCollapsed === false) return
			event.clipboardData?.setData('text/plain', copyText())
			event.preventDefault()
			const cells = (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1)
			announce(message('cellsCopied')({ cells }))
		}

		function onPaste(event: ClipboardEvent): void {
			const text = event.clipboardData?.getData('text/plain')
			if (!text || !editing()) return
			event.preventDefault()
			const failed = (error: unknown) =>
				announce(error instanceof Error ? error.message : String(error), { priority: 'assertive' })
			try {
				const later = pasteText(text, event)
				if (later) void later.catch(failed)
			} catch (error) {
				failed(error)
			}
		}

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
			// A row that shows as one that can open, can open: a row whose child rows all left the list has a detail row.
			if (bodyRows()[flatIndex(bodyRows()).get(id) ?? -1]?.expandable) return
			// A row with a detail row opens too. A pinned row is outside the list and has none.
			const node = model.rowById(id)
			const detail = node && !node.children?.length && options().hasDetail?.(node.row)
			if (detail && !pinnedIds(rowPinning(), model.source()).has(id)) return
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
				followRows()
				followCells()
				const page = state().page
				// Fewer rows can mean fewer pages: new data, or a row that is pinned and leaves the list.
				const fewer = changed.includes('revision') || changed.includes('rowPinning')
				if (!page || (!newList && !fewer)) return
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
		// The row that the active cell is on, for the same reason. A row that is
		// pinned, or a row that opens above the active cell, moves the rows under
		// it by one place, and the cell that has focus is still the same element.
		let seenBody: readonly FlatRow<unknown>[] = bodyRows()
		let activeRowId: string | undefined

		function followRows(): void {
			const rows = bodyRows()
			const head = headerRowCount()
			const active = state().active
			if (active && rows !== seenBody && activeRowId !== undefined) {
				const index = flatIndex(rows).get(activeRowId)
				const row = index === undefined ? active.row : head + index
				if (row !== active.row) context.store.set({ active: { row, col: active.col } })
			}
			seenBody = rows
			const now = state().active
			activeRowId = now ? rows[now.row - head]?.id : undefined
		}
		// A range is places in the grid. When other rows or columns come to those
		// places, the range is no longer what the person selected, so it goes. A
		// new array with the same rows at the corners keeps the range: that is
		// what the caller passes after an edit.
		type Corners = { range: CellRange; ids: readonly (string | undefined)[] }
		let corners: Corners | undefined

		function followCells(): void {
			// An editor whose row or column left the table has no cell to be in.
			const edited = state().editing
			if (edited !== null && !placeOf(edited)) edit.drop()
			const current = state().cellRange
			if (!current) {
				corners = undefined
				return
			}
			const head = headerRowCount()
			const rows = bodyRows()
			const leaves = layout().leaves
			const ids = [
				rows[current.anchor.row - head]?.id,
				rows[current.end.row - head]?.id,
				leaves[current.anchor.col]?.id,
				leaves[current.end.col]?.id,
				String(rows.length),
				String(leaves.length),
			]
			const before = corners
			corners = { range: current, ids }
			if (before?.range !== current || sameContent(before.ids, ids)) return
			corners = undefined
			change('cellRange', null, { reason: 'reset' })
		}
		context.onOptions(() => {
			// The options are not in place yet when this runs, so the check waits one turn.
			queueMicrotask(followColumns)
			queueMicrotask(followRows)
			queueMicrotask(followCells)
			// Whether the header and the footer stick is an option, and so is the row window.
			sticky.refresh()
			queueMicrotask(() => rowWindow.refresh())
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

		const controller: Omit<TableController, 'pinRow' | 'scrollToRow' | CellActions> = {
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
				// What is open stays open: a detail row is not a tree row or a group, and it is not closed here.
				const all = [...new Set([...state().expanded, ...expandable(model.grouped())])]
				if (!sameContent(all, state().expanded)) change('expanded', all, { reason: 'imperative' })
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
				const all = selectableOrder().filter(canSelect)
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

		const rowIndex = () => flatIndex(bodyRows())

		const rowActions: Pick<TableController, 'pinRow' | 'scrollToRow'> = {
			pinRow(rowId, edge) {
				const node = requireRow(rowId, 'pin')
				if (edge !== null && edge !== 'top' && edge !== 'bottom') {
					throw new Error(
						`A row is pinned to "top" or "bottom", or freed with null, not "${String(edge)}".`,
					)
				}
				// The children of a pinned row would leave the list with it, and no place shows them.
				if (edge && node.children?.length) {
					throw new Error(
						`Row "${rowId}" has child rows. Only a row without child rows can be pinned.`,
					)
				}
				const current = state().rowPinning
				const other = edge === 'top' ? current.bottom : current.top
				// A row that is at that edge already keeps its place among the pinned rows.
				if (edge && current[edge]?.includes(rowId) && !other?.includes(rowId)) return
				const without = (ids: readonly string[] = []) => ids.filter((id) => id !== rowId)
				const next = {
					top: edge === 'top' ? [...without(current.top), rowId] : without(current.top),
					bottom: edge === 'bottom' ? [...without(current.bottom), rowId] : without(current.bottom),
				}
				const same =
					sameContent(next.top, current.top ?? []) && sameContent(next.bottom, current.bottom ?? [])
				if (!same) change('rowPinning', next, { reason: 'imperative' })
			},
			scrollToRow(rowId, align = 'nearest') {
				if (!ROW_ALIGNS.includes(align)) {
					throw new Error(
						`A row scrolls to "start", "center", "end" or "nearest", not "${String(align)}".`,
					)
				}
				const index = rowIndex().get(rowId)
				if (index === undefined) {
					requireRow(rowId, 'scroll to')
					throw new Error(
						`Row "${rowId}" is not in the list now: a filter, a page or a closed parent row hides it.`,
					)
				}
				// A pinned row is in view at all times.
				if (bodyRows()[index]?.pinned) return
				rowWindow.scrollTo(rowId, align)
			},
		}

		function requireEditable(rowId: string, columnId: string) {
			const node = requireRow(rowId, 'edit')
			const found = column(columnId, 'edit')
			if (canEdit(node, found)) return { node, column: found }
			const open = layout().all.filter(
				(item) => (item.editable ?? options().editable ?? false) !== false,
			)
			throw new Error(
				`The cell of row "${rowId}" in column "${columnId}" cannot be edited. Columns with cells that can be edited: ${listed(open.map((item) => item.id))}.`,
			)
		}

		function requireCell(ref: CellRef, purpose: string): GridCell {
			if (typeof ref?.rowId !== 'string' || typeof ref.columnId !== 'string') {
				throw new Error('A cell is `{ rowId, columnId }`, with the id of a row and of a column.')
			}
			requireRow(ref.rowId, purpose)
			requireVisible(ref.columnId, purpose)
			const at = placeOf(cellKey(ref.rowId, ref.columnId))
			if (at) return at
			throw new Error(
				`Row "${ref.rowId}" is not in the list now: a filter, a page or a closed parent row hides it.`,
			)
		}

		const cellActions: Pick<TableController, CellActions> = {
			editCell(rowId, columnId, value) {
				const cell = requireEditable(rowId, columnId)
				const input = typeof value === 'string' ? { text: value } : { value }
				const finish = (result: SaveResult): void => {
					if (result === true) return
					throw new Error(
						`Column "${columnId}" refuses ${String(JSON.stringify(value))} for row "${rowId}": ${result}`,
					)
				}
				const result = saveCell(cell.node, cell.column, input, 'imperative')
				return result instanceof Promise ? result.then(finish) : finish(result)
			},
			startEdit(rowId, columnId) {
				requireEditable(rowId, columnId)
				const at = requireCell({ rowId, columnId }, 'edit')
				// The row must be in the page for its editor, and focus is on a cell before an edit.
				grid.focus(at, { reason: 'imperative' })
				edit.start(cellKey(rowId, columnId), { reason: 'imperative' })
			},
			cancelEdit() {
				edit.cancel()
			},
			selectCells(from, to = from) {
				if (!cellSelection()) {
					throw new Error(
						'This table has no cell selection. Set its `cellSelection` option to true.',
					)
				}
				const anchor = requireCell(from, 'select')
				const end = requireCell(to, 'select')
				// The active cell is the start of a range. Focus stays where it is: a
				// call from code must not take it from the person.
				const active = state().active
				if (active?.row !== anchor.row || active.col !== anchor.col) {
					context.store.set({ active: anchor })
				}
				range.select({ anchor, end }, { reason: 'imperative' })
			},
			clearCellSelection() {
				range.select(null, { reason: 'imperative' })
			},
			copyCells: () => copyText(),
			pasteCells(text) {
				if (typeof text !== 'string') throw new Error('`pasteCells` takes a text.')
				return pasteText(text)
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
			...rowActions,
			...cellActions,
			edit,
			range,
			cellIdAt,
			/** The id of a body cell as a list, for `selects`: one id for the cell of a data row, else none. */
			cellIds: (cell: { row: number; col: number; header?: boolean }): readonly string[] => {
				const id = cell.header ? undefined : cellIdAt(cell.row, cell.col)
				return id === undefined ? NO_IDS : [id]
			},
			inBody,
			/** Whether a cell can be edited, by its id. */
			canEditCell: (id: string) => {
				const cell = cellOf(id)
				return !!cell && canEdit(cell.node, cell.column)
			},
			hasEditing: editing,
			cellSelection,
			/**
			 * Saves a value for the cell that is edited, with the check of its
			 * column, and closes the editor. For an editor that is not the text
			 * field of the table, such as a list of choices.
			 */
			saveEdit(value: unknown, event?: Event): void {
				const id = state().editing
				const cell = id === null ? undefined : cellOf(id)
				if (!cell) return
				edit.settle(saveCell(cell.node, cell.column, { value }, 'imperative', event), {
					reason: 'imperative',
					event,
				})
			},
			onCopy,
			onPaste,
			sticky,
			rowWindow,
			/** What the body renders of the rows of the list, or `undefined` when it renders them all. */
			windowParts: () => rowWindow.parts(),
			/** The rows of the list, without the pinned rows. The row window counts its rows in this list. */
			listRows: () => model.flat(),
			/** The rows that are pinned to each edge. */
			pinnedRows: pinned,
			rowPin: (id: string): RowPin | undefined => bodyRows()[rowIndex().get(id) ?? -1]?.pinned,
			stickyHeader: () => options().stickyHeader ?? false,
			stickyFooter: () => options().stickyFooter ?? false,
			rowHeight: () => options().rowHeight,
			windowed: () => options().rowWindow ?? false,
			model,
			grid,
			selection,
			reorder,
			resize,
			pins,
			message,
			/**
			 * The rows of the body in order, pinned rows too. The header rows come
			 * first in the grid, so grid row `n` is `rows()[n - headerRowCount()]`.
			 */
			rows: bodyRows,
			row: (id: string): FlatRow<unknown> | undefined => bodyRows()[rowIndex().get(id) ?? -1],
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
			selects: selects({
				selected: [],
				active: [],
				columnTrack: [],
				columnResize: [],
				rowWindow: [],
				cellRange: [],
				editing: [],
				editErrors: [],
			}),
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
				const height = api.rowHeight()
				const variables = [
					sized ? `--table-width:${total}px` : '',
					height === undefined ? '' : `--table-row-height:${height}px`,
				].filter(Boolean)
				return {
					'aria-rowcount': String(api.gridRowCount()),
					'aria-colcount': String(columns.length),
					'aria-multiselectable':
						api.selectionMode() === 'multiple' || api.cellSelection() ? 'true' : undefined,
					'data-cell-selection': api.cellSelection() ? '' : undefined,
					'data-sized': sized ? '' : undefined,
					'data-row-window': api.windowed() ? '' : undefined,
					style: variables.length ? variables.join(';') : undefined,
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
		// They also hold the heights of the rows that stick to the top and the bottom.
		head: slot({
			role: 'rowgroup',
			bind: (el, { api }) => together(api.pins.bindGroup(el), api.sticky.bindGroup(el)),
		}),
		body: slot({
			role: 'rowgroup',
			bind: (el, { api }) =>
				together(api.pins.bindGroup(el), api.sticky.bindGroup(el), api.rowWindow.bindBody(el)),
		}),
		foot: slot({
			role: 'rowgroup',
			bind: (el, { api }) => together(api.pins.bindGroup(el), api.sticky.bindGroup(el)),
		}),
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
		'header-row': slot<{ index: number }>({
			props: { index: 'number' },
			role: 'row',
			// The row reads options and its own props, and no state.
			selects: selects(SILENT),
			attrs: (_state, { props, api }) => ({
				'aria-rowindex': String(props.index + 1),
				'data-sticky': api.stickyHeader() ? 'top' : undefined,
			}),
			bind: (el, { api }) => api.sticky.bind(el, () => (api.stickyHeader() ? 'top' : undefined)),
		}),
		/**
		 * A row that stands in for the rows that the row window does not render.
		 * `size` is their height in pixels, which the row gets as
		 * `--table-spacer-size`. `value` is the key of the gap; the first gap is
		 * the place where the list starts.
		 */
		spacer: slot<{ value: string; size: number }>({
			props: { value: 'string', size: 'number' },
			selects: selects(SILENT),
			attrs: (_state, { props }) => ({
				'aria-hidden': 'true',
				'data-empty': props.size > 0 ? undefined : '',
				style: `--table-spacer-size:${props.size}px`,
			}),
			bind: (el, { key, api }) => (key === 'gap-0' ? api.rowWindow.bindOrigin(el) : () => {}),
		}),
		/**
		 * A row that holds no data row: the footer row, or the row that says "no
		 * rows". `footer` marks the footer row, which can stick to the bottom.
		 */
		'plain-row': slot<{ index: number; footer?: boolean }>({
			props: { index: 'number', footer: 'boolean' },
			role: 'row',
			selects: selects(SILENT),
			attrs: (_state, { props, api }) => ({
				'aria-rowindex': String(props.index + 1),
				'data-kind': props.footer ? 'footer' : undefined,
				'data-sticky': props.footer && api.stickyFooter() ? 'bottom' : undefined,
			}),
			// Whether the row is the footer row is read once: the index of a row
			// changes with the rows, and what the row is does not.
			bind: (el, { props, api }) => {
				const footer = !!props.footer
				return api.sticky.bind(el, () => (footer && api.stickyFooter() ? 'bottom' : undefined))
			},
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
				// A detail row belongs to a data row, and it is not that row.
				const isRow = row.node.kind === 'row' && !row.detail
				const selected = isRow && api.isSelected(key)
				const tree = api.isTree() && !row.pinned
				return {
					...index,
					'aria-selected': isRow && api.canSelect(key) ? String(selected) : undefined,
					'aria-expanded': row.expandable ? String(row.expanded) : undefined,
					'aria-level': tree ? String(row.level + 1) : undefined,
					'aria-posinset': tree ? String(row.position) : undefined,
					'aria-setsize': tree ? String(row.setSize) : undefined,
					'data-kind': row.detail ? 'detail' : row.node.kind,
					'data-selected': selected ? '' : undefined,
					'data-expanded': row.expanded ? '' : undefined,
					'data-pinned': row.pinned,
					// A pinned row stays in view, so it sticks to its edge.
					'data-sticky': row.pinned,
				}
			},
			bind: (el, { key, api }) =>
				together(api.rowWindow.bindRow(el, key), api.sticky.bindKeyed(el, key)),
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
			keys: [
				...GRID_KEYS,
				'Enter',
				'F2',
				'Escape',
				' ',
				'alt+ArrowLeft',
				'alt+ArrowRight',
				'shift+ArrowUp',
				'shift+ArrowDown',
				'shift+ArrowLeft',
				'shift+ArrowRight',
				'shift+Home',
				'shift+End',
				'shift+ ',
				'mod+ ',
				'mod+a',
			],
			// A cell reads the range and the editor only for its own place and its own id.
			selects: selects({
				...QUIET,
				active: byCell,
				cellRange: byCellRange,
				editing: ({ props, api }) => api.cellIds(props),
				editErrors: ({ props, api }) => api.cellIds(props),
				expanded: [],
			}),
			state: (state, { props, api }) => {
				const id = props.header ? undefined : api.cellIdAt(props.row, props.col)
				return {
					/** Whether the editor of the cell is open. The renderer then shows the editor in the cell. */
					editing: id !== undefined && state.editing === id,
					/** Why the text of the editor was refused. */
					error: id === undefined ? undefined : state.editErrors[id],
				}
			},
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
				const id = props.header ? undefined : api.cellIdAt(props.row, props.col)
				const editable = id !== undefined && api.canEditCell(id)
				const ranged = !props.header && api.cellSelection() && api.inBody(props.row)
				return {
					...(ranged ? api.range.cellAttrs(state, props) : undefined),
					// In a grid, a cell can be edited unless it says that it cannot.
					'aria-readonly': id !== undefined && api.hasEditing() && !editable ? 'true' : undefined,
					'data-editable': editable ? '' : undefined,
					'data-editing': id !== undefined && state.editing === id ? '' : undefined,
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
					// Enter, F2 or a character opens the editor of a cell that can be
					// edited. It comes before the move into the cell: the cell holds a
					// value, and the editor is its control.
					const id = onCell && !props.header ? api.cellIdAt(props.row, props.col) : undefined
					if (id !== undefined && api.edit.keydown(event, id)) return
					if (
						onCell &&
						api.cellSelection() &&
						api.inBody(props.row) &&
						event.key !== 'Enter' &&
						event.key !== 'F2'
					) {
						// Space selects the row when rows can be selected, with Shift too.
						const forRow =
							event.key === ' ' &&
							!event.ctrlKey &&
							!event.metaKey &&
							row?.node.kind === 'row' &&
							api.canSelect(row.id)
						if (!forRow && api.range.keydown(event)) return
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
						const ranged =
							!props.header && event.button === 0 && api.cellSelection() && api.inBody(props.row)
						// The cell is under the pointer, so focus must not scroll it: a row
						// that the header cuts would move away from the pointer. Focus
						// that is here already is not moved again by the grid. A press
						// with Shift stretches the range, and focus stays at its start.
						if (!ranged || !event.shiftKey) el?.focus({ preventScroll: true })
						// A press on a cell of the body starts a range, and a drag paints it.
						if (ranged) api.range.pointerdown(event, props)
						else api.grid.focus(props, { reason: 'item-press', event })
					}
					// The whole header cell is the grip of its column. A drag starts only
					// after the pointer moves, so a press on a sort button stays a press.
					// A press in a text field selects text or moves the caret there.
					const field = target?.closest('input, select, textarea, [contenteditable]')
					if (header?.leaf && !field) api.reorder.pointerdown(event, header.column.id)
				},
				dblclick: (event, { api, props, el }) => {
					if (props.header) return
					const target = event.target instanceof Element ? event.target : undefined
					// A double press on a control inside the cell belongs to that control.
					if (
						target &&
						target !== el &&
						target.closest('a[href], button, input, select, textarea')
					) {
						return
					}
					const id = api.cellIdAt(props.row, props.col)
					if (id !== undefined) api.edit.dblclick(event, id)
				},
				// Copy and paste act on the cells when focus is on a cell, and not in a field inside one.
				copy: (event, { api, props, el }) => {
					if (event.target === el && !props.header) api.onCopy(event)
				},
				paste: (event, { api, props, el }) => {
					if (event.target === el && !props.header) api.onPaste(event)
				},
			},
			bind: (el, { api, props }) => {
				// The range joins the cell to the grid too, and finds it under a pointer that drags.
				const cleanups = [api.range.bind(el, props)]
				const header = props.header ? api.headerAt(props.row, props.col) : undefined
				if (header?.leaf) {
					const columnId = header.column.id
					cleanups.push(api.reorder.bind(el, columnId), api.pins.bind(el, columnId))
				}
				return () => cleanups.forEach((cleanup) => cleanup())
			},
		}),
		/**
		 * The text field that edits a cell. Render it inside the cell while the
		 * `editing` state of the cell part is true. `value` is the id of the cell,
		 * from `cellKey`.
		 */
		editor: slot<{ value: string }>({
			props: { value: 'string' },
			selects: selects({ ...SILENT, editErrors: ({ key }) => [key] }),
			attrs: (state, { id, key, api }) => {
				const cell = parseCellKey(key)
				const error = api.edit.error(state, key)
				return {
					'aria-label': api.message('editCell')({
						column: cell ? api.columnLabel(cell.columnId) : '',
					}),
					'aria-invalid': error === undefined ? undefined : 'true',
					'aria-errormessage': error === undefined ? undefined : `${id}-edit-error`,
					'data-invalid': error === undefined ? undefined : '',
					autocomplete: 'off',
				}
			},
			on: {
				keydown: (event, { api }) => {
					api.edit.inputKeydown(event)
					// A key in the field is text or a command of the editor, and never a move in the grid.
					event.stopPropagation()
				},
				focusout: (event, { api, el }) => {
					api.edit.focusout(event, el?.closest<HTMLElement>('[data-slot="table"]'))
				},
			},
			bind: (el, { api }) => api.edit.bindInput(el as HTMLInputElement),
		}),
		/** The reason why the text of the editor was refused. The editor names it as its error message. */
		'edit-error': slot<{ value: string }>({
			props: { value: 'string' },
			selects: selects(SILENT),
			attrs: (_state, { id }) => ({ id: `${id}-edit-error` }),
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
			'pinRow',
			'scrollToRow',
			'editCell',
			'selectCells',
			'clearCellSelection',
			'copyCells',
			'pasteCells',
		],
	},
})
