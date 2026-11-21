import {
	byCell,
	byCellRange,
	createCellRange,
	createGridFocus,
	definePrimitive,
	selects,
} from '@ui-sdk/core'
import type { CellRange, GridCell } from '@ui-sdk/core'
import { mount } from '@ui-sdk/core/testing'
import { expect, test } from 'vite-plus/test'

// P2 of the sheet work: a range while focus moves. A proof of `createCellRange`
// and `createGridFocus` of UI SDK 0.1.0-beta.13, which are experimental. The
// sheet keys of the table move the active cell inside a range (Enter, Tab) and
// build on the rules that these tests show.

const proof = definePrimitive({
	name: 'range-proof',
	options: {},
	state: () => ({ active: null as GridCell | null, range: null as CellRange | null }),
	api: (context) => {
		const grid = createGridFocus(context, { key: 'active', rows: () => 3, cols: () => 3 })
		const range = createCellRange(context, { key: 'range', grid, rows: () => 3, cols: () => 3 })
		return { grid, range }
	},
	slots: (slot) => ({
		root: slot({}),
		cell: slot<{ value: string; row: number; col: number }>({
			props: { value: 'string', row: 'number', col: 'number' },
			role: 'gridcell',
			focus: 'roving',
			keys: ['ArrowDown', 'shift+ArrowDown', 'shift+ArrowUp', 'Escape'],
			selects: selects({ active: byCell, range: byCellRange }),
			attrs: (state, { props, api }) => ({
				tabindex: api.grid.tabIndex(state, props),
				...api.range.cellAttrs(state, props),
			}),
			on: { keydown: (event, { api }) => void api.range.keydown(event) },
			bind: (el, { api, props }) => api.range.bind(el, props),
		}),
	}),
})

function setup() {
	const cells = [0, 1, 2]
		.flatMap((row) =>
			[0, 1, 2].map((col) => `<cell value="${row}:${col}" row="${row}" col="${col}"></cell>`),
		)
		.join('')
	const view = mount(proof, {}, `<root>${cells}</root>`)
	const cell = (row: number, col: number) => view.part('cell', `${row}:${col}`) as HTMLElement
	return { view, cell }
}

const box = { anchor: { row: 0, col: 0 }, end: { row: 1, col: 1 } }

test('a move of focus from code keeps the range, also with an event that holds Shift', () => {
	const { view, cell } = setup()
	try {
		cell(0, 0).focus()
		view.api.grid.focus({ row: 0, col: 0 })
		view.api.range.select(box)
		view.api.grid.focus({ row: 1, col: 0 }, { reason: 'list-navigation' })
		expect(view.state.active).toEqual({ row: 1, col: 0 })
		expect(view.state.range).toEqual(box)
		const enter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
		view.api.grid.focus({ row: 0, col: 1 }, { reason: 'list-navigation', event: enter })
		expect(view.state.active).toEqual({ row: 0, col: 1 })
		expect(view.state.range).toEqual(box)
	} finally {
		view.unmount()
	}
})

test('Shift with an arrow after such a move grows the range from its own end, not from the active cell', async () => {
	const { view, cell } = setup()
	try {
		cell(0, 0).focus()
		view.api.grid.focus({ row: 0, col: 0 })
		view.api.range.select(box)
		view.api.grid.focus({ row: 1, col: 0 }, { reason: 'list-navigation' })
		cell(1, 0).focus()
		await view.keys('Shift+ArrowDown')
		expect(view.state.range).toEqual({ anchor: { row: 0, col: 0 }, end: { row: 2, col: 1 } })
		// The active cell is where the move left it.
		expect(view.state.active).toEqual({ row: 1, col: 0 })
	} finally {
		view.unmount()
	}
})

test('an arrow without Shift drops the range and moves the active cell by itself', async () => {
	const { view, cell } = setup()
	try {
		cell(1, 1).focus()
		view.api.grid.focus({ row: 1, col: 1 })
		view.api.range.select(box)
		await view.keys('ArrowDown')
		expect(view.state.range).toBeNull()
		expect(view.state.active).toEqual({ row: 2, col: 1 })
	} finally {
		view.unmount()
	}
})

test('`selectAll`, `selectRows` and `selectColumns` leave the active cell where it is, also outside the range', () => {
	const { view } = setup()
	try {
		view.api.grid.focus({ row: 1, col: 1 })
		view.api.range.selectAll()
		expect(view.state.range).toEqual({ anchor: { row: 0, col: 0 }, end: { row: 2, col: 2 } })
		view.api.range.selectRows(2)
		expect(view.state.range).toEqual({ anchor: { row: 2, col: 0 }, end: { row: 2, col: 2 } })
		view.api.range.selectColumns(0, 1)
		expect(view.state.range).toEqual({ anchor: { row: 0, col: 0 }, end: { row: 2, col: 1 } })
		expect(view.state.active).toEqual({ row: 1, col: 1 })
	} finally {
		view.unmount()
	}
})
