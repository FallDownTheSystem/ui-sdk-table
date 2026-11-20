/** Whether two values hold the same content. Arrays, plain objects and dates compare by what is in them. */
export function sameContent(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
	if (a instanceof Date || b instanceof Date) {
		return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
	}
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
		return a.every((item, index) => sameContent(item, b[index]))
	}
	const protoA: unknown = Object.getPrototypeOf(a)
	if (protoA !== Object.getPrototypeOf(b) || (protoA !== Object.prototype && protoA !== null)) {
		return false
	}
	const keys = Object.keys(a)
	if (keys.length !== Object.keys(b).length) return false
	return keys.every((key) =>
		sameContent((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
	)
}

/**
 * Gives back the earlier object while a new one holds the same content. A
 * caller often builds its state inline, so each render passes a new object
 * that says the same thing. Without this, each render would be a new state:
 * every stage would run again, and the table would go back to its first page.
 */
export function stabilize<Value>(): (value: Value) => Value {
	let last: { value: Value } | undefined
	return (value) => {
		if (last && sameContent(last.value, value)) return last.value
		last = { value }
		return value
	}
}

/**
 * Remembers the last result of `fn` and returns it again while every argument
 * is the same value or the same object. A pipeline stage wrapped in it runs
 * only when its input or one of its settings changed.
 */
export function memo<Args extends readonly unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Result {
	let last: { args: Args; result: Result } | undefined
	return (...args) => {
		if (
			last &&
			last.args.length === args.length &&
			last.args.every((arg, index) => Object.is(arg, args[index]))
		) {
			return last.result
		}
		const result = fn(...args)
		last = { args, result }
		return result
	}
}
