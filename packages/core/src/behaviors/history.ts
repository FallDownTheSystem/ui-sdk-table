import type { PrimitiveContext } from '@ui-sdk/core'

/**
 * How a step went: it was put back or on again; the owner refused it; or
 * nothing of it is in the table any more.
 */
export type HistoryResult = 'done' | 'refused' | 'gone'

/** How many steps can be taken back, and how many can be put on again. */
export type HistoryCounts = { undo: number; redo: number }

export type StepHistory<State, Step> = {
	/** Adds a step that happened. The steps that were taken back go. Ignored while a step is applied. */
	record(step: Step): void
	/**
	 * Takes the last step back. A step that is gone is dropped, and the step
	 * before it is taken. `'empty'` when there is no step.
	 */
	undo(details?: { event?: Event }): HistoryResult | 'empty'
	/** Puts the step on again that was taken back last. */
	redo(details?: { event?: Event }): HistoryResult | 'empty'
	canUndo(state: State): boolean
	canRedo(state: State): boolean
	clear(): void
	/** The steps, oldest first, and how many of them are applied. */
	read(): { steps: readonly Step[]; position: number }
}

/**
 * The list of steps behind undo and redo. It knows no cell and no value: a
 * step is whatever the caller records, and `apply` of the caller puts one
 * back or on again and says how that went.
 *
 * It is built on no undo stack of UI SDK. `createUndoStack` keeps whole
 * values and gives no entry to read, to refuse or to drop, and
 * `createHistory` records the state keys of components through the agent
 * bridge. A step here is a change that the owner of the data applies, and
 * the owner can refuse it. This file is the one to change when UI SDK gets
 * a stack of changes.
 */
export function createStepHistory<State extends object, Step>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the `HistoryCounts`. */
		key: keyof State & string
		enabled: () => boolean
		/** How many steps the list holds. The oldest go first. */
		limit: () => number
		/** What a step weighs against `maxSize`. */
		size: (step: Step) => number
		/** What all steps together can weigh. The oldest go first. */
		maxSize: () => number
		/** Puts a step back or on again, and says how it went. */
		apply: (step: Step, direction: 'undo' | 'redo', details: { event?: Event }) => HistoryResult
		/** Runs after the list was emptied for a step that is larger than `maxSize`. */
		overflow?: (step: Step) => void
	},
): StepHistory<State, Step> {
	let steps: Step[] = []
	// How many steps are applied: the steps before this place can be taken back.
	let position = 0
	let applying = false
	let gone = false
	context.onDestroy(() => {
		gone = true
		steps = []
		position = 0
	})

	const counts = (state: State) => state[options.key] as HistoryCounts

	// The numbers are bookkeeping. What a person sees change is the values, and those are reported by `apply`.
	function publish(): void {
		if (gone) return
		const now = counts(context.store.get())
		const redo = steps.length - position
		if (now.undo === position && now.redo === redo) return
		context.store.set({ [options.key]: { undo: position, redo } } as Partial<State>)
	}

	function run(direction: 'undo' | 'redo', details: { event?: Event }): HistoryResult | 'empty' {
		// A step that is applied reports values, and a listener of that report must not start another step.
		if (applying || gone) return 'empty'
		let dropped = false
		applying = true
		try {
			for (;;) {
				const index = direction === 'undo' ? position - 1 : position
				const step = steps[index]
				if (!step) return dropped ? 'gone' : 'empty'
				const result = options.apply(step, direction, details)
				if (result === 'refused') return result
				if (result === 'done') {
					position += direction === 'undo' ? -1 : 1
					return result
				}
				// Nothing of the step is in the table. A step that stays would block every step under it.
				steps.splice(index, 1)
				if (direction === 'undo') position--
				dropped = true
			}
		} finally {
			applying = false
			publish()
		}
	}

	return {
		record(step) {
			if (applying || gone || !options.enabled()) return
			const maxSize = options.maxSize()
			const size = options.size(step)
			if (size > maxSize) {
				// A list that leaves out its newest step would take back an older step in its place.
				steps = []
				position = 0
				publish()
				options.overflow?.(step)
				return
			}
			steps.length = position
			steps.push(step)
			const limit = Math.max(1, options.limit())
			let total = 0
			for (const item of steps) total += options.size(item)
			let drop = Math.max(0, steps.length - limit)
			let weight = 0
			for (let index = 0; index < drop; index++) weight += options.size(steps[index] as Step)
			while (total - weight > maxSize && drop < steps.length - 1) {
				weight += options.size(steps[drop] as Step)
				drop++
			}
			if (drop) steps.splice(0, drop)
			position = steps.length
			publish()
		},
		undo: (details = {}) => run('undo', details),
		redo: (details = {}) => run('redo', details),
		canUndo: (state) => options.enabled() && counts(state).undo > 0,
		canRedo: (state) => options.enabled() && counts(state).redo > 0,
		clear() {
			if (!steps.length) return
			steps = []
			position = 0
			publish()
		},
		read: () => ({ steps, position }),
	}
}
