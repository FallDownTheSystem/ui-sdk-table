import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { h, nextTick } from 'vue'
import {
	createTableController,
	rowNumberColumn,
	Table,
	type CellAttrsContext,
	type ColumnDef,
	type LetterSlotProps,
} from './index'

// The row of letters as the renderer builds it: its place above the header
// rows, with header groups, and when the option comes and goes.

type Part = { id: string; name: string; kind: string; price: number }

const rows: Part[] = [
	{ id: 'a', name: 'Bolt', kind: 'Steel', price: 2.5 },
	{ id: 'b', name: 'Nut', kind: 'Steel', price: 0.5 },
]

const columns: ColumnDef<Part>[] = [
	rowNumberColumn<Part>(),
	{ id: 'name', header: 'Name' },
	{ id: 'about', header: 'About', columns: [{ id: 'kind', header: 'Kind' }, { id: 'price' }] },
]

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

function setup(props: Record<string, unknown>, slots: Record<string, unknown> = {}) {
	const controller = createTableController()
	const wrapper = mount(Table, {
		attachTo: document.body,
		props: { rows, columns, controller, cellSelection: true, 'aria-label': 'Parts', ...props },
		slots,
	} as never)
	wrappers.push(wrapper)
	const rowAt = (index: number) => wrapper.find(`tr[aria-rowindex="${index}"]`)
	return { wrapper, controller, rowAt }
}

test('the letters stand above the header rows of a header group, one cell for each column', () => {
	const contexts: Extract<CellAttrsContext<Part>, { kind: 'letter' }>[] = []
	const { wrapper, rowAt } = setup({
		columnLetters: true,
		cellAttrs: (context: CellAttrsContext<Part>) => {
			if (context.kind === 'letter') contexts.push(context)
			return undefined
		},
	})
	expect(wrapper.find('table').attributes('aria-rowcount')).toBe('5')
	expect(rowAt(1).attributes('data-kind')).toBe('letters')
	expect(
		rowAt(1)
			.findAll('th')
			.map((cell) => cell.text()),
	).toEqual(['', 'A', 'B', 'C'])
	// The group covers two columns in the second row of the grid, and the letters split it.
	expect(
		rowAt(2)
			.findAll('th')
			.map((cell) => cell.text()),
	).toEqual(['', 'Name', 'About'])
	expect(rowAt(2).find('[data-column="about"]').attributes('colspan')).toBe('2')
	expect(
		rowAt(3)
			.findAll('th')
			.map((cell) => cell.text()),
	).toEqual(['Kind', 'price'])
	expect(rowAt(4).find('[data-column="name"]').text()).toBe('Bolt')
	expect(contexts.map((context) => [context.column.id, context.letter, context.corner])).toEqual([
		['#', undefined, true],
		['name', 'A', false],
		['kind', 'B', false],
		['price', 'C', false],
	])
})

test('the `letter` slot shows a cell, and its `selectColumn` selects what a press does', async () => {
	const seen: LetterSlotProps<Part>[] = []
	const { wrapper, controller, rowAt } = setup(
		{ columnLetters: true },
		{
			letter: (props: LetterSlotProps<Part>) => {
				seen.push(props)
				return h('span', { class: 'mark' }, props.corner ? '*' : (props.letter ?? '-'))
			},
		},
	)
	expect(
		rowAt(1)
			.findAll('.mark')
			.map((cell) => cell.text()),
	).toEqual(['*', 'A', 'B', 'C'])
	seen.find((props) => props.letter === 'B')?.selectColumn()
	await nextTick()
	expect(controller.getView()?.cellSelection).toMatchObject({
		from: { rowId: 'a', columnId: 'kind' },
		to: { rowId: 'b', columnId: 'kind' },
	})
	seen.find((props) => props.corner)?.selectColumn()
	await nextTick()
	expect(controller.getView()?.cellSelection).toMatchObject({
		from: { columnId: 'name' },
		to: { columnId: 'price' },
		columns: 3,
	})
	expect(wrapper.findAll('tr[data-kind="letters"] th[data-selected]')).toHaveLength(3)
})

test('the option comes and goes: the rows under it move, and the active cell stays on its cell', async () => {
	const { wrapper, controller, rowAt } = setup({ sheet: true })
	expect(wrapper.find('tr[data-kind="letters"]').exists()).toBe(false)
	expect(
		rowAt(1)
			.findAll('th')
			.map((cell) => cell.text()),
	).toEqual(['', 'Name', 'About'])
	;(rowAt(4).find('[data-column="kind"]').element as HTMLElement).focus()
	await nextTick()
	expect(controller.getView()?.activeCell).toEqual({ rowId: 'b', columnId: 'kind' })

	await wrapper.setProps({ columnLetters: true })
	await new Promise((resolve) => setTimeout(resolve))
	expect(rowAt(1).attributes('data-kind')).toBe('letters')
	expect(rowAt(5).find('[data-column="kind"]').text()).toBe('Steel')
	expect(controller.getView()?.activeCell).toEqual({ rowId: 'b', columnId: 'kind' })
	expect(rowAt(5).find('[data-column="kind"]').attributes('data-active')).toBe('')

	await wrapper.setProps({ columnLetters: false })
	await new Promise((resolve) => setTimeout(resolve))
	expect(wrapper.find('tr[data-kind="letters"]').exists()).toBe(false)
	expect(controller.getView()?.activeCell).toEqual({ rowId: 'b', columnId: 'kind' })
})
