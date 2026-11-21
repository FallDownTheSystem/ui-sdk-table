<script setup lang="ts" generic="Row">
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronsUpDownIcon,
	MinusIcon,
} from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import {
	cellValue,
	createTableController,
	isNumericFormat,
	linkOf,
	Table,
	toText,
	type CellAttrsContext,
	type CellSlotProps,
	type ColumnDef,
	type GroupSlotProps,
	type RowAttrsContext,
	type TableInstance,
	type TableView,
} from 'ui-sdk-table-vue'
import { computed, onBeforeUnmount, onMounted, provide, shallowRef, watch } from 'vue'
import { cn } from '@/lib/utils'
import DataTableCheckbox from './DataTableCheckbox.vue'
import { buttonClass, skeletonClass } from './DataTableClasses'
import DataTableEmpty from './DataTableEmpty.vue'
import DataTableExpandAll from './DataTableExpandAll.vue'
import DataTablePagination from './DataTablePagination.vue'
import DataTableSelectAll from './DataTableSelectAll.vue'
import DataTableToolbar from './DataTableToolbar.vue'
import { resolveMessages } from './messages'
import {
	DATA_TABLE_CONTEXT,
	EXPAND_COLUMN,
	SELECT_COLUMN,
	VIEW_KEYS,
	type DataTableColumn,
	type DataTableColumnMeta,
	type DataTableEmits,
	type DataTableProps,
	type DataTableSlots,
} from './types'

const props = withDefaults(defineProps<DataTableProps<Row>>(), {
	pageSizes: () => [10, 25, 50, 100],
	width: 'full',
	scroll: 'self',
	skeletonRows: 3,
	// An option of the table that is not set must reach the table as "not
	// set", so the table keeps its own default. Vue reads a boolean that is
	// not set as false.
	sortChildren: undefined,
	resizable: undefined,
	reorderable: undefined,
	rowWindow: undefined,
	stickyHeader: undefined,
	stickyFooter: undefined,
	editable: undefined,
	cellSelection: undefined,
	manualSort: undefined,
	manualFilter: undefined,
	manualPage: undefined,
	loading: undefined,
})

const emit = defineEmits<DataTableEmits>()
const slots = defineSlots<DataTableSlots<Row>>()

const controller = props.controller ?? createTableController()
const messages = computed(() => resolveMessages(props.messages))
const label = computed(() => props.label ?? '')

// What the controls show comes from the table, and the table is not
// reactive. So the view is read again after each change that a control shows.
const view = shallowRef<TableView>()
const refresh = () => {
	view.value = controller.getView()
}
let stop: (() => void) | undefined
onMounted(() => {
	// The ids of groups come from the rows, so the table opens them itself.
	// It happens before the first paint: nobody sees the closed groups.
	if (props.defaultExpanded === 'all' && !props.expanded) controller.expandAll()
	refresh()
	stop = controller.subscribe((changed) => {
		if (changed.some((key) => VIEW_KEYS.includes(key))) refresh()
	})
})
onBeforeUnmount(() => stop?.())
// An option can change what a control shows without a change of state.
watch(
	() => [props.loading, props.selection, props.canSelect, props.locale, props.rowCount],
	refresh,
	{ flush: 'post' },
)

provide(DATA_TABLE_CONTEXT, { controller, view, messages, label })

const exportOptions = computed(() =>
	props.export === true ? {} : props.export ? props.export : undefined,
)
const hasToolbar = computed(
	() =>
		props.search ||
		props.columnFilters ||
		props.columnMenu ||
		exportOptions.value !== undefined ||
		!!slots.toolbar,
)

const hasExpandColumn = computed(() => !!props.hasDetail || !!props.getChildren)

// The two columns of the styled table hold a control and no value: they take
// no part in the search, a filter, an export or the list of columns.
const own = (id: string, width: number): ColumnDef<Row> => ({
	id,
	header: '',
	value: () => undefined,
	width,
	sortable: false,
	searchable: false,
	groupable: false,
	hideable: false,
	resizable: false,
	reorderable: false,
	editable: false,
	exportable: false,
})

const columns = computed<readonly ColumnDef<Row>[]>(() => [
	...(props.selection ? [own(SELECT_COLUMN, 40)] : []),
	...(hasExpandColumn.value ? [own(EXPAND_COLUMN, 40)] : []),
	...(props.columns ?? []),
])

