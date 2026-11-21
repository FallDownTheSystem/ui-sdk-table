import { usePart, usePrimitive, type PrimitiveHandle } from '@ui-sdk/vue/primitive'
import { tableArrived } from './controller'
import {
	cellKey,
	cellValue,
	editText,
	table as tablePrimitive,
	toText,
	type CellEdit,
	type CellRange,
	type ColumnDef,
	type ColumnPinning,
	type ColumnVisibility,
	type ColumnWidths,
	type DataRow,
	type FilterState,
	type FlatRow,
	type GroupPathEntry,
	type GroupRow,
	type PageState,
	type RowPin,
	type RowPinning,
	type SortDirection,
	type SortRule,
	type TableChangeDetails,
	type TableCommitDetails,
	type TableController,
	type TableEditDetails,
	type TableOptions,
} from 'ui-sdk-table-core'
import {
	Comment,
	defineComponent,
	h,
	onBeforeUnmount,
	onMounted,
	shallowRef,
	Text,
	type ComponentObjectPropsOptions,
	type PropType,
	type PublicProps,
	type SetupContext,
	type TableHTMLAttributes,
	type VNode,
	type VNodeChild,
} from 'vue'

/**
 * What a slot rendered, or `undefined` when that is nothing a person can
 * see. A slot whose `v-if` is false still gives a list, with a comment in it.
 */
function shown(content: VNodeChild): VNodeChild | undefined {
	const visible = (item: VNodeChild): boolean => {
		if (item === null || item === undefined || typeof item === 'boolean') return false
		if (Array.isArray(item)) return item.some(visible)
		if (typeof item !== 'object') return String(item).trim() !== ''
		const node: VNode = item
		if (node.type === Comment) return false
		// The text of a text node is a string. Any other node shows something.
		return node.type !== Text || typeof node.children !== 'string' || node.children.trim() !== ''
	}
	return visible(content) ? content : undefined
}
import {
	TableBody,
	TableCell,
	TableCol,
	TableEditError,
	TableEditor,
	TableFoot,
	TableHead,
	TableHeaderCell,
	TableHeaderRow,
	TablePlainRow,
	TableResizer,
	TableRow,
	TableSpacer,
} from './parts'

type Handle = PrimitiveHandle<typeof tablePrimitive>

const MODELS = [
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
] as const
type Model = (typeof MODELS)[number]

/** The keys of the state that decide which rows and columns the table has. */
const STRUCTURE = [
	'revision',
	'sort',
	'filter',
	'groupBy',
	'page',
	'expanded',
	'columnVisibility',
	'columnOrder',
	'columnPinning',
	'columnDrag',
	'rowPinning',
	'rowWindow',
] as const

const OPTIONS = [
	'rows',
	'columns',
	'getRowId',
	'getChildren',
	'locale',
	'searchMode',
	'fuzzyThreshold',
	'sortChildren',
	'canGroup',
	'selection',
	'canSelect',
	'resizable',
	'reorderable',
	'columnMinWidth',
	'columnMaxWidth',
	'messages',
	'controller',
	'multiSort',
	'alwaysSorted',
	'searchDebounce',
	'groupTotals',
	'totals',
	'rowWindow',
	'rowHeight',
	'estimatedRowHeight',
	'overscan',
	'stickyHeader',
	'stickyFooter',
	'hasDetail',
	'sheet',
	'history',
	'editable',
	'cellSelection',
	'manualSort',
	'manualFilter',
	'facets',
	'manualPage',
	'rowCount',
	'loading',
	...MODELS,
	'defaultSort',
	'defaultFilter',
	'defaultGroupBy',
	'defaultPage',
	'defaultExpanded',
	'defaultSelected',
	'defaultColumnVisibility',
	'defaultColumnOrder',
	'defaultColumnWidths',
	'defaultColumnPinning',
	'defaultRowPinning',
	'defaultCellRange',
] as const

// Vue must know which options are booleans, or the short form `<Table
// resizable>` passes an empty text, which reads as false.
const BOOLEANS: readonly string[] = [
	'sortChildren',
	'alwaysSorted',
	'groupTotals',
	'resizable',
	'reorderable',
	'rowWindow',
	'stickyHeader',
	'stickyFooter',
	'sheet',
	'editable',
	'cellSelection',
	'manualSort',
	'manualFilter',
	'manualPage',
	'loading',
]

