import { createController } from '@ui-sdk/core'
import type { TableController } from 'ui-sdk-table-core'

type Listener = (changed: readonly string[]) => void
type Entry = { listener: Listener; stop?: () => void }

const ARRIVED = Symbol('table arrived')

/**
 * A handle to a table for code outside it. Pass it as the `controller` prop;
 * then call `sortBy`, `setSearch`, `select` and the other methods on it.
 * Before the table exists, a call does nothing and answers `undefined`.
 *
 * `subscribe` is the one method that is safe to call early: its listener
 * waits for the table. When the table arrives, the listener runs once with
 * no key, so it can read `getView` for the first time, and then after each
 * change. The answer is the function that stops it, at any time. A table
 * that comes in place of another (a new `key`) takes over every listener.
 */
export function createTableController(): TableController {
	const inner = createController<TableController>()
	// Every listener, since a listener of UI SDK belongs to one table and ends with it.
	const entries = new Set<Entry>()
	// Whether a table ever arrived.
	let met = false

	// The controller answers with the stop function when it has a table, else with nothing.
	function connect(entry: Entry): boolean {
		const stop: unknown = inner.subscribe(entry.listener)
		if (typeof stop !== 'function') return false
		entry.stop = stop as () => void
		return true
	}

	function subscribe(listener: Listener): () => void {
		if (typeof listener !== 'function') throw new Error('`subscribe` takes a function.')
		const entry: Entry = { listener }
		entries.add(entry)
		// Before the first table, the listener only waits. The controller of UI SDK
		// is not asked then: in development it warns about each method that is
		// called before a component is there, and a wait is no mistake.
		if (met) connect(entry)
		return () => {
			entries.delete(entry)
			entry.stop?.()
		}
	}

	function arrived(): void {
		met = true
		for (const entry of entries) {
			entry.stop?.()
			entry.stop = undefined
			if (!connect(entry)) return
			entry.listener([])
		}
	}

	return new Proxy(inner, {
		get(target, key, receiver) {
			if (key === 'subscribe') return subscribe
			if (key === ARRIVED) return arrived
			return Reflect.get(target, key, receiver) as unknown
		},
	})
}

/** Tells a controller that its table is on the page. A controller of another kind is left alone. */
export function tableArrived(controller: TableController | undefined): void {
	const arrived: unknown = controller
		? (controller as unknown as Record<symbol, unknown>)[ARRIVED]
		: undefined
	// A plain controller of UI SDK answers any name with a function that does nothing.
	if (typeof arrived === 'function') (arrived as () => void)()
}
