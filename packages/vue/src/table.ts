import { usePart, usePrimitive, type PrimitiveHandle } from '@ui-sdk/vue/primitive'
import {
	cellValue,
	table as tablePrimitive,
	toText,
	type ColumnDef,
	type ColumnPinning,
	type ColumnVisibility,
	type ColumnWidths,
	type DataRow,
	type FilterState,
	type FlatRow,
	type GroupRow,
	type PageState,
	type SortDirection,
	type SortRule,
	type TableChangeDetails,
	type TableCommitDetails,
	type TableController,
	type TableOptions,
} from 'ui-sdk-table-core'
import {
	defineComponent,
	h,
	type ComponentObjectPropsOptions,
	type PropType,
	type PublicProps,
	type SetupContext,
	type TableHTMLAttributes,
	type VNodeChild,
} from 'vue'
import {
	TableBody,
	TableCell,
	TableCol,
	TableFoot,
	TableHead,
	TableHeaderCell,
	TableHeaderRow,
	TablePlainRow,
	TableResizer,
	TableRow,
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
] as const
type Model = (typeof MODELS)[number]

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
] as const

// Vue must know which options are booleans, or the short form `<Table
// resizable>` passes an empty text, which reads as false.
const BOOLEANS: readonly string[] = ['sortChildren', 'resizable', 'reorderable']

export type TableProps<Row> = Omit<TableOptions<Row>, `on${string}`>