/** What `rowAttrs` gets: which row of the table asks for its attributes. */
export type RowAttrsContext<Row> =
	| { kind: 'header'; index: number }
	| {
			kind: 'row'
			row: Row
			node: DataRow<Row>
			/** The place of the row among the rows of the body, from 0. */
			index: number
			level: number
	  }
	| {
			kind: 'group'
			group: GroupRow<Row>
			index: number
			level: number
			/** The groups from the outermost one down to this group. */
			path: readonly GroupPathEntry<Row>[]
	  }
	| { kind: 'detail'; row: Row; node: DataRow<Row>; index: number }
	| { kind: 'foot' }
	| { kind: 'empty' }

/** What `cellAttrs` gets: which cell of the table asks for its attributes. */
export type CellAttrsContext<Row> =
	| { kind: 'header'; column: ColumnDef<Row>; leaf: boolean }
	| { kind: 'cell'; column: ColumnDef<Row>; row: Row; node: DataRow<Row>; value: unknown }
	| { kind: 'group'; group: GroupRow<Row>; path: readonly GroupPathEntry<Row>[] }
	| {
			/** A cell of a group row under one column: its total, or nothing for a column without one. */
			kind: 'group-total'
			group: GroupRow<Row>
			column: ColumnDef<Row>
			value: unknown
			path: readonly GroupPathEntry<Row>[]
	  }
	| { kind: 'detail'; row: Row; node: DataRow<Row> }
	| { kind: 'foot'; column: ColumnDef<Row> }
	| { kind: 'empty' }

export type PartAttrs = Record<string, unknown>

/**
 * Attributes for the elements that the table renders itself, such as a class
 * or a `data-*` attribute. The table calls `rowAttrs` when it renders its
 * rows, and not for a new selection or a new active cell: show such state
 * with the `data-*` and `aria-*` attributes that the parts carry. A row whose
 * own state changed renders its cells, so `cellAttrs` runs for that row.
 * Pass the same function while its answers are the same, because a new
 * function renders every row again.
 *
 * What the table sets itself stays the table's: the props of its parts
 * (`value`, `index`, `colspan` and the others), `role`, `tabindex`, and the
 * `aria-*` and `data-*` attributes that show its state. Such a name in the
 * answer of the caller is left out.
 */
export type TableAttrsProps<Row> = {
	/** Attributes of a `tr` element. */
	rowAttrs?: (context: RowAttrsContext<Row>) => PartAttrs | undefined
	/** Attributes of a `th` or `td` element. */
	cellAttrs?: (context: CellAttrsContext<Row>) => PartAttrs | undefined
	/** Attributes of the `thead`, `tbody` and `tfoot` elements. */
	sectionAttrs?: { head?: PartAttrs; body?: PartAttrs; foot?: PartAttrs }
}

const ATTRS = ['rowAttrs', 'cellAttrs', 'sectionAttrs'] as const

// The names that belong to the table on the elements it renders: the props
// of the parts, and the attributes that carry its roles and its state. A
// caller that could set them could show a row as selected that is not, or
// give two rows one place.
const OWN_ATTRS: ReadonlySet<string> = new Set([
	'key',
	'value',
	'index',
	'row',
	'col',
	'colspan',
	'rowspan',
	'header',
	'footer',
	'role',
	'tabindex',
	'aria-busy',
	'aria-colcount',
	'aria-colindex',
	'aria-expanded',
	'aria-invalid',
	'aria-level',
	'aria-multiselectable',
	'aria-posinset',
	'aria-readonly',
	'aria-rowcount',
	'aria-rowindex',
	'aria-selected',
	'aria-setsize',
	'aria-sort',
	'data-active',
	'data-cell-selection',
	'data-checking',
	'data-column',
	'data-dragging',
	'data-editable',
	'data-editing',
	'data-empty',
	'data-expanded',
	'data-format',
	'data-grabbed',
	'data-invalid',
	'data-kind',
	'data-lead',
	'data-loading',
	'data-moving',
	'data-pinned',
	'data-pinned-edge',
	'data-range-edge',
	'data-row-window',
	'data-selected',
	'data-sheet',
	'data-sized',
	'data-slot',
	'data-sort-index',
	'data-sorted',
	'data-sticky',
])

