<script setup lang="ts" generic="Row">
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	MinusIcon,
	XIcon,
} from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import {
	cellValue,
	createTableController,
	isEmptyFilter,
	isNumericFormat,
	Table,
	toText,
	type CellAttrsContext,
	type ColumnDef,
	type GroupSlotProps,
	type RowAttrsContext,
	type TableInstance,
	type TableView,
} from 'ui-sdk-table-vue'
import {
	computed,
	onBeforeUnmount,
	onMounted,
	provide,
	shallowRef,
	useTemplateRef,
	watch,
} from 'vue'
import { cn } from '@/lib/utils'
import DataTableCheckbox from './DataTableCheckbox.vue'
import DataTableChevron from './DataTableChevron.vue'
import {
	buttonClass,
	focusInsetClass,
	indentClass,
	MAX_INDENT,
	skeletonClass,
} from './DataTableClasses'
import DataTableEmpty from './DataTableEmpty.vue'
import DataTableExpandAll from './DataTableExpandAll.vue'
import DataTableLink from './DataTableLink.vue'
import DataTablePagination from './DataTablePagination.vue'
import DataTableSelectAll from './DataTableSelectAll.vue'
import DataTableToolbar from './DataTableToolbar.vue'
import { resolveMessages, type DataTableExportFormat } from './messages'
import {
	DATA_TABLE_CONTEXT,
	EXPAND_COLUMN,
	isOwnColumn,
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

const emit = defineEmits<DataTableEmits<Row>>()
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

// A search, a filter, a sort and a page change what the table shows, and a
// person who does not see the table hears of it here. The text comes after a
// pause, once, so a fast typist hears the count of the last letter only.
const status = shallowRef('')
const ANNOUNCED: readonly string[] = ['filter', 'groupBy', 'sort', 'page']
const PAUSE = 500
const unsaid = new Set<string>()
let pause: ReturnType<typeof setTimeout> | undefined

function note(changed: readonly string[]) {
	for (const key of changed) if (ANNOUNCED.includes(key)) unsaid.add(key)
	if (!unsaid.size) return
	// An empty region first: the same text as the last time is said again.
	status.value = ''
	clearTimeout(pause)
	pause = setTimeout(announce, PAUSE)
}

function announce() {
	const now = view.value
	// Rows that are on their way have no count yet. Their arrival is a change, and that starts the pause again.
	if (!now || now.loading) return
	const texts = messages.value
	if (unsaid.has('filter') || unsaid.has('groupBy')) {
		status.value = texts.rowsFound({
			total: now.rowCount,
			unit: now.pageUnit,
			rows: now.dataRowCount,
		})
	} else if (unsaid.has('sort')) {
		const name = (id: string) => now.columns.find((column) => column.id === id)?.header ?? id
		status.value = texts.sortedBy({
			sort: now.sort.map((rule) => ({ column: name(rule.id), desc: rule.desc ?? false })),
		})
	} else {
		status.value = now.lastPageKnown
			? texts.pageOf({ page: now.page, pageCount: now.pageCount })
			: texts.pageNumber({ page: now.page })
	}
	unsaid.clear()
}

let stop: (() => void) | undefined
onMounted(() => {
	if (import.meta.env.DEV && !props.label) {
		console.warn(
			'[DataTable] The table has no accessible name. Pass `label`: assistive technology and an agent find the table by it, and tell its controls from those of another table.',
		)
	}
	// The ids of groups come from the rows, so the table opens them itself.
	// It happens before the first paint: nobody sees the closed groups.
	if (props.defaultExpanded === 'all' && !props.expanded) controller.expandAll()
	refresh()
	stop = controller.subscribe((changed) => {
		if (!changed.some((key) => VIEW_KEYS.includes(key))) return
		refresh()
		note(changed)
	})
})
onBeforeUnmount(() => {
	stop?.()
	clearTimeout(pause)
})
// An option can change what a control shows without a change of state.
watch(() => [props.selection, props.canSelect, props.locale], refresh, { flush: 'post' })

// `pagination` can come and go while the table is on the page. The pages are
// state of the table, so the table gets them, or loses them, here.
watch(
	() => props.pagination,
	(on) => {
		const size = view.value?.pageSize
		if (!view.value) return
		if (on && size === undefined) controller.setPageSize(props.pageSizes[0] ?? 10)
		else if (!on && size !== undefined) controller.setPageSize(null)
	},
)

const selected = computed<ReadonlySet<string>>(() => new Set(view.value?.selected))
const filterCount = computed(
	() =>
		Object.values(view.value?.filter.columns ?? {}).filter((value) => !isEmptyFilter(value)).length,
)

/** The kind of file of an export that failed, while its message shows. */
const failedExport = shallowRef<DataTableExportFormat>()

provide(DATA_TABLE_CONTEXT, {
	controller,
	view,
	messages,
	label,
	selected,
	filterCount,
	exportStarted: () => {
		failedExport.value = undefined
	},
	exportFailed: (error, format) => {
		failedExport.value = format
		emit('exportError', error, { format })
	},
})

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
// no part in the search, a filter, an export or the list of columns. They
// lead the table: first under any column order, and at the start edge beside
// a column that is pinned there. No order and no pin of the caller holds them.
const own = (id: string, width: number): ColumnDef<Row> => ({
	id,
	lead: true,
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

const ownIds = computed(() => [
	...(props.selection ? [SELECT_COLUMN] : []),
	...(hasExpandColumn.value ? [EXPAND_COLUMN] : []),
])

const columns = computed<readonly ColumnDef<Row>[]>(() => [
	...ownIds.value.map((id) => own(id, 40)),
	...(props.columns ?? []),
])

/** The columns in view. A part that reads the whole view renders for each change; this changes with the columns only. */
const visibleColumns = computed(() => view.value?.visibleColumns ?? [])

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
	messages: messages.value,
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
	facets: props.facets,
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
// A pinned cell is opaque too.
const pinned =
	'data-pinned:sticky data-pinned:z-10 data-pinned:bg-background data-[pinned=start]:start-(--table-pin-offset) data-[pinned=end]:end-(--table-pin-offset) in-data-sticky:data-pinned:z-30'
// An opaque cell hides the fill of its row, so it paints the tint of the row
// itself, as a layer of one colour over its own fill. The colour is the
// `from` stop of a gradient that ends where it starts. The table sets the
// stop for a hovered and for a selected row; a caller sets it for a tint of
// its own with a class for the cells of the row, such as `*:from-warning/15`.
const tinted =
	'from-100% in-data-sticky:bg-linear-to-b data-pinned:bg-linear-to-b group-hover/row:from-muted/50 group-aria-selected/row:from-muted'
const sized = 'in-data-sized:overflow-hidden in-data-sized:text-ellipsis'
// A cell that gets focus scrolls into view, and it must stop beside the sticky rows and the pinned columns, not under them.
const beside =
	'scroll-mt-(--table-sticky-top-size) scroll-mb-(--table-sticky-bottom-size) scroll-ms-(--table-pin-start-size) scroll-me-(--table-pin-end-size) in-data-sticky:scroll-my-0 data-pinned:scroll-mx-0'

const headClass = cn(
	'relative h-10 border-b border-border px-2 align-middle font-medium whitespace-nowrap text-foreground',
	'data-moving:bg-accent data-grabbed:z-40 data-grabbed:translate-x-(--drag-x)',
	// The handle that resizes a column is a thin bar at the end edge of its header.
	// UI SDK gives it its cursor and its touch action.
	'[&_[data-slot=table-resizer]]:absolute [&_[data-slot=table-resizer]]:inset-y-0 [&_[data-slot=table-resizer]]:end-0 [&_[data-slot=table-resizer]]:w-1.5 [&_[data-slot=table-resizer]]:outline-none [&_[data-slot=table-resizer]:is(:hover,:focus-visible,[data-dragging])]:bg-ring',
	stuck,
	pinned,
	sized,
	beside,
	focusInsetClass,
)

const cellClass = cn(
	'border-b border-border p-2 align-middle whitespace-nowrap',
	// A range of cells has a tint, as a layer like the tint of a row, so a pinned cell stays opaque under it.
	'data-selected:bg-linear-to-b data-selected:from-primary/10',
	// The editor of a cell takes the place of its text.
	'data-editing:relative data-editing:overflow-visible data-editing:p-0',
	// The editor fills its cell and asks for no width of its own: with a width
	// of its own, a column of a table without fixed widths would grow while a
	// cell of it is open.
	'[&_[data-slot=table-editor]]:h-9 [&_[data-slot=table-editor]]:w-0 [&_[data-slot=table-editor]]:min-w-full [&_[data-slot=table-editor]]:bg-background [&_[data-slot=table-editor]]:px-2 [&_[data-slot=table-editor]]:text-sm [&_[data-slot=table-editor]]:outline-2 [&_[data-slot=table-editor]]:-outline-offset-2 [&_[data-slot=table-editor]]:outline-ring [&_[data-slot=table-editor][aria-invalid=true]]:outline-destructive',
	'[&_[data-slot=table-edit-error]]:absolute [&_[data-slot=table-edit-error]]:start-0 [&_[data-slot=table-edit-error]]:top-full [&_[data-slot=table-edit-error]]:z-40 [&_[data-slot=table-edit-error]]:rounded-sm [&_[data-slot=table-edit-error]]:bg-destructive [&_[data-slot=table-edit-error]]:px-2 [&_[data-slot=table-edit-error]]:py-1 [&_[data-slot=table-edit-error]]:text-xs [&_[data-slot=table-edit-error]]:text-destructive-foreground',
	stuck,
	pinned,
	tinted,
	sized,
	beside,
	focusInsetClass,
)

const footClass = cn(
	'border-t border-border p-2 align-middle font-medium whitespace-nowrap',
	stuck,
	pinned,
	sized,
	beside,
	focusInsetClass,
)

const control = 'w-10 px-2 text-start'

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
				// `group/row` lets a cell that is opaque follow the hover and the selection of its row.
				'group/row transition-colors hover:bg-muted/50 data-selected:bg-muted in-data-row-window:h-(--table-row-height)',
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
		if (isOwnColumn(column.id)) return { class: cn(headClass, control) }
		return {
			class: cn(
				headClass,
				alignOf(column, context.leaf),
				props.headerClass,
				metaOf(column).headerClass,
			),
		}
	}
	if (context.kind === 'cell') {
		const column = context.column
		if (isOwnColumn(column.id)) return { class: cn(cellClass, control) }
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
		return {
			class: cn(footClass, isOwnColumn(context.column.id) ? control : alignOf(context.column)),
		}
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
		// A frame that scrolls is as wide as its place, and the table scrolls
		// inside it. A frame that never scrolls grows with a table that is wider
		// than its place, and the page scrolls: a frame that cut the table off
		// would have to scroll, and then no row could stick to the page.
		props.scroll === 'page'
			? props.width === 'auto'
				? 'w-fit'
				: 'w-fit min-w-full'
			: ['overflow-auto', props.width === 'auto' ? 'w-fit max-w-full' : 'w-full'],
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
		// Rows that wait for newer ones stay in view and readable; the cursor says that the table is busy.
		'data-loading:[&>tbody]:cursor-progress data-cell-selection:[&>tbody]:select-none',
		props.tableClass,
	),
)

/** The ids of the rows of a group that can be selected. */
function groupIds(group: GroupSlotProps<Row>['group']) {
	const can = props.canSelect
	return group.leaves.flatMap((leaf) => (!can || can(leaf.row) ? [leaf.id] : []))
}

const totalColumns = (group: GroupSlotProps<Row>) =>
	visibleColumns.value.filter((column) => column.id in group.totalTexts)

const skeletonColumns = computed(() => visibleColumns.value.length || columns.value.length)

/** The editor slots of the caller. The table has its own text field for a column without one. */
const editorSlots = computed(() =>
	Object.keys(slots).filter(
		(name): name is 'editor' | `edit-${string}` => name === 'editor' || name.startsWith('edit-'),
	),
)

const root = useTemplateRef<HTMLElement>('root')

// The button of the message leaves the page with the message. Focus goes to
// the control that the message is about, or the keyboard would start again
// from the top of the page.
function dismissExportError() {
	failedExport.value = undefined
	root.value?.querySelector<HTMLElement>('[data-export-trigger]')?.focus()
}

defineExpose({
	/** The methods of the table: `sortBy`, `setSearch`, `select` and the others. */
	controller,
})
</script>

<template>
	<div ref="root" data-slot="data-table" class="flex min-w-0 flex-col gap-3">
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
		<div
			v-if="failedExport"
			role="alert"
			data-slot="data-table-alert"
			class="flex items-center justify-between gap-2 rounded-md border border-destructive px-3 py-2 text-sm text-foreground"
		>
			<span>{{ messages.exportFailed({ format: failedExport }) }}</span>
			<Button
				:aria-label="messages.dismiss()"
				:class="buttonClass('ghost', 'icon-xs')"
				@click="dismissExportError"
			>
				<XIcon aria-hidden="true" />
			</Button>
		</div>
		<div data-slot="data-table-status" role="status" aria-live="polite" class="sr-only">
			{{ status }}
		</div>
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
						<DataTableSelectAll v-if="selection === 'multiple'" />
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
							:data-level="Math.min(cell.node.depth, MAX_INDENT)"
							:class="['flex', indentClass]"
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
								<DataTableChevron :expanded="cell.expanded" />
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
						<DataTableLink v-else :cell="cell" />
					</slot>
				</template>

				<template #foot="foot">
					<template v-if="isOwnColumn(foot.column.id)" />
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
							:data-level="Math.min(group.level, MAX_INDENT)"
							:class="['flex items-center gap-2', indentClass]"
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
								<DataTableChevron :expanded="group.expanded" />
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
