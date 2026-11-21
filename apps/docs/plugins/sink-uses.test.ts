import { describe, expect, it } from 'vite-plus/test'
import { tileId, usesOf } from './sink-uses'

describe('usesOf', () => {
	it('reads the imports from the library, without the types and the table itself', () => {
		const source = `
			import { Button } from '@ui-sdk/vue/button'
			import { applyEdits, Table, useTableSearch, type ColumnDef } from 'ui-sdk-table-vue'
			import { shallowRef } from 'vue'
		`
		expect(usesOf(source)).toEqual(['applyEdits', 'useTableSearch'])
	})

	it('reads an import that waits for its first use', () => {
		const source = `
			// The writers load on the first press, { not before }.
			const { toCsv, toXlsx: excel } = await import('ui-sdk-table-vue/export')
		`
		expect(usesOf(source)).toEqual(['toCsv', 'toXlsx'])
	})

	it('reads the options, models, events and slots of the table element', () => {
		const source = `
			<Table
				class="orders"
				:rows="rows"
				sticky-header
				multi-sort="always"
				v-model:sort="sort"
				aria-label="Orders"
				:row-attrs="(row) => (row.total > 10 ? late : undefined)"
				@update:group-by="regroup"
				@cell-edit="save"
				@column-widths-commit="(widths) => (saved = widths)"
			>
				<template #col-total="{ text }">{{ text }}</template>
				<template #group-total-total="{ text }">{{ text }}</template>
				<template #group="{ text }">{{ text }}</template>
				<template v-slot:empty>No rows</template>
			</Table>
		`
		expect(usesOf(source)).toEqual([
			'groupBy',
			'multiSort',
			'onCellEdit',
			'onColumnWidthsCommit',
			'rowAttrs',
			'rows',
			'slot.col',
			'slot.empty',
			'slot.group',
			'slot.group-total',
			'sort',
			'stickyHeader',
		])
	})

	it('reads the methods of a controller and the actions of an agent', () => {
		const source = `
			const controller = createTableController()
			controller.sortBy('total', 'desc')
			const view = controller.getView()
			other.setSearch('no controller of the table')
			await act('setPage', [2])
			const step = { action: 'clearFilters' }
		`
		expect(usesOf(source)).toEqual(['clearFilters', 'getView', 'setPage', 'sortBy'])
	})

	it('reads the keys of the columns, also of the columns under a header group', () => {
		const source = `
			const columns: ColumnDef<Order>[] = [
				{ id: 'customer', header: 'Customer' },
				// A comment with a word: ignored.
				{
					id: 'half',
					columns: [{ id: 'q1', format: 'integer', formatOptions: { showUnit: true } }],
				},
				{ id: 'total', value: (row) => ({ sum: row.total }), aggregate: 'sum' },
			]
			const other = [{ id: 'x', missing: true }]
		`
		expect(usesOf(source)).toEqual([
			'column.aggregate',
			'column.columns',
			'column.format',
			'column.formatOptions',
			'column.header',
			'column.id',
			'column.value',
		])
	})
})

describe('tileId', () => {
	it('gives the id of the tile in a file', () => {
		expect(tileId('SortTwoColumns.vue')).toBe('sort-two-columns')
		expect(tileId('RowsWindow.vue')).toBe('rows-window')
	})
})