// An option that takes `true` or another value. Without `Boolean` in its
// type, the short form `<Table history>` passes an empty text.
const MIXED: Readonly<Record<string, unknown[]>> = { history: [Boolean, Object] }

/** The attributes of a caller without the names that belong to the table. */
function callerAttrs(attrs: PartAttrs | undefined): PartAttrs | undefined {
	if (!attrs) return undefined
	let kept: PartAttrs | undefined
	for (const name in attrs) {
		if (!OWN_ATTRS.has(name)) continue
		// Most answers hold a class and nothing of the table's: they pass as they are.
		kept ??= { ...attrs }
		delete kept[name]
	}
	return kept ?? attrs
}

export type TableProps<Row> = Omit<TableOptions<Row>, `on${string}`> & TableAttrsProps<Row>

const PROPS = Object.fromEntries(
	[...OPTIONS, ...ATTRS].map((name) => [
		name,
		BOOLEANS.includes(name)
			? { type: Boolean, default: undefined }
			: name in MIXED
				? { type: MIXED[name], default: undefined }
				: null,
	]),
) as ComponentObjectPropsOptions<TableProps<unknown>>

export type TableEmits = {
	'update:sort': (value: readonly SortRule[]) => void
	'update:filter': (value: FilterState) => void
	'update:groupBy': (value: readonly string[]) => void
	'update:page': (value: PageState | undefined) => void
	'update:expanded': (value: readonly string[]) => void
	'update:selected': (value: string[]) => void
	'update:columnVisibility': (value: ColumnVisibility) => void
	'update:columnOrder': (value: readonly string[]) => void
	'update:columnWidths': (value: ColumnWidths) => void
	'update:columnPinning': (value: ColumnPinning) => void
	'update:rowPinning': (value: RowPinning) => void
	'update:cellRange': (value: CellRange | null) => void
	sortChange: (value: readonly SortRule[], details: TableChangeDetails) => void
	filterChange: (value: FilterState, details: TableChangeDetails) => void
	groupByChange: (value: readonly string[], details: TableChangeDetails) => void
	pageChange: (value: PageState | undefined, details: TableChangeDetails) => void
	expandedChange: (value: readonly string[], details: TableChangeDetails) => void
	selectedChange: (value: string[], details: TableChangeDetails) => void
	columnVisibilityChange: (value: ColumnVisibility, details: TableChangeDetails) => void
	columnOrderChange: (value: readonly string[], details: TableChangeDetails) => void
	columnWidthsChange: (value: ColumnWidths, details: TableChangeDetails) => void
	columnWidthsCommit: (value: ColumnWidths, details: TableCommitDetails) => void
	columnPinningChange: (value: ColumnPinning, details: TableChangeDetails) => void
	rowPinningChange: (value: RowPinning, details: TableChangeDetails) => void
	cellRangeChange: (value: CellRange | null, details: TableChangeDetails) => void
	cellRangeCommit: (value: CellRange | null, details: TableCommitDetails) => void
	/** Cells got new values. Put them into the rows; `details.cancel()` refuses them. */
	cellEdit: (edits: readonly CellEdit<any>[], details: TableEditDetails) => void
}

export type HeaderSlotProps<Row> = {
	column: ColumnDef<Row>
	/** The header text: `column.header`, or the column id. */
	label: string
	/** False for a header group, which holds columns and no cells. */
	leaf: boolean
	sort: SortDirection | undefined
	/** The place of the column in the sort, from 1. With several columns in the sort, the first one sorts first. */
	sortIndex: number | undefined
	toggleSort: (event?: Event) => void
	pin: 'start' | 'end' | undefined
	/**
	 * Selects the cells of the column, for a control in its header. With
	 * Shift in the event, the columns from the active cell to this one. It
	 * throws for a header group and without the `cellSelection` option.
	 */
	selectColumn: (event?: Event) => void
}

export type CellSlotProps<Row> = {
	row: Row
	node: DataRow<Row>
	column: ColumnDef<Row>
	value: unknown
	/** The value as text, with the format of the column. */
	text: string
	selected: boolean
	expanded: boolean
	expandable: boolean
	/** Tree and group levels above this row, from 0. */
	level: number
	/** The edge that the row is pinned to. */
	pinned: RowPin | undefined
	toggleSelected: (event?: Event) => void
	toggleExpanded: (event?: Event) => void
}

