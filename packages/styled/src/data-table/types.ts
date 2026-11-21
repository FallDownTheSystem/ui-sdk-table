import type {
	CellEdit,
	CellSlotProps,
	DetailSlotProps,
	EditorSlotProps,
	FootSlotProps,
	GroupSlotProps,
	HeaderSlotProps,
	CellRange,
	ColumnDef,
	ColumnFacetsSource,
	ColumnPinning,
	ColumnVisibility,
	ColumnWidths,
	DataRow,
	ExportOptions,
	FilterState,
	PageState,
	RowPinning,
	SortRule,
	TableChangeDetails,
	TableCommitDetails,
	TableController,
	TableEditDetails,
	TableView,
} from 'ui-sdk-table-vue'
import { inject, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'
import type { DataTableExportFormat } from './messages'
import type { DataTableMessages } from './messages'

/** A class as Vue takes it: a text, a list or a record of switches. */
export type ClassValue = string | false | null | undefined | ClassValue[] | Record<string, unknown>

/** One entry of a list of the styled table. */
export type DataTableSelectItem = { value: string; label: string }

/** What the styled table reads from the `meta` of a column. */
export type DataTableColumnMeta<Row = unknown> = {
	/** Where the text of the header, the cells and the total sits. A column of numbers defaults to the end. */
	align?: 'start' | 'center' | 'end'
	/** A class for each body cell of the column, or a function that gives one for a cell. */
	class?: ClassValue | ((value: unknown, row: Row) => ClassValue)
	/** A class for the header cell of the column. */
	headerClass?: ClassValue
	/** Whether the text of a cell breaks into lines. Defaults to false. */
	wrap?: boolean
	/** Whether the column has a control in the filter popover. Defaults to true. */
	filterable?: boolean
}

/** A column of the styled table: a column of the headless table, with a typed `meta`. */
export type DataTableColumn<Row = unknown> = Omit<ColumnDef<Row>, 'meta' | 'columns'> & {
	meta?: DataTableColumnMeta<Row>
	columns?: readonly DataTableColumn<Row>[]
}

export type DataTableExport = {
	/** Whether the menu offers a CSV file. Defaults to true. */
	csv?: boolean
	/** Whether the menu offers an Excel file. Defaults to true. */
	xlsx?: boolean
	/** The name of the file, without its ending. Defaults to `export`. */
	filename?: string | (() => string)
	/** Which rows and columns the file holds. Defaults to the rows that pass the filters and the columns in view. */
	options?: ExportOptions
}

export interface DataTableProps<Row> {
	rows?: readonly Row[]
	columns?: readonly DataTableColumn<Row>[]
	/** The name of the table, for assistive technology and for an agent. */
	label?: string

	/** Shows a search field over the table. The text is `filter.search`. */
	search?: boolean
	/** Shows a button over the table that opens a filter for each column in view. */
	columnFilters?: boolean
	/** Shows a menu over the table that shows and hides columns. */
	columnMenu?: boolean
	/**
	 * Shows the pages under the table. Without `page` and `defaultPage`, the
	 * table starts on its first page with the first of `pageSizes`.
	 */
	pagination?: boolean
	/** The page sizes that a person can choose. Defaults to 10, 25, 50 and 100. */
	pageSizes?: readonly number[]
	/** Shows a menu over the table that writes a CSV or an Excel file. */
	export?: boolean | DataTableExport
	/** `full` (the default) fills the place the table has. `auto` is as wide as the columns need. */
	width?: 'full' | 'auto'
	/**
	 * What scrolls the rows. `self` (the default): the frame around the table
	 * scrolls, once `wrapperClass` gives it a height. `page`: the frame never
	 * scrolls, so sticky rows stay at the edge of the page or of a scroll box
	 * around the table.
	 */
	scroll?: 'self' | 'page'
	/** How many skeleton rows show while `loading` is set and the table has no rows. Defaults to 3. */
	skeletonRows?: number
	/** Texts of the controls and of the table, in another language or with other words. */
	messages?: Partial<DataTableMessages>

	/** A class for the frame around the table, which has the border and scrolls. */
	wrapperClass?: ClassValue
	/** A class for the `table` element. */
	tableClass?: ClassValue
	/** A class for each header cell. */
	headerClass?: ClassValue
	/** A class for each row of the body, or a function that gives one for a data row. */
	rowClass?: ClassValue | ((row: Row, index: number) => ClassValue)
	/** A class for each body cell. */
	cellClass?: ClassValue

	getRowId?: (row: Row, index: number, parent: DataRow<Row> | null) => string | number
	getChildren?: (row: Row) => readonly Row[] | undefined
	locale?: string
	searchMode?: 'contains' | 'fuzzy'
	fuzzyThreshold?: number
	sortChildren?: boolean
	canGroup?: (row: Row) => boolean
	/** Row selection, with a checkbox column. */
	selection?: 'single' | 'multiple'
	canSelect?: (row: Row) => boolean
	resizable?: boolean
	reorderable?: boolean
	columnMinWidth?: number
	columnMaxWidth?: number
	controller?: TableController
	rowWindow?: boolean
	rowHeight?: number
	estimatedRowHeight?: number
	overscan?: number
	stickyHeader?: boolean
	stickyFooter?: boolean
	/** Which rows have a detail row, which the `detail` slot fills. */
	hasDetail?: (row: Row) => boolean
	editable?: boolean
	cellSelection?: boolean
	manualSort?: boolean
	manualFilter?: boolean
	/**
	 * The choices of the filter controls as the owner of the rows knows them,
	 * by column id: the values of a list, the lowest and highest number, the
	 * first and last date. With `manualFilter`, the rows of the table hold
	 * only what passes the filter, so give the facets of every row here.
	 */
	facets?: Readonly<Record<string, ColumnFacetsSource>>
	manualPage?: boolean
	rowCount?: number
	loading?: boolean

	sort?: readonly SortRule[]
	defaultSort?: readonly SortRule[]
	filter?: FilterState
	defaultFilter?: FilterState
	groupBy?: readonly string[]
	defaultGroupBy?: readonly string[]
	page?: PageState
	defaultPage?: PageState
	expanded?: readonly string[]
	/**
	 * The ids of the rows and groups that start open. `'all'` opens every
	 * group and every row with child rows that the table has when it mounts.
	 */
	defaultExpanded?: readonly string[] | 'all'
	selected?: string[]
	defaultSelected?: string[]
	columnVisibility?: ColumnVisibility
	defaultColumnVisibility?: ColumnVisibility
	columnOrder?: readonly string[]
	defaultColumnOrder?: readonly string[]
	columnWidths?: ColumnWidths
	defaultColumnWidths?: ColumnWidths
	columnPinning?: ColumnPinning
	defaultColumnPinning?: ColumnPinning
	rowPinning?: RowPinning
	defaultRowPinning?: RowPinning
	cellRange?: CellRange | null
	defaultCellRange?: CellRange | null
}

export type DataTableEmits<Row = unknown> = {
	'update:sort': [value: readonly SortRule[]]
	'update:filter': [value: FilterState]
	'update:groupBy': [value: readonly string[]]
	'update:page': [value: PageState | undefined]
	'update:expanded': [value: readonly string[]]
	'update:selected': [value: string[]]
	'update:columnVisibility': [value: ColumnVisibility]
	'update:columnOrder': [value: readonly string[]]
	'update:columnWidths': [value: ColumnWidths]
	'update:columnPinning': [value: ColumnPinning]
	'update:rowPinning': [value: RowPinning]
	'update:cellRange': [value: CellRange | null]
	sortChange: [value: readonly SortRule[], details: TableChangeDetails]
	filterChange: [value: FilterState, details: TableChangeDetails]
	groupByChange: [value: readonly string[], details: TableChangeDetails]
	pageChange: [value: PageState | undefined, details: TableChangeDetails]
	expandedChange: [value: readonly string[], details: TableChangeDetails]
	selectedChange: [value: string[], details: TableChangeDetails]
	columnVisibilityChange: [value: ColumnVisibility, details: TableChangeDetails]
	columnOrderChange: [value: readonly string[], details: TableChangeDetails]
	columnWidthsChange: [value: ColumnWidths, details: TableChangeDetails]
	columnWidthsCommit: [value: ColumnWidths, details: TableCommitDetails]
	columnPinningChange: [value: ColumnPinning, details: TableChangeDetails]
	rowPinningChange: [value: RowPinning, details: TableChangeDetails]
	cellRangeChange: [value: CellRange | null, details: TableChangeDetails]
	cellRangeCommit: [value: CellRange | null, details: TableCommitDetails]
	cellEdit: [edits: readonly CellEdit<Row>[], details: TableEditDetails]
	/** An export did not give a file: the writers did not load, or the data or the file could not be written. */
	exportError: [error: unknown, details: { format: DataTableExportFormat }]
}

/**
 * The slots of the styled table: the slots of the table under it, and
 * `toolbar`. A slot by column id may be absent, and the type says so: Vue
 * hands a render function the slots as a record that may lack any name.
 */
export type DataTableSlots<Row> = {
	/** One header cell. `header-{column id}` wins over `header`. */
	[name: `header-${string}`]: ((props: HeaderSlotProps<Row>) => unknown) | undefined
	/** One body cell. `col-{column id}` wins over `cell`. */
	[name: `col-${string}`]: ((props: CellSlotProps<Row>) => unknown) | undefined
	/** One total in the footer. `foot-{column id}` wins over `foot`. */
	[name: `foot-${string}`]: ((props: FootSlotProps<Row>) => unknown) | undefined
	/** The editor of one cell. `edit-{column id}` wins over `editor`. */
	[name: `edit-${string}`]: ((props: EditorSlotProps<Row>) => unknown) | undefined
} & {
	header?: (props: HeaderSlotProps<Row>) => unknown
	cell?: (props: CellSlotProps<Row>) => unknown
	foot?: (props: FootSlotProps<Row>) => unknown
	editor?: (props: EditorSlotProps<Row>) => unknown
	/** A group row, in place of the button and the totals of the styled table. */
	group?: (props: GroupSlotProps<Row>) => unknown
	/** The detail row of a row, for the rows that `hasDetail` names. */
	detail?: (props: DetailSlotProps<Row>) => unknown
	/** Shown in place of the rows when no row passes the filters. */
	empty?: () => unknown
	/** Shown in place of the skeleton rows while `loading` is set and the table has no rows. */
	loading?: () => unknown
	/** The controls of the caller in the toolbar, after the search and the filters. */
	toolbar?: (props: DataTableToolbarSlotProps) => unknown
}

/** What the `toolbar` slot gets: the methods of the table and what it shows now. */
export type DataTableToolbarSlotProps = {
	controller: TableController
	view: TableView | undefined
}

/**
 * What the parts of the styled table share. `view` is what the table shows
 * now; it is `undefined` until the table is on the page. A part that reads it
 * renders again for each change, and the table itself does not.
 */
export type DataTableContext = {
	controller: TableController
	view: Readonly<ShallowRef<TableView | undefined>>
	messages: ComputedRef<DataTableMessages>
	/** The name of the table, or an empty text. */
	label: ComputedRef<string>
	/**
	 * The ids of the selected rows as one set for every part. A table with
	 * groups has a checkbox for each group, and each of them asks which of
	 * its rows are selected: a set of its own for each would be built again
	 * for every checkbox after every change.
	 */
	selected: ComputedRef<ReadonlySet<string>>
	/** How many columns have a filter that asks for something. */
	filterCount: ComputedRef<number>
	/** An export starts: a message about an export that failed before goes away. */
	exportStarted: () => void
	/** An export failed: the table says so, shows a message and sends `exportError`. */
	exportFailed: (error: unknown, format: DataTableExportFormat) => void
}

export const DATA_TABLE_CONTEXT: InjectionKey<DataTableContext> = Symbol('data-table')

/** The table that a part belongs to. A part works only inside a `DataTable`. */
export function useDataTable(): DataTableContext {
	const context = inject(DATA_TABLE_CONTEXT)
	if (!context) throw new Error('A part of the data table must be inside a `DataTable`.')
	return context
}

/** The ids of the two columns that the styled table adds itself. */
export const SELECT_COLUMN = 'data-table-select'
export const EXPAND_COLUMN = 'data-table-expand'

export const isOwnColumn = (id: string) => id === SELECT_COLUMN || id === EXPAND_COLUMN

/** The state keys that `getView` reads. A change of another key, such as the active cell, changes no control. */
export const VIEW_KEYS: readonly string[] = [
	'revision',
	'sort',
	'filter',
	'groupBy',
	'page',
	'expanded',
	'selected',
	'columnVisibility',
	'columnOrder',
	'columnPinning',
	'rowPinning',
]