/** The first column of the caller that holds cells. Its text names a row for a checkbox or a button. */
const nameColumn = computed(() => {
	let found: DataTableColumn<Row> | undefined = props.columns?.[0]
	while (found?.columns?.length) found = found.columns[0]
	return found
})
const rowName = (row: Row) => {
	const column = nameColumn.value
	return column ? toText(cellValue(row, column)) : ''
}

const tableMessages = computed(() => messages.value)

/** The options and the state of the caller, as the table takes them. */
const tableProps = computed<TableInstance<Row>['$props']>(() => ({
	rows: props.rows,
	columns: columns.value,
	getRowId: props.getRowId,
	getChildren: props.getChildren,
	locale: props.locale,
	searchMode: props.searchMode,
	fuzzyThreshold: props.fuzzyThreshold,
	sortChildren: props.sortChildren,
	canGroup: props.canGroup,
	selection: props.selection,
	canSelect: props.canSelect,
	resizable: props.resizable,
	reorderable: props.reorderable,
	columnMinWidth: props.columnMinWidth,
	columnMaxWidth: props.columnMaxWidth,
	messages: tableMessages.value,
	controller,
	rowWindow: props.rowWindow,
	rowHeight: props.rowHeight,
	estimatedRowHeight: props.estimatedRowHeight,
	overscan: props.overscan,
	stickyHeader: props.stickyHeader,
	stickyFooter: props.stickyFooter,
	hasDetail: props.hasDetail,
	editable: props.editable,
	cellSelection: props.cellSelection,
	manualSort: props.manualSort,
	manualFilter: props.manualFilter,
	manualPage: props.manualPage,
	rowCount: props.rowCount,
	loading: props.loading,
	sort: props.sort,
	defaultSort: props.defaultSort,
	filter: props.filter,
	defaultFilter: props.defaultFilter,
	groupBy: props.groupBy,
	defaultGroupBy: props.defaultGroupBy,
	page: props.page,
	// With `pagination` and no page of the caller, the table starts on its first page.
	defaultPage:
		props.defaultPage ??
		(props.pagination && !props.page ? { page: 1, pageSize: props.pageSizes[0] ?? 10 } : undefined),
	expanded: props.expanded,
	defaultExpanded: props.defaultExpanded === 'all' ? undefined : props.defaultExpanded,
	selected: props.selected,
	defaultSelected: props.defaultSelected,
	columnVisibility: props.columnVisibility,
	defaultColumnVisibility: props.defaultColumnVisibility,
	columnOrder: props.columnOrder,
	defaultColumnOrder: props.defaultColumnOrder,
	columnWidths: props.columnWidths,
	defaultColumnWidths: props.defaultColumnWidths,
	columnPinning: props.columnPinning,
	defaultColumnPinning: props.defaultColumnPinning,
	rowPinning: props.rowPinning,
	defaultRowPinning: props.defaultRowPinning,
	cellRange: props.cellRange,
	defaultCellRange: props.defaultCellRange,
}))

// Every event of the table goes on to the caller under its own name. The
// table sends the change first and the `update:` after it, and not at all
// when a listener cancels the change; that order stays.
const listeners: TableInstance<Row>['$props'] = {
	'onUpdate:sort': (value) => emit('update:sort', value),
	'onUpdate:filter': (value) => emit('update:filter', value),
	'onUpdate:groupBy': (value) => emit('update:groupBy', value),
	'onUpdate:page': (value) => emit('update:page', value),
	'onUpdate:expanded': (value) => emit('update:expanded', value),
	'onUpdate:selected': (value) => emit('update:selected', value),
	'onUpdate:columnVisibility': (value) => emit('update:columnVisibility', value),
	'onUpdate:columnOrder': (value) => emit('update:columnOrder', value),
	'onUpdate:columnWidths': (value) => emit('update:columnWidths', value),
	'onUpdate:columnPinning': (value) => emit('update:columnPinning', value),
	'onUpdate:rowPinning': (value) => emit('update:rowPinning', value),
	'onUpdate:cellRange': (value) => emit('update:cellRange', value),
	onSortChange: (value, details) => emit('sortChange', value, details),
	onFilterChange: (value, details) => emit('filterChange', value, details),
	onGroupByChange: (value, details) => emit('groupByChange', value, details),
	onPageChange: (value, details) => emit('pageChange', value, details),
	onExpandedChange: (value, details) => emit('expandedChange', value, details),
	onSelectedChange: (value, details) => emit('selectedChange', value, details),
	onColumnVisibilityChange: (value, details) => emit('columnVisibilityChange', value, details),
	onColumnOrderChange: (value, details) => emit('columnOrderChange', value, details),
	onColumnWidthsChange: (value, details) => emit('columnWidthsChange', value, details),
	onColumnWidthsCommit: (value, details) => emit('columnWidthsCommit', value, details),
	onColumnPinningChange: (value, details) => emit('columnPinningChange', value, details),
	onRowPinningChange: (value, details) => emit('rowPinningChange', value, details),
	onCellRangeChange: (value, details) => emit('cellRangeChange', value, details),
	onCellRangeCommit: (value, details) => emit('cellRangeCommit', value, details),
	onCellEdit: (edits, details) => emit('cellEdit', edits, details),
}

