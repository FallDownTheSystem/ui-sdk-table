import { describe, expect, test } from 'vite-plus/test'
import { createStepHistory, type HistoryCounts, type HistoryResult } from './history'

type State = { history: HistoryCounts }
type Step = { name: string; size?: number }

function setup(given: { limit?: number; maxSize?: number } = {}) {
	let state: State = { history: { undo: 0, redo: 0 } }
	const world = {
		enabled: true,
		applied: [] as string[],
		answer: {} as Record<string, HistoryResult>,
		overflow: [] as string[],
		during: undefined as (() => void) | undefined,
	}
	const destroy: (() => void)[] = []
	const history = createStepHistory<State, Step>(
		{
			store: {
				get: () => state,
				set: (patch: Partial<State>) => {
					state = { ...state, ...patch }
				},
			} as never,
			onDestroy: (run) => void destroy.push(run),
		},
		{
			key: 'history',
			enabled: () => world.enabled,
			limit: () => given.limit ?? 100,
			size: (step) => step.size ?? 1,
			maxSize: () => given.maxSize ?? 1000,
			apply: (step, direction) => {
				world.applied.push(`${direction} ${step.name}`)
				world.during?.()
				return world.answer[step.name] ?? 'done'
			},
			overflow: (step) => world.overflow.push(step.name),
		},
	)
	const names = () => history.read().steps.map((step) => step.name)
	return {
		history,
		world,
		names,
		state: () => state,
		destroy: () => destroy.forEach((run) => run()),
	}
}

describe('the list of steps', () => {
	test('a step is taken back and put on again, last first', () => {
		const { history, world, state } = setup()
		expect(history.undo()).toBe('empty')
		history.record({ name: 'a' })
		history.record({ name: 'b' })
		expect(state().history).toEqual({ undo: 2, redo: 0 })
		expect(history.canUndo(state())).toBe(true)
		expect(history.canRedo(state())).toBe(false)
		expect(history.undo()).toBe('done')
		expect(history.undo()).toBe('done')
		expect(history.undo()).toBe('empty')
		expect(state().history).toEqual({ undo: 0, redo: 2 })
		expect(history.redo()).toBe('done')
		expect(world.applied).toEqual(['undo b', 'undo a', 'redo a'])
		expect(history.read().position).toBe(1)
	})

	test('a new step after an undo drops the steps that were taken back', () => {
		const { history, names, state } = setup()
		history.record({ name: 'a' })
		history.record({ name: 'b' })
		history.undo()
		history.record({ name: 'c' })
		expect(names()).toEqual(['a', 'c'])
		expect(state().history).toEqual({ undo: 2, redo: 0 })
		expect(history.redo()).toBe('empty')
	})

	test('`limit` keeps the newest steps', () => {
		const { history, names } = setup({ limit: 2 })
		for (const name of ['a', 'b', 'c']) history.record({ name })
		expect(names()).toEqual(['b', 'c'])
	})

	test('`maxSize` drops the oldest steps, and a step that is larger empties the list', () => {
		const { history, names, world, state } = setup({ maxSize: 10 })
		history.record({ name: 'a', size: 4 })
		history.record({ name: 'b', size: 4 })
		history.record({ name: 'c', size: 4 })
		expect(names()).toEqual(['b', 'c'])
		history.record({ name: 'huge', size: 11 })
		expect(names()).toEqual([])
		expect(world.overflow).toEqual(['huge'])
		expect(state().history).toEqual({ undo: 0, redo: 0 })
	})

	test('a step that the owner refuses stays where it is', () => {
		const { history, world, state } = setup()
		history.record({ name: 'a' })
		world.answer.a = 'refused'
		expect(history.undo()).toBe('refused')
		expect(state().history).toEqual({ undo: 1, redo: 0 })
		world.answer.a = 'done'
		expect(history.undo()).toBe('done')
	})

	test('a step that is gone is dropped, and the step before it is taken in the same call', () => {
		const { history, world, names, state } = setup()
		for (const name of ['a', 'b', 'c']) history.record({ name })
		world.answer.c = 'gone'
		world.answer.b = 'gone'
		expect(history.undo()).toBe('done')
		expect(world.applied).toEqual(['undo c', 'undo b', 'undo a'])
		expect(names()).toEqual(['a'])
		expect(state().history).toEqual({ undo: 0, redo: 1 })
		// When every step is gone, the answer says so.
		world.answer.a = 'gone'
		expect(history.redo()).toBe('gone')
		expect(names()).toEqual([])
	})

	test('a step that is recorded while another is applied is ignored, and so is an undo inside an undo', () => {
		const { history, world, names } = setup()
		history.record({ name: 'a' })
		world.during = () => {
			history.record({ name: 'echo' })
			expect(history.undo()).toBe('empty')
		}
		expect(history.undo()).toBe('done')
		expect(names()).toEqual(['a'])
	})

	test('a history that is off records nothing, and `clear` forgets every step', () => {
		const { history, world, names, state } = setup()
		world.enabled = false
		history.record({ name: 'a' })
		expect(names()).toEqual([])
		world.enabled = true
		history.record({ name: 'a' })
		history.record({ name: 'b' })
		history.undo()
		history.clear()
		expect(names()).toEqual([])
		expect(state().history).toEqual({ undo: 0, redo: 0 })
		expect(history.canUndo(state())).toBe(false)
	})

	test('after the table is gone, nothing is recorded and nothing is applied', () => {
		const { history, world, names, destroy } = setup()
		history.record({ name: 'a' })
		destroy()
		expect(names()).toEqual([])
		history.record({ name: 'b' })
		expect(history.undo()).toBe('empty')
		expect(world.applied).toEqual([])
	})
})
