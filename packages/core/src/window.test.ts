import { mount } from '@ui-sdk/core/testing'
import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import { createStickyRows } from './behaviors/sticky'
import { detailRowId } from './rows'
import { table, type TableOptions } from './table'

type Person = { id: string; name: string; score: number; reports?: Person[] }

const people = (count: number): Person[] =>
	Array.from({ length: count }, (_item, index) => ({
		id: `r${index}`,
		name: `Person ${index}`,
		score: index,
	}))

const columns = [{ id: 'name' }, { id: 'score', aggregate: 'sum' as const }]

/** Markup for some rows of a table, in the way a renderer writes it. */
function markup(ids: readonly string[], extra = ''): string {
	const rows = ids.map(
		(id, index) =>
			`<row value="${id}" index="${index + 1}"><cell value="${id}|name" row="${index + 1}" col="0">x</cell><cell value="${id}|score" row="${index + 1}" col="1">x</cell></row>`,
	)
	return `<root aria-label="People"><head><header-row index="0"><cell value="h|name" row="0" col="0" header>x</cell><cell value="h|score" row="0" col="1" header>x</cell></header-row></head><body>${extra}${rows.join('')}</body><foot><plain-row index="${ids.length + 1}" footer><cell value="f|name" row="${ids.length + 1}" col="0">x</cell></plain-row></foot></root>`
}

function setup(
	rows: Person[],
	options: Partial<TableOptions<Person>> = {},
	ids: readonly string[] = rows.slice(0, 6).map((row) => row.id),
	extra = '',
) {
	return mount(table, { rows, columns, ...options } as TableOptions, markup(ids, extra))
}

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id)
const style = (el: Element | undefined) => (el?.getAttribute('style') ?? '').replaceAll(' ', '')

const headerRow = (view: { root: HTMLElement }) =>
	view.root.querySelector('[data-slot="table-header-row"]')
const footerRow = (view: { root: HTMLElement }) =>
	view.root.querySelector('[data-slot="table-plain-row"]')

afterEach(() => vi.restoreAllMocks())

