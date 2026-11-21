import { describe, expect, test } from 'vite-plus/test'
import { sheetTable } from './sheet/harness'

const ref = (rowId: string, columnId: string) => ({ rowId, columnId })

describe('getSelectionSummary', () => {
	test('counts numbers, texts and the cells of the selection, with plain texts over several columns', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			// No cell is active.
			expect(view.api.getSelectionSummary()).toBeNull()
			view.api.selectCells(ref('a', 'name'), ref('b', 'stock'))
			expect(view.api.getSelectionSummary()).toEqual({
				cells: 8,
				count: 8,
				numbers: 4,
				sum: 133,
				mean: 33.25,
				min: 0.5,
				max: 90,
				texts: { sum: '133', mean: '33.25', min: '0.5', max: '90' },
			})
		} finally {
			view.unmount()
		}
	})

	test('one cell is a summary of one cell, and a cell without a number has no mean', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('c', 'price'))
			expect(view.api.getSelectionSummary()).toMatchObject({ cells: 1, numbers: 1, sum: 0.2 })
			view.api.selectCells(ref('c', 'name'))
			expect(view.api.getSelectionSummary()).toEqual({
				cells: 1,
				count: 1,
				numbers: 0,
				sum: 0,
				mean: undefined,
				min: undefined,
				max: undefined,
				texts: { sum: '0', mean: '', min: '', max: '' },
			})
		} finally {
			view.unmount()
		}
	})

	test('the same selection gives the same answer object, and another selection a new one', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'price'), ref('d', 'price'))
			const first = view.api.getSelectionSummary()
			expect(view.api.getSelectionSummary()).toBe(first)
			view.api.selectCells(ref('a', 'price'), ref('c', 'price'))
			const second = view.api.getSelectionSummary()
			expect(second).not.toBe(first)
			expect(second?.cells).toBe(3)
		} finally {
			view.unmount()
		}
	})

	test('the sum of a whole column is the total of that column, in the same text', () => {
		const { view } = sheetTable({
			sheet: true,
			columns: [
				{ id: 'name' },
				{
					id: 'price',
					format: 'currency',
					formatOptions: { currency: 'EUR', showUnit: true },
					aggregate: 'sum',
				},
			],
			rows: [
				{ id: 'a', name: 'Bolt', price: 0.1 },
				{ id: 'b', name: 'Nut', price: 0.2 },
				{ id: 'c', name: 'Washer', price: null },
				{ id: 'd', name: 'Screw', price: 1200 },
			] as never,
		})
		try {
			view.api.selectCellColumns('price')
			const summary = view.api.getSelectionSummary()
			const total = view.api.getTotals().price
			expect(summary?.sum).toBe(total?.value)
			expect(summary?.texts.sum).toBe(total?.text)
			expect(summary?.texts).toEqual({
				sum: '€1,200.30',
				mean: '€400.10',
				min: '€0.10',
				max: '€1,200.00',
			})
			expect(summary).toMatchObject({ cells: 4, count: 3, numbers: 3 })
		} finally {
			view.unmount()
		}
	})

	test('the numbers of the rows are no cells of the summary', () => {
		const { view } = sheetTable({ sheet: true }, { numbers: true })
		try {
			view.api.selectAllCells()
			expect(view.api.getSelectionSummary()).toMatchObject({ cells: 16, numbers: 8 })
		} finally {
			view.unmount()
		}
	})

	test('a table without cell selection counts the active cell', () => {
		const { view, cell } = sheetTable({ editable: true })
		try {
			cell('d', 'stock').focus()
			expect(view.api.getSelectionSummary()).toMatchObject({ cells: 1, sum: 60 })
		} finally {
			view.unmount()
		}
	})
})