const metaOf = (column: ColumnDef<Row>) => (column.meta ?? {}) as DataTableColumnMeta<Row>

const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const

function alignOf(column: ColumnDef<Row>, leaf = true) {
	const align =
		metaOf(column).align ??
		(leaf && column.format && isNumericFormat(column.format) ? 'end' : 'start')
	return ALIGN[align]
}

// A row that stays in view has cells that stick, because a row of a table
// cannot. Such a cell is opaque: the rows under it must not show through.
const stuck =
	'in-data-sticky:sticky in-data-sticky:z-20 in-data-sticky:bg-background in-data-[sticky=top]:top-(--table-sticky-offset) in-data-[sticky=bottom]:bottom-(--table-sticky-offset)'
// A pinned cell is opaque too, so it takes the fill of a selected row itself.
const pinned =
	'data-pinned:sticky data-pinned:z-10 data-pinned:bg-background data-[pinned=start]:start-(--table-pin-offset) data-[pinned=end]:end-(--table-pin-offset) in-data-sticky:data-pinned:z-30 in-aria-selected:data-pinned:bg-muted'
const sized = 'in-data-sized:overflow-hidden in-data-sized:text-ellipsis'
// A cell that gets focus scrolls into view, and it must stop beside the sticky rows and the pinned columns, not under them.
const beside =
	'scroll-mt-(--table-sticky-top-size) scroll-mb-(--table-sticky-bottom-size) scroll-ms-(--table-pin-start-size) scroll-me-(--table-pin-end-size) in-data-sticky:scroll-my-0 data-pinned:scroll-mx-0'
// The cell that the arrow keys are on. The line sits inside the cell, so the frame does not cut it.
const active =
	'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring'

const headClass = cn(
	'relative h-10 border-b border-border px-2 align-middle font-medium whitespace-nowrap text-foreground',
	'data-moving:bg-accent data-grabbed:z-40 data-grabbed:translate-x-(--drag-x)',
	// The handle that resizes a column is a thin bar at the end edge of its header.
	'[&_[data-slot=table-resizer]]:absolute [&_[data-slot=table-resizer]]:inset-y-0 [&_[data-slot=table-resizer]]:end-0 [&_[data-slot=table-resizer]]:w-1.5 [&_[data-slot=table-resizer]]:cursor-col-resize [&_[data-slot=table-resizer]]:touch-none [&_[data-slot=table-resizer]]:outline-none [&_[data-slot=table-resizer]:is(:hover,:focus-visible,[data-dragging])]:bg-ring',
	stuck,
	pinned,
	sized,
	beside,
	active,
)