describe('row pinning', () => {
	test('pinned rows go first and last, and the list does not hold them', () => {
		const view = setup(people(6), { defaultRowPinning: { top: ['r3'], bottom: ['r1'] } }, [
			'r3',
			'r0',
			'r2',
			'r4',
			'r5',
			'r1',
		])
		try {
			expect(ids(view.api.rows())).toEqual(['r3', 'r0', 'r2', 'r4', 'r5', 'r1'])
			expect(ids(view.api.listRows())).toEqual(['r0', 'r2', 'r4', 'r5'])
			// The header row, six rows and the footer row: a pinned row is counted once.
			expect(view.root.getAttribute('aria-rowcount')).toBe('8')
			const top = view.part('row', 'r3')
			expect(top?.getAttribute('data-pinned')).toBe('top')
			expect(top?.getAttribute('data-sticky')).toBe('top')
			expect(view.part('row', 'r1')?.getAttribute('data-sticky')).toBe('bottom')
			expect(view.part('row', 'r0')?.hasAttribute('data-pinned')).toBe(false)
			expect(view.api.rowPin('r3')).toBe('top')
			expect(view.api.rowPin('r0')).toBeUndefined()
			// The totals count every row that passes the filter, pinned or not.
			expect(view.api.totals()).toEqual({ score: 15 })
		} finally {
			view.unmount()
		}
	})

	test('`pinRow` pins, moves and frees a row, and refuses what cannot be pinned', () => {
		const tree: Person[] = [
			{ id: 'a', name: 'Aino', score: 1, reports: [{ id: 'a1', name: 'Eero', score: 2 }] },
			{ id: 'b', name: 'Helmi', score: 3 },
			{ id: 'c', name: 'Onni', score: 4 },
		]
		const view = setup(tree, { getChildren: (row) => row.reports }, ['a', 'b', 'c'])
		try {
			view.api.pinRow('c', 'top')
			expect(view.state.rowPinning).toEqual({ top: ['c'], bottom: [] })
			expect(view.changes.at(-1)).toMatchObject({ key: 'rowPinning', reason: 'imperative' })
			expect(ids(view.api.rows())).toEqual(['c', 'a', 'b'])
			view.api.pinRow('b', 'top')
			// A row that is pinned there already keeps its place.
			view.api.pinRow('c', 'top')
			expect(view.state.rowPinning.top).toEqual(['c', 'b'])
			view.api.pinRow('c', 'bottom')
			expect(view.state.rowPinning).toEqual({ top: ['b'], bottom: ['c'] })
			expect(ids(view.api.rows())).toEqual(['b', 'a', 'c'])
			view.api.pinRow('c', null)
			view.api.pinRow('b', null)
			expect(ids(view.api.rows())).toEqual(['a', 'b', 'c'])

			expect(() => view.api.pinRow('nope', 'top')).toThrow(
				'No row "nope" to pin. Rows: a, a1, b, c.',
			)
			expect(() => view.api.pinRow('b', 'left' as never)).toThrow('"top" or "bottom"')
			expect(() => view.api.pinRow('a', 'top')).toThrow('Only a row without child rows')
		} finally {
			view.unmount()
		}
	})

	test('a filter and a page do not hide a pinned row, and an unknown id pins nothing', () => {
		const view = setup(people(6), {
			rowPinning: { top: ['r5', 'gone'] },
			defaultFilter: { search: 'Person 1' },
			defaultPage: { page: 1, pageSize: 2 },
		})
		try {
			expect(ids(view.api.rows())).toEqual(['r5', 'r1'])
			expect(view.api.pinnedRows().top).toHaveLength(1)
			// The owner of the state did not pass a new value back.
			view.api.pinRow('r1', 'bottom')
			expect(view.state.rowPinning).toEqual({ top: ['r5', 'gone'] })
			// The pinned row is the last row of the data, and the first page shows it all the same.
			view.api.clearFilters()
			expect(ids(view.api.rows())).toEqual(['r5', 'r0', 'r1'])
			view.api.nextPage()
			expect(ids(view.api.rows())).toEqual(['r5', 'r2', 'r3'])
		} finally {
			view.unmount()
		}
	})

	test('selection follows the rows as the screen orders them, pinned rows too', async () => {
		const filtered = setup(
			people(6),
			{
				selection: 'multiple',
				defaultRowPinning: { top: ['r5'] },
				defaultFilter: { search: 'Person 1' },
			},
			['r5', 'r1'],
		)
		try {
			// The filter refuses the pinned row, and the row is in view.
			filtered.api.selectAll()
			expect(filtered.state.selected).toEqual(['r5', 'r1'])
		} finally {
			filtered.unmount()
		}
		const view = setup(people(6), { selection: 'multiple', defaultRowPinning: { top: ['r4'] } }, [
			'r4',
			'r0',
			'r1',
			'r2',
			'r3',
			'r5',
		])
		try {
			;(view.part('cell', 'r4|name') as HTMLElement).focus()
			await view.keys('Space')
			;(view.part('cell', 'r1|name') as HTMLElement).focus()
			await view.keys('Shift+Space')
			// On the screen, the rows from the pinned row to the second row of the list.
			expect([...view.state.selected].sort()).toEqual(['r0', 'r1', 'r4'])
		} finally {
			view.unmount()
		}
	})

	test('a row with child rows is never pinned, and a row in both edges can move', () => {
		const tree: Person[] = [
			{ id: 'a', name: 'Aino', score: 1, reports: [{ id: 'a1', name: 'Eero', score: 2 }] },
			{ id: 'b', name: 'Helmi', score: 3 },
		]
		const view = setup(
			tree,
			{
				getChildren: (row) => row.reports,
				defaultExpanded: ['a'],
				defaultRowPinning: { top: ['a', 'b'], bottom: ['b'] },
			},
			['b', 'a', 'a1'],
		)
		try {
			// The option names a parent row. Its child rows would have no place, so it stays in the list.
			expect(ids(view.api.rows())).toEqual(['b', 'a', 'a1'])
			expect(view.api.rowPin('a')).toBeUndefined()
			expect(view.api.rowPin('b')).toBe('top')
			view.api.pinRow('b', 'bottom')
			expect(view.state.rowPinning).toEqual({ top: ['a'], bottom: ['b'] })
			expect(ids(view.api.rows())).toEqual(['a', 'a1', 'b'])
		} finally {
			view.unmount()
		}
	})

	test('a pin that empties the last page moves the page of the state back', () => {
		const view = setup(people(5), { defaultPage: { page: 3, pageSize: 2 } }, ['r4'])
		try {
			expect(ids(view.api.rows())).toEqual(['r4'])
			view.api.pinRow('r4', 'top')
			expect(view.state.page).toEqual({ page: 2, pageSize: 2 })
			expect(ids(view.api.rows())).toEqual(['r4', 'r2', 'r3'])
		} finally {
			view.unmount()
		}
	})

	test('the active cell stays on its row when a row above it is pinned', () => {
		const view = setup(people(6))
		try {
			view.api.grid.focus({ row: 4, col: 1 }, { reason: 'imperative' })
			const cell = view.part('cell', 'r3|score')
			expect(cell?.getAttribute('tabindex')).toBe('0')
			view.api.pinRow('r5', 'top')
			// The row moved one place down, and the cell that has focus is the same element.
			expect(view.state.active).toEqual({ row: 5, col: 1 })
			expect(view.api.rows()[4]?.id).toBe('r3')
			view.api.pinRow('r5', null)
			expect(view.state.active).toEqual({ row: 4, col: 1 })
			// The row leaves the list: the active cell keeps its place, as far as the rows go.
			view.api.setSearch('Person 0')
			expect(view.state.active).toEqual({ row: 2, col: 1 })
		} finally {
			view.unmount()
		}
	})
})

