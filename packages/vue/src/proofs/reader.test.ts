import { createChange, definePrimitive, selects, type ChangeDetails } from '@ui-sdk/core'
import { createAgent } from '@ui-sdk/vue/agent'
import { createParts, usePart, usePrimitive, type PrimitiveHandle } from '@ui-sdk/vue/primitive'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, shallowRef, type PropType, type Ref } from 'vue'

// The Vue half of P5 of the sheet work, and R7. Proofs of UI SDK
// 0.1.0-beta.13 in Vue.
//
// P5: the format of a cell changes its text and often no attribute (two
// decimals in place of none). The text is rendered by the default slot of
// the cell part. So a part that a reader of our own wakes must run its
// default slot again when its `state` changed, also when its `attrs` did
// not, and a part that the reader does not name must not run its slot.
//
// R7: the formats are a state key of the owner and can hold 50,000 entries.
// The snapshot of an agent must not carry that record, or every look at the
// page would cost its size.

type Formats = Readonly<Record<string, string>>

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

type ProofOptions = {
	formats?: Formats
	defaultFormats?: Formats
	onFormatsChange?: (value: Formats, details: ChangeDetails) => void
}

const proof = definePrimitive({
	name: 'vue-reader-proof',
	options: { formats: 'value', defaultFormats: 'value', onFormatsChange: 'callback' },
	controlled: ['formats'],
	state: (options: ProofOptions) => ({
		formats: options.formats ?? options.defaultFormats ?? ({} as Formats),
	}),
	api: (context) => ({
		set: (formats: Formats) => context.store.set({ formats }),
		count: () => Object.keys(context.store.get().formats).length,
	}),
	slots: (slot) => ({
		root: slot({ role: 'group' }),
		cell: slot<{ value: string; row: string; col: string }>({
			props: { value: 'string', row: 'string', col: 'string' },
			selects: selects({ formats: byFormat }),
			// The format is in the state of the part and in no attribute.
			state: (state, { props }) => ({
				format: state.formats[`row:${props.row}`] ?? state.formats[`col:${props.col}`],
			}),
			attrs: () => ({}),
		}),
	}),
	agent: { actions: ['count'] },
})

const { Cell } = createParts(proof, { root: 'div', cell: 'span' })

type Handle = PrimitiveHandle<typeof proof>

const RootPart = defineComponent({
	name: 'ProofRootPart',
	inheritAttrs: false,
	props: { handle: { type: Object as PropType<Handle>, required: true } },
	setup: (props) => usePart(props.handle, 'root', undefined, undefined, 'div'),
})

function mountProof(defaultFormats: Formats = {}) {
	const runs: string[] = []
	let api: Handle['api'] | undefined
	const Probe = defineComponent(() => {
		const handle = usePrimitive(proof, () => ({ defaultFormats })) as Handle
		api = handle.api
		return () =>
			h(RootPart, { handle, 'aria-label': 'Formats' }, () =>
				['a', 'b'].flatMap((row) =>
					['x', 'y'].map((col) =>
						h(
							Cell,
							{ key: row + col, value: row + col, row, col },
							{
								default: (cell: { state: { format?: string } }) => {
									runs.push(row + col)
									return cell.state.format ?? 'plain'
								},
							},
						),
					),
				),
			)
	})
	const wrapper = mount(Probe, { attachTo: document.body })
	return { wrapper, runs, api }
}

test('a part that a reader of our own wakes runs its default slot again in Vue, and no other part does', async () => {
	const { wrapper, runs, api } = mountProof()
	const texts = () => wrapper.findAll('span').map((cell) => cell.text())
	expect(texts()).toEqual(['plain', 'plain', 'plain', 'plain'])
	expect(api).toBeDefined()

	runs.length = 0
	api?.set({ 'row:a': 'bold' })
	await nextTick()
	expect(texts()).toEqual(['bold', 'bold', 'plain', 'plain'])
	expect([...new Set(runs)].toSorted()).toEqual(['ax', 'ay'])

	runs.length = 0
	api?.set({ 'row:a': 'bold', 'col:y': 'italic' })
	await nextTick()
	expect(texts()).toEqual(['bold', 'bold', 'plain', 'italic'])
	// `ay` is named by its column, and its state stays the format of its row.
	expect(runs).not.toContain('ax')
	expect(runs).not.toContain('bx')
	expect(runs).toContain('by')
	wrapper.unmount()
})

