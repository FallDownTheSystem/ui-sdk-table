import { definePrimitive, selects } from '@ui-sdk/core'
import { mount } from '@ui-sdk/core/testing'
import { expect, test } from 'vite-plus/test'

// P5 of the sheet work: a reader of our own for `selects`. A proof of UI SDK
// 0.1.0-beta.13. `byCell` and `byCellRange` are readers that UI SDK ships: an
// object with `values`, the names that a part listens to, and `moved`, which
// names the parts that a change reaches. The formats of cells will be a
// record by row and by column, and their reader must wake the cells of one
// row or of one column, and no other cell.

type Formats = Readonly<Record<string, string>>

let calls: string[] = []

const byFormat = {
	values: ({ props }: { props: { row: string; col: string } }) => [
		`row:${props.row}`,
		`col:${props.col}`,
	],
	moved(previous: Formats | undefined, next: Formats | undefined, notify: (name: string) => void) {
		const names = new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})])
		for (const name of names) if (previous?.[name] !== next?.[name]) notify(name)
	},
}

const proof = definePrimitive({
	name: 'reader-proof',
	options: {},
	state: () => ({ formats: {} as Formats, other: 0 }),
	api: (context) => ({ set: (formats: Formats) => context.store.set({ formats }) }),
	slots: (slot) => ({
		root: slot({}),
		cell: slot<{ value: string; row: string; col: string }>({
			props: { value: 'string', row: 'string', col: 'string' },
			selects: selects({ formats: byFormat, other: [] }),
			attrs: (state, { props }) => {
				calls.push(props.value)
				return {
					'data-format': state.formats[`row:${props.row}`] ?? state.formats[`col:${props.col}`],
				}
			},
		}),
	}),
})

test('a reader of our own wakes the parts that it names, and no other part', async () => {
	const cells = ['a', 'b']
		.flatMap((row) =>
			['x', 'y'].map((col) => `<cell value="${row}${col}" row="${row}" col="${col}"></cell>`),
		)
		.join('')
	const view = mount(proof, {}, `<root>${cells}</root>`)
	try {
		await view.settle()
		calls = []
		view.api.set({ 'row:a': 'bold' })
		await view.settle()
		expect([...new Set(calls)].sort()).toEqual(['ax', 'ay'])
		expect(view.part('cell', 'ax')?.getAttribute('data-format')).toBe('bold')
		expect(view.part('cell', 'bx')?.getAttribute('data-format')).toBeNull()

		calls = []
		view.api.set({ 'row:a': 'bold', 'col:y': 'italic' })
		await view.settle()
		expect([...new Set(calls)].sort()).toEqual(['ay', 'by'])
		expect(view.part('cell', 'by')?.getAttribute('data-format')).toBe('italic')
	} finally {
		view.unmount()
	}
})