export type EditorSlotProps<Row> = {
	row: Row
	node: DataRow<Row>
	column: ColumnDef<Row>
	value: unknown
	/** The value as plain text, as the text field of the table shows it. */
	text: string
	/** Why the last value was refused. */
	error: string | undefined
	/** A check that takes time runs for a saved value. A save does nothing until it answers. */
	checking: boolean
	/**
	 * How the editor was opened. `replace`: the person typed a character on
	 * the cell, which is `typed`, and means to write over the value. `edit`:
	 * Enter, F2, a double press or code opened it, to change the value.
	 */
	mode: 'replace' | 'edit'
	/** The character that opened the editor, or `undefined`. */
	typed: string | undefined
	/**
	 * Saves a value, with the check of the column, and closes the editor. A
	 * value that is refused keeps the editor open, and `error` says why.
	 */
	save: (value: unknown, event?: Event) => void
	/** Closes the editor without a save. Focus goes back to the cell. */
	cancel: () => void
}

export type DetailSlotProps<Row> = {
	row: Row
	node: DataRow<Row>
	/** Closes the detail row. */
	toggleExpanded: (event?: Event) => void
}

export type GroupSlotProps<Row> = {
	group: GroupRow<Row>
	column: ColumnDef<Row> | undefined
	/** The value of the group as text, with the format of its column. */
	text: string
	expanded: boolean
	level: number
	/** Column totals of the rows in the group. */
	totals: Record<string, unknown>
	/** The totals as text, with the format of their columns, by column id. */
	totalTexts: Record<string, string>
	/**
	 * The groups from the outermost one down to this group, each with its
	 * column, its value and its text: "Europe", then "Finland".
	 */
	path: readonly GroupPathEntry<Row>[]
	/**
	 * The columns that this cell covers. With totals under their columns, a
	 * total of one of these columns has no cell of its own.
	 */
	covered: readonly ColumnDef<Row>[]
	toggleExpanded: (event?: Event) => void
}

export type GroupTotalSlotProps<Row> = {
	group: GroupRow<Row>
	column: ColumnDef<Row>
	/** The total of the column over the rows of the group. `undefined` for a column without an `aggregate`. */
	value: unknown
	/** The total as text, with the format of the column, or an empty text. */
	text: string
	/** The totals of every column that has one, by column id. */
	totals: Record<string, unknown>
	expanded: boolean
	level: number
	path: readonly GroupPathEntry<Row>[]
}

export type FootSlotProps<Row> = {
	column: ColumnDef<Row>
	value: unknown
	text: string
	/** The totals of every column that has one, by column id. */
	totals: Record<string, unknown>
}

export type TableSlots<Row> = {
	/** One header cell. `header-{column id}` wins over `header`. */
	[name: `header-${string}`]: (props: HeaderSlotProps<Row>) => VNodeChild
	/** One body cell. `col-{column id}` wins over `cell`. */
	[name: `col-${string}`]: (props: CellSlotProps<Row>) => VNodeChild
	/** One total in the footer. `foot-{column id}` wins over `foot`. */
	[name: `foot-${string}`]: (props: FootSlotProps<Row>) => VNodeChild
	/**
	 * The cell of a group row under one column, which holds the total of the
	 * group for that column. `group-total-{column id}` wins over `group-total`.
	 */
	[name: `group-total-${string}`]: (props: GroupTotalSlotProps<Row>) => VNodeChild
	/**
	 * The editor of one cell, in place of the text field of the table.
	 * `edit-{column id}` wins over `editor`. The control must take focus itself.
	 */
	[name: `edit-${string}`]: (props: EditorSlotProps<Row>) => VNodeChild
} & {
	editor?: (props: EditorSlotProps<Row>) => VNodeChild
	header?: (props: HeaderSlotProps<Row>) => VNodeChild
	cell?: (props: CellSlotProps<Row>) => VNodeChild
	foot?: (props: FootSlotProps<Row>) => VNodeChild
	/** The label cell of a group row. */
	group?: (props: GroupSlotProps<Row>) => VNodeChild
	'group-total'?: (props: GroupTotalSlotProps<Row>) => VNodeChild
	/** The detail row of a row, for the rows that `hasDetail` names. */
	detail?: (props: DetailSlotProps<Row>) => VNodeChild
	/** Shown in place of the rows when no row passes the filters. */
	empty?: () => VNodeChild
	/** Shown in place of the rows while `loading` is set and the table has no rows. */
	loading?: () => VNodeChild
}

