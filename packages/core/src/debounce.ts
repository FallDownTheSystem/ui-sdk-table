export type DebounceOptions = {
	/**
	 * Milliseconds that the calls must pause before the function runs. A
	 * function is read at each call, so the pause can follow an option.
	 * Defaults to 200. With 0 or less, each call runs at once.
	 */
	debounce?: number | (() => number | undefined)
}

export type Debounce<Args extends readonly unknown[]> = {
	/**
	 * Asks for a run with these arguments, after the pause. A call that
	 * waits is replaced: the function runs once, with the last arguments.
	 */
	call(...args: Args): void
	/** Drops the call that waits. The function does not run. */
	cancel(): void
	/** Runs the call that waits now. Without one, nothing happens. */
	flush(): void
	/** Whether a call waits. */
	pending(): boolean
}

export const DEFAULT_DEBOUNCE = 200

/**
 * Runs a function once after its calls pause: for work that follows what a
 * person types, such as a search. The name and the default of the `debounce`
 * option are those of the async options of UI SDK.
 *
 * The call that waits is no longer waiting when the function runs, so the
 * function can ask for a new run, and `pending` inside it answers false.
 * Call `cancel` when the owner of the function goes away.
 */
export function createDebounce<Args extends readonly unknown[]>(
	run: (...args: Args) => void,
	options: DebounceOptions = {},
): Debounce<Args> {
	if (typeof run !== 'function') throw new Error('`createDebounce` takes a function to run.')
	let waiting: { args: Args; timer: ReturnType<typeof setTimeout> } | undefined

	const pause = (): number => {
		const { debounce } = options
		const value = typeof debounce === 'function' ? debounce() : debounce
		if (value === undefined) return DEFAULT_DEBOUNCE
		if (typeof value !== 'number' || Number.isNaN(value)) {
			throw new Error('`debounce` is a number of milliseconds, or a function that returns one.')
		}
		return value
	}

	function cancel(): void {
		if (!waiting) return
		clearTimeout(waiting.timer)
		waiting = undefined
	}

	function flush(): void {
		if (!waiting) return
		const { args } = waiting
		cancel()
		run(...args)
	}

	return {
		call(...args) {
			const wait = pause()
			cancel()
			if (wait <= 0) {
				run(...args)
				return
			}
			waiting = { args, timer: setTimeout(flush, wait) }
		},
		cancel,
		flush,
		pending: () => waiting !== undefined,
	}
}