describe('detail rows', () => {
	test('a row with a detail row expands, and the detail row is one wide cell of the grid', async () => {
		const view = mount(
			table,
			{
				rows: people(3),
				columns,
				hasDetail: (row: Person) => row.id !== 'r2',
				defaultExpanded: ['r0'],
			} as TableOptions,
			`<root aria-label="People"><header-row index="0"><cell value="h|name" row="0" col="0" header>x</cell><cell value="h|score" row="0" col="1" header>x</cell></header-row><row value="r0" index="1"><cell value="r0|name" row="1" col="0">x</cell><cell value="r0|score" row="1" col="1">x</cell></row><row value="${detailRowId('r0')}" index="2"><cell value="d|r0" row="2" col="0" colspan="2">x</cell></row><row value="r1" index="3"><cell value="r1|name" row="3" col="0">x</cell><cell value="r1|score" row="3" col="1">x</cell></row></root>`,
		)
		try {
			const row = view.part('row', 'r0')
			// A table with detail rows is not a tree.
			expect(view.root.getAttribute('role')).toBe('grid')
			expect(ids(view.api.rows())).toEqual(['r0', detailRowId('r0'), 'r1', 'r2'])
			expect(row?.getAttribute('aria-expanded')).toBe('true')
			expect(view.part('row', 'r1')?.getAttribute('aria-expanded')).toBe('false')
			const detail = view.part('row', detailRowId('r0'))
			expect(detail?.getAttribute('data-kind')).toBe('detail')
			expect(detail?.hasAttribute('aria-selected')).toBe(false)
			expect(detail?.hasAttribute('aria-expanded')).toBe(false)
			expect(view.root.getAttribute('aria-rowcount')).toBe('6')

			// From the second column down onto the wide cell, and down again in the same column.
			;(view.part('cell', 'r0|score') as HTMLElement).focus()
			await view.keys('ArrowDown')
			expect(view.state.active).toEqual({ row: 2, col: 0 })
			await view.keys('ArrowDown')
			expect(view.state.active).toEqual({ row: 3, col: 1 })

			// Enter on a cell of the row closes its detail row.
			;(view.part('cell', 'r0|name') as HTMLElement).focus()
			await view.keys('Enter')
			expect(view.state.expanded).toEqual([])
			expect(view.changes.at(-1)).toMatchObject({ key: 'expanded', reason: 'press' })
			expect(row?.getAttribute('aria-expanded')).toBe('false')
			view.api.expand('r1')
			expect(ids(view.api.rows())).toEqual(['r0', 'r1', detailRowId('r1'), 'r2'])
			expect(() => view.api.expand('r2')).toThrow('No row or group "r2" that can expand')
		} finally {
			view.unmount()
		}
	})
})