// `usePart` gives the render function of a component, so the root element needs a component of its own.
const RootPart = defineComponent({
	name: 'TableRootPart',
	inheritAttrs: false,
	props: { handle: { type: Object as PropType<Handle>, required: true } },
	setup: (props) => usePart(props.handle, 'root', undefined, undefined, 'table'),
})

const TableImpl = defineComponent(
	(props: TableProps<unknown>, context: SetupContext) => {
		const { emit, attrs } = context
		const slots = context.slots as Record<string, ((props: any) => VNodeChild) | undefined>

		function report(key: Model) {
			return (value: unknown, details: TableChangeDetails) => {
				const send = emit as (name: string, ...args: unknown[]) => void
				send(`${key}Change`, value, details)
				// A listener can refuse the change. Then `v-model` must not take the value.
				if (!details.canceled) send(`update:${key}`, value)
			}
		}

		const callbacks = {
			onSortChange: report('sort'),
			onFilterChange: report('filter'),
			onGroupByChange: report('groupBy'),
			onPageChange: report('page'),
			onExpandedChange: report('expanded'),
			onSelectedChange: report('selected'),
			onColumnVisibilityChange: report('columnVisibility'),
			onColumnOrderChange: report('columnOrder'),
			onColumnWidthsChange: report('columnWidths'),
			onColumnPinningChange: report('columnPinning'),
			onRowPinningChange: report('rowPinning'),
			onCellRangeChange: report('cellRange'),
			onCellRangeCommit: (value: CellRange | null, details: TableCommitDetails) =>
				(emit as (name: string, ...args: unknown[]) => void)('cellRangeCommit', value, details),
			onCellEdit: (edits: readonly CellEdit[], details: TableEditDetails) =>
				(emit as (name: string, ...args: unknown[]) => void)('cellEdit', edits, details),
			onColumnWidthsCommit: (value: ColumnWidths, details: TableCommitDetails) =>
				(emit as (name: string, ...args: unknown[]) => void)('columnWidthsCommit', value, details),
		}

		const handle = usePrimitive(tablePrimitive, () => {
			// The primitive gets its own options only: the attribute props are for this component.
			const options: Record<string, unknown> = { ...callbacks }
			for (const name of OPTIONS) options[name] = props[name]
			return options as TableOptions
		}) as Handle
		const api = handle.api

		const rowAttrs = (context: RowAttrsContext<unknown>) => callerAttrs(props.rowAttrs?.(context))
		const cellAttrs = (context: CellAttrsContext<unknown>) =>
			callerAttrs(props.cellAttrs?.(context))
		const sectionAttrs = (section: 'head' | 'body' | 'foot') =>
			callerAttrs(props.sectionAttrs?.[section]) ?? null

		context.expose({ api } satisfies { api: TableController })

		// A listener that was given to the controller before this table existed starts now.
		onMounted(() => tableArrived(props.controller))

		// The key of a cell part. The two prefixes keep a header cell apart from the
		// cell of a row that has the id "header".
		const headerKey = (columnId: string) => `h|${columnId}`
		const cellId = (rowId: string, columnId: string) => `r|${rowId}|${columnId}`
		const groupKey = (rowId: string) => `g|${rowId}`
		const groupTotalKey = (rowId: string, columnId: string) => `t|${rowId}|${columnId}`
		const detailKey = (rowId: string) => `d|${rowId}`
		const footKey = (columnId: string) => `f|${columnId}`

		function headerRows() {
			return api.headerRows().map((cells, index) =>
				h(
					TableHeaderRow,
					{ ...rowAttrs({ kind: 'header', index }), key: `header-${index}`, index },
					() =>
						cells.map((cell) => {
							const column = cell.column
							return h(
								TableHeaderCell,
								{
									...cellAttrs({ kind: 'header', column, leaf: cell.leaf }),
									// The key is the column, so the element stays with its column when the order changes.
									key: cell.key,
									value: headerKey(cell.key),
									row: cell.row,
									col: cell.col,
									colspan: cell.colSpan,
									rowspan: cell.rowSpan,
									header: true,
								},
								() => {
									const label = column.header ?? column.id
									// The mode of the table reads the modifier keys of the event.
									const toggleSort = (event?: Event) => api.toggleSort(column.id, { event })
									const slot = slots[`header-${column.id}`] ?? slots.header
									const content = slot
										? slot({
												column,
												label,
												leaf: cell.leaf,
												sort: cell.leaf ? api.sortOf(column.id) : undefined,
												sortIndex: cell.leaf ? api.sortIndexOf(column.id) : undefined,
												toggleSort,
												pin: cell.pin,
												selectColumn: (event?: Event) => {
													if (!cell.leaf) {
														throw new Error(
															`"${column.id}" is a header group. \`selectColumn\` selects the cells of one column.`,
														)
													}
													api.selectColumnCells(column.id, event)
												},
											})
										: cell.leaf && column.sortable
											? h('button', { type: 'button', onClick: toggleSort }, label)
											: label
									if (!cell.leaf || !api.canResize(column.id)) return content
									return [content, h(TableResizer, { key: 'resizer', value: column.id })]
								},
							)
						}),
				),
			)
		}

		function groupRow(
			flat: FlatRow<unknown>,
			group: GroupRow<unknown>,
			index: number,
			position: number,
			columns: readonly ColumnDef[],
		) {
			const path = api.groupPath(group)
			// With totals under their columns, the label covers the first columns
			// and each column after them has a cell. Else the label is the row.
			const split = api.groupSpan()
			const span = split ?? columns.length
			const covered = columns.slice(0, span)
			const attrs = rowAttrs({ kind: 'group', group, index: position, level: flat.level, path })

			const label = () => {
				const column = api.column(group.columnId)
				const text = path.at(-1)?.text ?? toText(group.value)
				const toggleExpanded = (event?: Event) => api.toggleExpanded(flat.id, event)
				if (slots.group) {
					const totals = api.totals(group)
					const totalTexts: Record<string, string> = {}
					for (const total of api.allColumns()) {
						if (total.aggregate !== undefined) {
							totalTexts[total.id] = api.totalText(total, totals[total.id])
						}
					}
					return slots.group({
						group,
						column,
						text,
						expanded: flat.expanded,
						level: flat.level,
						totals,
						totalTexts,
						path,
						covered,
						toggleExpanded,
					})
				}
				const button = h(
					'button',
					{ type: 'button', onClick: toggleExpanded },
					api.groupText(group),
				)
				// A total of a column under the label has no cell of its own, so the label says it.
				const hidden = split === undefined ? [] : covered.filter((total) => total.aggregate)
				if (!hidden.length) return button
				const totals = api.totals(group)
				return [button, ...hidden.map((total) => ` ${api.totalText(total, totals[total.id])}`)]
			}

			return h(TableRow, { ...attrs, key: flat.id, value: flat.id, index }, () => [
				h(
					TableCell,
					{
						...cellAttrs({ kind: 'group', group, path }),
						key: 'label',
						value: groupKey(flat.id),
						row: index,
						col: 0,
						colspan: span,
					},
					label,
				),
				...columns.slice(span).map((column, offset) => {
					const totals = api.totals(group)
					const value = totals[column.id]
					const text = column.aggregate ? api.totalText(column, value) : ''
					const slot = slots[`group-total-${column.id}`] ?? slots['group-total']
					return h(
						TableCell,
						{
							...cellAttrs({ kind: 'group-total', group, column, value, path }),
							key: column.id,
							value: groupTotalKey(flat.id, column.id),
							row: index,
							col: span + offset,
						},
						() =>
							slot
								? slot({
										group,
										column,
										value,
										text,
										totals,
										expanded: flat.expanded,
										level: flat.level,
										path,
									})
								: text,
					)
				}),
			])
		}

		function dataRow(
			flat: FlatRow<unknown>,
			node: DataRow<unknown>,
			index: number,
			position: number,
			columns: readonly ColumnDef[],
		) {
			const toggleSelected = (event?: Event) => api.toggleSelected(flat.id, event)
			const toggleExpanded = (event?: Event) => api.toggleExpanded(flat.id, event)
			type RowState = { selected: boolean; expanded: boolean }

			function content(column: ColumnDef, col: number, state: RowState) {
				const text = api.text(node.row, column)
				const slot = slots[`col-${column.id}`] ?? slots.cell
				if (slot) {
					return slot({
						row: node.row,
						node,
						column,
						value: cellValue(node.row, column),
						text,
						selected: state.selected,
						expanded: state.expanded,
						expandable: flat.expandable,
						level: flat.level,
						pinned: flat.pinned,
						toggleSelected,
						toggleExpanded,
					})
				}
				// Without a slot, the first cell of a tree row still needs a way to open it.
				return col === 0 && flat.expandable
					? [
							h(
								'button',
								{
									type: 'button',
									'aria-label': api.message(state.expanded ? 'collapseRow' : 'expandRow')(),
									onClick: toggleExpanded,
								},
								api.message(state.expanded ? 'collapseSign' : 'expandSign')(),
							),
							' ',
							text,
						]
					: text
			}

			return h(
				TableRow,
				{
					...rowAttrs({ kind: 'row', row: node.row, node, index: position, level: flat.level }),
					key: flat.id,
					value: flat.id,
					index,
				},
				{
					// The state of the row part is the only thing here that follows the
					// selection, so a new selection renders this row and no other.
					default: ({ state }: { state: RowState }) =>
						columns.map((column, col) =>
							h(
								TableCell,
								{
									...(props.cellAttrs
										? cellAttrs({
												kind: 'cell',
												column,
												row: node.row,
												node,
												value: cellValue(node.row, column),
											})
										: undefined),
									key: column.id,
									value: cellId(flat.id, column.id),
									row: index,
									col,
								},
								{
									// The state of the cell part says whether its editor is open,
									// so the start and the end of an edit render one cell.
									default: (cell: {
										state: { editing: boolean; checking: boolean; error?: string }
									}) =>
										cell.state.editing
											? editor(node, column, cell.state.error, cell.state.checking)
											: content(column, col, state),
								},
							),
						),
				},
			)
		}

		function editor(
			node: DataRow<unknown>,
			column: ColumnDef,
			error: string | undefined,
			checking: boolean,
		) {
			const id = cellKey(node.id, column.id)
			const slot = slots[`edit-${column.id}`] ?? slots.editor
			if (slot) {
				return slot({
					row: node.row,
					node,
					column,
					value: cellValue(node.row, column),
					text: editText(node.row, column),
					error,
					checking,
					mode: api.edit.mode() ?? 'edit',
					typed: api.edit.typed(),
					save: (value: unknown, event?: Event) => api.saveEdit(value, event),
					cancel: () => api.cancelEdit(),
				})
			}
			return [
				h(TableEditor, { key: 'editor', value: id }),
				error === undefined ? null : h(TableEditError, { key: 'error', value: id }, () => error),
			]
		}

		function detailRow(
			flat: FlatRow<unknown>,
			node: DataRow<unknown>,
			index: number,
			position: number,
			span: number,
		) {
			const attrs = rowAttrs({ kind: 'detail', row: node.row, node, index: position })
			return h(TableRow, { ...attrs, key: flat.id, value: flat.id, index }, () =>
				h(
					TableCell,
					{
						...cellAttrs({ kind: 'detail', row: node.row, node }),
						value: detailKey(node.id),
						row: index,
						col: 0,
						colspan: span,
					},
					() =>
						slots.detail?.({
							row: node.row,
							node,
							toggleExpanded: (event?: Event) => api.toggleExpanded(node.id, event),
						}),
				),
			)
		}

		function bodyRow(flat: FlatRow<unknown>, index: number, columns: readonly ColumnDef[]) {
			// The grid counts the header rows first. A caller counts the rows of the body.
			const position = index - api.headerRowCount()
			if (flat.node.kind === 'group') {
				return groupRow(flat, flat.node, index, position, columns)
			}
			if (flat.detail) return detailRow(flat, flat.node, index, position, columns.length)
			return dataRow(flat, flat.node, index, position, columns)
		}

		/**
		 * The rows of the body. With a row window, the rows of the list that are
		 * not near the scroll frame give way to spacers; the pinned rows are
		 * always there.
		 */
		function bodyRows(
			rows: readonly FlatRow<unknown>[],
			head: number,
			columns: readonly ColumnDef[],
		) {
			const parts = api.windowParts()
			if (!parts) return rows.map((flat, position) => bodyRow(flat, head + position, columns))
			const { top, bottom } = api.pinnedRows()
			const list = api.listRows()
			const first = head + top.length
			const rendered: VNodeChild[] = top.map((flat, position) =>
				bodyRow(flat, head + position, columns),
			)
			for (const part of parts) {
				if (part.kind === 'gap') {
					rendered.push(h(TableSpacer, { key: part.key, value: part.key, size: part.size }))
					continue
				}
				for (let position = part.from; position < part.to; position++) {
					const flat = list[position]
					if (flat) rendered.push(bodyRow(flat, first + position, columns))
				}
			}
			bottom.forEach((flat, position) =>
				rendered.push(bodyRow(flat, first + list.length + position, columns)),
			)
			return rendered
		}

		function footRow(columns: readonly ColumnDef[], index: number) {
			if (!api.footerRowCount()) return null
			const totals = api.totals()
			return h(TableFoot, sectionAttrs('foot'), () =>
				h(TablePlainRow, { ...rowAttrs({ kind: 'foot' }), index, footer: true }, () =>
					columns.map((column, col) => {
						const value = totals[column.id]
						const text = column.aggregate ? api.totalText(column, value) : ''
						const slot = slots[`foot-${column.id}`] ?? slots.foot
						return h(
							TableCell,
							{
								...cellAttrs({ kind: 'foot', column }),
								key: column.id,
								value: footKey(column.id),
								row: index,
								col,
							},
							() => (slot ? slot({ column, value, text, totals }) : text),
						)
					}),
				),
			)
		}

		function emptyRow(index: number, span: number) {
			const attrs = rowAttrs({ kind: 'empty' })
			return h(TablePlainRow, { ...attrs, key: 'empty', index, 'data-kind': 'empty' }, () =>
				h(
					TableCell,
					{ ...cellAttrs({ kind: 'empty' }), value: 'empty', row: index, col: 0, colspan: span },
					() =>
						api.loading()
							? (shown(slots.loading?.({})) ?? api.message('loading')())
							: (shown(slots.empty?.({})) ?? api.message('noRows')()),
				),
			)
		}

		// The rows and the columns come from the api, and the api is not reactive.
		// So this number goes up when a key of the state changes that decides
		// which rows and columns there are, and the render reads the number. A
		// read of `handle.state` would render every row again for each row that
		// is selected and for each step of a resize: it follows the state as a whole.
		const structure = shallowRef(0)
		const read = () => {
			const state = handle.instance.get()
			return STRUCTURE.map((key) => state[key])
		}
		let seen = read()
		onBeforeUnmount(
			handle.instance.subscribe(() => {
				const next = read()
				if (next.some((value, index) => value !== seen[index])) structure.value++
				seen = next
			}),
		)

		function content() {
			const columns = api.columns()
			const rows = api.rows()
			const head = api.headerRowCount()
			return [
				h('colgroup', null, [
					columns.map((column) => h(TableCol, { key: column.id, value: column.id })),
				]),
				h(TableHead, sectionAttrs('head'), headerRows),
				h(TableBody, sectionAttrs('body'), () =>
					rows.length ? bodyRows(rows, head, columns) : emptyRow(head, columns.length),
				),
				footRow(columns, head + Math.max(1, rows.length)),
			]
		}

		return () => {
			// An option can change what a part shows without a change of state: a
			// locale, a message, whether columns resize. So every option is read here,
			// and a new value renders the table again.
			for (const name of OPTIONS) void props[name]
			for (const name of ATTRS) void props[name]
			void structure.value
			// A new function at each render: the root part then renders its content again.
			return h(RootPart, { handle, ...attrs }, () => content())
		}
	},
	{ name: 'Table', inheritAttrs: false, props: PROPS },
)

type TableListeners = {
	[Name in keyof TableEmits as `on${Capitalize<Name>}`]?: TableEmits[Name]
}

export type TableInstance<Row> = {
	$props: TableProps<Row> & TableListeners & PublicProps & TableHTMLAttributes
	$slots: Readonly<TableSlots<Row>>
	$emit: <Name extends keyof TableEmits>(name: Name, ...args: Parameters<TableEmits[Name]>) => void
	/** The methods of the table, the same as on a controller. */
	api: TableController
}

/**
 * A table without styles. It renders `table`, `thead`, `tbody`, `tr`, `th`
 * and `td` elements with the grid roles, keyboard navigation and state of the
 * table primitive. Each cell is a slot, and each state has a `v-model`.
 *
 * The component is generic in the row type. Vue cannot state that for a
 * component with dynamic slot names, so the type is given here by hand.
 */
export const Table = TableImpl as unknown as new <Row>(
	props: TableInstance<Row>['$props'],
) => TableInstance<Row>