const cellClass = cn(
	'border-b border-border p-2 align-middle whitespace-nowrap',
	// A range of cells has a tint. The editor of a cell takes the place of its text.
	'data-selected:bg-primary/10 data-editing:relative data-editing:overflow-visible data-editing:p-0',
	'[&_[data-slot=table-editor]]:h-9 [&_[data-slot=table-editor]]:w-full [&_[data-slot=table-editor]]:bg-background [&_[data-slot=table-editor]]:px-2 [&_[data-slot=table-editor]]:text-sm [&_[data-slot=table-editor]]:outline-2 [&_[data-slot=table-editor]]:-outline-offset-2 [&_[data-slot=table-editor]]:outline-ring [&_[data-slot=table-editor][aria-invalid=true]]:outline-destructive',
	'[&_[data-slot=table-edit-error]]:absolute [&_[data-slot=table-edit-error]]:start-0 [&_[data-slot=table-edit-error]]:top-full [&_[data-slot=table-edit-error]]:z-40 [&_[data-slot=table-edit-error]]:rounded-sm [&_[data-slot=table-edit-error]]:bg-destructive [&_[data-slot=table-edit-error]]:px-2 [&_[data-slot=table-edit-error]]:py-1 [&_[data-slot=table-edit-error]]:text-xs [&_[data-slot=table-edit-error]]:text-destructive-foreground',
	stuck,
	pinned,
	sized,
	beside,
	active,
)

const footClass = cn(
	'border-t border-border p-2 align-middle font-medium whitespace-nowrap',
	stuck,
	pinned,
	sized,
	beside,
	active,
)

const control = 'w-10 px-2 text-start'
const isOwn = (id: string) => id === SELECT_COLUMN || id === EXPAND_COLUMN

// These two functions stay the same for the life of the table: a new
// function would render every row again. They read the props when the table
// renders, so a new class of the caller still arrives.
function rowAttrs(context: RowAttrsContext<Row>) {
	if (context.kind === 'row') {
		const custom =
			typeof props.rowClass === 'function'
				? props.rowClass(context.row, context.index)
				: props.rowClass
		return {
			class: cn(
				'transition-colors hover:bg-muted/50 data-selected:bg-muted in-data-row-window:h-(--table-row-height)',
				custom,
			),
		}
	}
	if (context.kind === 'group') {
		return {
			class: cn(
				'bg-muted/30 transition-colors hover:bg-muted/50 in-data-row-window:h-(--table-row-height)',
				typeof props.rowClass === 'function' ? undefined : props.rowClass,
			),
		}
	}
	if (context.kind === 'detail') return { class: 'bg-muted/30' }
	return undefined
}

function cellAttrs(context: CellAttrsContext<Row>) {
	if (context.kind === 'header') {
		const column = context.column
		if (isOwn(column.id)) return { class: cn(headClass, control) }
		return {
			class: cn(
				headClass,
				context.leaf ? alignOf(column) : alignOf(column, false),
				props.headerClass,
				metaOf(column).headerClass,
			),
		}
	}
	if (context.kind === 'cell') {
		const column = context.column
		if (isOwn(column.id)) return { class: cn(cellClass, control) }
		const meta = metaOf(column)
		return {
			class: cn(
				cellClass,
				alignOf(column),
				meta.wrap && 'whitespace-normal',
				props.cellClass,
				typeof meta.class === 'function' ? meta.class(context.value, context.row) : meta.class,
			),
		}
	}
	if (context.kind === 'foot') {
		return { class: cn(footClass, isOwn(context.column.id) ? control : alignOf(context.column)) }
	}
	if (context.kind === 'detail') return { class: cn(cellClass, 'whitespace-normal') }
	if (context.kind === 'empty') {
		return { class: cn(cellClass, 'whitespace-normal', props.loading && 'p-0') }
	}
	return { class: cellClass }
}

// The last row of the body has no line: the frame, or the footer, draws it.
const sectionAttrs = { body: { class: '[&>tr:last-child>td]:border-b-0' } }

const frameClass = computed(() =>
	cn(
		'relative rounded-md border border-border',
		props.scroll === 'page' ? '' : 'overflow-auto',
		props.width === 'auto' ? 'w-fit max-w-full' : 'w-full',
		props.wrapperClass,
	),
)

const tableClass = computed(() =>
	cn(
		// Lines belong to the cells, not to the rows: a cell that sticks keeps its line.
		'border-separate border-spacing-0 caption-bottom text-sm text-foreground',
		props.width === 'auto' ? 'w-auto' : 'w-full',
		// A column takes its width from its `col` element. With a width for
		// every column, the table is as wide as their sum.
		'[&_[data-slot=table-col]]:w-(--table-column-width) data-sized:w-(--table-width) data-sized:table-fixed',
		// A spacer stands in for the rows that the row window does not render.
		'[&_[data-slot=table-spacer]]:h-(--table-spacer-size)',
		// Rows that wait for newer ones stay in view, dimmed.
		'data-loading:[&>tbody]:opacity-60 data-cell-selection:[&>tbody]:select-none',
		props.tableClass,
	),
)