describe('detail rows and other rows that open', () => {
	test('`expandAll` leaves an open detail row open', () => {
		const everyRow = () => true
		const view = setup(people(3), { hasDetail: everyRow, defaultExpanded: ['r0'] }, ['r0'])
		try {
			view.api.expandAll()
			expect(view.state.expanded).toEqual(['r0'])
			expect(ids(view.api.rows())).toEqual(['r0', detailRowId('r0'), 'r1', 'r2'])
		} finally {
			view.unmount()
		}
	})

	test('a row that shows as one that can open, opens', () => {
		const tree: Person[] = [
			{ id: 'a', name: 'Aino', score: 1, reports: [{ id: 'a1', name: 'Eero', score: 2 }] },
			{ id: 'b', name: 'Helmi', score: 3 },
		]
		const everyRow = () => true
		const view = setup(
			tree,
			{
				getChildren: (row) => row.reports,
				hasDetail: everyRow,
				defaultRowPinning: { top: ['a1'] },
			},
			['a1', 'a', 'b'],
		)
		try {
			// The only child row is pinned, so in the list the row has a detail row and no child rows.
			expect(view.part('row', 'a')?.getAttribute('aria-expanded')).toBe('false')
			view.api.toggleExpanded('a')
			expect(ids(view.api.rows())).toEqual(['a1', 'a', detailRowId('a'), 'b'])
		} finally {
			view.unmount()
		}
	})

	test('a data row cannot have the id of a detail row', () => {
		const rows: Person[] = [
			{ id: 'a', name: 'Aino', score: 1 },
			{ id: detailRowId('a'), name: 'Odd', score: 2 },
		]
		expect(() => {
			const view = setup(rows, { hasDetail: (row) => row.id === 'a', defaultExpanded: ['a'] }, [
				'a',
			])
			try {
				view.api.rows()
			} finally {
				view.unmount()
			}
		}).toThrow('Row id "detail/a" is also the id of the detail row of row "a".')
	})
})