// R7. `createChange` treats a key as controlled when its option is given,
// with or without a line in `controlled`; the snapshot of an agent reads only
// the keys of that list.
const quiet = definePrimitive({
	name: 'vue-quiet-proof',
	options: { formats: 'value', defaultFormats: 'value', onFormatsChange: 'callback' },
	state: (options: ProofOptions) => ({
		formats: options.formats ?? options.defaultFormats ?? ({} as Formats),
	}),
	sync: (options) => (options.formats === undefined ? {} : { formats: options.formats }),
	api: (context) => {
		const change = createChange(context)
		return {
			set: (formats: Formats) => change('formats', formats, { reason: 'imperative' }),
			read: () => context.store.get().formats,
		}
	},
	slots: (slot) => ({ root: slot({ role: 'group' }) }),
	agent: { actions: ['read'] },
})

type QuietHandle = PrimitiveHandle<typeof quiet>

const QuietRoot = defineComponent({
	name: 'QuietRootPart',
	inheritAttrs: false,
	props: { handle: { type: Object as PropType<QuietHandle>, required: true } },
	setup: (props) => usePart(props.handle, 'root', undefined, undefined, 'div'),
})

function mountQuiet(given: { formats?: Ref<Formats>; defaultFormats?: Formats; refuse?: boolean }) {
	const told: Formats[] = []
	let api: QuietHandle['api'] | undefined
	const Probe = defineComponent(() => {
		const handle = usePrimitive(quiet, () => ({
			formats: given.formats?.value,
			defaultFormats: given.defaultFormats,
			onFormatsChange: (value: Formats, details: ChangeDetails) => {
				told.push(value)
				if (given.refuse) details.cancel()
			},
		})) as QuietHandle
		api = handle.api
		return () => h(QuietRoot, { handle, 'aria-label': 'Quiet formats' })
	})
	const wrapper = mount(Probe, { attachTo: document.body })
	return { wrapper, told, api }
}

test('the snapshot of an agent holds every controlled state key whole, so a large key must stay out of `controlled`', () => {
	const large: Record<string, string> = {}
	for (let index = 0; index < 50_000; index++) large[`row:r${index}`] = 'bold'
	const agent = createAgent()

	const listed = mountProof(large)
	const start = performance.now()
	const heavy = JSON.stringify(agent.snapshot().find((entry) => entry.label === 'Formats'))
	const spent = performance.now() - start
	listed.wrapper.unmount()
	// Every look of an agent at the page would carry the record: about a megabyte.
	expect(heavy.length).toBeGreaterThan(500_000)
	expect(spent).toBeLessThan(1_000)

	const unlisted = mountQuiet({ defaultFormats: large })
	const light = JSON.stringify(agent.snapshot().find((entry) => entry.label === 'Quiet formats'))
	unlisted.wrapper.unmount()
	expect(light.length).toBeLessThan(500)
	expect(light).not.toContain('row:r1')
})

test('a key outside `controlled` still follows the state contract: the owner holds it, or the component does', async () => {
	// The owner holds the value: a change is reported and the state waits for the owner.
	const held = shallowRef<Formats>({ 'row:a': 'bold' })
	const owned = mountQuiet({ formats: held })
	expect(owned.api?.set({ 'row:b': 'italic' })).toBe(true)
	expect(owned.told).toEqual([{ 'row:b': 'italic' }])
	expect(owned.api?.read()).toEqual({ 'row:a': 'bold' })
	held.value = { 'row:b': 'italic' }
	await nextTick()
	expect(owned.api?.read()).toEqual({ 'row:b': 'italic' })
	owned.wrapper.unmount()

	// No owner: the component keeps the value itself.
	const free = mountQuiet({ defaultFormats: { 'row:a': 'bold' } })
	free.api?.set({ 'row:b': 'italic' })
	expect(free.api?.read()).toEqual({ 'row:b': 'italic' })
	free.wrapper.unmount()

	// A listener that refuses keeps the value as it was.
	const refused = mountQuiet({ defaultFormats: { 'row:a': 'bold' }, refuse: true })
	expect(refused.api?.set({ 'row:b': 'italic' })).toBe(false)
	expect(refused.api?.read()).toEqual({ 'row:a': 'bold' })
	refused.wrapper.unmount()
})
