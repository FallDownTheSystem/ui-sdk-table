import { usePart, usePrimitive, type PrimitiveHandle } from '@ui-sdk/vue/primitive'
import {
	cellValue,
	table as tablePrimitive,
	toText,
	type ColumnDef,
	type DataRow,
	type FilterState,
	type FlatRow,
	type GroupRow,
	type PageState,
	type SortDirection,
	type SortRule,
	type TableChangeDetails,
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
	TableFoot,
	TableHead,
	TableHeaderCell,
	TableHeaderRow,
	TableRow,
} from './parts'

type Handle = PrimitiveHandle<typeof tablePrimitive>

const MODELS = ['sort', 'filter', 'groupBy', 'page', 'expanded', 'selected'] as const
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
	'controller',
	...MODELS,
	'defaultSort',
	'defaultFilter',
	'defaultGroupBy',
	'defaultPage',
	'defaultExpanded',
	'defaultSelected',
] as const

export type TableProps<Row> = Omit<TableOptions<Row>, `on${string}`>

// `sortChildren` is the one boolean option. Vue must know that, or the short
// form `<Table sort-children>` passes an empty text, which reads as false.
const PROPS = Object.fromEntries(
	OPTIONS.map((name) => [
		name,
		name === 'sortChildren' ? { type: Boolean, default: undefined } : null,
	]),
) as ComponentObjectPropsOptions<TableProps<unknown>>

export type TableEmits = {
	'update:sort': (value: readonly SortRule[]) => void
	'update:filter': (value: FilterState) => void
	'update:groupBy': (value: readonly string[]) => void
	'update:page': (value: PageState | undefined) => void
	'update:expanded': (value: readonly string[]) => void
	'update:selected': (value: string[]) => void
	sortChange: (value: readonly SortRule[], details: TableChangeDetails) => void
	filterChange: (value: FilterState, details: TableChangeDetails) => void
	groupByChange: (value: readonly string[], details: TableChangeDetails) => void
	pageChange: (value: PageState | undefined, details: TableChangeDetails) => void
	expandedChange: (value: readonly string[], details: TableChangeDetails) => void
	selectedChange: (value: string[], details: TableChangeDetails) => void
}

export type HeaderSlotProps<Row> = {
	column: ColumnDef<Row>
	/** The header text: `column.header`, or the column id. */
	label: string
	sort: SortDirection | undefined
	toggleSort: (event?: Event) => void
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

		function headerRow(columns: readonly ColumnDef[]) {
			return h(TableHeaderRow, { key: 'header', index: 0 }, () =>
				columns.map((column, col) =>
					h(
						TableHeaderCell,
						{ key: column.id, value: headerKey(column.id), row: 0, col, header: true },
						() => {
							const label = column.header ?? column.id
							const toggleSort = (event?: Event) =>
								api.toggleSort(column.id, {
									append: event instanceof MouseEvent && event.shiftKey,
									event,
								})
							const slot = slots[`header-${column.id}`] ?? slots.header
							if (slot) return slot({ column, label, sort: api.sortOf(column.id), toggleSort })
							return column.sortable
								? h('button', { type: 'button', onClick: toggleSort }, label)
								: label
						},
					),
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
				h(TableCell, { value: `g|${flat.id}`, row: index, col: 0, colspan: span }, () => {
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

		function footRow(columns: readonly ColumnDef[]) {
			if (!columns.some((column) => column.aggregate)) return null
			const totals = api.totals()
			return h(TableFoot, null, () =>
				h('tr', { role: 'row' }, [
					columns.map((column) => {
						const value = totals[column.id]
						const text = column.aggregate ? api.totalText(column, value) : ''
						const slot = slots[`foot-${column.id}`] ?? slots.foot
						return h(
							'td',
							{ key: column.id, role: 'gridcell', 'data-column': column.id },
							slot ? [slot({ column, value, text })] : text,
						)
					}),
				]),
			)
		}

		return () => {
			// The list of rows comes from the api, so the render must name the state it depends on.
			const state = handle.state
			void state.revision
			void state.sort
			void state.filter
			void state.groupBy
			void state.page
			void state.expanded

			const columns = api.columns()
			const rows = api.rows()

			return h(RootPart, { handle, ...attrs }, () => [
				h(TableHead, null, () => headerRow(columns)),
				h(TableBody, null, () =>
					rows.length || !slots.empty
						? rows.map((flat, position) => {
								const index = position + 1
								return flat.node.kind === 'group'
									? groupRow(flat, flat.node, index, columns.length)
									: dataRow(flat, flat.node, index, columns)
							})
						: h('tr', { role: 'row' }, [
								h('td', { role: 'gridcell', colspan: columns.length }, [slots.empty({})]),
							]),
				),
				footRow(columns),
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