describe('sticky rows', () => {
	test('the header rows and the footer row stick when the options say so', () => {
		const view = setup(people(3), { stickyHeader: true, stickyFooter: true })
		try {
			expect(headerRow(view)?.getAttribute('data-sticky')).toBe('top')
			const footer = footerRow(view)
			expect(footer?.getAttribute('data-sticky')).toBe('bottom')
			expect(footer?.getAttribute('data-kind')).toBe('footer')
		} finally {
			view.unmount()
		}
		const plain = setup(people(3))
		try {
			expect(headerRow(plain)?.hasAttribute('data-sticky')).toBe(false)
			expect(footerRow(plain)?.hasAttribute('data-sticky')).toBe(false)
		} finally {
			plain.unmount()
		}
	})

	test('each sticky row starts where the sticky rows before it end', async () => {
		const listeners = new Set<(liveOnly: boolean) => void>()
		const destroy: (() => void)[] = []
		let pinned: { key: string; edge: 'top' | 'bottom' }[] = [{ key: 'b', edge: 'top' }]
		const sticky = createStickyRows(
			{
				store: {
					subscribe: (listener: (liveOnly: boolean) => void) => {
						listeners.add(listener)
						return () => listeners.delete(listener)
					},
				},
				onDestroy: (cleanup: () => void) => destroy.push(cleanup),
			} as never,
			{ keyed: () => pinned },
		)
		const body = document.createElement('tbody')
		const row = (height: number) => {
			const el = document.createElement('tr')
			el.getBoundingClientRect = () => ({ height, top: 0, bottom: height }) as DOMRect
			body.append(el)
			return el
		}
		const header = row(30)
		const a = row(20)
		const b = row(24)
		const c = row(20)
		const footer = row(28)
		document.body.append(body)
		let headerSticks = true
		const leave = [
			sticky.bindGroup(body),
			sticky.bind(header, () => (headerSticks ? 'top' : undefined)),
			sticky.bind(footer, () => 'bottom'),
			sticky.bindKeyed(a, 'a'),
			sticky.bindKeyed(b, 'b'),
			sticky.bindKeyed(c, 'c'),
		]
		const offset = (el: HTMLElement) => el.style.getPropertyValue('--table-sticky-offset')
		const sizes = () => [
			body.style.getPropertyValue('--table-sticky-top-size'),
			body.style.getPropertyValue('--table-sticky-bottom-size'),
		]
		const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve))
		try {
			await settle()
			expect([offset(header), offset(a), offset(b), offset(footer)]).toEqual([
				'0px',
				'',
				'30px',
				'0px',
			])
			expect(sizes()).toEqual(['54px', '28px'])

			// A second row at the bottom goes over the footer, and the header can stop to stick.
			pinned = [
				{ key: 'b', edge: 'top' },
				{ key: 'c', edge: 'bottom' },
			]
			headerSticks = false
			for (const listener of listeners) listener(false)
			await settle()
			expect([offset(header), offset(b), offset(c), offset(footer)]).toEqual([
				'',
				'0px',
				'28px',
				'0px',
			])
			expect(sizes()).toEqual(['24px', '48px'])

			// A change of live state only moves no row.
			pinned = []
			for (const listener of listeners) listener(true)
			await settle()
			expect(offset(b)).toBe('0px')
			sticky.refresh()
			await settle()
			expect([offset(b), offset(c)]).toEqual(['', ''])
			expect(sizes()).toEqual(['0px', '28px'])
		} finally {
			leave.forEach((cleanup) => cleanup())
			destroy.forEach((cleanup) => cleanup())
			body.remove()
		}
		expect(sizes()).toEqual(['', ''])
		expect(offset(footer)).toBe('')
	})
})

