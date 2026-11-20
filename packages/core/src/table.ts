import {
	byCell,
	createChange,
	createSelection,
	definePrimitive,
	selects,
	type ChangeDetails,
} from '@ui-sdk/core'
import { createTableGrid, GRID_KEYS, type GridCell } from './behaviors/grid'
import { formatValue } from './format'
import {
	cellValue,
	createRowModel,
	leafColumns,
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

export type TableChangeDetails = ChangeDetails<TableReason>

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
}

type TableState = {
	sort: readonly SortRule[]
	filter: FilterState
	groupBy: readonly string[]
	page: PageState | undefined
	expanded: readonly string[]
	selected: string[]
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

/** The header row is row 0 of the grid, so cell focus can move into it. */
const HEADER_ROWS = 1

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
	},
	controlled: ['sort', 'filter', 'groupBy', 'page', 'expanded', 'selected'],
	state: (options: TableOptions): TableState => ({
		sort: options.sort ?? options.defaultSort ?? NO_SORT,
		filter: options.filter ?? options.defaultFilter ?? NO_FILTER,
		groupBy: options.groupBy ?? options.defaultGroupBy ?? NO_IDS,
		page: options.page ?? options.defaultPage,
		expanded: options.expanded ?? options.defaultExpanded ?? NO_IDS,
		selected: options.selected ?? options.defaultSelected ?? [],
		active: null,
		revision: 0,
	}),
	sync: (options) => {
		const synced: Partial<TableState> = {}
		if (options.sort !== undefined) synced.sort = options.sort
		if (options.filter !== undefined) synced.filter = options.filter
		if (options.groupBy !== undefined) synced.groupBy = options.groupBy
		if (options.page !== undefined) synced.page = options.page
		if (options.expanded !== undefined) synced.expanded = options.expanded
		if (options.selected !== undefined) synced.selected = options.selected
		return synced
	},
	api: (context) => {
		const state = () => context.store.get()
		const options = () => context.options()
		const change = createChange(context)

		let seenRows = options().rows
		let seenColumns = options().columns
		context.onOptions((next) => {
			if (next.rows === seenRows && next.columns === seenColumns) return
			seenRows = next.rows
			seenColumns = next.columns
			context.store.set({ revision: state().revision + 1 })
		})

		const columnsOf = memo((columns: readonly ColumnDef[]) => {
			const leaves = leafColumns(columns)
			return { leaves, byId: new Map(leaves.map((column) => [column.id, column])) }
		})
		const columns = () => columnsOf(options().columns ?? NO_COLUMNS)

		function column(id: string, purpose: string): ColumnDef {
			const found = columns().byId.get(id)
			if (!found) {
				throw new Error(
					`No column "${id}" to ${purpose}. Columns: ${listed(columns().byId.keys())}.`,
				)
			}
			return found
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
			columns: () => options().columns ?? NO_COLUMNS,
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

		const grid = createTableGrid(context, {
			key: 'active',
			rows: () => HEADER_ROWS + model.flat().length,
			cols: () => columns().leaves.length,
			pageSize: () => state().page?.pageSize ?? 10,
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
			context.store.subscribe((_liveOnly, _delivered, changed) => {
				const next = list()
				const newList =
					next.sort !== seen.sort || next.filter !== seen.filter || next.groupBy !== seen.groupBy
				seen = next
				const page = state().page
				if (!page || (!newList && !changed.includes('revision'))) return
				// A page that arrives together with the list is the page the caller wants,
				// for example a filter and a page that both come from a URL.
				const first = newList && !changed.includes('page')
				const target = first ? 1 : Math.min(page.page, model.pageCount())
				if (target !== page.page) change('page', { ...page, page: target }, { reason: 'reset' })
			}),
		)

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
		}

		return {
			...controller,
			model,
			grid,
			selection,
			/** The visible rows in order. Grid row `n` is `rows()[n - 1]`; grid row 0 is the header. */
			rows: () => model.flat(),
			row: (id: string): FlatRow<unknown> | undefined => {
				const index = flatIndex(model.flat()).get(id)
				return index === undefined ? undefined : model.flat()[index]
			},
			columns: () => columns().leaves,
			column: (id: string) => columns().byId.get(id),
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
			selects: selects({ selected: [], active: [] }),
			attrs: (_state, { api }) => ({
				'aria-rowcount': String(HEADER_ROWS + api.rows().length),
				'aria-colcount': String(api.columns().length),
				'aria-multiselectable': api.selectionMode() === 'multiple' ? 'true' : undefined,
			}),
			state: (state, { api }) => ({
				revision: state.revision,
				sort: state.sort,
				filter: state.filter,
				groupBy: state.groupBy,
				expanded: state.expanded,
				page: api.model.page(),
				pageSize: state.page?.pageSize,
				pageCount: api.model.pageCount(),
				rowCount: api.model.rowCount(),
			}),
		}),
		head: slot({ role: 'rowgroup' }),
		body: slot({ role: 'rowgroup' }),
		foot: slot({ role: 'rowgroup' }),
		// The header row is a slot of its own, so no row id of the data can be mistaken for it.
		headerRow: slot<{ index: number }>({
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
				selected: ({ key }) => [key],
				expanded: ({ key }) => [key],
				active: [],
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
		cell: slot<{ value: string; row: number; col: number; header?: boolean }>({
			props: { value: 'string', row: 'number', col: 'number', header: 'boolean' },
			role: (_state, { props }) => (props.header ? 'columnheader' : 'gridcell'),
			roles: ['columnheader', 'gridcell'],
			focus: 'roving',
			keys: [...GRID_KEYS, 'Enter', 'F2', 'Escape', ' '],
			selects: selects({ active: byCell, selected: [], expanded: [] }),
			attrs: (state, { props, api }) => {
				const column = api.columns()[props.col]
				const sort = props.header && column?.sortable ? api.sortOf(column.id) : undefined
				return {
					tabindex: api.grid.tabIndex(state, props),
					'aria-colindex': String(props.col + 1),
					'aria-sort':
						props.header && column?.sortable
							? sort === 'asc'
								? 'ascending'
								: sort === 'desc'
									? 'descending'
									: 'none'
							: undefined,
					'data-column': column?.id,
					'data-active': api.grid.isActive(state, props) ? '' : undefined,
					'data-sorted': sort,
				}
			},
			on: {
				keydown: (event, { api, props, el }) => {
					const onCell = event.target === el
					const column = api.columns()[props.col]
					// Enter on a sortable header sorts. It comes before the move into the
					// cell, because a header often holds a sort button for the pointer.
					if (onCell && props.header && event.key === 'Enter' && column?.sortable) {
						event.preventDefault()
						api.toggleSort(column.id, { append: event.shiftKey, event })
						return
					}
					const row = props.header ? undefined : api.rows()[props.row - HEADER_ROWS]
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
					// A press on a control inside the cell must leave focus on that control.
					if (event.target !== el && event.target instanceof Element) {
						const control = event.target.closest('a[href], button, input, select, textarea')
						if (control && el?.contains(control)) return
					}
					api.grid.focus(props, { reason: 'item-press', event })
				},
			},
			bind: (el, { api, props }) => api.grid.bind(el, props),
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
		],
	},
})
