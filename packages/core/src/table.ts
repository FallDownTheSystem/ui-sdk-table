import {
	announce,
	byCell,
	createChange,
	createCommit,
	createSelection,
	definePrimitive,
	direct,
	dispatch,
	isComposing,
	isRTL,
	live,
	matchesShortcut,
	selects,
	type ChangeDetails,
	type ChangeSource,
	type CommitDetails,
} from '@ui-sdk/core'
import { createCellEdit, type LateSave, type SaveResult } from './behaviors/edit'
import { byFillDraft, createFillHandle, type FillDirection, type FillDraft } from './behaviors/fill'
import { createStepHistory, type HistoryCounts, type HistoryResult } from './behaviors/history'
import { createCellWrites, type WriteInput, type WriteTarget } from './behaviors/write'
import { createTableGrid, GRID_KEYS, type GridArea, type GridCell } from './behaviors/grid'
import { createColumnPins } from './behaviors/pin'
import { createCellPick, pickBounds, type CellPick } from './behaviors/pick'
import {
	byCellRange,
	cellsToText,
	createTableRange,
	textToCells,
	type CellBounds,
	type CellRange,
	type CellRangeReason,
} from './behaviors/range'
import { createColumnReorder, type ReorderDraft } from './behaviors/reorder'
import {
	byCellFormat,
	CELL_ALIGNS,
	CELL_DATE_STYLES,
	CELL_FORMAT_KEYS,
	CELL_FORMAT_NAMES,
	CELL_MAX_DECIMALS,
	CLEAR_FORMAT,
	formatNames,
	ownFormat,
	resolveFormat,
	revertFormats,
	setFormats,
	type CellFormat,
	type CellFormatPatch,
	type CellFormats,
	type FormatPlace,
} from './sheet/formats'
import { lettersByColumn } from './sheet/chrome'
import { isFormulaError } from './formula/errors'
import type {
	CellFormulas,
	FormulaEngine,
	FormulaEntry,
	FormulaFunctionInfo,
	FormulaIssue,
	FormulaPlace,
	FormulaReference,
	FormulaResult,
	FormulaSummaryLine,
	FormulaView,
} from './formula/types'
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
	isLead,
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
	emptyValue,
	fieldText,
	parseCellKey,
	resolveValue,
	sameValue,
	isThenable,
	type CellEdit,
	type ParseTexts,
	type Checked,
} from './edit'
import { createHeldKey, createTurnValues } from './edit/turn'
import { fillValues } from './sheet/fill'
import { moveFrom, type Move } from './sheet/moves'
import { stepSize, type HistoryEntry, type TableStep } from './sheet/steps'
import { meanDecimals, type RangeSummary, summarize } from './sheet/summary'
import { createDebounce } from './debounce'
import { collectExport, type ExportData, type ExportOptions } from './export/data'
import { formatValue, isNumericFormat, type FormatName } from './format'
import { defaultMessages, type TableMessages } from './messages'
import {
	cellValue,
	compareValues,
	createRowModel,
	dateRange,
	dayOf,
	dayRange,
	isDay,
	isEmptyFilter,
	memo,
	numberRange,
	numberStep,
	sameContent,
	stabilize,
	timeZoneOf,
	toText,
	toTime,
	uniqueValues,
	valueKey,
	walkRows,
	leafColumns,
	aggregates,
	type AggregateFn,
	type AggregateName,
	type ColumnDef,
	type DataRow,
	type FilterKind,
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
	| 'shortcut'
	| 'undo'
	| 'redo'

export type TableChangeDetails = ChangeDetails<TableReason>

/** What made a step of the history: the reason of an edit, or of a change of formats. */
export type TableStepReason = TableEditReason | 'shortcut' | 'formula'
export type TableCommitDetails = CommitDetails<TableReason>

/**
 * Why cells got new values: a key or a loss of focus in the editor, a paste,
 * or a call from code. A table with the `sheet` or the `history` option also
 * reports an arrow key that saved the editor (`list-navigation`), a cut, a
 * clear, a fill, and an undo or a redo. With formulas, `recalculate` reports
 * the formula cells that the new rows of the owner gave other values: no
 * person did it, so it is no step of the history.
 */
export type TableEditReason =
	| 'enter-key'
	| 'tab-key'
	| 'focus-out'
	| 'paste'
	| 'imperative'
	| 'list-navigation'
	| 'cut'
	| 'clear'
	| 'fill'
	| 'undo'
	| 'redo'
	| 'recalculate'
export type TableEditDetails = ChangeDetails<TableEditReason>

/** Where a fill goes from its source. `forward` is toward the end of a row in reading order. */
export type FillWay = 'down' | 'up' | 'forward' | 'back'

/** A cell of the data, by the id of its row and of its column. */
export type CellRef = {
	/** The id of the row. */
	rowId: string
	/** The id of the column. */
	columnId: string
}

/** An arrow key that moves a pick (`movePick`). */
export type PickKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

/** How `movePick` moves. */
export type PickMoveOptions = {
	/** Keep the first cell of the pick and move its end: a range, as Shift with an arrow. */
	extend?: boolean
	/** Go to the edge of the body in the direction of the key, as Control with an arrow. */
	edge?: boolean
	/**
	 * Start a new pick from the cell of the field, also when a pick is there:
	 * after the person typed a character, a key picks anew, as in a
	 * spreadsheet.
	 */
	start?: boolean
}

const PICK_STEPS: Readonly<Record<PickKey, GridCell>> = {
	ArrowUp: { row: -1, col: 0 },
	ArrowDown: { row: 1, col: 0 },
	ArrowLeft: { row: 0, col: -1 },
	ArrowRight: { row: 0, col: 1 },
}

/**
 * The cells that a change of formats is for: the cells from one to another
 * as the table shows them, or whole columns. Whole columns also hold for
 * rows that come later.
 */
export type FormatTarget = { from: CellRef; to?: CellRef } | { columns: readonly string[] }

export type ColumnVisibility = Readonly<Record<string, boolean>>
/**
 * The function of the total of a column, chosen at run time, by column id.
 * An entry wins over the `aggregate` of the column, and `null` takes the
 * total of the column away.
 */
export type ColumnAggregates = Readonly<Record<string, AggregateName | null>>
export type ColumnWidths = Readonly<Record<string, number>>

export type SortDirection = 'asc' | 'desc'

export type RowPin = 'top' | 'bottom'
/** The ids of the rows that stay at the top or the bottom edge while the other rows scroll. */
export type RowPinning = {
	/** The ids of the rows that stay above the others, in order. */
	top?: readonly string[]
	/** The ids of the rows that stay below the others, in order. */
	bottom?: readonly string[]
}

/** The methods of a table that code outside it, or an agent, can call. */
export type TableController = {
	/** Sorts by a column in a direction, `'asc'` by default. Without `append: true`, the column replaces the sort, whatever the `multiSort` mode. With `append`, `null` takes the column out of the sort; without it, `null` empties the sort. */
	sortBy(columnId: string, direction?: SortDirection | null, options?: { append?: boolean }): void
	/**
	 * Sorts by a column as a press on its header does: ascending, descending,
	 * not sorted. Without `append`, the `multiSort` option of the table and
	 * the keys of the event decide whether the column joins the sort or
	 * replaces it. With `alwaysSorted`, the last column of the sort turns
	 * back to ascending and the sort is never empty.
	 */
	toggleSort(columnId: string, options?: { append?: boolean; event?: Event }): void
	/** Gives the table a search text at once. A text that waits from `inputSearch` is dropped. */
	setSearch(text: string): void
	/**
	 * Takes the text of a search field while a person types. `getView().search`
	 * holds the text at once, and the table filters when the typing pauses for
	 * `searchDebounce` milliseconds. Pass the event of the field for the details
	 * of the change.
	 */
	inputSearch(text: string, event?: Event): void
	/** Filters now by the text that waits from `inputSearch`, for example on Enter. Without one, nothing happens. */
	flushSearch(): void
	/** Sets the filter of one column. A value that asks for nothing (see `isEmptyFilter`) takes the filter of the column away. */
	setColumnFilter(columnId: string, value: unknown): void
	/** Takes the search and the filter of every column away, in one change. A search text that waits from `inputSearch` goes too. */
	clearFilters(): void
	/** Takes the filter of every column away, in one change. The search stays. */
	clearColumnFilters(): void
	/** Groups the rows by these columns, in this order. An empty list takes the groups away. */
	setGroupBy(columnIds: readonly string[]): void
	/** Goes to a page, from 1. A page past the last goes to the last. It throws when the table has no pages or the page is not a whole number. */
	setPage(page: number): void
	/** Gives the table pages of a size, from its first page. `null` takes the pages away: every row shows. */
	setPageSize(pageSize: number | null): void
	/** Goes to the next page. On the last page, nothing changes. */
	nextPage(): void
	/** Goes to the page before. On the first page, nothing changes. */
	previousPage(): void
	/** Goes to the first page. */
	firstPage(): void
	/** Goes to the last page. It throws with `manualPage` and no `rowCount`: the table does not know its last page. */
	lastPage(): void
	/** Opens a tree row, a group or a row with a detail row. It throws for a row that cannot open. */
	expand(rowId: string): void
	/** Closes a tree row, a group or a row with a detail row. It throws for a row that cannot open. */
	collapse(rowId: string): void
	/** Opens a row that is closed and closes one that is open. Pass the event of a press for the details of the change. */
	toggleExpanded(rowId: string, event?: Event): void
	/** Opens every tree row and group, in one change. A detail row stays as it is. */
	expandAll(): void
	/** Closes every row and group, detail rows too, in one change. */
	collapseAll(): void
	/** Selects one row in place of the selection. It throws without the `selection` option, and for a row that `canSelect` refuses. */
	select(rowId: string): void
	/** Adds a row to the selection, or takes a selected row away. Pass the event of a press for the details of the change. */
	toggleSelected(rowId: string, event?: Event): void
	/** Selects every row of the list that can be selected, in one change. It needs `selection: 'multiple'`. A selected row that the filter hides stays selected. */
	selectAll(): void
	/** Takes every row out of the selection. */
	clearSelection(): void
	/** Shows or hides a column, or every column of a header group. */
	setColumnVisibility(columnId: string, visible: boolean): void
	/** Hides a column that shows and shows one that is hidden. */
	toggleColumnVisibility(columnId: string): void
	/** Shows every column, in one change. */
	showAllColumns(): void
	/**
	 * Hides every column that can be hidden, in one change. A column with
	 * `hideable: false` and a column that leads the table stay. A table needs
	 * one column: when no other column would be left, the first one in view stays.
	 */
	hideAllColumns(): void
	/** Brings the hidden columns back to what the table started with: `defaultColumnVisibility`, or every column in view. */
	resetColumnVisibility(): void
	/** Brings the column order back to what the table started with: `defaultColumnOrder`, or the order of the definitions. */
	resetColumnOrder(): void
	/** Brings the pinned columns back to what the table started with: `defaultColumnPinning`, or no pinned column. */
	resetColumnPinning(): void
	/** Moves a column to a place among the columns that can move, from 0. */
	moveColumn(columnId: string, index: number): void
	/** Puts the columns in this order. Columns that are not listed come after, in the order of the definitions. It throws for an id that is listed twice. */
	setColumnOrder(columnIds: readonly string[]): void
	/** Gives a column a width in pixels. `null` takes the width away again. */
	setColumnWidth(columnId: string, width: number | null): void
	/** Takes every width that a resize or `setColumnWidth` gave away, so each column has the width of its definition again. */
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
	/** Takes the range of cells away. */
	clearCellSelection(): void
	/** The text of the selected cells, with tabs between cells and line breaks between rows. */
	copyCells(): string
	/**
	 * Puts tab-separated text into the cells from the first selected cell on,
	 * as a paste does. It throws with the reason when a value is refused, and
	 * then no cell changes.
	 */
	pasteCells(text: string): void | Promise<void>
	/**
	 * Empties the selected cells, as Delete does in a sheet: each gets the
	 * empty value of its column (`emptyValue`), with the check of the column.
	 * It throws with the reason when a column refuses an empty value, and then
	 * no cell changes. Cells that cannot be edited are left as they are.
	 */
	clearCells(): void | Promise<void>
	/**
	 * Empties the selected cells and returns their text, as `copyCells` gives
	 * it. A caller puts the text on the clipboard. It throws as `clearCells` does.
	 */
	cutCells(): string | Promise<string>
	/**
	 * Fills the selected cells from their first line: `'down'` from the first
	 * row, `'up'` from the last row, `'forward'` from the first column,
	 * `'back'` from the last column. `source` is how many lines the fill
	 * starts from, 1 without it; with two or more, numbers and days with one
	 * step go on, and everything else repeats. Each value passes the check of
	 * its column, and one refusal stops the fill before any cell changes. It
	 * throws when the selected cells are one line in that direction.
	 */
	fillCells(direction: FillWay, source?: number): void | Promise<void>
	/** Selects every cell of the body. Needs the `cellSelection` option. */
	selectAllCells(): void
	/** Selects every cell of a row, or of the rows from one to another as the list shows them. */
	selectCellRows(fromRowId: string, toRowId?: string): void
	/** Selects every cell of a column, or of the columns from one to another as the table shows them. */
	selectCellColumns(fromColumnId: string, toColumnId?: string): void
	/**
	 * Takes the last change of cell values back: it reports the old values
	 * through `onCellEdit` with the reason `undo`, and the owner of the rows
	 * puts them in, as for an edit. Needs the `history` option. It throws when
	 * there is nothing to undo, when a listener refuses the report, and while
	 * the check of a value runs.
	 */
	undo(): void
	/** Puts the change on again that `undo` took back last, with the reason `redo`. */
	redo(): void
	/** Forgets every step. Call it when the rows become other data, such as another document. */
	clearHistory(): void
	/** The steps of the history, oldest first, and how many of them are applied: `undo` takes back the last of those. */
	getHistory(): { entries: readonly HistoryEntry<TableStepReason>[]; position: number }
	/**
	 * Chooses the function of the total of a column, in the footer, in the
	 * group rows and in an export: `sum`, `mean`, `min`, `max`, `count`,
	 * `uniqueCount` or `first`. `null` takes the total of the column away, and
	 * `undefined` gives the column the `aggregate` of its definition back.
	 */
	setColumnAggregate(columnId: string, aggregate: AggregateName | null | undefined): void
	/**
	 * The formula of a computed column, as a person reads it (the headers of
	 * the columns, the signs of the locale) and in the stored form, or `null`
	 * for a column without one. `error` says why the formula gives an error
	 * in every row. Needs the `formulas` option.
	 */
	getColumnFormula(columnId: string): { formula: string; text: string; error: string | null } | null
	/**
	 * Sets the formula of a column, as a person types it or in the stored
	 * form, or takes it away with `null`: one change of `cellFormulas` and
	 * one step of the history. It throws when the formula cannot be read,
	 * reads another row, or reads its own column through other formulas.
	 * Needs the `formulas` option.
	 */
	setColumnFormula(columnId: string, formula: string | null): void
	/**
	 * The address of a cell, such as `D7`: the letter of its column among
	 * the columns of the owner and the number of its row in the document.
	 * `null` for a column without a letter. Needs the `formulas` option.
	 */
	getAddress(rowId: string, columnId: string): string | null
	/** The cell of an address such as `D7`. It throws for an address that the table does not have. Needs the `formulas` option. */
	cellAt(address: string): CellRef
	/**
	 * The formula of a cell: the stored form, the text as a person reads it,
	 * the address, the value and the words of its error. `null` for a cell
	 * without a formula of its own. Needs the `formulas` option.
	 */
	getCellFormula(rowId: string, columnId: string): FormulaView | null
	/**
	 * Gives a cell a formula, as a person types it or in the stored form, or
	 * takes it away with `null` (the cell keeps its value). One report with
	 * every cell that follows, and one step. It throws when the cell cannot
	 * hold a formula, the formula cannot be read, or it reads its own cell.
	 */
	setCellFormula(rowId: string, columnId: string, formula: string | null): void
	/**
	 * Computes every formula of a cell and reports each cell whose value is
	 * not the one its formula gives, with the reason `recalculate`. Returns
	 * how many cells it reported. The table does this by itself after new
	 * rows, for the cells that they change; this is for a check after a load.
	 */
	recalculate(): number
	/** The formulas as a short list: each text of a column once, with how many cells hold it. `limit` is 1 to 500, 100 by default. */
	getFormulaSummary(limit?: number): { lines: FormulaSummaryLine[]; more: number }
	/** The value that a formula would give at a cell, the active cell by default. Nothing is written. */
	evaluateFormula(formula: string, at?: CellRef): unknown
	/** The functions of the formulas: name, arguments as a text and as a list, one line of help, and group. */
	getFormulaFunctions(): readonly FormulaFunctionInfo[]
	/**
	 * The text that a person types for cells: `B2`, `B2:C5`, or `B:C` for
	 * whole columns. It reads a pick of `pickedCells`, else the selected cells
	 * (the selected range, or the active cell); selected cells are whole
	 * columns when they hold every row of the document, and more than one.
	 * The corners are the first and the last cell that hold values. `null`
	 * without cells, for a column without a letter, and with `manualPage`,
	 * where no address names a row. Needs the `formulas` option.
	 */
	getRangeAddress(cells?: CellPick | null): string | null
	/**
	 * Moves the pick of the pick mode with an arrow key, as a field that
	 * writes a formula does it while a person points with the keys. The
	 * first move, and a move with `start`, picks the cell next to the cell
	 * of the field (the cell that is edited, else the active cell) in the
	 * direction of the key; a later move takes the pick one cell further.
	 * `extend` (Shift) keeps the first cell and grows a range, and `edge`
	 * (Control) goes to the edge of the body. It changes `pickedCells` with
	 * the reason `list-navigation`, scrolls the cell into view, and leaves
	 * focus, the caret, the active cell and the selected cells where they
	 * are. Returns the pick, or `null` without a cell to pick. Needs
	 * `pickCells`; the text field of the table's own editor calls it itself.
	 */
	movePick(key: PickKey, options?: PickMoveOptions): CellPick | null
	/**
	 * The references of a formula text as a person types it at a cell, the
	 * active cell by default: the place of each in the text, from `start` up
	 * to `end`, and the cells that it names by ids, from the first to the
	 * last. It reads a text that is not a whole formula yet. A field colours
	 * a reference and its cells with one colour. Needs the `formulas` option.
	 */
	getFormulaReferences(text: string, at?: CellRef): FormulaReference[]
	/**
	 * Changes the format of cells: how their values become text (`format`,
	 * `decimals`, `currency`, `dateStyle`) and how they look (`align`, `bold`,
	 * `italic`, `color`, `fill`). A key with `null` takes that property away.
	 * Without a target, the selected cells get it; when those are every row
	 * that the table has, the format goes to the whole columns and holds for
	 * rows that come later. It throws for a property, a format name or a
	 * colour that the table does not know, and lists the valid ones.
	 */
	formatCells(patch: CellFormatPatch, target?: FormatTarget): void
	/** Takes every format of cells away: of the target, or of the selected cells. */
	clearCellFormats(target?: FormatTarget): void
	/**
	 * Makes the selected cells bold or italic, for a button of a toolbar, as
	 * the keys of a sheet do: on, unless every selected cell has it, and then off.
	 */
	toggleCellFormat(property: 'bold' | 'italic'): void
	/**
	 * The format that a cell has of its own: the format of its column in
	 * `cellFormats` with the format of the cell over it. An empty object when
	 * neither says anything, and for the number of a row. The `format` of the
	 * column definition is not in it.
	 */
	getCellFormat(rowId: string, columnId: string): CellFormat
	/**
	 * What the selected cells add up to: how many hold a value and a number,
	 * and the sum, the mean, the smallest and the largest of the numbers, each
	 * also as text. Counted when it is asked for, and kept for the same
	 * selection and the same rows. `null` when no cell of a data row is
	 * selected. Group rows and the numbers of the rows are left out.
	 */
	getSelectionSummary(): RangeSummary | null
	/**
	 * The cells of the table as plain data, for a file: every row that passes
	 * the filters and the visible columns, or what the options ask for. The
	 * writers are in the `export` entry of the package (`toCsv`, `toXlsx`).
	 */
	exportData(options?: ExportOptions): ExportData
	/** Selects rows in one change, beside the rows that are selected. It throws for a row that cannot be selected. */
	selectRows(rowIds: readonly string[]): void
	/** Takes rows out of the selection in one change. */
	deselectRows(rowIds: readonly string[]): void
	/**
	 * What the table shows now, for a control beside it: a search field, a
	 * list of columns, the pages. It answers at the time of the call;
	 * `subscribe` says when to ask again.
	 */
	getView(): TableView
	/**
	 * What a filter control of a column offers: its kind, and the values, the
	 * numbers or the dates that the column holds. They follow the search and
	 * the filters of the other columns, and never the filter of the column
	 * itself, so a filter does not take away its own choices. `rows: 'all'`
	 * gives the facets of every row of the table. A column that the `facets`
	 * option names has the facets of the owner, for both.
	 */
	getFacets(columnId: string, options?: FacetOptions): ColumnFacets
	/**
	 * The total of each column that has an `aggregate`, with its text in the
	 * format of the column: of the rows that pass the filters, as the footer
	 * shows them, or of one group by its id.
	 */
	getTotals(groupId?: string): Readonly<Record<string, ColumnTotal>>
	/**
	 * Runs the listener after each change of the state, of the rows or of the
	 * columns, with the keys of the state that changed. Returns the function
	 * that stops it. A table that is destroyed stops every listener itself.
	 */
	subscribe(listener: (changed: readonly string[]) => void): () => void
}

/** The state of a table and the numbers that follow from it, as `getView` gives them. */
export type TableView = {
	/** The sort: the columns in the order in which they sort. */
	sort: readonly SortRule[]
	/** The filter: the search and the filter of each column. */
	filter: FilterState
	/**
	 * The text that a search field shows: the text that waits from
	 * `inputSearch`, else the search of the filter.
	 */
	search: string
	/** Whether a text from `inputSearch` waits for its pause, so the rows do not follow `search` yet. */
	searchPending: boolean
	/** The ids of the columns that group the rows, in order. */
	groupBy: readonly string[]
	/** The ids of the open tree rows, groups and rows with a detail row. */
	expanded: readonly string[]
	/** The ids of the selected rows. */
	selected: readonly string[]
	/** The page in view, from 1. A table without pages has one page. */
	page: number
	/** How many rows a page holds, or `undefined` for a table without pages. */
	pageSize: number | undefined
	/** How many pages there are. A table without pages has one. */
	pageCount: number
	/** How many entries the pages divide: what `pageUnit` names. With pages from a server, its `rowCount`. */
	rowCount: number
	/**
	 * What the pages count. `rows`: each row. `groups`: each group, with its
	 * rows on the page of the group. `parents`: each top-level row, with its
	 * child rows on the same page. `mixed`: groups, and rows outside every group.
	 */
	pageUnit: PageUnit
	/** How many data rows pass the filters, child rows too. With `rows`, it is `rowCount`. */
	dataRowCount: number
	/** Whether the last page is known. It is not for pages from a server that gave no count. */
	lastPageKnown: boolean
	/** Every column that holds cells, hidden ones too, in definition order. */
	columns: readonly ColumnDef[]
	/** The columns in view, in display order. */
	visibleColumns: readonly ColumnDef[]
	/** The ids of the rows that `selectAll` selects: the rows that pass the filters and can be selected. */
	selectable: readonly string[]
	/** Whether the table has a group or a row with child rows: what `expandAll` opens. */
	hasExpandable: boolean
	/** Whether one of them is open now. An id in `expanded` that no group or row has any more does not count. */
	hasExpanded: boolean
	/** The `loading` option: whether new rows are on their way. */
	loading: boolean
	/** The functions of the totals that were chosen at run time, by column id. */
	columnAggregates: ColumnAggregates
	/** The formats of cells and columns that were set at run time. */
	cellFormats: CellFormats
	/** Whether the table has the `formulas` option. */
	formulas: boolean
	/** The formulas of the table. */
	cellFormulas: CellFormulas
	/** The formula of the active cell or of its column, for a formula bar. `null` without formulas and without an active cell. */
	formula: FormulaView | null
	/** Whether `undo` has a step to take back. Always false without the `history` option. */
	canUndo: boolean
	/** Whether `redo` has a step to bring back. Always false without the `history` option. */
	canRedo: boolean
	/** The cell that has the tab stop, when it is a cell of a data row. */
	activeCell: CellRef | null
	/**
	 * The selected cells of a table with `cellSelection`: the range, or the
	 * active cell alone. `null` when no cell of a data row is selected.
	 */
	cellSelection: CellSelectionView | null
}

/**
 * The selected cells by id: the first and the last cell that hold values, and
 * how many data rows and columns are between them. Group rows and detail rows
 * inside a range hold no values and are not counted.
 */
export type CellSelectionView = {
	/** The first selected cell that holds a value, at the top and the start. */
	from: CellRef
	/** The last selected cell that holds a value, at the bottom and the end. */
	to: CellRef
	/** How many data rows the selection covers. */
	rows: number
	/** How many columns the selection covers. */
	columns: number
}

/** The limits of the history. Without one, the default holds. */
export type TableHistoryOptions = {
	/** How many steps are kept. The oldest go first. Defaults to 100. */
	limit?: number
	/**
	 * How many cells all steps together hold. The oldest steps go first, and
	 * one step that is larger empties the history. Defaults to 100,000.
	 */
	maxCells?: number
}

export type PageUnit = 'rows' | 'groups' | 'parents' | 'mixed'

/**
 * One value of a column, with its text as a cell shows it and the number of
 * rows that hold it. Facets of the owner have a count only when the owner gave one.
 */
export type ColumnFacetValue = {
	/** The value as the rows hold it. */
	value: unknown
	/** The value as text, as a cell of the column shows it. */
	text: string
	/** How many rows hold the value. */
	count?: number
}

/**
 * The facets of one column as the owner of the rows knows them, for the
 * `facets` option. Give the part that fits the filter of the column.
 */
export type ColumnFacetsSource = {
	/** The values of a `select` filter, in the order of the list. `text` defaults to the value in the format of the column. */
	values?: readonly { value: unknown; text?: string; count?: number }[]
	/** The lowest and the highest number of a `range` filter. `step` defaults to the step of the format of the column. */
	range?: { min: number; max: number; step?: number }
	/** The first and the last date of a `dateRange` filter: a `Date`, a time in milliseconds or a text that `Date` reads. */
	dates?: { from: unknown; to: unknown }
}

export type ColumnFacets = {
	/** The filter of the column: its `filter` option, or what its format says. A column of dates filters by a range of dates, a column of numbers by a range, any other column by text. */
	kind: FilterKind
	/** Each different value, sorted. Filled for the kind `select`. */
	values: readonly ColumnFacetValue[]
	/**
	 * The lowest and the highest number, and the step of a slider between
	 * them: the smallest change that the format of the column shows. Filled
	 * for the kind `range`. `sliderBounds` gives ends that are whole steps.
	 */
	range: { min: number; max: number; step: number } | null
	/** The earliest and the latest date. Filled for the kind `dateRange`. */
	dates: { from: Date; to: Date } | null
	/**
	 * The days of `dates` as `YYYY-MM-DD`, in the zone of the column (the
	 * `timeZone` of its format options) or in local time: the days that a
	 * range of dates on this column is matched by.
	 */
	days: { from: string; to: string } | null
}

/** Which rows the facets of a column come from. */
export type FacetOptions = {
	/**
	 * `'filtered'` (the default): the rows that pass the search and the
	 * filters of the other columns. `'all'`: every row of the table.
	 */
	rows?: 'filtered' | 'all'
}

/** The total of one column, and its text in the format of the column. */
export type ColumnTotal = {
	/** The total as a value. */
	value: unknown
	/** The total as text, with the format of the column. */
	text: string
}

/**
 * Totals as the owner of the rows knows them, for the `totals` option: by
 * column id for the whole table, and by group id and column id for groups.
 * A column that is not named keeps the total of the rows that the table has.
 */
export type TableTotalsSource = {
	/** The total of each column over every row, by column id. */
	table?: Readonly<Record<string, unknown>>
	/** The totals of each group, by group id and column id. */
	groups?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

/** One step of the way to a group: a group above it, or the group itself. */
export type GroupPathEntry<Row = unknown> = {
	/** The group. */
	group: GroupRow<Row>
	/** The column that the group is made from. `undefined` when the table has no such column any more. */
	column: ColumnDef<Row> | undefined
	/** The value that the rows of the group share. */
	value: unknown
	/** The value as text, with the format of its column. */
	text: string
}

/** How a press on a header changes the sort: see the `multiSort` option. */
export type MultiSortMode = 'none' | 'modifier' | 'always'

type ReadActions = 'getView' | 'getFacets' | 'getTotals' | 'getSelectionSummary' | 'subscribe'

type CellActions =
	| 'editCell'
	| 'startEdit'
	| 'cancelEdit'
	| 'selectCells'
	| 'clearCellSelection'
	| 'copyCells'
	| 'pasteCells'
	| 'clearCells'
	| 'cutCells'
	| 'fillCells'
	| 'formatCells'
	| 'clearCellFormats'
	| 'toggleCellFormat'
	| 'getCellFormat'
	| 'selectAllCells'
	| 'selectCellRows'
	| 'selectCellColumns'
	| 'undo'
	| 'redo'
	| 'clearHistory'
	| 'getHistory'
	| 'exportData'

/** The methods that are written apart from the main list, each group beside the state it reads. */
type OtherActions = 'pinRow' | 'scrollToRow' | CellActions | ReadActions

export type TableOptions<Row = unknown> = {
	/** The rows of the table. Each row needs a stable id (see `getRowId`). The table never changes or copies a row. */
	rows?: readonly Row[]
	/** The columns, in the order of the definitions. A column with `columns` is a header group. */
	columns?: readonly ColumnDef<Row>[]
	/** A stable id for a row. Without it, the `id` property of the row is used. */
	getRowId?: (row: Row, index: number, parent: DataRow<Row> | null) => string | number
	/** The child rows of a row. With it, the table is a tree. */
	getChildren?: (row: Row) => readonly Row[] | undefined
	/** The locale of the texts that the table writes: numbers, dates, the search without case, and the signs of a formula that a person types. Without it, the formats use `en-US`. A format whose `formatOptions` has a `locale` keeps its own. */
	locale?: string
	/** How the search matches. `'contains'` (the default): the text of a cell holds the search, without case. `'fuzzy'`: the letters of the search are in the text in order. */
	searchMode?: 'contains' | 'fuzzy'
	/** With `searchMode: 'fuzzy'`, the score that a match must pass, from 0 to 1. Defaults to 0: every match in order passes. */
	fuzzyThreshold?: number
	/** Also sort the tree children of each row. Defaults to true. */
	sortChildren?: boolean
	/** Which rows go into groups. A row that it refuses stays out of every group and comes first, before the groups. */
	canGroup?: (row: Row) => boolean
	/** Row selection. Without it, rows cannot be selected. */
	selection?: 'single' | 'multiple'
	/** Which rows can be selected. A row that it refuses has no selection, and `select` throws for it. */
	canSelect?: (row: Row) => boolean
	/** Whether a person can resize columns. A column can say otherwise. Defaults to false. */
	resizable?: boolean
	/** Whether a person can move columns. A column can say otherwise. Defaults to false. */
	reorderable?: boolean
	/** The smallest width of a column that has no `minWidth`, in pixels. Defaults to 48. */
	columnMinWidth?: number
	/** The largest width of a column that has no `maxWidth`, in pixels. Without it, no limit. */
	columnMaxWidth?: number
	/** Texts of the table in another language, or with other words. */
	messages?: Partial<TableMessages>
	/** Gives the actions of the table to code outside it. Create one with `createTableController()`. */
	controller?: TableController

	/**
	 * Whether a press on a header can add its column to the sort. `'none'`:
	 * one column at a time, and a modifier key changes nothing. `'modifier'`
	 * (the default): a press with Shift, Control or Command adds the column.
	 * `'always'`: each press adds the column. Enter on a header follows the
	 * same rule. A `sort` that the owner sets is never cut to the mode.
	 */
	multiSort?: MultiSortMode
	/**
	 * Whether the table keeps a sort once it has one. With it, a press on the
	 * only column of the sort turns the order, ascending and descending, and
	 * never takes the sort away. Without it, the third press does. Defaults
	 * to false. It does not sort a table that starts without a sort; give
	 * `defaultSort` for that.
	 */
	alwaysSorted?: boolean
	/**
	 * How long the typing in a search field must pause before the table
	 * filters, in milliseconds, for a text from `inputSearch`. Defaults to
	 * 200. With 0, each text filters at once.
	 */
	searchDebounce?: number
	/**
	 * Whether a group row shows the total of each column in a cell under that
	 * column, as the footer does. The label of the group then covers the
	 * columns before the first total. It applies while a column in view has
	 * an `aggregate`; without one, and with `false`, a group row is one cell
	 * as wide as the table. Defaults to true.
	 */
	groupTotals?: boolean
	/**
	 * Totals as the owner of the rows knows them. The footer, the group rows,
	 * `getTotals` and the totals of an export show them in place of what the
	 * rows of the table give. For rows from a server: the table has one page
	 * of them, and its own totals are of that page.
	 */
	totals?: TableTotalsSource

	/** The sort: the columns in the order in which they sort. Pass it to control the sort. */
	sort?: readonly SortRule[]
	defaultSort?: readonly SortRule[]
	onSortChange?: (value: readonly SortRule[], details: TableChangeDetails) => void

	/** The search and the filter of each column. Pass it to control the filter. */
	filter?: FilterState
	defaultFilter?: FilterState
	onFilterChange?: (value: FilterState, details: TableChangeDetails) => void

	/** The ids of the columns that group the rows, outermost first. Pass it to control the groups. */
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

	/**
	 * The function of the total of a column where a person chose one, by
	 * column id: `sum`, `mean`, `min`, `max`, `count`, `uniqueCount` or
	 * `first`. An entry wins over the `aggregate` of the column, and `null`
	 * takes the total of the column away. The footer, the group rows,
	 * `getTotals` and an export all follow it. With `totals` of the owner, the
	 * owner hears the change and gives the number of the chosen function.
	 */
	columnAggregates?: ColumnAggregates
	defaultColumnAggregates?: ColumnAggregates
	onColumnAggregatesChange?: (value: ColumnAggregates, details: TableChangeDetails) => void

	/**
	 * The formats of cells and of whole columns: how a value becomes text and
	 * how the cell looks, by row id and column id. A property of a cell wins
	 * over the same property of its column, and both win over the `format`
	 * of the column definition. The looks reach a cell as `data-align`,
	 * `data-bold`, `data-italic`, `data-color` and `data-fill`, and the style
	 * of the app gives them a meaning. The value is reported whole and shares
	 * what did not change, so an owner saves it as it is. Colour alone must
	 * not carry a meaning: a screen reader says the text of a cell, not its looks.
	 */
	cellFormats?: CellFormats
	defaultCellFormats?: CellFormats
	onCellFormatsChange?: (value: CellFormats, details: TableChangeDetails) => void

	/**
	 * Turns formulas on: the value of `createFormulaEngine()` of the entry
	 * `ui-sdk-table-core/formulas`. Pass one engine for the life of the table;
	 * a new engine at each render computes every formula again.
	 */
	formulas?: FormulaEngine
	/**
	 * The formulas of the table, as data of the owner, in the stored form.
	 * `columns` makes a column computed: each row gets the value of the
	 * formula, also a row that comes later, and its cells cannot be edited.
	 * A formula that cannot be read, or column formulas that read each other
	 * in a circle, show an error in every row. Read only with `formulas`.
	 */
	cellFormulas?: CellFormulas
	defaultCellFormulas?: CellFormulas
	/** A formula that a person entered changes with the reason of the edit (`enter-key`, `paste`). */
	onCellFormulasChange?: (
		value: CellFormulas,
		details: ChangeDetails<TableReason | TableEditReason>,
	) => void
	/**
	 * The names that `color` and `fill` of a cell format can have, such as
	 * `['red', 'amber', 'green']`. The table writes a name into `data-color`
	 * or `data-fill`, and the style of the app maps it to its own colours for
	 * light and dark. Without the option, a format can carry no colour.
	 */
	formatColors?: readonly string[]

	/**
	 * The rules of a data sheet. In the editor, Enter saves and moves down
	 * (with Shift up), and an arrow key saves and moves when a character
	 * opened the editor. Inside a selected range, Enter and Tab walk the range
	 * and Tab on a cell stays in it; without a range, Tab on a cell leaves the
	 * table as before. Delete and Backspace empty the selected cells, a cut
	 * empties them too, and a paste repeats a block that fits the range a
	 * whole number of times. It is also a preset: `editable`, `cellSelection`
	 * and `history` are on unless one of them is set to false. Defaults to false.
	 */
	sheet?: boolean
	/**
	 * Undo and redo for cell values: Control or Command with Z, and with
	 * Shift+Z or Y, on a cell, and `undo` and `redo` of the controller. A step
	 * is one report of `onCellEdit` that no listener refused. An undo reports
	 * the old values through `onCellEdit` with the reason `undo`, without
	 * `parse` and without the schema, and the owner of the rows puts them in.
	 * Rows need stable ids for it. With `manualPage`, a change of the page,
	 * the sort or the filter empties the history. Pass limits in place of
	 * `true` to change them. Defaults to the `sheet` option.
	 */
	history?: boolean | TableHistoryOptions
	/**
	 * The fill handle: a small part at the corner of the selected cells that
	 * a person drags to fill more cells, and with `sheet` the keys Control+D
	 * (fill down) and Control+R (fill forward). `'vertical'` and
	 * `'horizontal'` let a fill go along one axis only. Needs cell selection.
	 * Defaults to the `sheet` option.
	 */
	fillHandle?: boolean | 'vertical' | 'horizontal'
	/** Whether a person can edit cells. A column can say otherwise. Defaults to the `sheet` option, else to `entry`. */
	editable?: boolean
	/**
	 * A mode for entering data, which an app can turn on and off, for example
	 * with an Edit button. While it is on, cells can be edited unless
	 * `editable` is false or a column says otherwise, one plain press on a
	 * cell opens its editor, and Tab and Shift+Tab on a cell and in the
	 * editor go to the next and the previous cell that can be edited, across
	 * the rows. From the last such cell Tab leaves the table, and from the
	 * first Shift+Tab. Inside a selected range of more than one cell, Tab
	 * keeps the rule of the range. Defaults to false.
	 */
	entry?: boolean
	/**
	 * The pick mode, for a field that writes a formula: while it is on, a
	 * press or a drag on cells of the body picks them, and a press on a letter
	 * of `columnLetters` picks its column. A pick changes nothing else: the
	 * active cell, the selected cells, an open editor, focus and the caret of
	 * a field stay. The picked cells go to `pickedCells` and show
	 * `data-picked`. An app turns it on and off, for example while the text
	 * of its field starts with `=`, and puts the address of the pick
	 * (`getRangeAddress`) into the text. The root shows `data-pick`.
	 * Defaults to false.
	 */
	pickCells?: boolean
	/**
	 * The cells of the last pick, as places in the grid like `cellRange`, or
	 * `null`. It goes back to `null` when `pickCells` goes off.
	 */
	pickedCells?: CellPick | null
	defaultPickedCells?: CellPick | null
	/** Runs for the press of a pick and for each step of its drag. */
	onPickedCellsChange?: (value: CellPick | null, details: TableChangeDetails) => void
	/** Runs once when a drag that changed the pick ends. */
	onPickedCellsCommit?: (value: CellPick, details: TableCommitDetails) => void
	/**
	 * Runs when cells got new values: one cell from the editor or from
	 * `editCell`, many cells from a paste. The table does not change the rows.
	 * Put the values into your rows and pass the new rows; `applyEdits` does
	 * that for plain rows. `details.cancel()` refuses the edit.
	 */
	onCellEdit?: (edits: readonly CellEdit<Row>[], details: TableEditDetails) => void

	/** Whether a person can select a range of cells, to copy it or to paste into it. Defaults to the `sheet` option. */
	cellSelection?: boolean
	/**
	 * A row of letters above the header rows, as a spreadsheet has: A, B, C,
	 * then AA. It is the place where a person selects whole columns, as the
	 * row numbers of `rowNumberColumn()` are for whole rows: a press on a
	 * letter selects the cells of its column, with Shift the columns from the
	 * active cell to it, and a drag over letters selects those columns. Space
	 * on a letter selects its column, and Shift with an arrow takes the next
	 * columns. The cell above the row numbers selects every cell. A column
	 * that leads the table has an empty letter cell that selects nothing.
	 *
	 * A letter is the place of the column among the columns in view. The row
	 * is grid row 0: it counts in `aria-rowindex`, `aria-rowcount` and the rows
	 * of `cellRange`, and it sticks with `stickyHeader`. An export does not
	 * hold it. Selecting needs `cellSelection`; this option is not part of
	 * `sheet`. Defaults to false.
	 */
	columnLetters?: boolean
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

	/**
	 * The rows come from a server in sort order. The table does not sort them.
	 * The `sort` state still changes, so the caller knows what to ask for.
	 */
	manualSort?: boolean
	/**
	 * The rows come from a server with the search and the column filters
	 * applied. The table does not filter them. Facets and totals are of the
	 * rows that the table has; give `facets` for the choices of every row, and
	 * `totals` for the totals of every row.
	 */
	manualFilter?: boolean
	/**
	 * The facets of columns as the owner of the rows knows them, by column
	 * id. `getFacets` answers with them in place of what the rows of the
	 * table hold. A server that filters knows every value of a column; the
	 * rows that it sends hold only the values that pass.
	 */
	facets?: Readonly<Record<string, ColumnFacetsSource>>
	/**
	 * The rows are one page from a server. The table shows them all, and the
	 * pages come from `rowCount`. Every other feature works on the rows that
	 * the table has: an export, the totals and "select all" are of this page.
	 * Give `totals` for the totals that the server knows.
	 */
	manualPage?: boolean
	/**
	 * How many rows the server has after its filter, for `manualPage`. Without
	 * it, a full page has a next page and a page that is not full is the last.
	 * An empty page after the first then sends the table one page back, so
	 * keep the rows of the page before, or set `loading`, while a page loads.
	 * `lastPage` needs the count.
	 */
	rowCount?: number
	/** Whether new rows are on their way. The table says so to assistive technology and keeps its rows. */
	loading?: boolean
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
	columnAggregates: ColumnAggregates
	/** The formats of cells and columns. Not a key of `controlled`: an agent reads a format with `getCellFormat`, and its snapshot stays small. */
	cellFormats: CellFormats
	/** The formulas of cells and columns. Not a key of `controlled`, as `cellFormats`: an agent reads a formula with an action. */
	cellFormulas: CellFormulas
	cellRange: CellRange | null
	/** The cells of the last pick of the pick mode, or `null`. */
	pickedCells: CellPick | null
	/**
	 * The text of a search field that the filter does not hold yet: it waits
	 * for a pause in the typing, or for the owner of the filter to pass it
	 * back. `null` when the filter holds what the field shows.
	 */
	searchDraft: string | null
	/** Whether the text of `searchDraft` waits for a pause in the typing. */
	searchPending: boolean
	/** How many steps `undo` and `redo` have. The steps themselves are not state. */
	history: HistoryCounts
	/** The cells that a drag of the fill handle would fill, or `null`. Live: it changes with each move of the pointer. */
	fillDraft: FillDraft | null
	/** Whether a drag of the fill handle runs. Live. */
	filling: boolean
	/** The id of the cell that is edited (`cellKey`), or `null`. */
	editing: string | null
	/** The id of the cell whose new value is checked now, or `null`. */
	editChecking: string | null
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
const NO_AGGREGATES: ColumnAggregates = {}
const AGGREGATE_NAMES = Object.keys(aggregates) as AggregateName[]
const NO_ERRORS: Readonly<Record<string, string>> = {}
const NO_LIMITS: TableHistoryOptions = {}
const NO_FLAT: FlatRow<unknown>[] = []

const DEFAULT_ROW_HEIGHT = 36
const DEFAULT_OVERSCAN = 8
const ROW_ALIGNS: readonly RowAlign[] = ['start', 'center', 'end', 'nearest']

const DEFAULT_COLUMN_WIDTH = 150
const DEFAULT_COLUMN_MIN_WIDTH = 48
const RESIZE_STEP = 10
const RESIZE_LARGE_STEP = 50
const SORT_MODES: readonly MultiSortMode[] = ['none', 'modifier', 'always']
const FILL_WAYS: readonly FillWay[] = ['down', 'up', 'forward', 'back']
const FACET_ROWS = ['filtered', 'all'] as const

/** The ids of the columns that a person can move: the visible ones that are not pinned and do not lead the table. */
function columnTrack(layout: ColumnLayout): string[] {
	return layout.leaves
		.filter((column) => !layout.pins.has(column.id) && !isLead(column))
		.map((column) => column.id)
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
	pickedCells: [],
	editing: [],
	editChecking: [],
	editErrors: [],
	searchDraft: [],
	searchPending: [],
	history: [],
	fillDraft: [],
	filling: [],
	cellFormats: [],
	cellFormulas: [],
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
	columnAggregates: [],
} as const

const EDIT_REASONS: readonly TableEditReason[] = [
	'enter-key',
	'tab-key',
	'focus-out',
	'paste',
	'list-navigation',
	'cut',
	'clear',
	'fill',
	'undo',
	'redo',
]

const NO_HISTORY: HistoryCounts = { undo: 0, redo: 0 }
const NO_FORMATS: CellFormats = Object.freeze({})
const NO_FORMULAS: CellFormulas = Object.freeze({})
const NO_FORMAT: CellFormat = Object.freeze({})
const HISTORY_LIMIT = 100
const HISTORY_MAX_CELLS = 100_000

/** One cleanup for several. */
const together =
	(...cleanups: (() => void)[]) =>
	() =>
		cleanups.forEach((cleanup) => cleanup())

/** The name of the function of a total: one of the built-in names, or `custom` for a function of the column. */
export const aggregateName = (
	aggregate: AggregateName | AggregateFn<any> | undefined,
): AggregateName | 'custom' | undefined => (typeof aggregate === 'function' ? 'custom' : aggregate)

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
		multiSort: 'string',
		alwaysSorted: 'boolean',
		searchDebounce: 'number',
		groupTotals: 'boolean',
		totals: 'value',
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
		columnAggregates: 'value',
		defaultColumnAggregates: 'value',
		onColumnAggregatesChange: 'callback',
		cellFormats: 'value',
		defaultCellFormats: 'value',
		onCellFormatsChange: 'callback',
		formulas: 'value',
		cellFormulas: 'value',
		defaultCellFormulas: 'value',
		onCellFormulasChange: 'callback',
		formatColors: 'value',
		sheet: 'boolean',
		history: 'value',
		fillHandle: 'value',
		editable: 'boolean',
		entry: 'boolean',
		onCellEdit: 'callback',
		cellSelection: 'boolean',
		columnLetters: 'boolean',
		cellRange: 'value',
		defaultCellRange: 'value',
		onCellRangeChange: 'callback',
		onCellRangeCommit: 'callback',
		pickCells: 'boolean',
		pickedCells: 'value',
		defaultPickedCells: 'value',
		onPickedCellsChange: 'callback',
		onPickedCellsCommit: 'callback',
		manualSort: 'boolean',
		manualFilter: 'boolean',
		facets: 'value',
		manualPage: 'boolean',
		rowCount: 'number',
		loading: 'boolean',
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
		'columnAggregates',
		'cellRange',
	],
	commits: ['columnWidths', 'cellRange', 'pickedCells'],
	live: ['columnResize', 'fillDraft', 'filling'],
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
			columnAggregates:
				options.columnAggregates ?? options.defaultColumnAggregates ?? NO_AGGREGATES,
			cellFormats: options.cellFormats ?? options.defaultCellFormats ?? NO_FORMATS,
			cellFormulas: options.cellFormulas ?? options.defaultCellFormulas ?? NO_FORMULAS,
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
			pickedCells: options.pickedCells ?? options.defaultPickedCells ?? null,
			searchDraft: null,
			searchPending: false,
			history: NO_HISTORY,
			fillDraft: null,
			filling: false,
			editing: null,
			editChecking: null,
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
		if (options.columnAggregates !== undefined) synced.columnAggregates = options.columnAggregates
		if (options.cellFormats !== undefined) synced.cellFormats = options.cellFormats
		if (options.cellFormulas !== undefined) synced.cellFormulas = options.cellFormulas
		if (options.cellRange !== undefined) synced.cellRange = options.cellRange
		if (options.pickedCells !== undefined) synced.pickedCells = options.pickedCells
		return synced
	},
	api: (context) => {
		const state = () => context.store.get()
		const options = () => context.options()
		const change = createChange(context)
		const commit = createCommit(context)
		const message = <Key extends keyof TableMessages>(key: Key): TableMessages[Key] =>
			options().messages?.[key] ?? defaultMessages[key]
		/** The rules of a data sheet, which are also a preset for the options under them. */
		const sheet = () => options().sheet ?? false
		const entry = () => options().entry ?? false
		const editableByDefault = () => options().editable ?? (sheet() || entry())

		let seenRows = options().rows
		let seenColumns = options().columns
		let seenEngine = options().formulas
		const pagesOf = (next: TableOptions) =>
			`${next.manualPage}|${next.rowCount}|${next.loading}|${next.locale}`
		let seenPages = pagesOf(options())
		context.onOptions((next) => {
			// The count and the end of a load can come after the rows, and each
			// can change the last page as new rows can. A locale and an engine
			// change the texts of the view, so a listener of `subscribe` reads again.
			const pages = pagesOf(next)
			if (
				next.rows === seenRows &&
				next.columns === seenColumns &&
				next.formulas === seenEngine &&
				pages === seenPages
			)
				return
			seenRows = next.rows
			seenColumns = next.columns
			seenEngine = next.formulas
			seenPages = pages
			context.store.set({ revision: state().revision + 1 })
		})
		// A person who cannot see the table hears that rows are on their way.
		let wasLoading = options().loading ?? false
		context.onOptions((next) => {
			const loading = next.loading ?? false
			if (loading && !wasLoading) announce(message('loading')())
			wasLoading = loading
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
		const ownColumns = () => options().columns ?? NO_COLUMNS
		const engine = () => options().formulas
		// The columns with their formulas: the definitions that every other part
		// reads. The engine builds them, so a table without one carries no such code.
		const withFormulas = memo(
			(
				columns: readonly ColumnDef[],
				layer: CellFormulas['columns'],
				found: FormulaEngine | undefined,
			) => (found && layer ? found.withColumns(columns, layer) : undefined),
		)
		const builtColumns = () => withFormulas(ownColumns(), state().cellFormulas.columns, engine())
		const definitions = () => builtColumns()?.columns ?? ownColumns()
		// A new formula of a column gives the rows other values, as new columns do.
		let seenColumnFormulas = state().cellFormulas.columns
		context.onDestroy(
			context.store.subscribe((liveOnly) => {
				if (liveOnly) return
				const next = state().cellFormulas.columns
				if (next === seenColumnFormulas) return
				seenColumnFormulas = next
				context.store.set({ revision: state().revision + 1 })
			}),
		)
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
		/** The row of letters above the header rows: grid row 0 with `columnLetters`. */
		const letterRowCount = () => (options().columnLetters ? 1 : 0)
		const isLetterRow = (row: number) => row < letterRowCount()
		const letterMap = memo(lettersByColumn)
		/** The letter that a column shows, or `undefined` without the row of letters and for a column that leads the table. */
		const letterOf = (columnId: string): string | undefined =>
			letterRowCount()
				? letterMap(layout(), engine() ? ownColumns() : undefined).get(columnId)
				: undefined
		/** The header cell that covers a place of the header. The header rows come after the row of letters. */
		const headerAt = (row: number, col: number) =>
			headerMap(layout())[row - letterRowCount()]?.[col]

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

		/** The text of a value by the definition of its column alone. A search and the label of a group read this: neither follows a format that a person gave a cell. */
		function columnText(row: unknown, column: ColumnDef): string {
			const value = cellValue(row, column)
			// An error of a formula shows its code, also in a column of numbers.
			if (isFormulaError(value)) return value
			return column.format
				? formatValue(value, column.format, column.formatOptions, { locale: options().locale })
				: toText(value)
		}

		const hasFormats = (formats: CellFormats) => !!formats.columns || !!formats.cells

		/**
		 * The text of a cell as a person sees it. With the id of the row, the
		 * format of the cell decides; without it, the format of the column.
		 * A table without formats pays one test for this.
		 */
		function text(row: unknown, column: ColumnDef, rowId?: string): string {
			const formats = state().cellFormats
			if (!hasFormats(formats)) return columnText(row, column)
			const shown = resolveFormat(column, formats, rowId)
			const value = cellValue(row, column)
			if (isFormulaError(value)) return value
			return shown.format
				? formatValue(value, shown.format, shown.options, { locale: options().locale })
				: toText(value)
		}

		/** The name of the format that a cell shows with: an empty cell with a number format reads a number. */
		const shownFormat = (column: ColumnDef, rowId: string): string | undefined => {
			const formats = state().cellFormats
			return hasFormats(formats) ? resolveFormat(column, formats, rowId).format : column.format
		}

		const pickAggregate = (
			chosen: ColumnAggregates,
			column: ColumnDef,
		): AggregateName | AggregateFn<unknown> | undefined =>
			column.id in chosen ? (chosen[column.id] ?? undefined) : column.aggregate
		/**
		 * The function of the total of a column: the one that was chosen at run
		 * time, else the `aggregate` of the column. Every reader of a total asks
		 * here, so the footer, the group rows, `getTotals` and an export agree.
		 */
		const aggregateOf = (column: ColumnDef) => pickAggregate(state().columnAggregates, column)
		const aggregatesNow = createHeldKey<Record<string, AggregateName | null>, TableReason>({
			given: () => options().columnAggregates,
			state: () => state().columnAggregates,
			change: (next, details) => change('columnAggregates', next, details),
			dispatch: (next, details) => dispatch(context, 'onColumnAggregatesChange', next, details),
		})
		const formulasNow = createHeldKey<CellFormulas, TableReason | TableEditReason>({
			given: () => options().cellFormulas,
			state: () => state().cellFormulas,
			change: (next, details) => change('cellFormulas', next, details),
			dispatch: (next, details) => dispatch(context, 'onCellFormulasChange', next, details),
		})
		// The formats of now for a change that starts from them. What a cell
		// shows is the state, which follows the owner.
		const formatsNow = createHeldKey<CellFormats, TableReason>({
			given: () => options().cellFormats,
			state: () => state().cellFormats,
			change: (next, details) => changeFormatsThrough('cellFormats', next, details),
			dispatch: (next, details) => dispatch(formatsContext, 'onCellFormatsChange', next, details),
		})

		function totalText(column: ColumnDef, value: unknown): string {
			const aggregate = aggregateOf(column)
			const counts = aggregate === 'count' || aggregate === 'uniqueCount'
			// A total shows as its column does: a column that a person made a currency sums to a currency.
			const shown = resolveFormat(column, state().cellFormats)
			if (!shown.format || counts || typeof aggregate === 'function') return toText(value)
			return formatValue(value, shown.format, shown.options, { locale: options().locale })
		}

		/** The value of a group as its column shows it. */
		function groupValueText(group: GroupRow<unknown>): string {
			const column = layout().byId.get(group.columnId)
			const sample = group.leaves[0]
			return column && sample ? columnText(sample.row, column) : toText(group.value)
		}

		function groupText(group: GroupRow<unknown>): string {
			return message('groupRow')({ text: groupValueText(group), count: group.leaves.length })
		}

		// A group knows the group above it, so its path is that path and one
		// entry more. It is kept for the group: a render asks for it for each cell.
		const groupPaths = new WeakMap<
			GroupRow<unknown>,
			{ columns: unknown; locale: string | undefined; path: readonly GroupPathEntry[] }
		>()

		/** The groups from the outermost one down to a group, with the group itself last. */
		function groupPath(group: GroupRow<unknown>): readonly GroupPathEntry[] {
			const columns = definitions()
			const locale = options().locale
			const kept = groupPaths.get(group)
			if (kept && kept.columns === columns && kept.locale === locale) return kept.path
			const path = [
				...(group.parent ? groupPath(group.parent) : []),
				{
					group,
					column: layout().byId.get(group.columnId),
					value: group.value,
					text: groupValueText(group),
				},
			]
			groupPaths.set(group, { columns, locale, path })
			return path
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
			// An empty choice is no choice: the totals of a table without one are counted as before.
			aggregates: () =>
				state().columnAggregates === NO_AGGREGATES ? undefined : state().columnAggregates,
			// Read at each use, so a table that gets these options later still works.
			get getRowId() {
				return options().getRowId
			},
			get getChildren() {
				return options().getChildren
			},
			locale: () => options().locale,
			filter: () => list().filter,
			filterText: columnText,
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
			manual: () => ({
				sort: options().manualSort,
				filter: options().manualFilter,
				page: options().manualPage,
			}),
			serverRowCount: () => options().rowCount,
			loading: () => options().loading,
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

		/** The rows of the grid before the body: the row of letters and the header rows. */
		const headerRowCount = () => letterRowCount() + layout().headerRows.length
		/** Without rows, the body holds one row that says so. */
		const bodyRowCount = () => bodyRows().length || 1
		const hasTotals = memo((columns: readonly ColumnDef[], chosen: ColumnAggregates) =>
			columns.some((column) => pickAggregate(chosen, column) !== undefined),
		)
		/** The footer is one row of column totals, and it exists when a column has a total. */
		const footerRowCount = () => (hasTotals(layout().leaves, state().columnAggregates) ? 1 : 0)
		const rowCount = () => headerRowCount() + bodyRowCount() + footerRowCount()

		// The totals of the owner, checked once for each object that the owner gives.
		const givenTotals = memo(
			(given: TableTotalsSource | undefined, columns: ColumnLayout, chosen: ColumnAggregates) => {
				if (given === undefined) return undefined
				const wrong = () =>
					new Error(
						'`totals` is an object with `table` (totals by column id) and `groups` (totals by group id, then by column id).',
					)
				const record = (value: unknown): value is Record<string, unknown> =>
					typeof value === 'object' && value !== null && !Array.isArray(value)
				if (!record(given)) throw wrong()
				if (Object.keys(given).some((key) => key !== 'table' && key !== 'groups')) throw wrong()
				const check = (totals: unknown) => {
					if (!record(totals)) throw wrong()
					for (const id of Object.keys(totals)) {
						const found = columns.byId.get(id)
						const withTotal = columns.all.filter(
							(column) => pickAggregate(chosen, column) !== undefined,
						)
						if (!found || pickAggregate(chosen, found) === undefined) {
							throw new Error(
								`${found ? `Column "${id}" has no \`aggregate\`, so it shows no total` : `No column "${id}" to give a total to`}. Columns with a total: ${listed(withTotal.map((column) => column.id))}.`,
							)
						}
					}
				}
				if (given.table !== undefined) check(given.table)
				if (given.groups !== undefined) {
					if (!record(given.groups)) throw wrong()
					for (const totals of Object.values(given.groups)) check(totals)
				}
				return given
			},
		)
		const mergedTotals = new WeakMap<
			Record<string, unknown>,
			{ own: Readonly<Record<string, unknown>>; result: Record<string, unknown> }
		>()

		/**
		 * The totals of a group, or of every row that passes the filters. The
		 * footer, the group rows, `getTotals` and an export all read them here:
		 * what the rows of the table give, and over it what the owner knows better.
		 */
		function totalsOf(group?: GroupRow<unknown>): Record<string, unknown> {
			const counted = model.aggregate(group)
			const given = givenTotals(options().totals, layout(), state().columnAggregates)
			const own = group ? given?.groups?.[group.id] : given?.table
			if (!own) return counted
			const kept = mergedTotals.get(counted)
			if (kept && kept.own === own) return kept.result
			const result = { ...counted, ...own }
			mergedTotals.set(counted, { own, result })
			return result
		}

		// How many columns the label of a group row covers when the row shows
		// totals: the columns that lead the table, the first column after them,
		// and the columns after that up to the first one with a total. The label
		// never crosses from pinned columns to free ones: a cell sticks or scrolls
		// as a whole.
		const labelSpan = memo(
			(columns: ColumnLayout, on: boolean, chosen: ColumnAggregates): number | undefined => {
				const leaves = columns.leaves
				const first = leaves[0]
				if (!on || !first || !hasTotals(leaves, chosen)) return undefined
				const pin = columns.pins.get(first.id)
				let span = 1
				let named = !isLead(first)
				for (let next = leaves[span]; next; next = leaves[span]) {
					if (columns.pins.get(next.id) !== pin) break
					if (named && pickAggregate(chosen, next) !== undefined) break
					if (!isLead(next)) named = true
					span++
				}
				return span
			},
		)
		/** The columns that the label cell of a group row covers, or `undefined` when a group row is one wide cell. */
		const groupSpan = () =>
			labelSpan(layout(), options().groupTotals ?? true, state().columnAggregates)

		/** What a cell of a group row is: its label, the total of a column, or the place of a column without one. */
		const columnFormatNames = memo((columns: readonly ColumnDef[]) =>
			columns.flatMap((item) => formatNames(undefined, item.id)),
		)

		function groupCell(
			row: number,
			col: number,
		): 'group-label' | 'group-total' | 'group-blank' | undefined {
			const flat = bodyRows()[row - headerRowCount()]
			if (flat?.node.kind !== 'group') return undefined
			const span = groupSpan()
			if (span === undefined || col < span) return 'group-label'
			const leaf = layout().leaves[col]
			return leaf && aggregateOf(leaf) !== undefined ? 'group-total' : 'group-blank'
		}

		function area(cell: GridCell): GridArea {
			const columns = layout()
			const head = headerRowCount()
			// A letter is a cell of one column, also above a header group.
			if (isLetterRow(cell.row)) return { row: cell.row, col: cell.col, rowSpan: 1, colSpan: 1 }
			if (cell.row < head) {
				const header = headerAt(cell.row, cell.col)
				if (header) {
					return {
						row: header.row + letterRowCount(),
						col: header.col,
						rowSpan: header.rowSpan,
						colSpan: header.colSpan,
					}
				}
			}
			const flat = bodyRows()
			const at = flat[cell.row - head]
			// A group row with totals: the label covers the first columns, and each column after it has a cell.
			const span = at?.node.kind === 'group' ? groupSpan() : undefined
			if (span !== undefined) {
				return cell.col < span
					? { row: cell.row, col: 0, rowSpan: 1, colSpan: span }
					: { row: cell.row, col: cell.col, rowSpan: 1, colSpan: 1 }
			}
			// Else a group row is one cell as wide as the table, and so is the row that says "no rows".
			// So is a detail row.
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
		const editing = () => hasEditing(layout().all, editableByDefault())

		function canEdit(node: DataRow<unknown>, column: ColumnDef): boolean {
			// The number of a row is its place, and no value of the data.
			if (column.rowHeader) return false
			const rule = column.editable ?? editableByDefault()
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

		// The columns of row headers lead the table. A range starts after the last of them.
		const afterRowHeaders = memo((leaves: readonly ColumnDef[]) => {
			let first = 0
			leaves.forEach((leaf, index) => {
				if (leaf.rowHeader) first = index + 1
			})
			return first
		})
		const firstRangeCol = () => afterRowHeaders(layout().leaves)
		/** Whether a place of the grid is the header of a data row: the cell with its number. */
		const isRowHeader = (cell: GridCell): boolean =>
			layout().leaves[cell.col]?.rowHeader === true && cellIdAt(cell.row, cell.col) !== undefined

		// How many rows of the body before each place hold no data: group rows and detail rows.
		const passedOver = memo((rows: readonly FlatRow<unknown>[]) => {
			const before = new Int32Array(rows.length)
			let count = 0
			rows.forEach((flat, index) => {
				before[index] = count
				if (flat.node.kind !== 'row' || flat.detail) count++
			})
			return count ? before : undefined
		})
		// The data rows that the pages before this one show, with the rows that are open now.
		const shownBefore = memo(
			(rows: readonly TableRow<unknown>[], end: number, open: ReadonlySet<string>) => {
				let count = 0
				const walk = (list: readonly TableRow<unknown>[], to: number) => {
					for (let index = 0; index < to; index++) {
						const node = list[index]
						if (!node) continue
						if (node.kind === 'row') count++
						if (node.children?.length && open.has(node.id)) {
							walk(node.children, node.children.length)
						}
					}
				}
				walk(rows, Math.min(end, rows.length))
				return count
			},
		)
		/**
		 * The number of a data row, from 1: its place among the data rows that
		 * the table shows, counted over the pages before this one. A group row
		 * and a detail row have no number. It is a place and no id: after a
		 * sort, row 1 is another row.
		 */
		function rowNumber(rowId: string): number | undefined {
			// With formulas, the number is an address: the place of the row in the document.
			const found = engine()
			if (found && !(options().manualPage ?? false)) return found.rowNumber(rowId, formulaSheet)
			const rows = bodyRows()
			const index = flatIndex(rows).get(rowId)
			const flat = index === undefined ? undefined : rows[index]
			if (index === undefined || !flat || flat.node.kind !== 'row' || flat.detail) return undefined
			const place = index + 1 - (passedOver(rows)?.[index] ?? 0)
			const page = state().page
			if (!page || model.page() <= 1) return place
			const start = (model.page() - 1) * page.pageSize
			// With pages from a server, the table has one page and the server counts the rows.
			if ((options().manualPage ?? false) || pageUnit(model.grouped()) === 'rows') {
				return place + start
			}
			return place + shownBefore(model.grouped(), start, idSet(state().expanded))
		}

		const parseTexts = (): ParseTexts => ({
			notNumber: message('notNumber'),
			notDate: message('notDate'),
			notBoolean: message('notBoolean'),
		})

		const editReason = (reason: string): TableEditReason =>
			(EDIT_REASONS as readonly string[]).includes(reason)
				? (reason as TableEditReason)
				: 'imperative'

		// The values that were reported in this turn. The rows of the owner come
		// with its next render, and until then a second report must start from
		// the first: its `previous`, and the test whether a value changes at all.
		const turn = createTurnValues(() => options().rows)
		/** The value that a cell holds now: what the table reported in this turn, else what the row says. */
		function valueNow(node: DataRow<unknown>, column: ColumnDef): unknown {
			const held = turn.read(node.id, column.id)
			return held ? held.value : cellValue(node.row, column)
		}

		/**
		 * Tells the owner about new values, and returns whether a listener
		 * refused them, with the source of the change as the listener got it.
		 * `dispatch` gives back only the refusal, so the listener is called
		 * through one of our own that reads the details on their way.
		 */
		function tell(
			edits: CellEdit[],
			reason: TableEditReason,
			event?: Event,
		): { refused: boolean; source: ChangeSource } {
			let source: ChangeSource = 'programmatic'
			const through = {
				options: () => ({
					onCellEdit(given: readonly CellEdit[], details: TableEditDetails) {
						source = details.source
						options().onCellEdit?.(given, details)
					},
				}),
			}
			const refused = dispatch(through, 'onCellEdit', edits, { reason, event })
			if (!refused) {
				turn.add(edits)
				if (engine()) toldSince.push(edits)
				// A cell that got a value by another way can get the value of a check again.
				if (reason !== 'recalculate' && checkedValues.size) {
					for (const edit of edits) checkedValues.delete(cellKey(edit.rowId, edit.columnId))
				}
			}
			return { refused, source }
		}

		// The check after new rows of the owner. The rows of the last check by
		// id, the reports since, and the last value that a check reported for
		// each cell: an owner that does not take it gets it once, and no loop.
		// At the mount the table trusts the document: the first check compares with these rows.
		let checkedById: ReadonlyMap<string, DataRow<unknown>> | undefined = engine()
			? model.source().byId
			: undefined
		let toldSince: (readonly CellEdit[])[] = []
		const checkedValues = new Map<string, unknown>()
		let checkQueued = false
		let checkedRows = options().rows
		context.onOptions((next) => {
			if (!next.formulas || next.rows === checkedRows) return
			checkedRows = next.rows
			if (checkQueued) return
			checkQueued = true
			queueMicrotask(checkRows)
		})

		function checkRows(): void {
			checkQueued = false
			const before = checkedById
			const after = model.source().byId
			checkedById = after
			const told = toldSince
			toldSince = []
			const found = engine()
			const formulas = formulasNow.read()
			if (destroyed || !found || before === after || !formulas.cells) return
			if (options().manualPage ?? false) return
			const checked = found.recheck({ before, after, told }, formulas, formulaSheet)
			// A check that would read too many cells leaves them as they are.
			if (!('issues' in checked)) reportCheck(checked.results)
		}

		/** Reports what a check found, once for each value of a cell. Returns how many cells it reported. */
		function reportCheck(results: readonly FormulaResult[]): number {
			const edits: CellEdit[] = []
			const columns = layout().byId
			for (const result of results) {
				const key = cellKey(result.rowId, result.columnId)
				if (checkedValues.has(key) && sameValue(checkedValues.get(key), result.value)) continue
				const node = model.rowById(result.rowId)
				const column = columns.get(result.columnId)
				if (!node || !column) continue
				checkedValues.set(key, result.value)
				edits.push({ ...result, row: node.row, column })
			}
			if (edits.length) tell(edits, 'recalculate')
			return edits.length
		}

		/**
		 * With formulas: the edits of a report with every formula cell that
		 * follows from them, and the formulas after it. A value over a formula
		 * cell takes its formula away. The words of an issue refuse the whole report.
		 */
		function joinFormulas(
			edits: CellEdit[],
		):
			| { edits: CellEdit[]; before: CellFormulas; after: CellFormulas; cells: number }
			| string
			| undefined {
			const found = engine()
			if (!found || (options().manualPage ?? false)) return undefined
			const before = formulasNow.read()
			if (!before.cells && !edits.some((edit) => edit.formula !== undefined)) return undefined
			const joined = found.join(
				edits.map((edit) =>
					edit.formula === undefined
						? { rowId: edit.rowId, columnId: edit.columnId, value: edit.value }
						: { rowId: edit.rowId, columnId: edit.columnId, formula: edit.formula },
				),
				before,
				formulaSheet,
			)
			if ('issues' in joined) return joined.issues.map((issue) => issueText(found, issue)).join(' ')
			const all: CellEdit[] = []
			let cells = 0
			for (const edit of edits) {
				// A formula that was entered comes back with its value among the results.
				if (typeof edit.formula === 'string') continue
				const lost =
					edit.formula === undefined && formulaIn(before, edit.rowId, edit.columnId) !== undefined
				if (lost || edit.formula === null) cells++
				all.push(lost ? { ...edit, formula: null } : edit)
			}
			const columns = layout().byId
			for (const result of joined.results) {
				const node = model.rowById(result.rowId)
				const column = columns.get(result.columnId)
				if (!node || !column) continue
				if (result.formula !== undefined) cells++
				all.push({
					rowId: node.id,
					columnId: column.id,
					row: node.row,
					column,
					value: result.value,
					previous: result.previous,
					...(result.formula === undefined ? undefined : { formula: result.formula }),
				})
			}
			return { edits: all, before, after: joined.formulas, cells }
		}

		/**
		 * Tells the caller about new values. Returns whether a listener refused
		 * them, or the words of a formula that refuses them. A report that went
		 * through is a step of the history. The values go first and the formulas
		 * after them: a value without its formula is a state that makes sense.
		 */
		function report(edits: CellEdit[], reason: string, event?: Event): boolean | string {
			const why = editReason(reason)
			const joined = joinFormulas(edits)
			if (typeof joined === 'string') return joined
			const all = joined ? joined.edits : edits
			const { refused, source } = tell(all, why, event)
			if (refused) return true
			const formulas =
				joined &&
				joined.after !== joined.before &&
				formulasNow.change(joined.after, { reason: why, event })
					? { before: joined.before, after: joined.after, cells: joined.cells }
					: undefined
			if (historyOn()) {
				history.record({
					id: ++stepIds,
					reason: why,
					source,
					cells: all.map((edit) => ({
						rowId: edit.rowId,
						columnId: edit.columnId,
						before: edit.previous,
						after: edit.value,
					})),
					...(formulas ? { formulas } : undefined),
				})
			}
			return false
		}

		const historyOn = () => (options().history ?? sheet()) !== false
		const historyLimits = (): TableHistoryOptions => {
			const given = options().history
			return typeof given === 'object' && given !== null ? given : NO_LIMITS
		}
		let stepIds = 0
		// What the last undo or redo did, for the words after it.
		let applied: { cells: number; gone: number; hidden: number } | undefined

		/**
		 * Puts a step back, or on again. The table never writes a row, so this
		 * is a report, as an edit is, and the owner of the rows puts the values
		 * in. The values came from the data and not from a person, so they pass
		 * no `parse` and no schema: a schema could refuse a value that the data
		 * held before, and that step would block every step under it.
		 */
		function applyStep(
			step: TableStep<TableStepReason>,
			direction: 'undo' | 'redo',
			event?: Event,
		): HistoryResult {
			if (step.formulas && !step.cells.length) {
				// A step of formulas: the formulas that the step changed go back, and
				// what the owner changed beside it since stays.
				const { before, after } = step.formulas
				const now = formulasNow.read()
				const next =
					direction === 'undo'
						? requireFormulas().revertFormulas(now, after, before)
						: requireFormulas().revertFormulas(now, before, after)
				if (next !== now && !formulasNow.change(next, { reason: direction, event })) {
					return 'refused'
				}
				applied = { cells: 0, gone: 0, hidden: 0 }
				return 'done'
			}
			if (step.formats) {
				// A step of formats: the formats that the step changed go back, and
				// what the owner changed beside it since stays.
				const { before, after, cells } = step.formats
				const now = formatsNow.read()
				const next =
					direction === 'undo'
						? revertFormats(now, after, before)
						: revertFormats(now, before, after)
				if (next !== now && !formatsNow.change(next, { reason: direction, event })) return 'refused'
				applied = { cells: next === now ? 0 : cells, gone: 0, hidden: 0 }
				return 'done'
			}
			const edits: CellEdit[] = []
			const places: GridCell[] = []
			let gone = 0
			let hidden = 0
			const columns = layout().byId
			// The places are looked up without a cell id: a step can hold many thousands of cells.
			const rowPlaces = flatIndex(bodyRows())
			const columnPlaces = layout().index
			const head = headerRowCount()
			for (const cell of step.cells) {
				// Every row that the table has, also one that a filter, a page or a closed parent hides.
				const node = model.rowById(cell.rowId)
				const column = columns.get(cell.columnId)
				if (!node || !column) {
					gone++
					continue
				}
				const value = direction === 'undo' ? cell.before : cell.after
				const previous = valueNow(node, column)
				// The owner did not take the edit, or took this step back by itself.
				if (sameValue(previous, value)) continue
				edits.push({ rowId: node.id, columnId: column.id, row: node.row, column, value, previous })
				const row = rowPlaces.get(node.id)
				const col = columnPlaces.get(column.id)
				if (row === undefined || col === undefined) hidden++
				else places.push({ row: head + row, col })
			}
			// Nothing of the step is in the table any more.
			if (gone === step.cells.length) return 'gone'
			if (edits.length && tell(edits, direction, event).refused) return 'refused'
			// The values first, then the formulas of the step, as the report had them.
			if (step.formulas) {
				const { before, after } = step.formulas
				const now = formulasNow.read()
				const engineNow = requireFormulas()
				const next =
					direction === 'undo'
						? engineNow.revertFormulas(now, after, before)
						: engineNow.revertFormulas(now, before, after)
				if (next !== now) formulasNow.change(next, { reason: direction, event })
			}
			applied = { cells: edits.length, gone, hidden }
			showCells(places)
			return 'done'
		}

		/**
		 * Brings the person to cells that changed without a key or a press on
		 * them: the active cell goes to the first one, and when the cells are
		 * one block, the block is the range.
		 */
		function showCells(places: readonly GridCell[]): void {
			const [head] = places
			if (!head) return
			let top = head.row
			let bottom = head.row
			let left = head.col
			let right = head.col
			for (const place of places) {
				top = Math.min(top, place.row)
				bottom = Math.max(bottom, place.row)
				left = Math.min(left, place.col)
				right = Math.max(right, place.col)
			}
			const first = { row: top, col: left }
			activate(first)
			// The person must see what changed, also from a button outside the table,
			// where focus does not bring the row into view.
			const row = bodyRows()[top - headerRowCount()]
			if (row && !row.pinned) rowWindow.scrollTo(row.id)
			if (!cellSelection()) return
			const block = (bottom - top + 1) * (right - left + 1) === places.length && places.length > 1
			range.select(block ? { anchor: first, end: { row: bottom, col: right } } : null, {
				reason: 'imperative',
			})
		}

		/**
		 * Makes a cell the active one from code. Focus that is in the table
		 * goes with it, or the next arrow key would start from a cell that the
		 * person is not on. Focus that is outside the table stays there: a call
		 * from code must not take it from the person.
		 */
		function activate(cell: GridCell): void {
			const active = state().active
			if (active?.row === cell.row && active.col === cell.col) return
			if (grid.hasFocus()) {
				grid.focus(cell, { reason: 'imperative' })
				return
			}
			context.store.set({ active: cell })
		}

		const history = createStepHistory<TableState, TableStep<TableStepReason>>(context, {
			key: 'history',
			enabled: historyOn,
			limit: () => historyLimits().limit ?? HISTORY_LIMIT,
			size: stepSize,
			maxSize: () => historyLimits().maxCells ?? HISTORY_MAX_CELLS,
			apply: (step, direction, details) => applyStep(step, direction, details.event),
			overflow: (step) => announce(message('historyTooLarge')({ cells: step.cells.length })),
		})

		/** Whether a new value is checked now. Its step is not in the history yet, so an undo would take the step before it. */
		const historyBusy = () => edit.checking() || writes.pending()

		/**
		 * Runs an undo or a redo and says what it did. Returns the reason why
		 * nothing changed, or `undefined`.
		 */
		function travel(direction: 'undo' | 'redo', event?: Event): string | undefined {
			if (historyBusy()) return message('historyBusy')()
			applied = undefined
			const result = direction === 'undo' ? history.undo({ event }) : history.redo({ event })
			if (result === 'refused') return message('undoRefused')()
			if (result !== 'done' || !applied) {
				return message(direction === 'undo' ? 'nothingToUndo' : 'nothingToRedo')()
			}
			announce(message(direction === 'undo' ? 'undone' : 'redone')(applied))
			return undefined
		}

		/** Handles the keys of the history on a cell. Returns whether the key was one of them. */
		function historyKeydown(event: KeyboardEvent): boolean {
			if (!historyOn()) return false
			const redo = matchesShortcut(event, 'mod+shift+z') || matchesShortcut(event, 'mod+y')
			if (!redo && !matchesShortcut(event, 'mod+z')) return false
			// The key is the table's, also with nothing to undo: the browser must not undo in a field elsewhere.
			event.preventDefault()
			const direction = redo ? 'redo' : 'undo'
			const empty = direction === 'undo' ? !history.canUndo(state()) : !history.canRedo(state())
			// A key with no step is silent, and so is a key while a check runs.
			if (empty || historyBusy()) return true
			const reason = travel(direction, event)
			if (reason !== undefined && history.read().steps.length) {
				announce(reason, { priority: 'assertive' })
			}
			return true
		}

		/**
		 * Checks a new value of a cell and reports it. The answer is `true`, or
		 * the reason why the value is refused. The table never writes the value
		 * into the row: the caller does, when `onCellEdit` runs.
		 */
		function saveCell(
			node: DataRow<unknown>,
			column: ColumnDef,
			input: { text: string; field?: boolean } | { value: unknown },
			reason: string,
			event?: Event,
		): SaveResult | LateSave {
			const finish = (checked: Checked & { formula?: string }): SaveResult => {
				if ('issues' in checked) return checked.issues[0] ?? message('invalidValue')()
				// The rows can be other objects after a check that took time: the
				// caller looks for the row object of the edit in its rows of now.
				const now = model.rowById(node.id)
				if (!now) return message('editRowGone')()
				const previous = valueNow(now, column)
				const { formula } = checked
				if (formula === undefined && sameValue(previous, checked.value)) return true
				const edits: CellEdit[] = [
					{
						rowId: now.id,
						columnId: column.id,
						row: now.row,
						column,
						value: checked.value,
						previous,
						...(formula === undefined ? undefined : { formula }),
					},
				]
				const refused = report(edits, reason, event)
				return refused === false ? true : refused === true ? message('editRefused')() : refused
			}
			// The rule of `=` comes before `parse`: a formula, or a text after `'`.
			const entry = 'text' in input ? formulaEntry(node, column, input.text) : undefined
			if (entry && 'issues' in entry) return entryRefusal(entry)
			if (entry && 'formula' in entry) {
				if (entry.formula === formulaOf(node.id, column.id)) return true
				return finish({ value: undefined, formula: entry.formula })
			}
			if (entry) input = { ...input, text: entry.text }
			// A `parse` or a schema that throws refuses the value with its own words.
			// Only the check is inside: an error of a listener of `onCellEdit` is an
			// error of the page, and the person must not read it as a reason.
			const failed = (error: unknown) => (error instanceof Error ? error.message : String(error))
			let checked: Checked | Promise<Checked>
			try {
				checked = resolveValue(
					input,
					node.row,
					column,
					parseTexts(),
					options().locale,
					shownFormat(column, node.id),
				)
			} catch (error) {
				return failed(error)
			}
			if (!isThenable(checked)) return finish(checked)
			return Promise.resolve(checked).then(
				(answer) => () => finish(answer),
				(error: unknown) => () => failed(error),
			)
		}

		// A check that takes time can answer after the table is gone. Nothing is reported then.
		let destroyed = false
		context.onDestroy(() => {
			destroyed = true
		})
		const GONE = 'The table was removed before the value was checked, so nothing was saved.'

		const writes = createCellWrites<TableEditReason>(context, {
			rowById: (id) => model.rowById(id),
			check: (input: WriteInput, row, column, rowId) => {
				const node = engine() && model.rowById(rowId)
				const entry = !node
					? undefined
					: 'formula' in input
						? formulaEntry(node, column, input.formula, true)
						: 'text' in input
							? formulaEntry(node, column, input.text)
							: undefined
				if (entry && 'issues' in entry) return { issues: [entryRefusal(entry)] }
				const own = node ? formulaOf(rowId, column.id) : undefined
				if (entry && 'formula' in entry) {
					// The formula that the cell holds already is no change.
					return node && entry.formula === own
						? { value: valueNow(node, column) }
						: { value: undefined, formula: entry.formula }
				}
				const checked = resolveValue(
					entry ? { text: entry.text } : (input as { text: string } | { value: unknown }),
					row,
					column,
					parseTexts(),
					options().locale,
					shownFormat(column, rowId),
				)
				// A value over a formula takes the formula away, also a value that stays.
				return own === undefined || isThenable(checked) || 'issues' in checked
					? checked
					: { ...checked, formula: null }
			},
			valueOf: valueNow,
			report: (edits, details) => {
				const refused = report(edits, details.reason, details.event)
				if (typeof refused === 'string') throw new Error(refused)
				return refused
			},
			refusal: {
				value: ({ reason, column, text, message: why }) =>
					reason === 'clear' || reason === 'cut'
						? message('clearRefused')({ column: label(column.id), message: why })
						: reason === 'fill'
							? message('fillRefused')({ column: label(column.id), text, message: why })
							: message('pasteRefused')({ column: label(column.id), text, message: why }),
				invalid: () => message('invalidValue')(),
				rowGone: () => message('editRowGone')(),
				refused: () => message('editRefused')(),
				tableGone: () => GONE,
			},
		})

		/** The body rows as grid rows, and the columns in view: where a move after a save can go. */
		const moveLimits = () => {
			const first = headerRowCount()
			return { first, last: first + bodyRows().length - 1, cols: layout().leaves.length }
		}
		/** Whether a place of the grid holds the cell of a data row. A group row and a detail row hold none. */
		const holdsCell = (cell: GridCell) => cellIdAt(cell.row, cell.col) !== undefined

		/** The selected range when it holds more than one cell and the cell is inside it. */
		function rangeAround(cell: GridCell): CellBounds | undefined {
			if (!cellSelection() || !state().cellRange) return undefined
			const bounds = selectedCells()
			if (!bounds) return undefined
			const inside =
				cell.row >= bounds.top &&
				cell.row <= bounds.bottom &&
				cell.col >= bounds.left &&
				cell.col <= bounds.right
			return inside ? bounds : undefined
		}

		/**
		 * The cell that focus goes to after a save. In a table, Tab goes to the
		 * next cell in reading order and stops at the last one. In a sheet,
		 * Enter moves too, a group row is passed over, and inside a selected
		 * range both keys walk the range and start again at its first cell.
		 */
		function moveAfter(from: GridCell, move: Move): GridCell {
			const bounds = rangeAround(from)
			if (entry() && !bounds && (move === 'forward' || move === 'back')) {
				return entryMove(from, move === 'back') ?? from
			}
			if (!sheet() && !(entry() && bounds)) {
				const next = moveFrom(from, move, moveLimits())
				const spot = area(next)
				return { row: spot.row, col: spot.col }
			}
			return moveFrom(from, move, moveLimits(), bounds, holdsCell)
		}

		/** Whether a place of the grid holds a cell that takes input: one that opens an editor, and no cell of a column that leads. */
		const takesInput = (cell: GridCell) => {
			const id = cellIdAt(cell.row, cell.col)
			return id !== undefined && !layout().leaves[cell.col]?.lead && editableCell(id)
		}

		/**
		 * The cell that Tab goes to in the entry mode: the next or the previous
		 * cell that takes input, in reading order and across the rows.
		 * `undefined` after the last one and before the first one, so that Tab
		 * leaves the table there.
		 */
		function entryMove(from: GridCell, back: boolean): GridCell | undefined {
			if (!inBody(from.row)) return undefined
			const to = moveFrom(from, back ? 'back' : 'forward', moveLimits(), undefined, takesInput)
			return to.row === from.row && to.col === from.col ? undefined : to
		}

		/**
		 * Tab in the editor of the entry mode at the last cell that takes input
		 * (with Shift: the first). The text is saved and the key goes on, so the
		 * browser takes focus out of the table. `true` when it saved, `false`
		 * when the text was refused or is checked, and `undefined` for any other key or place.
		 */
		function entryLeave(event: KeyboardEvent): boolean | undefined {
			if (!entry() || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
				return undefined
			}
			const id = state().editing
			const at = id === null ? undefined : placeOf(id)
			if (!at || rangeAround(at) || entryMove(at, event.shiftKey)) return undefined
			return edit.end('tab-key', event)
		}

		/**
		 * The cell of the last press in the entry mode. The click after it
		 * opens that cell, and not the cell under the pointer then: the save of
		 * an editor in another cell can change the widths of the columns
		 * between the press and the release, and then the browser sends the
		 * click to the row, or past the table when it got narrower. So the
		 * page hears the next click. A pointer that moved is a drag, and opens nothing.
		 */
		let pressed: { id: string; x: number; y: number } | undefined
		context.onDestroy(() => (pressed = undefined))
		function entryPress(event?: PointerEvent, id?: string): void {
			const plain =
				event &&
				event.button === 0 &&
				!event.shiftKey &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.altKey
			pressed =
				plain && id !== undefined && entry() && editableCell(id)
					? { id, x: event.clientX, y: event.clientY }
					: undefined
			const page = event?.target instanceof Node ? event.target.ownerDocument : null
			if (pressed && page) page.addEventListener('click', entryClick, { capture: true, once: true })
		}
		function entryClick(event: MouseEvent): void {
			const press = pressed
			pressed = undefined
			if (!press || !entry()) return
			if (Math.abs(event.clientX - press.x) > 4 || Math.abs(event.clientY - press.y) > 4) return
			edit.start(press.id, { reason: 'imperative', event })
		}

		/** A key in the text field of the editor. */
		function editorKeydown(event: KeyboardEvent): void {
			if (pickKeydown(event)) {
				event.stopPropagation()
				return
			}
			// After the last cell of the entry mode, Tab saves and goes on to the
			// root, which lets the browser take focus out of the table.
			const left = entryLeave(event)
			if (left) return
			if (left === false) event.preventDefault()
			else edit.inputKeydown(event)
			// A key in the field is text or a command of the editor, and never a move in the grid.
			event.stopPropagation()
		}

		const edit = createCellEdit(context, {
			key: 'editing',
			checking: 'editChecking',
			errors: 'editErrors',
			text: (id) => {
				const cell = cellOf(id)
				if (!cell) return ''
				const ofColumn = columnFormulaAt(cell.node, cell.column)
				if (ofColumn !== undefined) {
					return requireFormulas().print(ofColumn, { columnId: cell.column.id }, formulaSheet)
				}
				const plain = fieldText(cell.node.row, cell.column, shownFormat(cell.column, cell.node.id))
				// A formula cell starts with its formula, and a text with `=` with `'`.
				return holdsFormula(cell.node, cell.column)
					? requireFormulas().field(
							formulaOf(cell.node.id, cell.column.id),
							plain,
							{ rowId: cell.node.id, columnId: cell.column.id },
							formulaSheet,
						)
					: plain
			},
			canEdit: (id) => editableCell(id),
			save: (id, text, details) => {
				const cell = cellOf(id)
				// The row or the column went away while the editor was open, so there is nothing to save.
				if (!cell) return true
				if (columnFormulaAt(cell.node, cell.column) !== undefined) {
					// The cell shows the formula of its column, so a save is a new formula of the column.
					const refused = text.startsWith('=')
						? writeColumnFormula(cell.column.id, text, editReason(details.reason), details.event)
						: issueText(requireFormulas(), { code: 'columnCell', column: cell.column.id })
					return refused ?? true
				}
				return saveCell(
					cell.node,
					cell.column,
					{ text, field: true },
					details.reason,
					details.event,
				)
			},
			// The person looks at the field, so a refusal is said at once.
			refused: (_id, reason) => announce(reason, { priority: 'assertive' }),
			// The input goes away with the edit, so focus goes to a cell: the one
			// that was edited, or after Tab the next one, as in a spreadsheet.
			arrows: sheet,
			done: (id, details) => {
				const at = placeOf(id)
				if (!at) return
				const { event } = details
				const key = event instanceof KeyboardEvent ? event : undefined
				// An arrow that saved the editor moves as the arrow does on a cell: one
				// cell, and a range goes. The key event is used up by then (a slow check
				// answers long after it), so the grid moves by the name of the key.
				if (details.saved && details.reason === 'list-navigation' && key) {
					grid.focus(at, { reason: 'imperative', event })
					if (cellSelection()) range.select(null, { reason: 'list-navigation', event })
					grid.move(key.key, event)
					return
				}
				const back = !!key?.shiftKey
				const move: Move | undefined = !details.saved
					? undefined
					: details.reason === 'tab-key'
						? back
							? 'back'
							: 'forward'
						: sheet() && details.reason === 'enter-key' && key?.key === 'Enter'
							? back
								? 'up'
								: 'down'
							: undefined
				const to = move ? moveAfter(at, move) : at
				const next = cellIdAt(to.row, to.col)
				grid.focus(to, { reason: move ? 'list-navigation' : 'imperative', event })
				if (next === undefined || next === id) return
				// The save can move the row, for example in a sorted table. The
				// renderer then moves its element, focus is lost, and the text field
				// that goes away gives focus back to the cell it was in. The person
				// pressed Tab, so focus belongs on the next cell of the row.
				return () => {
					const want = placeOf(next)
					const edited = placeOf(id)
					const active = state().active
					if (!want || !edited || !active || !grid.hasFocus()) return
					if (active.row === edited.row && active.col === edited.col) {
						grid.focus(want, { reason: 'imperative' })
					}
				}
			},
		})

		const cellSelection = () => options().cellSelection ?? sheet()
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
			firstCol: firstRangeCol,
			columnsFrom: () => letteredFrom(),
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
			const active = state().active
			// A range in the state of a table without cell selection marks no cell, so it selects none.
			const bounds = cellSelection()
				? range.bounds(state())
				: active && { top: active.row, bottom: active.row, left: active.col, right: active.col }
			if (!bounds) return undefined
			// A range from the owner can start in the header rows or end in the footer
			// row. Only its body cells show as selected, so only those are selected.
			const first = headerRowCount()
			const top = Math.max(bounds.top, first)
			const bottom = Math.min(bounds.bottom, first + bodyRows().length - 1)
			// The number of a row is no cell of the data: an active row header selects nothing.
			const left = Math.max(bounds.left, firstRangeCol())
			return top > bottom || left > bounds.right ? undefined : { ...bounds, top, bottom, left }
		}

		/**
		 * The text of the selected cells. Each value is plain text, without the
		 * format of the column, so a paste of the text into these columns or into
		 * other columns gives the same values.
		 */
		function copyText(): string {
			const bounds = selectedCells()
			if (!bounds) return ''
			const head = headerRowCount()
			const rows = bodyRows()
			const leaves = layout().leaves.slice(bounds.left, bounds.right + 1)
			const lines: string[][] = []
			const formulas: (CopiedFormula | undefined)[][] = []
			for (let row = bounds.top; row <= bounds.bottom; row++) {
				const flat = rows[row - head]
				// A group row or a detail row holds no values, and gives an empty line.
				const values = flat && flat.node.kind === 'row' && !flat.detail ? flat.node.row : undefined
				lines.push(leaves.map((column) => (values === undefined ? '' : editText(values, column))))
				if (engine()) {
					formulas.push(
						leaves.map((column) => {
							const formula = flat && formulaOf(flat.id, column.id)
							return formula ? { rowId: flat.id, columnId: column.id, formula } : undefined
						}),
					)
				}
			}
			const text = cellsToText(lines)
			// The clipboard holds values; a paste of this text again pastes the formulas.
			lastCopy = engine() ? { text: copyKey(text), formulas, mode: 'copy' } : undefined
			return text
		}

		/**
		 * Puts text into cells, from the first selected cell on. One value fills
		 * every selected cell. Each value goes through the check of its column,
		 * and one refusal stops the paste before any cell changes: half of a
		 * paste is worse than none. Cells that cannot be edited are skipped.
		 */
		function pasteText(text: string, event?: Event): void | Promise<void> {
			const copied = lastCopy?.text === copyKey(text) ? lastCopy : undefined
			const bounds = selectedCells()
			if (!bounds) throw new Error(message('pasteNowhere')())
			const block = textToCells(text)
			const width = Math.max(0, ...block.map((line) => line.length))
			const single = block.length === 1 && width === 1
			// In a sheet, a block that fits the range a whole number of times fills it, as one value does.
			const repeats =
				single ||
				(sheet() &&
					width > 0 &&
					(bounds.bottom - bounds.top + 1) % block.length === 0 &&
					(bounds.right - bounds.left + 1) % width === 0)
			const head = headerRowCount()
			const rows = bodyRows()
			const leaves = layout().leaves
			const bottom = repeats ? bounds.bottom : bounds.top + block.length - 1
			const right = repeats ? bounds.right : bounds.left + width - 1
			// All or nothing: a text that is cut at the edge of the table is half a paste.
			if (bottom > head + rows.length - 1 || right > leaves.length - 1) {
				throw new Error(message('pasteTooLarge')({ rows: block.length, columns: width }))
			}
			const targets: WriteTarget[] = []
			for (let row = bounds.top; row <= bottom; row++) {
				const flat = rows[row - head]
				const line = block[(row - bounds.top) % block.length] ?? []
				if (!flat || flat.node.kind !== 'row' || flat.detail) {
					// A group row or a detail row holds no values. A copy gives an
					// empty line for it, and such a line passes. A line with values
					// has no place here, and the lines after it would be one row off.
					if (!single && line.some((value) => value !== '')) {
						throw new Error(message('pasteOverRow')())
					}
					continue
				}
				for (let col = bounds.left; col <= right; col++) {
					const column = leaves[col]
					const value = line[(col - bounds.left) % width]
					if (!column || value === undefined || !canEdit(flat.node, column)) continue
					const source =
						copied?.formulas[(row - bounds.top) % block.length]?.[(col - bounds.left) % width]
					targets.push({
						rowId: flat.id,
						column,
						input: source
							? { formula: moveTo(source, flat.id, column.id, copied?.mode) }
							: { text: value },
					})
				}
			}
			if (!targets.length) throw new Error(message('pasteNowhere')())
			const finish = (cells: number): void => {
				if (cellSelection()) {
					const pasted = {
						anchor: { row: bounds.top, col: bounds.left },
						end: { row: bottom, col: right },
					}
					// Without the event: the range changes because of the paste, and a
					// paste is not a reason that a change of state knows.
					range.select(pasted, { reason: 'imperative' })
				}
				announce(message('cellsPasted')({ cells }))
			}
			const written = writes.write(targets, { reason: 'paste', event })
			// The formulas of a cut land once.
			if (copied?.mode === 'cut') lastCopy = undefined
			return typeof written === 'number' ? finish(written) : written.then(finish)
		}

		/**
		 * Empties the selected cells: each gets the empty value of its column,
		 * with the check of the column. All or nothing, as a paste. Cells that
		 * cannot be edited are left as they are. Returns how many cells changed.
		 */
		function clearSelected(reason: 'clear' | 'cut', event?: Event): number | Promise<number> {
			const bounds = selectedCells()
			if (!bounds) throw new Error(message('clearNowhere')())
			const head = headerRowCount()
			const rows = bodyRows()
			const leaves = layout().leaves.slice(bounds.left, bounds.right + 1)
			const targets: WriteTarget[] = []
			for (let row = bounds.top; row <= bounds.bottom; row++) {
				const flat = rows[row - head]
				if (!flat || flat.node.kind !== 'row' || flat.detail) continue
				for (const column of leaves) {
					if (!canEdit(flat.node, column)) continue
					const value = emptyValue(flat.node.row, column)
					targets.push({ rowId: flat.id, column, input: { value } })
				}
			}
			if (!targets.length) throw new Error(message('clearNowhere')())
			if (reason === 'cut' && lastCopy) lastCopy.mode = 'cut'
			return writes.write(targets, { reason, event })
		}

		/** Runs work that a person started with a key or the clipboard, and says a refusal at once. */
		function attempt(work: () => unknown): void {
			const failed = (error: unknown) => {
				if (destroyed) return
				announce(error instanceof Error ? error.message : String(error), { priority: 'assertive' })
			}
			try {
				const later = work()
				if (isThenable(later)) void Promise.resolve(later).catch(failed)
			} catch (error) {
				failed(error)
			}
		}

		/** Empties the selected cells and says how many changed. */
		function clearAndSay(reason: 'clear' | 'cut', event?: Event): void | Promise<void> {
			const say = (cells: number): void => {
				announce(message(reason === 'cut' ? 'cellsCut' : 'cellsCleared')({ cells }))
			}
			const cleared = clearSelected(reason, event)
			return typeof cleared === 'number' ? say(cleared) : cleared.then(say)
		}

		/** The data rows between two rows of the grid, in order. A group row and a detail row hold no values. */
		function dataRowsBetween(top: number, bottom: number) {
			const head = headerRowCount()
			const rows = bodyRows()
			const found: { id: string; node: DataRow<unknown>; pinned: RowPin | undefined }[] = []
			for (let row = top; row <= bottom; row++) {
				const flat = rows[row - head]
				if (!flat || flat.node.kind !== 'row' || flat.detail) continue
				found.push({ id: flat.id, node: flat.node, pinned: flat.pinned })
			}
			return found
		}

		/**
		 * Fills the cells of `target` from the cells of `source`, which are
		 * beside each other along one axis. Each line goes on as `fillValues`
		 * says: a series with one step continues, everything else repeats. A
		 * line counts data rows, so a group row is passed over. The new values
		 * pass the check of their column, and one refusal stops the fill
		 * before any cell changes. Cells that cannot be edited are left as
		 * they are, and keep their place in the line.
		 */
		function fill(source: CellBounds, target: CellBounds, event?: Event): void | Promise<void> {
			const leaves = layout().leaves
			const vertical = target.left === source.left && target.right === source.right
			const from = dataRowsBetween(source.top, source.bottom)
			const to = vertical ? dataRowsBetween(target.top, target.bottom) : from
			const [first] = from
			if (!first) throw new Error(message('fillNowhere')())
			// A pinned row and a row of the list stand next to each other on the
			// screen and not in the data: a series over both would follow no order.
			if (
				to.some((row) => row.pinned !== first.pinned) ||
				from.some((row) => row.pinned !== first.pinned)
			) {
				throw new Error(message('fillOverPinned')())
			}
			const targets: WriteTarget[] = []
			if (vertical) {
				const back = target.bottom < source.top
				// The nearest cell first, as `fillValues` counts.
				if (back) to.reverse()
				for (let col = source.left; col <= source.right; col++) {
					const column = leaves[col]
					if (!column) continue
					const values = fillValues(
						from.map((row) => valueNow(row.node, column)),
						to.length,
						back,
					)
					to.forEach((row, index) => {
						if (!canEdit(row.node, column)) return
						// A source cell with a formula gives it on, moved; one with a value follows the series.
						const source =
							from[back ? from.length - 1 - (index % from.length) : index % from.length]
						const formula = source && formulaOf(source.id, column.id)
						// A value of the same column needs no `parse`: it is a value already.
						targets.push({
							rowId: row.id,
							column,
							input: formula
								? {
										formula: moveTo(
											{ rowId: source.id, columnId: column.id, formula },
											row.id,
											column.id,
										),
									}
								: { value: values[index] },
						})
					})
				}
			} else {
				const back = target.right < source.left
				const sources = leaves.slice(source.left, source.right + 1)
				const cols: ColumnDef[] = leaves.slice(target.left, target.right + 1)
				if (back) cols.reverse()
				for (const row of from) {
					const values = fillValues(
						sources.map((column) => valueNow(row.node, column)),
						cols.length,
						back,
					)
					cols.forEach((column, index) => {
						if (!canEdit(row.node, column)) return
						const source =
							sources[back ? sources.length - 1 - (index % sources.length) : index % sources.length]
						const formula = source && formulaOf(row.id, source.id)
						// A value of another column is a text for this one, as in a paste: the
						// `parse` of this column makes its own kind of value of it, or refuses it.
						targets.push({
							rowId: row.id,
							column,
							input: formula
								? {
										formula: moveTo(
											{ rowId: row.id, columnId: source.id, formula },
											row.id,
											column.id,
										),
									}
								: { text: toText(values[index]) },
						})
					})
				}
			}
			if (!targets.length) throw new Error(message('fillNowhere')())
			const finish = (cells: number): void => {
				if (cellSelection()) {
					const filled = {
						anchor: {
							row: Math.min(source.top, target.top),
							col: Math.min(source.left, target.left),
						},
						end: {
							row: Math.max(source.bottom, target.bottom),
							col: Math.max(source.right, target.right),
						},
					}
					range.select(filled, { reason: 'imperative' })
				}
				announce(message('cellsFilled')({ cells }))
			}
			const written = writes.write(targets, { reason: 'fill', event })
			return typeof written === 'number' ? finish(written) : written.then(finish)
		}

		/**
		 * The selected cells as the source and the target of a fill: the first
		 * `lines` lines in the direction of the fill are the source, and the
		 * rest is the target. `undefined` when the cells hold no more lines.
		 */
		function fillParts(
			way: FillWay,
			lines: number,
		): { source: CellBounds; target: CellBounds } | undefined {
			const bounds = selectedCells()
			if (!bounds) return undefined
			if (way === 'forward' || way === 'back') {
				if (bounds.right - bounds.left + 1 <= lines) return undefined
				const edge = way === 'forward' ? bounds.left + lines : bounds.right - lines
				return way === 'forward'
					? { source: { ...bounds, right: edge - 1 }, target: { ...bounds, left: edge } }
					: { source: { ...bounds, left: edge + 1 }, target: { ...bounds, right: edge } }
			}
			// A line of a vertical fill is a data row.
			const head = headerRowCount()
			const rows = bodyRows()
			const data: number[] = []
			for (let row = bounds.top; row <= bounds.bottom; row++) {
				const flat = rows[row - head]
				if (flat && flat.node.kind === 'row' && !flat.detail) data.push(row)
			}
			if (data.length <= lines) return undefined
			const edge = way === 'down' ? data[lines - 1] : data[data.length - lines]
			if (edge === undefined) return undefined
			return way === 'down'
				? { source: { ...bounds, bottom: edge }, target: { ...bounds, top: edge + 1 } }
				: { source: { ...bounds, top: edge }, target: { ...bounds, bottom: edge - 1 } }
		}

		const fillOption = () => options().fillHandle ?? sheet()
		/** Whether a person can fill cells with the handle and the keys. */
		const fillOn = () => fillOption() !== false && cellSelection() && editing()
		const fillDirection = (): FillDirection => {
			const given = fillOption()
			return given === 'vertical' || given === 'horizontal' ? given : 'both'
		}

		// A cell says its column and its row says its place, in every renderer.
		const placeOfElement = (el: Element): GridCell | undefined => {
			const col = Number(el.closest('[aria-colindex]')?.getAttribute('aria-colindex'))
			const row = Number(el.closest('[aria-rowindex]')?.getAttribute('aria-rowindex'))
			return col >= 1 && row >= 1 ? { row: row - 1, col: col - 1 } : undefined
		}
		/** The rows of the body and the columns that hold values: where a fill and a pick can reach. */
		const bodyLimits = (): CellBounds | undefined => {
			const count = bodyRows().length
			const top = headerRowCount()
			const right = layout().leaves.length - 1
			const left = firstRangeCol()
			return count && left <= right ? { top, bottom: top + count - 1, left, right } : undefined
		}

		const pickCells = () => options().pickCells ?? false
		const picker = createCellPick<TableState>(context, {
			key: 'pickedCells',
			placeOf: placeOfElement,
			limits: bodyLimits,
			columnsFrom: () => letteredFrom(),
			set: (next, details) => change('pickedCells', next, details),
			commit: (next, details) => commit('pickedCells', next, details),
			reveal: (cell) => {
				const row = bodyRows()[cell.row - headerRowCount()]
				if (row && !row.pinned && (options().rowWindow ?? false)) rowWindow.scrollTo(row.id)
			},
		})
		function movePick(key: unknown, moves: PickMoveOptions = {}, event?: Event): CellPick | null {
			if (!pickCells()) throw new Error('The pick mode is off: pass `pickCells`, then move a pick.')
			const way = Object.hasOwn(PICK_STEPS, String(key)) ? PICK_STEPS[key as PickKey] : undefined
			if (!way) {
				throw new Error(
					`No key "${String(key)}" to move a pick. Keys: ${listed(Object.keys(PICK_STEPS))}.`,
				)
			}
			const editing = state().editing
			const from = (editing === null ? undefined : placeOf(editing)) ?? state().active ?? undefined
			return picker.move(way, from, moves, event)
		}
		/**
		 * A key in the table's own editor while the pick mode is on: an arrow
		 * moves the pick and is no move of the caret, and a typed character
		 * ends the pick, so the next arrow picks anew from the edited cell.
		 */
		function pickKeydown(event: KeyboardEvent): boolean {
			if (!pickCells() || event.altKey || isComposing(event)) return false
			if (Object.hasOwn(PICK_STEPS, event.key)) {
				event.preventDefault()
				movePick(event.key, { extend: event.shiftKey, edge: event.ctrlKey || event.metaKey }, event)
				return true
			}
			const typed =
				(event.key.length === 1 && !event.ctrlKey && !event.metaKey) ||
				event.key === 'Backspace' ||
				event.key === 'Delete'
			if (typed && state().pickedCells)
				change('pickedCells', null, { reason: 'input-change', event })
			return false
		}
		// A pick is of the mode: the picked cells go when it goes off.
		context.onOptions((next) => {
			if (!next.pickCells && state().pickedCells) {
				queueMicrotask(() => change('pickedCells', null, { reason: 'reset' }))
			}
		})

		const fillHandle = createFillHandle<TableState>(context, {
			draft: 'fillDraft',
			dragging: 'filling',
			source: () => (fillOn() ? selectedCells() : undefined),
			placeOf: placeOfElement,
			limits: bodyLimits,
			direction: fillDirection,
			commit: (draft, details) => {
				// An editor that is open in another cell with a refused value keeps the person.
				if (!edit.release(undefined, details.event)) return
				attempt(() => fill(draft.source, draft.target, details.event))
			},
		})

		/** The fill keys of a sheet: Control+D fills the selected cells down from their first row, Control+R forward from their first column. */
		function fillKeydown(event: KeyboardEvent, cell: GridCell): boolean {
			if (!sheet() || !fillOn() || !inBody(cell.row)) return false
			const way: FillWay | undefined = matchesShortcut(event, 'mod+d')
				? 'down'
				: matchesShortcut(event, 'mod+r')
					? 'forward'
					: undefined
			if (!way) return false
			const direction = fillDirection()
			if (direction !== 'both' && (direction === 'vertical') !== (way === 'down')) return false
			// With nothing to fill, the key stays the browser's: Control+R loads the page again.
			const parts = fillParts(way, 1)
			if (!parts) return false
			event.preventDefault()
			if (!edit.release(undefined, event)) return true
			attempt(() => fill(parts.source, parts.target, event))
			return true
		}

		function onCopy(event: ClipboardEvent, say = true): void {
			const bounds = selectedCells()
			if (!bounds) return
			// Without a range, a person who selected text with the pointer copies that text.
			const page = event.target instanceof Node ? event.target.ownerDocument : null
			const ranged = cellSelection() && !!state().cellRange
			if (!ranged && page?.getSelection()?.isCollapsed === false) return
			// One cell of a group row or a detail row holds no value to copy.
			if (!ranged && cellIdAt(bounds.top, bounds.left) === undefined) return
			event.clipboardData?.setData('text/plain', copyText())
			event.preventDefault()
			if (!say) return
			const cells = (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1)
			announce(message('cellsCopied')({ cells }))
		}

		function onPaste(event: ClipboardEvent): void {
			const text = event.clipboardData?.getData('text/plain')
			if (!text || !editing()) return
			event.preventDefault()
			attempt(() => pasteText(text, event))
		}

		/**
		 * A cut in a sheet: the text goes to the clipboard at once, because a
		 * clipboard can be written only inside its event, and then the cells
		 * are emptied. When the clear is refused, the cells keep their values
		 * and the text stays on the clipboard, as after a copy.
		 */
		function onCut(event: ClipboardEvent): void {
			if (!sheet() || !editing()) return
			const before = event.defaultPrevented
			onCopy(event, false)
			// The copy took the event when it had cells to copy.
			if (before || !event.defaultPrevented) return
			attempt(() => clearAndSay('cut', event))
		}

		/** The keys of a sheet on a body cell: Delete and Backspace empty the selected cells, and Tab stays inside a range. */
		function sheetKeydown(event: KeyboardEvent, cell: GridCell): boolean {
			if (fillKeydown(event, cell)) return true
			if (event.altKey || event.ctrlKey || event.metaKey) return false
			if (event.key === 'Tab' && (sheet() || entry())) {
				// Without a range, Tab leaves the table: a page is not a spreadsheet,
				// and a table that keeps Tab is a trap for a person without a pointer.
				// The entry mode goes to the next cell that takes input, and leaves after the last.
				const bounds = rangeAround(cell)
				const to = bounds
					? moveFrom(cell, event.shiftKey ? 'back' : 'forward', moveLimits(), bounds, holdsCell)
					: entry()
						? entryMove(cell, event.shiftKey)
						: undefined
				if (!to) return false
				event.preventDefault()
				grid.focus(to, { reason: 'list-navigation', event })
				return true
			}
			if (!sheet()) return false
			if (event.shiftKey || (event.key !== 'Delete' && event.key !== 'Backspace')) return false
			if (!editing() || !inBody(cell.row)) return false
			event.preventDefault()
			// An editor that is open in another cell with a refused value keeps the person.
			if (!edit.release(undefined, event)) return true
			attempt(() => clearAndSay('clear', event))
			return true
		}

		/** The data rows between two rows of the body: how many, and the first and the last. */
		const dataRowsIn = memo((rows: readonly FlatRow<unknown>[], top: number, bottom: number) => {
			let count = 0
			let first: string | undefined
			let last: string | undefined
			for (let index = top; index <= bottom; index++) {
				const flat = rows[index]
				if (!flat || flat.node.kind !== 'row' || flat.detail) continue
				count++
				first ??= flat.id
				last = flat.id
			}
			return { count, first, last }
		})

		function selectionView(): CellSelectionView | null {
			return cellSelection() ? cellsView(selectedCells()) : null
		}

		/** Cells of the grid by id: the first and the last cell that hold values, and how many rows and columns. */
		function cellsView(bounds: CellBounds | undefined): CellSelectionView | null {
			if (!bounds) return null
			const head = headerRowCount()
			const found = dataRowsIn(bodyRows(), bounds.top - head, bounds.bottom - head)
			const leaves = layout().leaves
			const from = leaves[bounds.left]
			const to = leaves[bounds.right]
			if (found.first === undefined || found.last === undefined || !from || !to) return null
			return {
				from: { rowId: found.first, columnId: from.id },
				to: { rowId: found.last, columnId: to.id },
				rows: found.count,
				columns: bounds.right - bounds.left + 1,
			}
		}

		function activeFormula(): FormulaView | null {
			const ref = engine() ? activeCellRef() : null
			return ref ? formulaView(ref.rowId, ref.columnId, false) : null
		}

		function activeCellRef(): CellRef | null {
			const active = state().active
			const id = active ? cellIdAt(active.row, active.col) : undefined
			return (id === undefined ? undefined : parseCellKey(id)) ?? null
		}

		/** After a range was selected from code: the active cell is inside it, as the start of a range is. */
		function activeIntoRange(): void {
			const bounds = selectedCells()
			const active = state().active
			if (!bounds) return
			const inside =
				active &&
				active.row >= bounds.top &&
				active.row <= bounds.bottom &&
				active.col >= bounds.left &&
				active.col <= bounds.right
			if (!inside) activate({ row: bounds.top, col: bounds.left })
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

		function rowIdList(rowIds: unknown, action: string): string[] {
			if (!Array.isArray(rowIds)) throw new Error(`\`${action}\` takes a list of row ids.`)
			return rowIds.map(String)
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
				// With pages from a server, another page, sort or filter brings other
				// rows. The rows of the steps are no longer in the table, and the owner
				// saved them or dropped them when it left the page.
				if ((options().manualPage ?? false) && (newList || changed.includes('page'))) {
					history.clear()
				}
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
		let seenHead = headerRowCount()
		let seenLetters = letterRowCount()
		let activeColumn: string | undefined

		function followColumns(): void {
			const columns = layout()
			const track = columnTrack(committed())
			if (!sameContent(track, state().columnTrack)) context.store.set({ columnTrack: track })
			const active = state().active
			const before = seenHead
			const head = headerRowCount()
			const lettersBefore = seenLetters
			const letters = letterRowCount()
			const changed = columns !== seenLayout || head !== before
			// What was seen is updated first: the change of the active cell below runs this again.
			seenLayout = columns
			seenHead = head
			seenLetters = letters
			// The row of letters coming or going moves every row under it, as a header group does.
			if (active && changed) {
				const moved = activeColumn === undefined ? undefined : columns.index.get(activeColumn)
				const col = moved ?? active.col
				const row =
					active.row < before
						? Math.max(0, Math.min(active.row - lettersBefore + letters, head - 1))
						: active.row - before + head
				if (row !== active.row || col !== active.col) context.store.set({ active: { row, col } })
			}
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

		function setFilter(next: FilterState, reason: TableReason, event?: Event): boolean {
			return sameContent(next, state().filter) || change('filter', next, { reason, event })
		}

		const searchOf = (filter: FilterState) => filter.search ?? ''

		function setSearchDraft(text: string | null, pending: boolean): void {
			const current = state()
			if (current.searchDraft !== text || current.searchPending !== pending) {
				context.store.set({ searchDraft: text, searchPending: pending })
			}
		}

		/**
		 * Gives the filter a search text. A filter of the owner holds the text a
		 * moment later, when the owner passes it back; until then the field
		 * shows the text that was asked for, and not the text before it.
		 */
		function applySearch(text: string, reason: TableReason, event?: Event): void {
			searchWait.cancel()
			// The text that the filter holds is no change: an empty search and no search are one.
			const accepted =
				text === searchOf(state().filter) ||
				setFilter({ ...state().filter, search: text }, reason, event)
			setSearchDraft(accepted && searchOf(state().filter) !== text ? text : null, false)
		}

		// The text of a search field waits here for a pause in the typing.
		const searchWait = createDebounce(
			(text: string, event?: Event) => applySearch(text, 'input-change', event),
			{ debounce: () => options().searchDebounce },
		)
		// A table that is gone filters nothing.
		context.onDestroy(() => searchWait.cancel())
		// A new search text in the state is what the field shows from now on:
		// the text of a pause that ended, or a text from outside, which wins
		// over a text that waits.
		let seenSearch = searchOf(state().filter)
		context.onDestroy(
			context.store.subscribe((liveOnly) => {
				if (liveOnly) return
				const now = searchOf(state().filter)
				if (now === seenSearch) return
				seenSearch = now
				searchWait.cancel()
				setSearchDraft(null, false)
			}),
		)

		function sortMode(): MultiSortMode {
			const mode = options().multiSort ?? 'modifier'
			if (SORT_MODES.includes(mode)) return mode
			throw new Error(`\`multiSort\` is one of: ${SORT_MODES.join(', ')}. It is "${String(mode)}".`)
		}

		/** Whether a sort action adds its column to the sort, for what the caller asked and the mode of the table. */
		function appends(asked: unknown, event?: Event): boolean {
			const mode = sortMode()
			if (asked !== undefined && typeof asked !== 'boolean') {
				throw new Error('`append` of a sort is true or false.')
			}
			if (asked && mode === 'none') {
				throw new Error(
					`This table sorts by one column at a time: its \`multiSort\` option is "none", so \`append\` cannot add a column to the sort. Leave \`append\` out, or set \`multiSort\` to "modifier" or "always".`,
				)
			}
			if (asked !== undefined) return asked
			if (mode !== 'modifier') return mode === 'always'
			const keys = event as { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } | undefined
			return !!(keys?.shiftKey || keys?.ctrlKey || keys?.metaKey)
		}

		// What the table started with, for the actions that bring it back.
		const started = {
			columnVisibility: options().defaultColumnVisibility ?? NO_VISIBILITY,
			columnOrder: options().defaultColumnOrder ?? NO_IDS,
			columnPinning: options().defaultColumnPinning ?? NO_PINNING,
		}

		/**
		 * Gives a column another function for its total, or takes its total
		 * away with `null`, or gives it the function of its definition back
		 * with `undefined`.
		 */
		function chooseAggregate(
			columnId: string,
			aggregate: AggregateName | null | undefined,
			event?: Event,
		): void {
			const found = column(String(columnId), 'set the total of')
			if (found.rowHeader) {
				throw new Error(`Column "${found.id}" holds the numbers of the rows, and has no total.`)
			}
			if (aggregate != null && !AGGREGATE_NAMES.includes(aggregate)) {
				throw new Error(
					`No aggregate "${String(aggregate)}" for column "${found.id}". Aggregates: ${AGGREGATE_NAMES.join(', ')}; null for no total, or undefined for the aggregate of the column.`,
				)
			}
			// The choice of now, also when the owner did not pass the last one back yet.
			const current = aggregatesNow.read()
			const has = found.id in current
			if (aggregate === undefined ? !has : has && current[found.id] === aggregate) return
			const next: Record<string, AggregateName | null> = { ...current }
			if (aggregate === undefined) delete next[found.id]
			else next[found.id] = aggregate
			aggregatesNow.change(next, { reason: event ? 'item-press' : 'imperative', event })
		}

		function requireFormulas(): FormulaEngine {
			const found = engine()
			if (!found) throw new Error('This table has no formulas: pass `formulas`.')
			return found
		}

		const documentIds = memo((source: { byId: ReadonlyMap<string, unknown> }) => [
			...source.byId.keys(),
		])
		/** What the engine reads of the table. */
		const formulaSheet = {
			columns: ownColumns,
			rowIds: () => documentIds(model.source()),
			row: (rowId: string) => model.source().byId.get(rowId)?.row,
			value: (rowId: string, columnId: string) => {
				const node = model.source().byId.get(rowId)
				const found = layout().byId.get(columnId)
				return node && found ? valueNow(node, found) : undefined
			},
			locale: () => options().locale,
		}

		/** A cell of the table for a formula: `at`, else the active cell. It throws for a row or a column that it does not have. */
		function formulaAt(at: CellRef | undefined, purpose: string): FormulaPlace {
			requireFormulas()
			const ref = at ?? activeCellRef()
			if (!ref) throw new Error('No cell is active: pass `{ rowId, columnId }`.')
			return {
				rowId: requireRow(String(ref.rowId), purpose).id,
				columnId: formulaTarget(ref.columnId, purpose).id,
			}
		}

		/** A column that can hold a formula: a column of the owner with cells, without the numbers of the rows. */
		function formulaTarget(columnId: unknown, purpose: string): ColumnDef {
			const valid = leafColumns(ownColumns()).filter((leaf) => !leaf.rowHeader)
			const found = valid.find((leaf) => leaf.id === columnId)
			if (!found) {
				throw new Error(
					`No column "${String(columnId)}" to ${purpose}. Columns: ${listed(valid.map((leaf) => leaf.id))}.`,
				)
			}
			return found
		}

		/** The words of an issue: those of the app in `messages`, else those of the engine. */
		const issueText = (found: FormulaEngine, issue: FormulaIssue) =>
			options().messages?.formulaIssue?.(issue) ?? found.describe(issue)
		const entryRefusal = (entry: { issues: FormulaIssue[] }) =>
			entry.issues.map((issue) => issueText(requireFormulas(), issue)).join(' ')

		const formulaIn = (formulas: CellFormulas, rowId: string, columnId: string) =>
			formulas.cells?.[rowId]?.[columnId]
		/** The formula of a cell of its own now, also one that this turn gave it. */
		const formulaOf = (rowId: string, columnId: string) =>
			formulaIn(formulasNow.read(), rowId, columnId)

		type CopiedFormula = FormulaPlace & { formula: string }
		/** The last copy of the table: its text, and the formulas of its cells. */
		let lastCopy:
			| { text: string; formulas: (CopiedFormula | undefined)[][]; mode: 'copy' | 'cut' }
			| undefined
		// Another program can change the line ends or add one at the end.
		const copyKey = (text: string) => text.replace(/\r\n/g, '\n').replace(/\n$/, '')
		const moveTo = (
			from: CopiedFormula,
			rowId: string,
			columnId: string,
			mode: 'copy' | 'cut' = 'copy',
		) => requireFormulas().move(from.formula, from, { rowId, columnId }, formulaSheet, mode)

		const ownLeaves = memo(
			(columns: readonly ColumnDef[]) =>
				new Map(leafColumns(columns).map((leaf) => [leaf.id, leaf])),
		)
		/**
		 * The formula of a computed column, when a cell of it opens: the column
		 * of the owner can be edited, so its field shows the formula of the
		 * column, and a save changes the column.
		 */
		function columnFormulaAt(node: DataRow<unknown>, column: ColumnDef): string | undefined {
			const formula = engine() ? formulasNow.read().columns?.[column.id] : undefined
			const own = formula === undefined ? undefined : ownLeaves(ownColumns()).get(column.id)
			return own && canEdit(node, own) ? formula : undefined
		}

		/** Whether a cell opens an editor, by its id: a cell that can be edited, or a cell of a computed column of the owner. */
		function editableCell(id: string): boolean {
			const cell = cellOf(id)
			return (
				!!cell &&
				(canEdit(cell.node, cell.column) || columnFormulaAt(cell.node, cell.column) !== undefined)
			)
		}

		/** Whether a cell takes a text with `=` as a formula: a cell that can be edited, in a column that allows it and is not computed. */
		function holdsFormula(node: DataRow<unknown>, column: ColumnDef): boolean {
			return (
				!!engine() &&
				column.allowFormula !== false &&
				formulasNow.read().columns?.[column.id] === undefined &&
				canEdit(node, column)
			)
		}

		/** What a person typed into a cell, read by the rule of `=`, or `undefined` for a plain value. */
		function formulaEntry(
			node: DataRow<unknown>,
			column: ColumnDef,
			text: string,
			stored = false,
		): FormulaEntry | undefined {
			const found = engine()
			if (!found || (text[0] !== '=' && !text.startsWith("'="))) return undefined
			// A formula of a copy or a fill must land; a typed text is a value where no formula can be.
			if (!holdsFormula(node, column)) {
				return stored ? { issues: [{ code: 'notHere', column: column.id }] } : undefined
			}
			// Without the whole document, no address names a row.
			if (text[0] === '=' && text.length > 1 && (options().manualPage ?? false)) {
				return { issues: [{ code: 'noDocument' }] }
			}
			return stored
				? { formula: text }
				: found.entry(text, { rowId: node.id, columnId: column.id }, formulaSheet)
		}

		/** The formula of a cell, or of its column, as a formula bar and an agent read it. */
		function formulaView(rowId: string, columnId: string, own: boolean): FormulaView | null {
			const found = requireFormulas()
			const node = model.rowById(rowId)
			const column = layout().byId.get(columnId)
			if (!node || !column) return null
			const at = { rowId, columnId }
			const formula = formulaOf(rowId, columnId)
			const ofColumn = formulasNow.read().columns?.[columnId]
			if (own && formula === undefined) return null
			const value = valueNow(node, column)
			const error = isFormulaError(value) ? value : null
			const stored = formula ?? ofColumn
			return {
				rowId,
				columnId,
				address: found.address(at, formulaSheet) ?? '',
				formula: formula ?? null,
				text:
					stored === undefined
						? fieldText(node.row, column, shownFormat(column, rowId))
						: found.print(stored, formula === undefined ? { columnId } : at, formulaSheet),
				value,
				error,
				ofColumn: formula === undefined && ofColumn !== undefined,
			}
		}
		/** Why a value is an error of a formula: the words of the app, else those of the engine. */
		const errorText = (code: Parameters<NonNullable<TableMessages['formulaError']>>[0]) =>
			options().messages?.formulaError?.(code) ?? requireFormulas().errorText(code)
		/** The words of a formula of a column that cannot run, or `undefined`. */
		const columnIssues = (columnId: string) =>
			builtColumns()
				?.issues.get(columnId)
				?.map((issue) => entryRefusal({ issues: [issue] }))
				.join(' ')
		/** The words of an error in a cell: why the formula of its column cannot run, else why the value is an error. */
		const cellErrorText = (columnId: string, code: Parameters<typeof errorText>[0]) =>
			columnIssues(columnId) ?? errorText(code)

		function writeCellFormula(rowId: string, columnId: string, text: string | null): void {
			const found = requireFormulas()
			if (historyBusy()) {
				throw new Error('A new value is checked now. Wait for its answer, then set the formula.')
			}
			const node = requireRow(String(rowId), 'give a formula')
			const target = formulaTarget(columnId, 'give a formula')
			if (!holdsFormula(node, target)) {
				throw new Error(issueText(found, { code: 'notHere', column: target.id }))
			}
			if (options().manualPage ?? false) throw new Error(issueText(found, { code: 'noDocument' }))
			if (text !== null && (typeof text !== 'string' || !text.startsWith('='))) {
				throw new Error('A formula is a text that starts with `=`, or null to take it away.')
			}
			const at = { rowId: node.id, columnId: target.id }
			let formula: string | null = null
			if (text !== null) {
				const parsed = found.parse(text, at, formulaSheet)
				if ('issues' in parsed) {
					const why = entryRefusal(parsed)
					throw new Error(`The formula "${text}" cannot be set: ${why}`, { cause: why })
				}
				formula = parsed.formula
			}
			const now = formulaOf(node.id, target.id)
			if ((now ?? null) === formula) return
			const value = valueNow(node, target)
			const refused = report(
				[{ ...at, row: node.row, column: target, value, previous: value, formula }],
				'imperative',
			)
			if (refused === true) throw new Error(message('editRefused')())
			if (refused) {
				throw new Error(`The formula "${String(text)}" cannot be set: ${refused}`, {
					cause: refused,
				})
			}
		}

		function readColumnFormula(columnId: string) {
			const found = requireFormulas()
			const target = formulaTarget(columnId, 'read the formula of')
			const formula = formulasNow.read().columns?.[target.id]
			if (formula === undefined) return null
			return {
				formula,
				text: found.print(formula, { columnId: target.id }, formulaSheet),
				error: columnIssues(target.id) ?? null,
			}
		}

		/**
		 * Sets the formula of a column, or takes it away with `null`: one change
		 * and one step. Returns the words of a refusal, and nothing when it is set.
		 */
		function writeColumnFormula(
			columnId: string,
			text: string | null,
			reason: TableEditReason | TableReason = 'imperative',
			event?: Event,
		): string | undefined {
			const found = requireFormulas()
			const target = formulaTarget(columnId, 'give a formula')
			if (text !== null && typeof text !== 'string') {
				throw new Error('A formula is a text that starts with `=`, or null to take it away.')
			}
			let formula: string | null = null
			if (text !== null) {
				const parsed = found.parse(text, { columnId: target.id }, formulaSheet)
				const issue: FormulaIssue | undefined =
					'issues' in parsed
						? parsed.issues[0]
						: found.columnCircle(
								target.id,
								parsed.formula,
								ownColumns(),
								formulasNow.read().columns,
							)
				if (issue) return issueText(found, issue)
				if ('formula' in parsed) formula = parsed.formula
			}
			const before = formulasNow.read()
			const next = found.setFormulas(before, { columns: [{ columnId: target.id, formula }] })
			if (next === before) return
			if (!formulasNow.change(next, { reason, event })) return message('editRefused')()
			if (historyOn()) {
				history.record({
					id: ++stepIds,
					reason: 'formula',
					source: event instanceof KeyboardEvent ? 'keyboard' : 'programmatic',
					cells: [],
					formulas: { before, after: next, cells: 0 },
				})
			}
		}

		function resetColumns(key: keyof typeof started): void {
			if (!sameContent(started[key], state()[key])) change(key, started[key], { reason: 'reset' })
		}

		function setExpanded(id: string, open: boolean, reason: TableReason, event?: Event): void {
			const current = state().expanded
			const isOpen = current.includes(id)
			if (isOpen === open) return
			const next = open ? [...current, id] : current.filter((other) => other !== id)
			change('expanded', next, { reason, event })
		}

		/** Whether the pages come from a server that gave no count, so the last page is not known. */
		const openEnded = () => (options().manualPage ?? false) && options().rowCount === undefined

		function goToPage(page: number, reason: TableReason): void {
			const current = state().page
			if (!current) {
				throw new Error('This table has no pages. Set its `page` or `defaultPage` option.')
			}
			// Without a count, the pages that the table knows are no limit for a jump.
			const last = openEnded() ? Infinity : model.pageCount()
			if (!Number.isInteger(page)) {
				throw new Error(
					`A page must be a whole number from 1${last === Infinity ? '' : ` to ${last}`}.`,
				)
			}
			const clamped = Math.min(Math.max(1, page), last)
			// A step past the last page changes nothing, and a listener that loads rows must not load them again.
			if (clamped !== current.page) change('page', { ...current, page: clamped }, { reason })
		}

		const controller: Omit<TableController, OtherActions> = {
			sortBy(columnId, direction = 'asc', sortOptions = {}) {
				column(columnId, 'sort by')
				if (direction !== null && direction !== 'asc' && direction !== 'desc') {
					throw new Error(`A sort direction is "asc", "desc" or null, not "${String(direction)}".`)
				}
				// Code that names its direction asks for one column unless it says otherwise, in every mode.
				const append = appends(sortOptions.append ?? false)
				const rest = append ? state().sort.filter((rule) => rule.id !== columnId) : []
				const next = direction ? [...rest, { id: columnId, desc: direction === 'desc' }] : rest
				setSort(next, 'imperative')
			},
			toggleSort(columnId, toggle = {}) {
				const { event } = toggle
				column(columnId, 'sort by')
				const append = appends(toggle.append, event)
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
				// A table that keeps its sort turns the last column back to ascending.
				if (!next.length && (options().alwaysSorted ?? false)) {
					next = [{ id: columnId, desc: false }]
				}
				setSort(next, event ? 'press' : 'imperative', event)
			},
			setSearch(search) {
				if (typeof search !== 'string') throw new Error('The search text must be a string.')
				applySearch(search, 'imperative')
			},
			inputSearch(search, event) {
				if (typeof search !== 'string') throw new Error('The search text must be a string.')
				// The text that the filter holds already: nothing has to wait. A search
				// field of a browser empties itself on Escape, after the key did.
				if (search === searchOf(state().filter)) {
					searchWait.cancel()
					setSearchDraft(null, false)
					return
				}
				setSearchDraft(search, true)
				searchWait.call(search, event)
				// A pause of 0 ran the search at once, and it said what the field shows.
				if (!searchWait.pending() && state().searchPending) {
					setSearchDraft(state().searchDraft, false)
				}
			},
			flushSearch() {
				searchWait.flush()
			},
			setColumnFilter(columnId, value) {
				column(columnId, 'filter')
				// A filter that asks for nothing leaves no key: the state says which columns filter.
				const { [columnId]: _gone, ...others } = state().filter.columns ?? {}
				const columns = isEmptyFilter(value) ? others : { ...others, [columnId]: value }
				const { columns: _columns, ...rest } = state().filter
				setFilter(Object.keys(columns).length ? { ...rest, columns } : rest, 'imperative')
			},
			clearFilters() {
				// A text that waits is a search too, and it goes with the others.
				searchWait.cancel()
				const accepted = setFilter(NO_FILTER, 'imperative')
				setSearchDraft(accepted && searchOf(state().filter) !== '' ? '' : null, false)
			},
			clearColumnFilters() {
				const search = state().filter.search
				setFilter(search === undefined ? NO_FILTER : { search }, 'imperative')
			},
			setGroupBy(columnIds) {
				if (!Array.isArray(columnIds)) throw new Error('`setGroupBy` takes a list of column ids.')
				for (const id of columnIds) column(String(id), 'group by')
				change('groupBy', [...columnIds], { reason: 'imperative' })
			},
			setPage: (page) => goToPage(page, 'imperative'),
			setPageSize(pageSize) {
				const current = state().page
				if (pageSize === null) {
					if (current) change('page', undefined, { reason: 'imperative' })
					return
				}
				if (!Number.isInteger(pageSize) || pageSize < 1) {
					throw new Error(
						'A page size must be a whole number above 0, or null for a table without pages.',
					)
				}
				// The size that the table has, on its first page: a listener that loads rows must not load them again.
				if (current?.page === 1 && current.pageSize === pageSize) return
				change('page', { page: 1, pageSize }, { reason: 'imperative' })
			},
			// A step forward stops at the last page that the table knows, with or without a count.
			nextPage: () => goToPage(Math.min(model.page() + 1, model.pageCount()), 'imperative'),
			previousPage: () => goToPage(model.page() - 1, 'imperative'),
			firstPage: () => goToPage(1, 'imperative'),
			lastPage() {
				if (openEnded()) {
					throw new Error(
						'This table does not know its last page: its rows come in pages from a server (`manualPage`), and it has no `rowCount`.',
					)
				}
				goToPage(model.pageCount(), 'imperative')
			},
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
			selectRows(rowIds) {
				const ids = rowIdList(rowIds, 'selectRows')
				// No row is no choice. With a single selection, the lines below would clear it.
				if (!ids.length) return
				for (const id of ids) requireSelectable(id)
				if (options().selection !== 'multiple' && ids.length > 1) {
					throw new Error(
						"`selectRows` with more than one row needs the `selection` option to be 'multiple'.",
					)
				}
				const current = options().selection === 'multiple' ? state().selected : []
				const next = [...new Set([...current, ...ids])]
				if (!sameContent(next, state().selected)) {
					change('selected', next, { reason: 'imperative' })
				}
			},
			deselectRows(rowIds) {
				const gone = new Set(rowIdList(rowIds, 'deselectRows'))
				requireSelection()
				const next = state().selected.filter((id) => !gone.has(id))
				if (next.length !== state().selected.length) {
					change('selected', next, { reason: 'imperative' })
				}
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
			hideAllColumns() {
				const columns = layout()
				const next: Record<string, boolean> = { ...state().columnVisibility }
				for (const found of columns.all) {
					if (!isLead(found) && found.hideable !== false) next[found.id] = false
				}
				// A table needs one column, and a column that leads the table is a control of its rows, not one of them.
				const stays = columns.leaves.some((found) => !isLead(found) && found.hideable === false)
				const first = stays ? undefined : columns.leaves.find((found) => !isLead(found))
				if (first) delete next[first.id]
				if (!sameContent(next, state().columnVisibility)) {
					change('columnVisibility', next, { reason: 'imperative' })
				}
			},
			resetColumnVisibility: () => resetColumns('columnVisibility'),
			resetColumnOrder: () => resetColumns('columnOrder'),
			resetColumnPinning: () => resetColumns('columnPinning'),
			setColumnAggregate: (columnId, aggregate) => chooseAggregate(columnId, aggregate),
			getColumnFormula: (columnId) => readColumnFormula(columnId),
			getFormulaSummary: (limit) => requireFormulas().summary(formulasNow.read(), limit),
			evaluateFormula: (formula, at) =>
				requireFormulas().evaluateText(
					formula,
					formulaAt(at, 'evaluate a formula at'),
					formulaSheet,
				),
			getFormulaFunctions: () => requireFormulas().functions(),
			recalculate() {
				const found = requireFormulas()
				if (historyBusy()) {
					throw new Error('A new value is checked now. Wait for its answer, then recalculate.')
				}
				if (options().manualPage ?? false) throw new Error(issueText(found, { code: 'noDocument' }))
				const checked = found.recheck(
					{ after: model.source().byId, told: [] },
					formulasNow.read(),
					formulaSheet,
				)
				if ('issues' in checked) throw new Error(entryRefusal(checked))
				// A request of the owner reports every cell again.
				checkedValues.clear()
				const cells = reportCheck(checked.results)
				announce(options().messages?.recalculated?.({ cells }) ?? found.recalculated(cells))
				return cells
			},
			getCellFormula(rowId, columnId) {
				requireFormulas()
				const node = requireRow(String(rowId), 'read the formula of')
				const target = formulaTarget(columnId, 'read the formula of')
				return formulaView(node.id, target.id, true)
			},
			setCellFormula: (rowId, columnId, formula) => writeCellFormula(rowId, columnId, formula),
			setColumnFormula(columnId, formula) {
				const refused = writeColumnFormula(columnId, formula)
				if (refused) {
					throw new Error(
						`The formula "${String(formula)}" of column "${String(columnId)}" cannot be set: ${refused}`,
						{ cause: refused },
					)
				}
			},
			getRangeAddress(cells) {
				const found = requireFormulas()
				const view = cellsView(cells ? pickBounds(cells) : selectedCells())
				if (!view || (options().manualPage ?? false)) return null
				const whole = cells
					? cells.columns
					: view.rows > 1 && view.rows === formulaSheet.rowIds().length
				return found.rangeAddress(view.from, view.to, whole, formulaSheet) ?? null
			},
			movePick: (key, moves) => movePick(key, moves),
			getFormulaReferences(text, at) {
				const ref = formulaAt(at, 'read the references of a formula at')
				return requireFormulas().references(String(text), ref, formulaSheet)
			},
			getAddress(rowId, columnId) {
				const found = requireFormulas()
				const target = formulaTarget(columnId, 'read the address of')
				if (!model.source().byId.has(String(rowId))) {
					throw new Error(`No row "${String(rowId)}" in the table.`)
				}
				return found.address({ rowId: String(rowId), columnId: target.id }, formulaSheet) ?? null
			},
			cellAt(address) {
				const found = requireFormulas()
				const cell = found.cellAt(address, formulaSheet)
				if ('issues' in cell) {
					throw new Error(
						cell.issues.map((issue) => issueText(found, issue)).join(' ') +
							' An address is a letter and a number, such as A1.',
					)
				}
				return cell
			},
			moveColumn(columnId, index) {
				requireVisible(columnId, 'move')
				const track = state().columnTrack
				if (isLead(column(columnId, 'move'))) {
					throw new Error(`Column "${columnId}" leads the table, and keeps its place.`)
				}
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
				if (isLead(column(columnId, 'pin'))) {
					throw new Error(
						`Column "${columnId}" leads the table: it keeps its place, and sticks to the start with the first column that is pinned there.`,
					)
				}
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

		const selectableNow = memo(
			(ids: readonly string[], _canSelect: unknown, _source: unknown): readonly string[] =>
				ids.filter(canSelect),
		)

		/** The filter control that fits a column. */
		function filterKind(found: ColumnDef): FilterKind {
			if (typeof found.filter === 'string') return found.filter
			// A matcher of the caller reads a value that only the caller knows. Text is the one value every control can give.
			if (typeof found.filter === 'function' || !found.format) return 'text'
			if (found.format === 'date' || found.format === 'datetime') return 'dateRange'
			return isNumericFormat(found.format) ? 'range' : 'text'
		}

		// The facets of a column are kept while their rows, the column, the
		// locale, the facets of the owner and the values that its own filter
		// names are the same: a filter control asks for them at each render. The
		// rows are a stage of the row model, so a new filter of the column itself
		// keeps them, and so does a new sort or a new page.
		const facetCache = new Map<
			string,
			{
				rows: unknown
				column: ColumnDef
				locale: string | undefined
				given: unknown
				chosen: unknown
				/** The values that the rows hold, by key, and whether the list has a value that no row holds. */
				held: ReadonlySet<string>
				extra: boolean
				result: ColumnFacets
			}
		>()

		/** The values that a filter names and no row holds, each once. */
		function goneValues(own: unknown, held: ReadonlySet<string>): unknown[] {
			const chosen = isEmptyFilter(own) ? [] : Array.isArray(own) ? own : [own]
			const seen = new Set<string>()
			return chosen.filter((value: unknown) => {
				const key = valueKey(value)
				if (key === '' || held.has(key) || seen.has(key)) return false
				seen.add(key)
				return true
			})
		}
		const stepCache = new Map<
			string,
			{ rows: unknown; column: ColumnDef; locale: string | undefined; step: number }
		>()

		/** The step of a slider over a column: from its format, or from the digits of every row. */
		function stepOf(found: ColumnDef): number {
			const rows = model.source().rows
			const locale = options().locale
			const kept = stepCache.get(found.id)
			if (kept && kept.rows === rows && kept.column === found && kept.locale === locale) {
				return kept.step
			}
			const step = numberStep(rows, found, locale)
			stepCache.set(found.id, { rows, column: found, locale, step })
			return step
		}

		/** The facets of the owner for a column, checked, or `undefined` for a column without them. */
		function givenFacets(found: ColumnDef): ColumnFacetsSource | undefined {
			const all = options().facets
			if (!all) return undefined
			for (const id of Object.keys(all)) column(id, 'give facets to')
			const given = all[found.id]
			if (given === undefined) return undefined
			const wrong = (part: string) => new Error(`The facets of column "${found.id}" need ${part}.`)
			if (typeof given !== 'object' || given === null) {
				throw wrong('an object with `values`, `range` or `dates`')
			}
			const { values, range, dates } = given
			if (
				values !== undefined &&
				!(
					Array.isArray(values) &&
					values.every((entry) => typeof entry === 'object' && entry !== null && 'value' in entry)
				)
			) {
				throw wrong('`values` as a list of { value, count? } entries')
			}
			if (range !== undefined && !(Number.isFinite(range?.min) && Number.isFinite(range?.max))) {
				throw wrong('`range` as { min, max } with two numbers')
			}
			if (range?.step !== undefined && !(Number.isFinite(range.step) && range.step > 0)) {
				throw wrong('`range.step` as a number above 0')
			}
			if (
				dates !== undefined &&
				(toTime(dates?.from) === undefined || toTime(dates?.to) === undefined)
			) {
				throw wrong('`dates` as { from, to } with two dates')
			}
			return given
		}

		// What the pages count, and how many data rows pass the filters.
		const pageUnit = memo((rows: readonly TableRow<unknown>[]): PageUnit => {
			let groups = 0
			let parents = 0
			for (const row of rows) {
				if (row.kind === 'group') groups++
				else if (row.children?.length) parents++
			}
			if (groups) return groups === rows.length ? 'groups' : 'mixed'
			return parents ? 'parents' : 'rows'
		})
		const dataRowCount = memo((rows: readonly DataRow<unknown>[]) => {
			let count = 0
			const walk = (list: readonly DataRow<unknown>[]) => {
				count += list.length
				for (const row of list) if (row.children) walk(row.children)
			}
			walk(rows)
			return count
		})

		// Every group of the table by its id, on all pages.
		const groupsById = memo((rows: readonly TableRow<unknown>[]) => {
			const groups = new Map<string, GroupRow<unknown>>()
			const walk = (list: readonly TableRow<unknown>[]) => {
				for (const node of list) {
					if (node.kind !== 'group') continue
					groups.set(node.id, node)
					walk(node.children)
				}
			}
			walk(rows)
			return groups
		})

		/** A number of a summary as text, in the format of a column or as a plain number of the locale. */
		function summaryText(value: number | undefined, column?: ColumnDef, decimals = 6): string {
			if (value === undefined) return ''
			if (column?.format && isNumericFormat(column.format)) return totalText(column, value)
			// A sum of floats can end in noise: six decimals are enough for a status bar.
			return new Intl.NumberFormat(options().locale ?? 'en-US', {
				maximumFractionDigits: decimals,
			}).format(value)
		}

		// The summary of the selected cells, kept for the same cells of the same
		// rows. The rows are another array after each edit, so the answer follows the data.
		const selectionSummary = memo(
			(
				top: number,
				bottom: number,
				left: number,
				right: number,
				rows: readonly FlatRow<unknown>[],
				leaves: readonly ColumnDef[],
				_locale: string | undefined,
			): RangeSummary | null => {
				const head = headerRowCount()
				const columns = leaves.slice(left, right + 1)
				const values: unknown[] = []
				for (let row = top; row <= bottom; row++) {
					const flat = rows[row - head]
					// A group row and a detail row hold no values.
					if (!flat || flat.node.kind !== 'row' || flat.detail) continue
					for (const column of columns) values.push(cellValue(flat.node.row, column))
				}
				if (!values.length) return null
				const counted = summarize(values)
				const [only] = columns.length === 1 ? columns : []
				return {
					cells: values.length,
					...counted,
					texts: {
						sum: summaryText(counted.sum, only),
						mean: summaryText(counted.mean, only, meanDecimals(counted.min, counted.max)),
						min: summaryText(counted.min, only),
						max: summaryText(counted.max, only),
					},
				}
			},
		)

		const subscriptions = new Set<() => void>()
		context.onDestroy(() => {
			for (const stop of subscriptions) stop()
		})

		const readActions: Pick<TableController, ReadActions> = {
			getView() {
				const current = state()
				const columns = layout()
				const open = expandable(model.grouped())
				const unit = pageUnit(model.grouped())
				return {
					sort: current.sort,
					filter: current.filter,
					search: current.searchDraft ?? searchOf(current.filter),
					searchPending: current.searchPending,
					groupBy: current.groupBy,
					expanded: current.expanded,
					selected: current.selected,
					page: model.page(),
					pageSize: current.page?.pageSize,
					pageCount: model.pageCount(),
					rowCount: model.rowCount(),
					pageUnit: unit,
					// Rows that are counted one by one need no second count, and pages from a server have their own.
					dataRowCount: unit === 'rows' ? model.rowCount() : dataRowCount(model.filtered()),
					lastPageKnown: !openEnded(),
					columns: columns.all,
					visibleColumns: columns.leaves,
					selectable: options().selection
						? selectableNow(selectableOrder(), options().canSelect, model.source())
						: NO_IDS,
					hasExpandable: open.size > 0,
					hasExpanded: current.expanded.some((id) => open.has(id)),
					loading: options().loading ?? false,
					columnAggregates: current.columnAggregates,
					cellFormats: current.cellFormats,
					formulas: !!options().formulas,
					cellFormulas: current.cellFormulas,
					formula: activeFormula(),
					canUndo: history.canUndo(current),
					canRedo: history.canRedo(current),
					activeCell: activeCellRef(),
					cellSelection: selectionView(),
				}
			},
			getFacets(columnId, facetOptions = {}) {
				const found = column(String(columnId), 'read the facets of')
				const set =
					typeof facetOptions === 'object' && facetOptions !== null ? facetOptions.rows : null
				if (set !== undefined && (set === null || !FACET_ROWS.includes(set))) {
					throw new Error(
						`\`getFacets\` takes a column id and \`{ rows }\`, where \`rows\` is one of: ${FACET_ROWS.join(', ')}.`,
					)
				}
				const every = set === 'all'
				const rows = every ? model.source().rows : model.facetRows(found.id)
				const locale = options().locale
				const all = options().facets
				const kind = filterKind(found)
				// The values that the filter of the column names stay in its list, also
				// when another filter leaves no row that holds them.
				const own = every || kind !== 'select' ? undefined : state().filter.columns?.[found.id]
				const key = `${every ? 'all' : 'filtered'}|${found.id}`
				const kept = facetCache.get(key)
				if (
					kept &&
					kept.rows === rows &&
					kept.column === found &&
					kept.locale === locale &&
					kept.given === all
				) {
					if (sameContent(kept.chosen, own)) return kept.result
					// Another choice among the values that the rows hold gives the same list.
					if (!kept.extra && !goneValues(own, kept.held).length) {
						kept.chosen = own
						return kept.result
					}
				}
				const given = givenFacets(found)
				const valueText = (value: unknown) =>
					found.format
						? formatValue(value, found.format, found.formatOptions, { locale })
						: toText(value)
				const zone = timeZoneOf(found)
				const dayOn = (value: unknown, time: number) => (isDay(value) ? value : dayOf(time, zone))
				let values: readonly ColumnFacetValue[] = []
				let held: ReadonlySet<string> = new Set()
				let extra = false
				if (kind === 'select' && given?.values) {
					values = given.values.map(({ value, text, count }) => ({
						value,
						text: text ?? valueText(value),
						...(count === undefined ? undefined : { count }),
					}))
				} else if (kind === 'select') {
					const present = uniqueValues(rows, found, locale)
					held = new Set(present.map((facet) => valueKey(facet.value)))
					const gone = goneValues(own, held).map((value) => ({ value, count: 0 }))
					extra = gone.length > 0
					const list = extra
						? [...present, ...gone].sort((a, b) => compareValues(a.value, b.value, locale))
						: present
					values = list.map((facet) => ({ ...facet, text: valueText(facet.value) }))
				}
				let dates: ColumnFacets['dates'] = null
				let days: ColumnFacets['days'] = null
				if (kind === 'dateRange') {
					const from = toTime(given?.dates?.from)
					const to = toTime(given?.dates?.to)
					if (given?.dates && from !== undefined && to !== undefined) {
						dates = { from: new Date(from), to: new Date(to) }
						days = { from: dayOn(given.dates.from, from), to: dayOn(given.dates.to, to) }
					} else {
						dates = dateRange(rows, found)
						days = dayRange(rows, found)
					}
				}
				let range: ColumnFacets['range'] = null
				if (kind === 'range') {
					const ends = given?.range ?? numberRange(rows, found)
					if (ends) {
						range = { min: ends.min, max: ends.max, step: given?.range?.step ?? stepOf(found) }
					}
				}
				const result: ColumnFacets = { kind, values, range, dates, days }
				facetCache.set(key, {
					rows,
					column: found,
					locale,
					given: all,
					chosen: own,
					held,
					extra,
					result,
				})
				return result
			},
			getTotals(groupId) {
				let group: GroupRow<unknown> | undefined
				if (groupId !== undefined) {
					const groups = groupsById(model.grouped())
					group = groups.get(String(groupId))
					if (!group) {
						throw new Error(
							`No group "${String(groupId)}" to read the totals of. Groups: ${listed(groups.keys())}.`,
						)
					}
				}
				const values = totalsOf(group)
				const totals: Record<string, ColumnTotal> = {}
				for (const found of layout().all) {
					if (aggregateOf(found) === undefined) continue
					totals[found.id] = { value: values[found.id], text: totalText(found, values[found.id]) }
				}
				return totals
			},
			getSelectionSummary: () => {
				const bounds = selectedCells()
				if (!bounds) return null
				return selectionSummary(
					bounds.top,
					bounds.bottom,
					bounds.left,
					bounds.right,
					bodyRows(),
					layout().leaves,
					options().locale,
				)
			},
			subscribe(listener) {
				if (typeof listener !== 'function') throw new Error('`subscribe` takes a function.')
				let active = true
				const leave = context.store.subscribe((liveOnly, _delivered, changed) => {
					if (active && !liveOnly) listener(changed)
				})
				const stop = () => {
					active = false
					subscriptions.delete(stop)
					leave()
				}
				subscriptions.add(stop)
				return stop
			},
		}

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
			const open = layout().all.filter((item) => (item.editable ?? editableByDefault()) !== false)
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
				if (value === undefined) {
					throw new Error(
						'`editCell` takes the new value as its third argument. Pass `null` or an empty text to empty the cell.',
					)
				}
				const input = typeof value === 'string' ? { text: value } : { value }
				const finish = (result: SaveResult): void => {
					if (result === true) return
					throw new Error(
						`Column "${columnId}" refuses ${String(JSON.stringify(value))} for row "${rowId}": ${result}`,
						// The words for a person, as the editor of the cell shows them.
						{ cause: result },
					)
				}
				const result = saveCell(cell.node, cell.column, input, 'imperative')
				if (typeof result === 'string' || result === true) return finish(result)
				return result.then((save) => {
					if (destroyed) throw new Error(GONE)
					finish(save())
				})
			},
			startEdit(rowId, columnId) {
				// A cell of a computed column opens with the formula of its column.
				if (!editableCell(cellKey(rowId, columnId))) requireEditable(rowId, columnId)
				const at = requireCell({ rowId, columnId }, 'edit')
				const id = cellKey(rowId, columnId)
				// Before focus moves: an editor that stays open keeps focus.
				if (!edit.release(id)) {
					throw new Error(
						'The editor of another cell is open, and its value was refused or is checked now. Call `cancelEdit` first, or give it a value that passes.',
					)
				}
				// The row must be in the page for its editor, and focus is on a cell before an edit.
				grid.focus(at, { reason: 'imperative' })
				edit.start(id, { reason: 'imperative' })
			},
			cancelEdit() {
				edit.cancel()
			},
			selectCells(from, to = from) {
				requireCellSelection()
				const anchor = requireCell(from, 'select')
				const end = requireCell(to, 'select')
				// The active cell is the start of a range. Focus that is outside the
				// table stays there: a call from code must not take it from the
				// person. Focus that is in the table goes with the active cell, or
				// the next arrow key would start from a cell that the person is not on.
				activate(anchor)
				range.select({ anchor, end }, { reason: 'imperative' })
			},
			clearCellSelection() {
				range.select(null, { reason: 'imperative' })
			},
			exportData: (exportOptions) =>
				collectExport<unknown>(
					{
						all: () => model.source().rows,
						sorted: () => model.sorted(),
						filtered: () => model.filtered(),
						listed: () => model.grouped(),
						page: () => model.paged(),
						pinned: () => ({
							top: pinned().top.flatMap((flat) => (flat.node.kind === 'row' ? [flat.node] : [])),
							bottom: pinned().bottom.flatMap((flat) =>
								flat.node.kind === 'row' ? [flat.node] : [],
							),
						}),
						selected: () => idSet(state().selected),
						visibleColumns: () => layout().leaves,
						allColumns: () => layout().all,
						label: (column) => column.header ?? column.id,
						text,
						formatOf: (rowId, column) =>
							hasFormats(state().cellFormats)
								? ownFormat(state().cellFormats, rowId, column.id)
								: undefined,
						groupText,
						totals: totalsOf,
						totalText,
						aggregateOf,
						locale: () => options().locale,
						...(engine() && {
							formulaOf: (rowId: string, columnId: string) =>
								formulaOf(rowId, columnId) ?? formulasNow.read().columns?.[columnId],
							documentRows: formulaSheet.rowIds,
						}),
					},
					exportOptions,
				),
			copyCells: () => copyText(),
			pasteCells(text) {
				if (typeof text !== 'string') throw new Error('`pasteCells` takes a text.')
				return pasteText(text)
			},
			clearCells: () => clearAndSay('clear'),
			cutCells() {
				const text = copyText()
				const cleared = clearAndSay('cut')
				return cleared ? cleared.then(() => text) : text
			},
			fillCells(direction, source = 1) {
				requireCellSelection()
				if (!FILL_WAYS.includes(direction)) {
					throw new Error(
						`Cells are filled "down", "up", "forward" or "back", not "${String(direction)}".`,
					)
				}
				if (!Number.isInteger(source) || source < 1) {
					throw new Error(
						`A fill starts from 1 or more lines of the selected cells, not from ${String(source)}.`,
					)
				}
				const parts = fillParts(direction, source)
				if (!parts) {
					const bounds = selectedCells()
					const vertical = direction === 'down' || direction === 'up'
					const size = !bounds
						? 0
						: vertical
							? dataRowsBetween(bounds.top, bounds.bottom).length
							: bounds.right - bounds.left + 1
					const unit = vertical ? (size === 1 ? 'row' : 'rows') : size === 1 ? 'column' : 'columns'
					throw new Error(
						`The selected cells hold ${size} ${unit}, so a fill ${direction} from ${source} of them has no cell to fill. Select the cells to fill from together with the cells to fill.`,
					)
				}
				return fill(parts.source, parts.target)
			},
			selectAllCells() {
				requireCellSelection()
				range.selectAll({ reason: 'imperative' })
				activeIntoRange()
			},
			selectCellRows(fromRowId, toRowId = fromRowId) {
				requireCellSelection()
				const first = layout().leaves[0]
				if (!first) throw new Error('No column is in view, so there is no cell to select.')
				const from = requireCell({ rowId: fromRowId, columnId: first.id }, 'select')
				const to = requireCell({ rowId: toRowId, columnId: first.id }, 'select')
				range.selectRows(from.row, to.row, { reason: 'imperative' })
				activeIntoRange()
			},
			selectCellColumns(fromColumnId, toColumnId = fromColumnId) {
				requireCellSelection()
				requireRanged(fromColumnId)
				requireRanged(toColumnId)
				const index = layout().index
				range.selectColumns(index.get(fromColumnId) ?? 0, index.get(toColumnId) ?? 0, {
					reason: 'imperative',
				})
				activeIntoRange()
			},
			formatCells(patch, target) {
				applyFormat(checkedPatch(patch), target, 'imperative')
			},
			clearCellFormats(target) {
				applyFormat(CLEAR_FORMAT, target, 'imperative')
			},
			toggleCellFormat(property) {
				if (property !== 'bold' && property !== 'italic') {
					throw new Error(
						`A format is turned on and off for "bold" or "italic", not for "${String(property)}". Set another property with \`formatCells\`.`,
					)
				}
				toggleLook(property, 'imperative')
			},
			getCellFormat(rowId, columnId) {
				requireRow(String(rowId), 'read the format of')
				const found = column(String(columnId), 'read the format of')
				// The number of a row can be the active cell, and a toolbar asks for
				// the format of that one. It has none, which is an answer and no error.
				if (found.rowHeader) return NO_FORMAT
				return ownFormat(formatsNow.read(), String(rowId), found.id) ?? NO_FORMAT
			},
			undo: () => travelOrThrow('undo'),
			redo: () => travelOrThrow('redo'),
			clearHistory() {
				requireHistory()
				history.clear()
			},
			getHistory() {
				const { steps, position } = history.read()
				return {
					entries: steps.map((step) => ({
						id: step.id,
						reason: step.reason,
						source: step.source,
						cells: step.cells.length,
						formats: !!step.formats,
						formulas: !!step.formulas,
					})),
					position,
				}
			},
		}

		/** A column whose cells can have a format: every column but the one with the numbers of the rows. */
		function formatColumn(id: string): ColumnDef {
			const found = column(id, 'format')
			if (!found.rowHeader) return found
			const valid = layout().all.filter((item) => !item.rowHeader)
			throw new Error(
				`Column "${id}" holds the numbers of the rows, and its cells have no format. Columns: ${listed(valid.map((item) => item.id))}.`,
			)
		}

		/** Checks a change of a format, so that a wrong name is refused with the names that are valid. */
		function checkedPatch(patch: unknown): CellFormatPatch {
			const keys: readonly string[] = CELL_FORMAT_KEYS
			if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
				throw new Error(
					`A format is an object with the properties ${keys.join(', ')}. A property with null is taken away.`,
				)
			}
			const given = patch as Record<string, unknown>
			const unknown = Object.keys(given).find((key) => !keys.includes(key))
			if (unknown !== undefined) {
				throw new Error(
					`A format has no property "${unknown}". Its properties: ${keys.join(', ')}.`,
				)
			}
			if (!keys.some((key) => given[key] !== undefined)) {
				throw new Error(`A format names one property at least: ${keys.join(', ')}.`)
			}
			const oneOf = (key: string, valid: readonly string[], what: string) => {
				const value = given[key]
				if (value == null || (typeof value === 'string' && valid.includes(value))) return
				throw new Error(
					`No ${what} "${typeof value === 'string' ? value : JSON.stringify(value)}". \`${key}\` of a format is one of: ${valid.join(', ')}; or null to take it away.`,
				)
			}
			oneOf('format', CELL_FORMAT_NAMES, 'format')
			oneOf('dateStyle', CELL_DATE_STYLES, 'date style')
			oneOf('align', CELL_ALIGNS, 'side')
			for (const key of ['color', 'fill']) {
				if (given[key] == null) continue
				const colors = options().formatColors ?? NO_IDS
				if (!colors.length) {
					throw new Error(
						`This table has no colours for a format. Set its \`formatColors\` option to the names that \`${key}\` can have.`,
					)
				}
				oneOf(key, colors, 'colour')
			}
			for (const key of ['bold', 'italic']) {
				const value = given[key]
				if (value != null && typeof value !== 'boolean') {
					throw new Error(`\`${key}\` of a format is true or false, or null to take it away.`)
				}
			}
			const { decimals, currency } = given
			if (
				decimals != null &&
				(typeof decimals !== 'number' ||
					!Number.isInteger(decimals) ||
					decimals < 0 ||
					decimals > CELL_MAX_DECIMALS)
			) {
				throw new Error(
					`\`decimals\` of a format is a whole number from 0 to ${CELL_MAX_DECIMALS}, or null to take it away.`,
				)
			}
			if (currency != null && (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency))) {
				throw new Error(
					'`currency` of a format is an ISO 4217 code of three letters, such as EUR, or null to take it away.',
				)
			}
			const checked: Record<string, unknown> = {}
			for (const key of keys) {
				if (given[key] === undefined) continue
				checked[key] =
					key === 'currency' && typeof currency === 'string' ? currency.toUpperCase() : given[key]
			}
			return checked as CellFormatPatch
		}

		/**
		 * The formats that a change is for. Cells go to the layer of the
		 * cells. When they are every row that the table has, the change goes
		 * to the layer of the columns, so it also holds for a row that comes
		 * later. With pages from a server the table never has every row.
		 */
		function formatPlace(target: FormatTarget | undefined): {
			place: FormatPlace
			cells: number
			whole: boolean
		} {
			const every = model.source().byId.size
			if (target !== undefined && (typeof target !== 'object' || target === null)) {
				throw new Error(
					'The target of a format is `{ from, to }` with cells as `{ rowId, columnId }`, or `{ columns }` with column ids.',
				)
			}
			if (target && 'columns' in target) {
				if (!Array.isArray(target.columns) || !target.columns.length) {
					throw new Error(
						`\`columns\` of the target of a format is a list of column ids. Columns: ${listed(
							layout()
								.all.filter((item) => !item.rowHeader)
								.map((item) => item.id),
						)}.`,
					)
				}
				const ids = [...new Set(target.columns.map((id: string) => formatColumn(String(id)).id))]
				return { place: { columns: ids }, cells: ids.length * every, whole: true }
			}
			let bounds: CellBounds | undefined
			if (target) {
				const from = requireCell(target.from, 'format')
				const to = target.to === undefined ? from : requireCell(target.to, 'format')
				formatColumn(target.from.columnId)
				if (target.to) formatColumn(target.to.columnId)
				bounds = {
					top: Math.min(from.row, to.row),
					bottom: Math.max(from.row, to.row),
					left: Math.max(Math.min(from.col, to.col), firstRangeCol()),
					right: Math.max(from.col, to.col),
				}
			} else {
				bounds = selectedCells()
				if (!bounds) {
					throw new Error(
						'No cell is selected, so there is nothing to format. Select cells first, or pass a target: `{ from, to }` with cells as `{ rowId, columnId }`, or `{ columns }` with column ids.',
					)
				}
			}
			const rows = dataRowsBetween(bounds.top, bounds.bottom).map((row) => row.id)
			const columns = layout()
				.leaves.slice(bounds.left, bounds.right + 1)
				.filter((leaf) => !leaf.rowHeader)
				.map((leaf) => leaf.id)
			if (!rows.length || !columns.length) {
				throw new Error('These cells hold no value: a group row and a detail row have no format.')
			}
			const whole = !(options().manualPage ?? false) && rows.length === every
			return {
				place: whole ? { columns } : { rows, columns },
				cells: rows.length * columns.length,
				whole,
			}
		}

		/**
		 * Reports new formats through `createChange`, and returns whether they
		 * were taken, with the source of the change as the listener got it. The
		 * listener of the owner is called through one of our own for that, as
		 * `tell` does for an edit.
		 */
		let formatSource: ChangeSource = 'programmatic'
		const formatsContext = {
			...context,
			options: () => ({
				...options(),
				onCellFormatsChange(value: CellFormats, details: TableChangeDetails) {
					formatSource = details.source
					options().onCellFormatsChange?.(value, details)
				},
			}),
		}
		const changeFormatsThrough = createChange(formatsContext)

		/** Changes the formats. A change that was taken is one step of the history. */
		function changeFormats(
			next: CellFormats,
			cells: number,
			reason: 'imperative' | 'shortcut',
			event?: Event,
		): boolean {
			const before = formatsNow.read()
			if (next === before) return false
			formatSource = 'programmatic'
			if (!formatsNow.change(next, { reason, event })) return false
			if (historyOn()) {
				history.record({
					id: ++stepIds,
					reason,
					source: formatSource,
					cells: [],
					formats: { before, after: next, cells },
				})
			}
			return true
		}

		function applyFormat(
			patch: CellFormatPatch,
			target: FormatTarget | undefined,
			reason: 'imperative' | 'shortcut',
			event?: Event,
		): void {
			const { place, cells } = formatPlace(target)
			const next = setFormats(formatsNow.read(), place, patch)
			if (changeFormats(next, cells, reason, event)) announce(message('cellsFormatted')({ cells }))
		}

		/**
		 * The format keys of a sheet on a body cell: bold and italic for the
		 * selected cells. A key turns the look on, unless every selected cell
		 * has it; then it turns it off.
		 */
		function formatKeydown(event: KeyboardEvent, cell: GridCell): boolean {
			if (!sheet() || !inBody(cell.row)) return false
			const key = matchesShortcut(event, 'mod+b')
				? 'bold'
				: matchesShortcut(event, 'mod+i')
					? 'italic'
					: undefined
			if (!key) return false
			const bounds = selectedCells()
			if (!bounds) return false
			const rows = dataRowsBetween(bounds.top, bounds.bottom)
			const columns = layout()
				.leaves.slice(bounds.left, bounds.right + 1)
				.filter((leaf) => !leaf.rowHeader)
			// A group row has no format, and its keys stay the browser's.
			if (!rows.length || !columns.length) return false
			event.preventDefault()
			attempt(() => toggleLook(key, 'shortcut', event))
			return true
		}

		/** Turns a look of the selected cells on, unless every one of them has it; then it turns it off. */
		function toggleLook(
			key: 'bold' | 'italic',
			reason: 'imperative' | 'shortcut',
			event?: Event,
		): void {
			const { place, whole } = formatPlace(undefined)
			const formats = formatsNow.read()
			const rowIds = 'rows' in place ? place.rows : [undefined]
			const every = rowIds.every((rowId) =>
				place.columns.every((id) => ownFormat(formats, rowId, id)?.[key] === true),
			)
			// A look that comes from the column is not in the cells, so taking
			// it away from them changes nothing: these cells say no to it.
			const fromColumn = !whole && place.columns.some((id) => formats.columns?.[id]?.[key])
			applyFormat({ [key]: every ? (fromColumn ? false : null) : true }, undefined, reason, event)
		}

		function requireCellSelection(): void {
			if (cellSelection()) return
			throw new Error('This table has no cell selection. Set its `cellSelection` option to true.')
		}

		/** A column whose cells a range can hold: one in view that is no column of row numbers. */
		function requireRanged(columnId: string): void {
			requireVisible(columnId, 'select')
			if (!column(columnId, 'select').rowHeader) return
			const valid = layout().leaves.filter((leaf) => !leaf.rowHeader)
			throw new Error(
				`Column "${columnId}" holds the numbers of the rows, and no range holds them. Columns with cells to select: ${listed(valid.map((leaf) => leaf.id))}.`,
			)
		}

		function requireHistory(): void {
			if (historyOn()) return
			throw new Error('This table has no history. Set its `history` option.')
		}

		function travelOrThrow(direction: 'undo' | 'redo'): void {
			requireHistory()
			// An editor that is open holds a value that is no step yet. It is saved first.
			if (!edit.release()) {
				throw new Error(
					'The editor of a cell is open, and its value was refused or is checked now. Call `cancelEdit` first, or give it a value that passes.',
				)
			}
			const reason = travel(direction)
			if (reason !== undefined) throw new Error(reason)
		}

		/**
		 * Selects the cells of a column, for a control in its header. With
		 * Shift, the columns from the active cell to this one.
		 */
		function selectColumnCells(columnId: string, event?: Event): void {
			requireCellSelection()
			requireRanged(columnId)
			const to = layout().index.get(columnId) ?? 0
			const active = state().active
			const shift =
				event instanceof MouseEvent || event instanceof KeyboardEvent ? event.shiftKey : false
			const from = shift && active && inBody(active.row) ? active.col : to
			range.selectColumns(from, to, { reason: event ? 'item-press' : 'imperative', event })
			if (!shift) {
				const bounds = selectedCells()
				if (bounds) activate({ row: bounds.top, col: to })
			}
		}

		/**
		 * Selects the cells of a row, for a control in its row header. With
		 * Shift, the rows from the active cell to this one.
		 */
		function selectRowCells(rowId: string, event?: Event): void {
			requireCellSelection()
			const first = layout().leaves[firstRangeCol()]
			if (!first) throw new Error('No column with cells to select is in view.')
			const to = requireCell({ rowId, columnId: first.id }, 'select')
			const active = state().active
			const shift =
				event instanceof MouseEvent || event instanceof KeyboardEvent ? event.shiftKey : false
			const from = shift && active && inBody(active.row) ? active.row : to.row
			range.selectRows(from, to.row, { reason: event ? 'item-press' : 'imperative', event })
			if (!shift) activate(to)
		}

		/** Whether a range of the state holds every row of the body in a column: the letter of that column then shows as selected. */
		function wholeColumnSelected(current: TableState, col: number): boolean {
			const now = current.cellRange
			const count = bodyRows().length
			if (!now || !count || !cellSelection()) return false
			const first = headerRowCount()
			return (
				Math.min(now.anchor.row, now.end.row) <= first &&
				Math.max(now.anchor.row, now.end.row) >= first + count - 1 &&
				Math.min(now.anchor.col, now.end.col) <= col &&
				Math.max(now.anchor.col, now.end.col) >= col
			)
		}

		/** The first column in view with a letter. The columns before it lead the table. */
		function letteredFrom(): number {
			const leaves = layout().leaves
			const letters = letterMap(layout())
			const index = leaves.findIndex((leaf) => letters.has(leaf.id))
			return index === -1 ? leaves.length : index
		}

		/** Whether a place of the row of letters is the corner: the letter cell of a first column that leads the table. */
		const isCorner = (col: number): boolean => {
			const first = layout().leaves[0]
			return col === 0 && letterRowCount() > 0 && !!first && isLead(first)
		}

		/** Selects every column that has a letter, over the rows of the body: what the corner does. */
		function selectLetteredColumns(details: { reason: CellRangeReason; event?: Event }): void {
			const last = layout().leaves.length - 1
			const from = letteredFrom()
			if (from > last) return
			if (range.selectWholeColumns(from, last, details)) sayRange()
		}

		/** Says the size of the selected cells, as a key of the range does. */
		function sayRange(): void {
			const bounds = selectedCells()
			if (!bounds) return
			announce(
				message('cellsSelected')({
					rows: bounds.bottom - bounds.top + 1,
					columns: bounds.right - bounds.left + 1,
				}),
			)
		}

		/**
		 * Selects by the cell of a column in the row of letters: the column of a
		 * letter, every column from the corner. For a control in a letter cell.
		 */
		function selectLetterColumn(columnId: string, event?: Event): void {
			requireCellSelection()
			const col = layout().index.get(columnId)
			if (col !== undefined && isCorner(col)) {
				selectLetteredColumns({ reason: event ? 'item-press' : 'imperative', event })
				return
			}
			if (col !== undefined && letterOf(columnId) === undefined) {
				const valid = [...letterMap(layout()).keys()]
				throw new Error(
					`Column "${columnId}" leads the table and has no letter. Columns with a letter: ${listed(valid)}.`,
				)
			}
			selectColumnCells(columnId, event)
		}

		/** A press on a cell of the row of letters. The press on a letter takes its column, and a drag more columns. */
		function pressLetter(event: PointerEvent, cell: GridCell): void {
			const id = layout().leaves[cell.col]?.id
			if (cellSelection() && id !== undefined && letterOf(id) !== undefined) {
				range.pointerdownColumns(event, cell)
				return
			}
			grid.focus(cell, { reason: 'item-press', event })
			if (cellSelection() && isCorner(cell.col)) {
				selectLetteredColumns({ reason: 'item-press', event })
			}
		}

		/**
		 * The keys on a cell of the row of letters. Space (also with Shift or
		 * Control) and Enter select the column of the letter, or every column
		 * from the corner; Control+A every column; Shift with an arrow takes the
		 * next column; Escape drops the range. The keys of a
		 * sheet act on the selected cells, as from a row number. Tab leaves the table.
		 */
		function letterKeydown(event: KeyboardEvent, cell: GridCell): boolean {
			if (!cellSelection() || event.altKey || event.key === 'Tab') return false
			const mod = event.ctrlKey || event.metaKey
			const id = layout().leaves[cell.col]?.id
			const lettered = id !== undefined && letterOf(id) !== undefined
			const why = { reason: 'list-navigation' as const, event }
			// Control+A selects every cell, as the corner does: also here, the checkbox of a row is no cell of a range.
			if (matchesShortcut(event, 'mod+a')) {
				event.preventDefault()
				selectLetteredColumns(why)
				return true
			}
			// Space alone, Control+Space as in a spreadsheet, and Shift+Space as on a row number.
			const space = event.key === ' ' && !(mod && event.shiftKey)
			if (space || (event.key === 'Enter' && !mod && !event.shiftKey)) {
				if (!lettered && !isCorner(cell.col)) return false
				event.preventDefault()
				if (lettered) {
					if (range.selectWholeColumns(cell.col, cell.col, why)) sayRange()
				} else selectLetteredColumns(why)
				return true
			}
			if (
				event.shiftKey &&
				!mod &&
				lettered &&
				(event.key === 'ArrowLeft' || event.key === 'ArrowRight')
			) {
				event.preventDefault()
				const rtl = event.target instanceof Element && isRTL(event.target)
				const step = (event.key === 'ArrowRight') !== rtl ? 1 : -1
				const now = state().cellRange
				const body = { first: headerRowCount(), last: headerRowCount() + bodyRows().length - 1 }
				// A range of whole columns grows at its end. Any other range starts again from this letter.
				const whole =
					!!now &&
					Math.min(now.anchor.row, now.end.row) === body.first &&
					Math.max(now.anchor.row, now.end.row) === body.last
				const anchor = whole && now ? now.anchor.col : cell.col
				const from = whole && now ? now.end.col : cell.col
				const end = Math.max(letteredFrom(), Math.min(layout().leaves.length - 1, from + step))
				if (range.selectWholeColumns(anchor, end, why)) sayRange()
				return true
			}
			if (event.key === 'Escape' && state().cellRange) {
				event.preventDefault()
				range.select(null, why)
				return true
			}
			// Delete, a cut, a fill or a format from a letter act on the selected cells, as from a row number.
			const body = { row: headerRowCount(), col: cell.col }
			return formatKeydown(event, body) || sheetKeydown(event, body)
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
			...readActions,
			edit,
			range,
			cellIdAt,
			/** The id of a body cell as a list, for `selects`: one id for the cell of a data row, else none. */
			cellIds: (cell: { row: number; col: number; header?: boolean }): readonly string[] => {
				const id = cell.header ? undefined : cellIdAt(cell.row, cell.col)
				return id === undefined ? NO_IDS : [id]
			},
			/** The names that a cell hears a change of formats by: its row and its column. The header of a column hears its column. */
			formatNamesAt: (cell: { row: number; col: number; header?: boolean }): readonly string[] => {
				if (cell.header) {
					const header = headerAt(cell.row, cell.col)
					return header?.leaf && header.column ? formatNames(undefined, header.column.id) : NO_IDS
				}
				const flat = bodyRows()[cell.row - headerRowCount()]
				// The label of a group row says the totals of its group, so it hears every column.
				if (flat?.node.kind === 'group' && groupCell(cell.row, cell.col) === 'group-label') {
					return columnFormatNames(layout().all)
				}
				const data = flat && flat.node.kind === 'row' && !flat.detail
				return formatNames(data ? flat.id : undefined, layout().leaves[cell.col]?.id)
			},
			/** The formats of the columns, for the label of a group row: they decide the text of the totals that it says. */
			totalFormatsAt: (
				current: TableState,
				cell: { row: number; col: number; header?: boolean },
			): CellFormats['columns'] =>
				!cell.header &&
				current.cellFormats.columns &&
				groupCell(cell.row, cell.col) === 'group-label'
					? current.cellFormats.columns
					: undefined,
			/**
			 * The format that a cell shows with, from the formats of a state: for
			 * the cell of a data row, the format of its column with its own over
			 * it; for a total in the footer or in a group row, the format of its column.
			 */
			formatAt: (
				current: TableState,
				cell: { row: number; col: number; header?: boolean; colspan?: number },
			): CellFormat | undefined => {
				const formats = current.cellFormats
				if (cell.header || (cell.colspan ?? 1) > 1 || !hasFormats(formats)) return undefined
				const column = layout().leaves[cell.col]
				if (!column || column.rowHeader) return undefined
				const flat = bodyRows()[cell.row - headerRowCount()]
				if (flat?.detail) return undefined
				return ownFormat(formats, flat?.node.kind === 'row' ? flat.id : undefined, column.id)
			},
			formatKeydown,
			/** The name of the format that a column shows its values with, after the formats that a person gave the column. */
			formatNameOf: (current: TableState, column: ColumnDef, rowId?: string): string | undefined =>
				hasFormats(current.cellFormats)
					? resolveFormat(column, current.cellFormats, rowId).name
					: column.format,
			inBody,
			/** Whether a cell can be edited, by its id. */
			canEditCell: (id: string) => editableCell(id),
			entry,
			editorKeydown,
			entryPress,
			hasEditing: editing,
			cellSelection,
			/**
			 * What a cell says about the range. With row selection too, a cell
			 * outside the range says nothing: a cell that says it is not selected
			 * would deny what its selected row says.
			 */
			rangeAttrs: (current: TableState, cell: GridCell) => {
				const attrs = range.cellAttrs(current, cell)
				return options().selection && attrs['aria-selected'] === 'false'
					? { ...attrs, 'aria-selected': undefined }
					: attrs
			},
			/**
			 * Saves a value for the cell that is edited, with the check of its
			 * column, and closes the editor. For an editor that is not the text
			 * field of the table, such as a list of choices.
			 */
			saveEdit(value: unknown, event?: Event): void {
				const id = state().editing
				const cell = id === null ? undefined : cellOf(id)
				// A second save while the first is checked would check a value that is never reported.
				if (!cell || edit.checking()) return
				// In a sheet, Enter in an editor of the caller saves and moves down, as in the text field.
				const reason =
					sheet() && event instanceof KeyboardEvent && event.key === 'Enter'
						? 'enter-key'
						: 'imperative'
				// A text with `=` from an editor of the caller is a formula, as in the text field.
				const input =
					engine() && typeof value === 'string' && /^'?=/.test(value) ? { text: value } : { value }
				edit.settle(saveCell(cell.node, cell.column, input, reason, event), { reason, event })
			},
			onCopy,
			onPaste,
			onCut,
			sheet,
			sheetKeydown,
			historyKeydown,
			selectColumnCells,
			selectRowCells,
			fillHandle,
			picker,
			pickCells,
			/** Whether the fill handle sits in a cell: the end corner of the selected cells, in a table that can fill. */
			fillHandleAt: (cell: GridCell): boolean => fillHandle.holds(cell),
			isRowHeader,
			rowNumber,
			letterRowCount,
			isLetterRow,
			letterOf,
			isCorner,
			letterKeydown,
			pressLetter,
			selectLetterColumn,
			wholeColumnSelected,
			/** Whether a copy, a cut or a paste on a cell acts on the selected cells: a cell of the body, and a letter. */
			holdsRange: (cell: { row: number; header?: boolean }) =>
				!cell.header || isLetterRow(cell.row),
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
			loading: () => options().loading ?? false,
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
			/**
			 * Selects the rows of a group that can be selected, or takes them out
			 * of the selection when every one of them is in it. The rows of other
			 * groups stay as they are.
			 */
			toggleGroupSelected(group: GroupRow<unknown>, event?: Event) {
				const ids = group.leaves.map((leaf) => leaf.id).filter(canSelect)
				if (!ids.length) return
				const selected = idSet(state().selected)
				const all = ids.every((id) => selected.has(id))
				const inGroup = new Set(ids)
				const next = all
					? state().selected.filter((id) => !inGroup.has(id))
					: [...state().selected, ...ids.filter((id) => !selected.has(id))]
				change('selected', next, { reason: 'list-navigation', event })
			},
			sortOf: (columnId: string): SortDirection | undefined => {
				const rule = state().sort.find((item) => item.id === columnId)
				return rule ? (rule.desc ? 'desc' : 'asc') : undefined
			},
			/** The place of a column in the sort, from 1: the first column sorts first. */
			sortIndexOf: (columnId: string): number | undefined => {
				const index = state().sort.findIndex((item) => item.id === columnId)
				return index === -1 ? undefined : index + 1
			},
			isTree: () => !!options().getChildren || state().groupBy.length > 0,
			/** Column totals of a group, or of all filtered rows, with the totals of the owner over them. */
			totals: totalsOf,
			groupSpan,
			groupCell,
			groupPath,
			/** A total as text. A count is a plain number, whatever the format of its column. */
			totalText,
			/** The function of the total of a column: the one chosen at run time, else the `aggregate` of the column. */
			aggregateOf,
			chooseAggregate,
			/** Whether a row of the grid is the footer row. */
			inFooter: (row: number) => footerRowCount() > 0 && row === headerRowCount() + bodyRowCount(),
			/** The name of a footer cell whose function a person chose: the function and the total. */
			footerLabel(column: ColumnDef): string | undefined {
				const chosen = state().columnAggregates[column.id]
				if (!chosen) return undefined
				return message('totalLabel')({
					label: message('aggregateLabel')(chosen),
					text: totalText(column, totalsOf()[column.id]),
				})
			},
			/** The text of a group row: the value of the group as its column shows it, and its count. */
			groupText,
			/** Whether the table has the `formulas` option. */
			hasFormulas: () => !!engine(),
			/**
			 * The attributes of a body cell for its formula: whether it has one
			 * of its own, and the code and the words of an error value.
			 */
			formulaAttrs: (current: TableState, id: string) => {
				const ref = parseCellKey(id)
				const node = ref && model.rowById(ref.rowId)
				const column = ref && layout().byId.get(ref.columnId)
				if (!ref || !node || !column) return undefined
				const value = cellValue(node.row, column)
				const error = isFormulaError(value) ? value : undefined
				return {
					'data-formula':
						formulaIn(current.cellFormulas, ref.rowId, ref.columnId) === undefined ? undefined : '',
					'data-formula-error': error?.replace(/[^A-Za-z0-9]/g, '').toLowerCase(),
					'aria-description': error && cellErrorText(column.id, error),
				}
			},
			/** For the slot props of a cell: the formula as a person reads it, and the error with its words. */
			cellFormula: (rowId: string, columnId: string) => {
				const view = engine() ? formulaView(rowId, columnId, false) : null
				if (!view || (view.formula === null && !view.error)) return undefined
				return {
					text: view.text,
					...(view.error
						? { error: { code: view.error, message: cellErrorText(columnId, view.error) } }
						: undefined),
				}
			},
			storedFormula: (current: TableState, id: string) => {
				const ref = parseCellKey(id)
				return ref && formulaIn(current.cellFormulas, ref.rowId, ref.columnId)
			},
			/** For the slot props of a header: the formula of a computed column as a person reads it. */
			headerFormula: (columnId: string) => {
				const formula = engine() ? state().cellFormulas.columns?.[columnId] : undefined
				return formula === undefined
					? undefined
					: requireFormulas().print(formula, { columnId }, formulaSheet)
			},
			/** For the slot props of an editor: the formula of the cell as a person reads it. */
			editorFormula: (rowId: string, columnId: string) => {
				const view = engine() ? formulaView(rowId, columnId, true) : null
				return view ? view.text : undefined
			},
			/**
			 * The keyboard of a phone for the editor of a cell, by its id: `decimal`
			 * for a column with `numberKeyboard`, unless the field can hold a
			 * formula or the format of the cell is no number format. The number
			 * keyboard has no `=`, no letters and no sign of a date.
			 */
			inputModeOf: (id: string): 'decimal' | undefined => {
				const cell = cellOf(id)
				if (!cell?.column.numberKeyboard) return undefined
				const { node, column } = cell
				if (holdsFormula(node, column) || columnFormulaAt(node, column) !== undefined) return
				const format = shownFormat(column, node.id)
				return format === undefined || isNumericFormat(format as FormatName) ? 'decimal' : undefined
			},
			/** Whether a column is computed by a formula of the `columns` layer. */
			isFormulaColumn: (columnId: string) =>
				!!engine() && state().cellFormulas.columns?.[columnId] !== undefined,
		}
	},
	slots: (slot) => ({
		root: slot({
			role: (_state, { api }) => (api.isTree() ? 'treegrid' : 'grid'),
			roles: ['grid', 'treegrid'],
			keys: { none: 'Focus stays on a cell, and the keydown of the cell handles the keys.' },
			bind: (el, { api }) =>
				together(api.grid.bindRoot(el), api.fillHandle.bindRoot(el), api.picker.bindRoot(el)),
			// The cursor of a fill is the same over every cell, so the root says that a
			// fill drag runs. The root hears `filling` for it: a key with an empty
			// list in `selects` would never reach `live`.
			live: live((state) => ({ 'data-filling': state.filling ? '' : undefined })),
			// Selection and cell focus change one row or two cells. The root must not render for them.
			selects: selects({
				selected: [],
				active: [],
				columnTrack: [],
				columnResize: [],
				rowWindow: [],
				cellRange: [],
				pickedCells: [],
				editing: [],
				editChecking: [],
				editErrors: [],
				searchDraft: [],
				searchPending: [],
				history: [],
				fillDraft: [],
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
					'data-entry': api.entry() ? '' : undefined,
					'data-pick': api.pickCells() ? '' : undefined,
					'data-sheet': api.sheet() ? '' : undefined,
					'data-formulas': api.hasFormulas() ? '' : undefined,
					'data-sized': sized ? '' : undefined,
					'data-row-window': api.windowed() ? '' : undefined,
					'aria-busy': api.loading() ? 'true' : undefined,
					'data-loading': api.loading() ? '' : undefined,
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
		// `value` is the key of the part: without one, every header row would be one part with one
		// element, and only the last row would join the rows that stick.
		'header-row': slot<{ value?: string; index: number }>({
			props: { value: 'string', index: 'number' },
			role: 'row',
			// The row reads options and its own props, and no state.
			selects: selects(SILENT),
			attrs: (_state, { props, api }) => ({
				'aria-rowindex': String(props.index + 1),
				'data-kind': api.isLetterRow(props.index) ? 'letters' : undefined,
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
			role: (_state, { props, api }) =>
				props.header ? 'columnheader' : api.isRowHeader(props) ? 'rowheader' : 'gridcell',
			roles: ['columnheader', 'gridcell', 'rowheader'],
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
				'Delete',
				'Backspace',
				'Tab',
				'shift+Tab',
				'mod+z',
				'mod+shift+z',
				'mod+y',
				'mod+d',
				'mod+r',
				'mod+b',
				'mod+i',
			],
			// A cell reads the range and the editor only for its own place and its own id.
			selects: selects({
				...QUIET,
				active: byCell,
				// A letter hears the columns of a range: it shows when its whole column is selected.
				cellRange: {
					values: (context) =>
						context.props.header && context.api.isLetterRow(context.props.row)
							? [`letter:${context.props.col}`]
							: byCellRange.values(context),
					moved: (previous, next, notify) => {
						byCellRange.moved(previous, next, notify)
						for (const range of [previous, next]) {
							if (!range) continue
							const right = Math.max(range.anchor.col, range.end.col)
							for (let col = Math.min(range.anchor.col, range.end.col); col <= right; col++) {
								notify(`letter:${col}`)
							}
						}
					},
				},
				// A pick wakes the cells of the places that it leaves and reaches.
				pickedCells: byCellRange,
				editing: ({ props, api }) => api.cellIds(props),
				editChecking: ({ props, api }) => api.cellIds(props),
				editErrors: ({ props, api }) => api.cellIds(props),
				// A part hears a live key only when its readers let it. The draft of a
				// fill wakes the cells of the rows whose marks change.
				fillDraft: {
					values: ({ props }) => (props.header ? NO_IDS : [String(props.row)]),
					moved: byFillDraft.moved,
				},
				// A change of formats wakes the cells of its rows and its columns, and no other cell.
				cellFormats: {
					values: ({ props, api }) => api.formatNamesAt(props),
					moved: byCellFormat.moved,
				},
				// The formulas have the two layers of the formats, so a change wakes the same cells.
				cellFormulas: {
					values: ({ props, api }) => api.formatNamesAt(props),
					moved: byCellFormat.moved,
				},
				expanded: [],
			}),
			state: (state, { props, api }) => {
				const id = props.header ? undefined : api.cellIdAt(props.row, props.col)
				return {
					/** The format that the cell has of its own, from `cellFormats`: the format of its column with the format of the cell over it. */
					format: api.formatAt(state, props),
					/** For the label of a group row: the formats of the columns, which decide the text of its totals. */
					totalFormats: api.totalFormatsAt(state, props),
					/** Whether the editor of the cell is open. The renderer then shows the editor in the cell. */
					editing: id !== undefined && state.editing === id,
					/** Whether the check of a new value runs. The editor then waits for the answer. */
					checking: id !== undefined && state.editChecking === id,
					/** Why the text of the editor was refused. */
					error: id === undefined ? undefined : state.editErrors[id],
					/** Whether the fill handle sits in this cell. The renderer then shows the `fill-handle` part in it. */
					fillHandle: id !== undefined && api.fillHandleAt(props),
					/** The formula of the cell of its own, in the stored form, so a renderer renders the cell again when it changes. */
					formula: id === undefined ? undefined : api.storedFormula(state, id),
				}
			},
			// The cells that a drag of the fill handle would fill. It changes with
			// each move of the pointer, so it is written to the elements and renders nothing.
			live: live((state, { props, api }) =>
				props.header ? {} : api.fillHandle.cellAttrs(state, props),
			),
			attrs: (state, { props, api }) => {
				if (props.header && api.isLetterRow(props.row)) {
					// A cell of the row of letters: the letter of a column, or the corner, or the empty cell of a column that leads.
					const column = api.columns()[props.col]
					const pin = column ? api.columnPin(column.id) : undefined
					const offset = pin && column ? api.pins.offset(column.id) : undefined
					const letter = column ? api.letterOf(column.id) : undefined
					const corner = api.isCorner(props.col)
					return {
						'data-kind': 'letter',
						'data-corner': corner ? '' : undefined,
						'data-column': column?.id,
						'data-lead': letter === undefined ? '' : undefined,
						'data-selected':
							letter !== undefined && api.wholeColumnSelected(state, props.col) ? '' : undefined,
						'aria-label': corner ? api.message('cornerCell')() : undefined,
						'aria-colindex': String(props.col + 1),
						tabindex: api.grid.tabIndex(state, props),
						'data-active': api.grid.isActive(state, props) ? '' : undefined,
						'data-pinned': pin,
						'data-pinned-edge': pin && column && api.isPinEdge(column.id) ? '' : undefined,
						style: offset ? `--table-pin-offset:${offset}` : undefined,
					}
				}
				const header = props.header ? api.headerAt(props.row, props.col) : undefined
				const column = props.header ? header?.column : api.columns()[props.col]
				const span = props.colspan ?? 1
				const wide = span > 1
				const inGroup = props.header ? undefined : api.groupCell(props.row, props.col)
				// The label of a group row that shows totals covers some columns, and
				// sticks with them. A cell as wide as the table has no side to stick to.
				const label = inGroup === 'group-label' && api.groupSpan() !== undefined
				// The header of one column, and not a header group.
				const leaf = !!header?.leaf
				const sortable = leaf && !!column?.sortable
				const sort = sortable && column ? api.sortOf(column.id) : undefined
				// A header group is pinned with the columns under it. It starts at its
				// column that is nearest to the edge, and its other end is the one that
				// can be next to the columns that scroll.
				const leaves = api.columns()
				const first = header ? leaves[header.col] : column
				const last = header
					? leaves[header.col + header.colSpan - 1]
					: label
						? leaves[props.col + span - 1]
						: column
				const pin = header
					? header.pin
					: (wide && !label) || !column
						? undefined
						: api.columnPin(column.id)
				const near = pin === 'end' ? last : first
				const far = pin === 'end' ? first : last
				const offset = pin && near ? api.pins.offset(near.id) : undefined
				const id = props.header ? undefined : api.cellIdAt(props.row, props.col)
				const editable = id !== undefined && api.canEditCell(id)
				const footer = !props.header && !wide && api.inFooter(props.row)
				const total =
					column && (footer || inGroup === 'group-total') ? api.aggregateOf(column) : undefined
				// The header of a row holds the number of the row, and a screen reader says it with each cell of the row.
				const rowHeader = id !== undefined && column?.rowHeader === true
				const number = rowHeader ? api.rowNumber(parseCellKey(id)?.rowId ?? '') : undefined
				// A group row holds no values, so its cells are never cells of a range. Nor is the number of a row.
				const ranged =
					!props.header && !inGroup && !rowHeader && api.cellSelection() && api.inBody(props.row)
				// The looks of a format are data. The style of the app gives each a meaning.
				const format = id === undefined ? undefined : api.formatAt(state, props)
				return {
					'data-align': format?.align,
					'data-bold': format?.bold ? '' : undefined,
					'data-italic': format?.italic ? '' : undefined,
					'data-color': format?.color,
					'data-fill': format?.fill,
					'data-formula-column': column && api.isFormulaColumn(column.id) ? '' : undefined,
					...(id !== undefined && api.hasFormulas() ? api.formulaAttrs(state, id) : undefined),
					...(ranged ? api.rangeAttrs(state, props) : undefined),
					...(id !== undefined && !inGroup && !rowHeader && api.pickCells()
						? api.picker.cellAttrs(state, props)
						: undefined),
					'data-kind': inGroup,
					'data-row-header': rowHeader ? '' : undefined,
					// The function of a total, for a style and for a test: in the footer and in a group row.
					'data-aggregate': total === undefined ? undefined : aggregateName(total),
					'aria-label':
						number === undefined
							? footer && column
								? api.footerLabel(column)
								: undefined
							: api.message('rowNumber')({ number }),
					// In a grid, a cell can be edited unless it says that it cannot.
					'aria-readonly':
						id !== undefined && !rowHeader && api.hasEditing() && !editable ? 'true' : undefined,
					'data-editable': editable ? '' : undefined,
					'data-editing': id !== undefined && state.editing === id ? '' : undefined,
					'data-checking': id !== undefined && state.editChecking === id ? '' : undefined,
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
					// The format of the column, so a style can put every number at the end of
					// its column: in a header, a row, a group row and the footer. A cell
					// over several columns shows no value of one column.
					// A format that a person gave the cell or its column wins over the definition.
					'data-format':
						wide || !column
							? undefined
							: api.formatNameOf(
									state,
									column,
									id === undefined ? undefined : parseCellKey(id)?.rowId,
								),
					// A column that leads the table holds a control, not a value, and a style gives it another width.
					'data-lead': !wide && column?.lead ? '' : undefined,
					'data-active': api.grid.isActive(state, props) ? '' : undefined,
					'data-sorted': sort,
					// With several columns in the sort, a header can show which one sorts first.
					'data-sort-index': sort && column ? String(api.sortIndexOf(column.id)) : undefined,
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
					// Undo and redo act on the values of the table from any cell. In a
					// field inside a cell, the key is the field's: the browser undoes the typing there.
					if (onCell && api.historyKeydown(event)) return
					// A letter selects its column, and the keys of a sheet act on what it selected.
					if (
						onCell &&
						props.header &&
						api.isLetterRow(props.row) &&
						api.letterKeydown(event, props)
					)
						return
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
						// The mode of the table reads the modifier keys of the event.
						api.toggleSort(column.id, { event })
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
					if (onCell && !props.header && api.formatKeydown(event, props)) return
					if (onCell && !props.header && api.sheetKeydown(event, props)) return
					const id = onCell && !props.header ? api.cellIdAt(props.row, props.col) : undefined
					if (id !== undefined && api.edit.keydown(event, id)) return
					if (
						onCell &&
						api.cellSelection() &&
						api.inBody(props.row) &&
						event.key !== 'Enter' &&
						event.key !== 'F2'
					) {
						// Space selects the row when rows can be selected, with Shift too,
						// and the rows of a group on a group row.
						const forRow =
							event.key === ' ' &&
							!event.ctrlKey &&
							!event.metaKey &&
							(row?.node.kind === 'group'
								? api.selectionMode() === 'multiple'
								: !!row && api.canSelect(row.id))
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
					} else if (
						event.key === ' ' &&
						row.node.kind === 'group' &&
						api.selectionMode() === 'multiple'
					) {
						// A group row holds no row of its own to select. Space on it is the
						// choice of its rows, as Space on a row is the choice of that row.
						event.preventDefault()
						api.toggleGroupSelected(row.node, event)
					}
				},
				// Focus can arrive without a key or a pointer: from a script, or from a
				// screen reader. The active cell must follow it, or the next arrow key
				// starts from the wrong cell.
				focus: (event, { api, props }) => {
					// Focus came to this cell, so the person left an editor that is open
					// in another cell. An editor that cannot end takes focus back, and
					// the active cell stays with it.
					const id = props.header ? undefined : api.cellIdAt(props.row, props.col)
					if (!api.edit.release(id, event)) return
					const active = api.grid.active()
					if (active?.row === props.row && active.col === props.col) return
					api.grid.focus(props, { reason: 'imperative', event })
				},
				pointerdown: (event, { api, props, el }) => {
					const target = event.target instanceof Element ? event.target : undefined
					// The pick mode: a press on a cell of the body or on a letter picks, and
					// changes nothing else. A press in a field inside the cell stays the field's.
					if (
						api.pickCells() &&
						(!props.header || api.isLetterRow(props.row)) &&
						(props.header || api.inBody(props.row)) &&
						!(
							target !== el &&
							target?.closest('a[href], button, input, select, textarea, [contenteditable]')
						)
					) {
						const column = api.columns()[props.col]
						const letter = !!props.header
						// The number of a row, a corner and the letter cell of a column that leads pick nothing.
						if (
							letter ? column && api.letterOf(column.id) !== undefined : !api.isRowHeader(props)
						) {
							api.picker.pointerdown(event, props, letter)
						} else event.preventDefault()
						return
					}
					api.entryPress()
					// A press on the resize handle resizes. It must not move focus or start a column move.
					if (target?.closest('[data-slot="table-resizer"]')) return
					// A press on the fill handle starts a fill, and the range under it stays.
					if (target?.closest('[data-slot="table-fill-handle"]')) return
					const header = props.header ? api.headerAt(props.row, props.col) : undefined
					// A press on a control inside the cell must leave focus on that control.
					const control =
						target && target !== el && target.closest('a[href], button, input, select, textarea')
					if (!control || !el?.contains(control)) {
						// An editor in another cell whose value is refused keeps focus
						// and the active cell: the person must see why before a move.
						const own = props.header ? undefined : api.cellIdAt(props.row, props.col)
						if (!api.edit.release(own, event)) {
							event.preventDefault()
							return
						}
						api.entryPress(event, own)
						const ranged =
							!props.header && event.button === 0 && api.cellSelection() && api.inBody(props.row)
						const letter = !!props.header && event.button === 0 && api.isLetterRow(props.row)
						// The cell is under the pointer, so focus must not scroll it: a row
						// that the header cuts would move away from the pointer. Focus
						// that is here already is not moved again by the grid. A press
						// with Shift stretches the range, and focus stays at its start.
						if (!(ranged || (letter && api.cellSelection())) || !event.shiftKey) {
							el?.focus({ preventScroll: true })
						}
						// A press on a cell of the body starts a range, and a drag paints it.
						// A press on the number of a row takes the row, and on a letter the column.
						if (letter) api.pressLetter(event, props)
						else if (ranged && api.isRowHeader(props)) api.range.pointerdownRows(event, props)
						else if (ranged) api.range.pointerdown(event, props)
						else api.grid.focus(props, { reason: 'item-press', event })
					}
					// The whole header cell is the grip of its column. A drag starts only
					// after the pointer moves, so a press on a sort button stays a press.
					// A press in a text field selects text or moves the caret there.
					const field = target?.closest('input, select, textarea, [contenteditable]')
					if (header?.leaf && !field) api.reorder.pointerdown(event, header.column.id)
				},
				dblclick: (event, { api, props, el }) => {
					if (props.header || api.pickCells()) return
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
					if (event.target === el && api.holdsRange(props)) api.onCopy(event)
				},
				paste: (event, { api, props, el }) => {
					if (event.target === el && api.holdsRange(props)) api.onPaste(event)
				},
				cut: (event, { api, props, el }) => {
					if (event.target === el && api.holdsRange(props)) api.onCut(event)
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
			selects: selects({
				...SILENT,
				editErrors: ({ key }) => [key],
				editChecking: ({ key }) => [key],
			}),
			attrs: (state, { id, key, api }) => {
				const cell = parseCellKey(key)
				const error = api.edit.error(state, key)
				const checking = state.editChecking === key
				return {
					// While the value is checked, the text is the one that was sent. A
					// change of it now would be lost without a word.
					readonly: checking ? '' : undefined,
					'aria-busy': checking ? 'true' : undefined,
					'data-checking': checking ? '' : undefined,
					'aria-label': api.message('editCell')({
						column: cell ? api.columnLabel(cell.columnId) : '',
					}),
					'aria-invalid': error === undefined ? undefined : 'true',
					'aria-errormessage': error === undefined ? undefined : `${id}-edit-error`,
					'data-invalid': error === undefined ? undefined : '',
					autocomplete: 'off',
					inputmode: api.inputModeOf(key),
				}
			},
			on: {
				keydown: (event, { api }) => api.editorKeydown(event),
				focusout: (event, { api, el }) => {
					api.edit.focusout(event, el?.closest<HTMLElement>('[data-slot="table"]'))
				},
			},
			bind: (el, { api }) => api.edit.bindInput(el as HTMLInputElement),
		}),
		/**
		 * The fill handle: a small part at the end corner of the selected cells
		 * that a person drags to fill more cells. Render it inside the cell whose
		 * `fillHandle` state is true. It is a tool for the pointer and no tab
		 * stop: the fill keys and `fillCells` do the same work.
		 */
		'fill-handle': slot({
			selects: selects(SILENT),
			attrs: () => ({ 'aria-hidden': 'true' }),
			on: { pointerdown: (event, { api }) => api.fillHandle.pointerdown(event) },
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
			'flushSearch',
			'setColumnFilter',
			'clearFilters',
			'clearColumnFilters',
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
			'selectRows',
			'deselectRows',
			'getFacets',
			'getTotals',
			'getSelectionSummary',
			'setColumnVisibility',
			'toggleColumnVisibility',
			'showAllColumns',
			'hideAllColumns',
			'resetColumnVisibility',
			'resetColumnOrder',
			'resetColumnPinning',
			'moveColumn',
			'setColumnOrder',
			'setColumnWidth',
			'resetColumnWidths',
			'pinColumn',
			'setColumnAggregate',
			'getColumnFormula',
			'setColumnFormula',
			'getAddress',
			'cellAt',
			'getCellFormula',
			'setCellFormula',
			'recalculate',
			'getFormulaSummary',
			'evaluateFormula',
			'getFormulaFunctions',
			'getRangeAddress',
			'movePick',
			'getFormulaReferences',
			'pinRow',
			'scrollToRow',
			'editCell',
			'selectCells',
			'clearCellSelection',
			'copyCells',
			'exportData',
			'pasteCells',
			'clearCells',
			'cutCells',
			'fillCells',
			'formatCells',
			'clearCellFormats',
			'toggleCellFormat',
			'getCellFormat',
			'selectAllCells',
			'selectCellRows',
			'selectCellColumns',
			'undo',
			'redo',
		],
	},
})