describe('row window', () => {
	const spacers = `<spacer value="gap-0" size="0"></spacer>`

	test('two tables in one frame switch scroll anchoring off once and on once', async () => {
		const page = document.documentElement
		page.style.setProperty('overflow-anchor', 'auto')
		const make = () => setup(people(50), { rowWindow: true, rowHeight: 20 }, ['r0'], spacers)
		const first = make()
		const second = make()
		try {
			await first.settle()
			await second.settle()
			expect(page.style.getPropertyValue('overflow-anchor')).toBe('none')
			first.unmount()
			// The second table still corrects the scroll position itself.
			expect(page.style.getPropertyValue('overflow-anchor')).toBe('none')
		} finally {
			second.unmount()
		}
		expect(page.style.getPropertyValue('overflow-anchor')).toBe('auto')
		page.style.removeProperty('overflow-anchor')
	})

	test('without the option, every row is rendered and no spacer is asked for', () => {
		const view = setup(people(500))
		try {
			expect(view.api.windowParts()).toBeUndefined()
			expect(view.root.hasAttribute('data-row-window')).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('before the page says where the frame is, the window holds the first rows', () => {
		// No spacer is in the page yet, as on a server.
		const view = setup(people(500), { rowWindow: true, rowHeight: 20, overscan: 2 })
		try {
			// A frame of 800 pixels: 40 rows, and 2 more.
			expect(view.state.rowWindow).toEqual({ start: 0, end: 42, keep: [] })
			expect(view.api.windowParts()?.at(-1)).toMatchObject({ kind: 'gap', from: 42, to: 500 })
		} finally {
			view.unmount()
		}
	})

	test('the window starts with the first rows, and gaps stand in for the rest', async () => {
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400)
		const view = setup(
			people(500),
			{ rowWindow: true, rowHeight: 20, overscan: 2 },
			undefined,
			spacers,
		)
		try {
			expect(view.root.hasAttribute('data-row-window')).toBe(true)
			expect(style(view.root)).toContain('--table-row-height:20px')
			await view.settle()
			// The frame is 400 pixels: the rows that it touches, and 2 more.
			expect(view.api.windowParts()).toEqual([
				{ kind: 'gap', key: 'gap-0', from: 0, to: 0, size: 0 },
				{ kind: 'rows', from: 0, to: 23 },
				{ kind: 'gap', key: 'gap-1', from: 23, to: 500, size: 9540 },
			])
			// Every row counts, rendered or not.
			expect(view.root.getAttribute('aria-rowcount')).toBe('502')
			const spacer = view.part('spacer', 'gap-0')
			expect(spacer?.getAttribute('aria-hidden')).toBe('true')
			expect(spacer?.hasAttribute('data-empty')).toBe(true)
			expect(style(spacer)).toContain('--table-spacer-size:0px')
			expect(spacer?.hasAttribute('role')).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('the window follows the frame, and a row that is asked for is reached in one scroll', async () => {
		// The page is the frame here. The list starts 100 pixels under the top of the page.
		let scrollY = 0
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400)
		const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(((move: ScrollToOptions) => {
			// One step, also on a page that animates its scrolls.
			expect(move.behavior).toBe('instant')
			scrollY += move.top ?? 0
		}) as typeof window.scrollBy)
		const view = setup(
			people(500),
			{ rowWindow: true, rowHeight: 20, overscan: 2 },
			undefined,
			spacers,
		)
		try {
			const origin = view.part('spacer', 'gap-0') as HTMLElement
			origin.getBoundingClientRect = () => ({ top: 100 - scrollY }) as DOMRect
			await view.settle()
			view.api.scrollToRow('r300', 'start')
			expect(scrollBy).toHaveBeenCalledTimes(1)
			// Row 300 starts 6,000 pixels into the list, which starts at 100.
			expect(scrollY).toBe(6100)
			expect(view.state.rowWindow).toMatchObject({ start: 298, end: 323 })

			view.api.scrollToRow('r300', 'nearest')
			expect(scrollY).toBe(6100)
			view.api.scrollToRow('r499', 'end')
			expect(scrollY).toBe(100 + 500 * 20 - 400)
			expect(view.state.rowWindow).toMatchObject({ start: 478, end: 500 })
			view.api.scrollToRow('r250', 'center')
			expect(scrollY).toBe(100 + 250 * 20 + 10 - 200)

			// Focus on a cell of a row that is not in the page brings the frame to that row.
			view.api.grid.focus({ row: 8, col: 0 }, { reason: 'imperative' })
			expect(scrollY).toBe(240)
			expect(view.state.rowWindow).toMatchObject({ start: 5, end: 30, keep: [] })
			// A person scrolls away: the row of the active cell stays rendered, far from the frame.
			scrollY = 6100
			window.dispatchEvent(new Event('scroll'))
			expect(view.state.rowWindow).toMatchObject({ start: 298, end: 323, keep: [7] })
			expect(view.api.windowParts()?.map((part) => part.kind)).toEqual([
				'gap',
				'rows',
				'gap',
				'rows',
				'gap',
			])

			scrollY = 100
			window.dispatchEvent(new Event('scroll'))
			expect(view.state.rowWindow).toMatchObject({ start: 0, end: 23, keep: [] })

			// The top of the frame cuts the third row. A press on it leaves the rows
			// where they are: the row is under the pointer.
			scrollY = 150
			window.dispatchEvent(new Event('scroll'))
			view.api.grid.focus({ row: 3, col: 0 }, { reason: 'item-press' })
			expect(scrollY).toBe(150)
			// A key that moves to a row brings all of it into the frame.
			const cell = view.part('cell', 'r2|name') as HTMLElement
			cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
			expect(view.state.active).toEqual({ row: 2, col: 0 })
			expect(scrollY).toBe(120)

			expect(() => view.api.scrollToRow('nope')).toThrow('No row "nope" to scroll to')
			expect(() => view.api.scrollToRow('r1', 'top' as never)).toThrow(
				'"start", "center", "end" or "nearest"',
			)
			view.api.setSearch('Person 49')
			expect(() => view.api.scrollToRow('r1')).toThrow('Row "r1" is not in the list now')
		} finally {
			view.unmount()
		}
	})
})