/** The link of a cell whose column has the format `url` or `email`. */
function linkFor(cell: CellSlotProps<Row>) {
	const format = cell.column.format
	if (format !== 'url' && format !== 'email') return null
	return linkOf(cell.value, format, cell.column.formatOptions, { row: cell.row })
}

/** The ids of the rows of a group that can be selected. */
function groupIds(group: GroupSlotProps<Row>['group']) {
	const can = props.canSelect
	return group.leaves.flatMap((leaf) => (!can || can(leaf.row) ? [leaf.id] : []))
}

const totalColumns = (group: GroupSlotProps<Row>) =>
	(view.value?.visibleColumns ?? []).filter((column) => column.id in group.totalTexts)

const skeletonColumns = computed(() => view.value?.visibleColumns.length ?? columns.value.length)

/** The editor slots of the caller. The table has its own text field for a column without one. */
const editorSlots = computed(() =>
	Object.keys(slots).filter(
		(name): name is 'editor' | `edit-${string}` => name === 'editor' || name.startsWith('edit-'),
	),
)

defineExpose({
	/** The methods of the table: `sortBy`, `setSearch`, `select` and the others. */
	controller,
})
</script>

<template>
	<div data-slot="data-table" class="flex min-w-0 flex-col gap-3">
		<DataTableToolbar
			v-if="hasToolbar"
			:search="search"
			:column-filters="columnFilters"
			:column-menu="columnMenu"
			:export="exportOptions"
		>
			<template #default="toolbar">
				<slot name="toolbar" v-bind="toolbar" />
			</template>
		</DataTableToolbar>
		<div data-slot="data-table-frame" :class="frameClass">
			<Table
				v-bind="{ ...tableProps, ...listeners }"
				:row-attrs="rowAttrs"
				:cell-attrs="cellAttrs"
				:section-attrs="sectionAttrs"
				:aria-label="label || undefined"
				:class="tableClass"
			>
				<template #header="header">
					<template v-if="header.column.id === SELECT_COLUMN">
						<DataTableSelectAll v-if="selection === 'multiple'" :label="messages.selectAllRows()" />
						<span v-else class="sr-only">{{ messages.selectionColumn() }}</span>
					</template>
					<DataTableExpandAll v-else-if="header.column.id === EXPAND_COLUMN" />
					<slot
						v-else-if="slots[`header-${header.column.id}`]"
						:name="`header-${header.column.id}`"
						v-bind="header"
					/>
					<slot v-else name="header" v-bind="header">
						<Button
							v-if="header.leaf && header.column.sortable"
							:class="cn(buttonClass('ghost', 'sm'), '-mx-2.5')"
							@click="(event: Event) => header.toggleSort(event)"
						>
							{{ header.label }}
							<ArrowUpIcon v-if="header.sort === 'asc'" aria-hidden="true" />
							<ArrowDownIcon v-else-if="header.sort === 'desc'" aria-hidden="true" />
							<ChevronsUpDownIcon v-else aria-hidden="true" class="text-muted-foreground" />
						</Button>
						<template v-else>{{ header.label }}</template>
					</slot>
				</template>

				<template #cell="cell">
					<DataTableCheckbox
						v-if="cell.column.id === SELECT_COLUMN"
						:checked="cell.selected"
						:disabled="canSelect ? !canSelect(cell.row) : false"
						:label="messages.selectRow({ row: rowName(cell.row) })"
						@change="(_next, event) => cell.toggleSelected(event)"
					/>
					<template v-else-if="cell.column.id === EXPAND_COLUMN">
						<span
							:data-level="Math.min(cell.node.depth, 5)"
							class="flex data-[level=1]:ps-4 data-[level=2]:ps-8 data-[level=3]:ps-12 data-[level=4]:ps-16 data-[level=5]:ps-20"
						>
							<Button
								v-if="cell.expandable"
								:aria-expanded="cell.expanded"
								:aria-label="
									cell.expanded
										? messages.collapseRowOf({ row: rowName(cell.row) })
										: messages.expandRowOf({ row: rowName(cell.row) })
								"
								:class="buttonClass('ghost', 'icon-xs')"
								@click="(event: Event) => cell.toggleExpanded(event)"
							>
								<ChevronDownIcon v-if="cell.expanded" aria-hidden="true" />
								<ChevronRightIcon v-else aria-hidden="true" class="rtl:rotate-180" />
							</Button>
						</span>
					</template>
					<slot
						v-else-if="slots[`col-${cell.column.id}`]"
						:name="`col-${cell.column.id}`"
						v-bind="cell"
					/>
					<slot v-else name="cell" v-bind="cell">
						<template v-if="cell.column.format === 'boolean'">
							<CheckIcon v-if="cell.value" aria-hidden="true" class="inline size-4" />
							<MinusIcon v-else aria-hidden="true" class="inline size-4 text-muted-foreground" />
							<span class="sr-only">{{ cell.text }}</span>
						</template>
						<a
							v-else-if="linkFor(cell)"
							:href="linkFor(cell)?.href"
							:target="linkFor(cell)?.newTab ? '_blank' : undefined"
							:rel="linkFor(cell)?.newTab ? 'noopener noreferrer' : undefined"
							class="rounded-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							{{ linkFor(cell)?.text }}
						</a>
						<template v-else>{{ cell.text }}</template>
					</slot>
				</template>

				<template #foot="foot">
					<template v-if="isOwn(foot.column.id)" />
					<slot
						v-else-if="slots[`foot-${foot.column.id}`]"
						:name="`foot-${foot.column.id}`"
						v-bind="foot"
					/>
					<slot v-else name="foot" v-bind="foot">{{ foot.text }}</slot>
				</template>

				<template #group="group">
					<slot name="group" v-bind="group">
						<div
							:data-level="Math.min(group.level, 5)"
							class="flex items-center gap-2 data-[level=1]:ps-4 data-[level=2]:ps-8 data-[level=3]:ps-12 data-[level=4]:ps-16 data-[level=5]:ps-20"
						>
							<DataTableSelectAll
								v-if="selection === 'multiple'"
								:ids="groupIds(group.group)"
								:label="messages.selectGroup({ group: group.text })"
							/>
							<Button
								:aria-expanded="group.expanded"
								:class="cn(buttonClass('ghost', 'sm'), '-ms-1')"
								@click="(event: Event) => group.toggleExpanded(event)"
							>
								<ChevronDownIcon v-if="group.expanded" aria-hidden="true" />
								<ChevronRightIcon v-else aria-hidden="true" class="rtl:rotate-180" />
								{{ messages.groupRow({ text: group.text, count: group.group.leaves.length }) }}
							</Button>
							<dl
								v-if="totalColumns(group).length"
								data-slot="data-table-group-totals"
								class="ms-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1 pe-2 font-normal"
							>
								<div v-for="column in totalColumns(group)" :key="column.id" class="flex gap-1.5">
									<dt>{{ column.header ?? column.id }}</dt>
									<dd class="font-medium tabular-nums">{{ group.totalTexts[column.id] }}</dd>
								</div>
							</dl>
						</div>
					</slot>
				</template>

				<template v-if="slots.detail" #detail="detail">
					<slot name="detail" v-bind="detail" />
				</template>

				<template v-for="name in editorSlots" :key="name" #[name]="editor">
					<slot :name="name" v-bind="editor" />
				</template>

				<template #empty>
					<slot name="empty"><DataTableEmpty /></slot>
				</template>

				<template #loading>
					<slot name="loading">
						<div data-slot="data-table-skeleton" role="status" :aria-label="messages.loading()">
							<div
								v-for="row in skeletonRows"
								:key="row"
								data-slot="data-table-skeleton-row"
								class="grid auto-cols-fr grid-flow-col gap-4 border-b border-border p-3 last:border-b-0"
							>
								<div v-for="column in skeletonColumns" :key="column" :class="skeletonClass" />
							</div>
						</div>
					</slot>
				</template>
			</Table>
		</div>
		<DataTablePagination v-if="pagination" :page-sizes="pageSizes" />
	</div>
</template>