const PROPS = Object.fromEntries(
	OPTIONS.map((name) => [
		name,
		BOOLEANS.includes(name) ? { type: Boolean, default: undefined } : null,
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
}

export type HeaderSlotProps<Row> = {
	column: ColumnDef<Row>
	/** The header text: `column.header`, or the column id. */
	label: string
	/** False for a header group, which holds columns and no cells. */
	leaf: boolean
	sort: SortDirection | undefined
	toggleSort: (event?: Event) => void
	pin: 'start' | 'end' | undefined
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
	toggleSelected: (event?: Event) => void
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
	toggleExpanded: (event?: Event) => void
}

export type FootSlotProps<Row> = {
	column: ColumnDef<Row>
	value: unknown
	text: string
}

export type TableSlots<Row> = {
	/** One header cell. `header-{column id}` wins over `header`. */
	[name: `header-${string}`]: (props: HeaderSlotProps<Row>) => VNodeChild
	/** One body cell. `col-{column id}` wins over `cell`. */
	[name: `col-${string}`]: (props: CellSlotProps<Row>) => VNodeChild
	/** One total in the footer. `foot-{column id}` wins over `foot`. */
	[name: `foot-${string}`]: (props: FootSlotProps<Row>) => VNodeChild
} & {
	header?: (props: HeaderSlotProps<Row>) => VNodeChild
	cell?: (props: CellSlotProps<Row>) => VNodeChild
	foot?: (props: FootSlotProps<Row>) => VNodeChild
	group?: (props: GroupSlotProps<Row>) => VNodeChild
	/** Shown in place of the rows when no row passes the filters. */
	empty?: () => VNodeChild
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
			onColumnWidthsCommit: (value: ColumnWidths, details: TableCommitDetails) =>
				(emit as (name: string, ...args: unknown[]) => void)('columnWidthsCommit', value, details),
		}

		const handle = usePrimitive(
			tablePrimitive,
			() => ({ ...props, ...callbacks }) as TableOptions,
		) as Handle
		const api = handle.api

		context.expose({ api } satisfies { api: TableController })

		// The key of a cell part. The two prefixes keep a header cell apart from the
		// cell of a row that has the id "header".
		const headerKey = (columnId: string) => `h|${columnId}`
		const cellId = (rowId: string, columnId: string) => `r|${rowId}|${columnId}`
		const groupKey = (rowId: string) => `g|${rowId}`
		const footKey = (columnId: string) => `f|${columnId}`

		function headerRows() {
			return api.headerRows().map((cells, index) =>
				h(TableHeaderRow, { key: `header-${index}`, index }, () =>
					cells.map((cell) => {
						const column = cell.column
						return h(
							TableHeaderCell,
							{
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
								const toggleSort = (event?: Event) =>
									api.toggleSort(column.id, {
										append: event instanceof MouseEvent && event.shiftKey,
										event,
									})
								const slot = slots[`header-${column.id}`] ?? slots.header
								const content = slot
									? slot({
											column,
											label,
											leaf: cell.leaf,
											sort: cell.leaf ? api.sortOf(column.id) : undefined,
											toggleSort,
											pin: cell.pin,
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
			span: number,
		) {
			return h(TableRow, { key: flat.id, value: flat.id, index }, () =>
				h(TableCell, { value: groupKey(flat.id), row: index, col: 0, colspan: span }, () => {
					const column = api.column(group.columnId)
					const sample = group.leaves[0]
					const text = column && sample ? api.text(sample.row, column) : toText(group.value)
					const toggleExpanded = (event?: Event) => api.toggleExpanded(flat.id, event)
					if (slots.group) {
						return slots.group({
							group,
							column,
							text,
							expanded: flat.expanded,
							level: flat.level,
							totals: api.totals(group),
							toggleExpanded,
						})
					}
					return h(
						'button',
						{ type: 'button', onClick: toggleExpanded },
						`${text} (${group.leaves.length})`,
					)
				}),
			)
		}

		function dataRow(
			flat: FlatRow<unknown>,
			node: DataRow<unknown>,
			index: number,
			columns: readonly ColumnDef[],
		) {
			const toggleSelected = (event?: Event) => api.toggleSelected(flat.id, event)
			const toggleExpanded = (event?: Event) => api.toggleExpanded(flat.id, event)
			return h(
				TableRow,
				{ key: flat.id, value: flat.id, index },
				{
					// The state of the row part is the only thing here that follows the
					// selection, so a new selection renders this row and no other.
					default: ({ state }: { state: { selected: boolean; expanded: boolean } }) =>
						columns.map((column, col) =>
							h(
								TableCell,
								{ key: column.id, value: cellId(flat.id, column.id), row: index, col },
								() => {
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
											toggleSelected,
											toggleExpanded,
										})
									}
									// Without a slot, the first cell of a tree row still needs a way to open it.
									return col === 0 && flat.expandable
										? [
												h(
													'button',
													{ type: 'button', onClick: toggleExpanded },
													state.expanded ? '−' : '+',
												),
												' ',
												text,
											]
										: text
								},
							),
						),
				},
			)
		}

		function footRow(columns: readonly ColumnDef[], index: number) {
			if (!api.footerRowCount()) return null
			const totals = api.totals()
			return h(TableFoot, null, () =>
				h(TablePlainRow, { index }, () =>
					columns.map((column, col) => {
						const value = totals[column.id]
						const text = column.aggregate ? api.totalText(column, value) : ''
						const slot = slots[`foot-${column.id}`] ?? slots.foot
						return h(
							TableCell,
							{ key: column.id, value: footKey(column.id), row: index, col },
							() => (slot ? slot({ column, value, text }) : text),
						)
					}),
				),
			)
		}

		function emptyRow(index: number, span: number) {
			return h(TablePlainRow, { key: 'empty', index, 'data-kind': 'empty' }, () =>
				h(TableCell, { value: 'empty', row: index, col: 0, colspan: span }, () =>
					slots.empty ? slots.empty({}) : api.message('noRows')(),
				),
			)
		}

		return () => {
			// The rows and the columns come from the api, so the render must name the state it depends on.
			const state = handle.state
			void state.revision
			void state.sort
			void state.filter
			void state.groupBy
			void state.page
			void state.expanded
			void state.columnVisibility
			void state.columnOrder
			void state.columnPinning
			void state.columnDrag

			const columns = api.columns()
			const rows = api.rows()
			const head = api.headerRowCount()

			return h(RootPart, { handle, ...attrs }, () => [
				h('colgroup', null, [
					columns.map((column) => h(TableCol, { key: column.id, value: column.id })),
				]),
				h(TableHead, null, headerRows),
				h(TableBody, null, () =>
					rows.length
						? rows.map((flat, position) => {
								const index = head + position
								return flat.node.kind === 'group'
									? groupRow(flat, flat.node, index, columns.length)
									: dataRow(flat, flat.node, index, columns)
							})
						: emptyRow(head, columns.length),
				),
				footRow(columns, head + Math.max(1, rows.length)),
			])
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
