import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { createDebounce } from './debounce'

describe('createDebounce', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('the function runs once after the calls pause, with the last arguments', () => {
		const runs: string[] = []
		const debounce = createDebounce((text: string) => runs.push(text), { debounce: 100 })
		debounce.call('a')
		vi.advanceTimersByTime(60)
		debounce.call('ab')
		vi.advanceTimersByTime(60)
		// 120 ms after the first call, and 60 ms after the last one: nothing ran yet.
		expect(runs).toEqual([])
		expect(debounce.pending()).toBe(true)
		vi.advanceTimersByTime(40)
		expect(runs).toEqual(['ab'])
		expect(debounce.pending()).toBe(false)
		vi.advanceTimersByTime(500)
		expect(runs).toEqual(['ab'])
	})

	test('the pause is 200 ms without the option, as in the async options of UI SDK', () => {
		const run = vi.fn<() => void>()
		const debounce = createDebounce(run)
		debounce.call()
		vi.advanceTimersByTime(199)
		expect(run).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1)
		expect(run).toHaveBeenCalledTimes(1)
	})

	test('`cancel` drops the call that waits', () => {
		const run = vi.fn<() => void>()
		const debounce = createDebounce(run, { debounce: 100 })
		debounce.call()
		debounce.cancel()
		expect(debounce.pending()).toBe(false)
		vi.advanceTimersByTime(500)
		expect(run).not.toHaveBeenCalled()
		// Nothing waits, so nothing is left to drop or to run.
		debounce.cancel()
		debounce.flush()
		expect(run).not.toHaveBeenCalled()
	})

	test('`flush` runs the call that waits now, and the timer does not run it again', () => {
		const runs: number[] = []
		const debounce = createDebounce((value: number) => runs.push(value), { debounce: 100 })
		debounce.call(1)
		debounce.call(2)
		debounce.flush()
		expect(runs).toEqual([2])
		expect(debounce.pending()).toBe(false)
		vi.advanceTimersByTime(500)
		expect(runs).toEqual([2])
	})

	test('a pause of 0 runs each call at once, and a function gives the pause of now', () => {
		let pause = 0
		const runs: string[] = []
		const debounce = createDebounce((text: string) => runs.push(text), { debounce: () => pause })
		debounce.call('a')
		expect(runs).toEqual(['a'])
		expect(debounce.pending()).toBe(false)
		pause = 50
		debounce.call('b')
		expect(runs).toEqual(['a'])
		vi.advanceTimersByTime(50)
		expect(runs).toEqual(['a', 'b'])
		// A call that waits goes away when the next call runs at once.
		debounce.call('c')
		pause = 0
		debounce.call('d')
		vi.advanceTimersByTime(500)
		expect(runs).toEqual(['a', 'b', 'd'])
	})

	test('inside the function, no call waits, and the function can ask for a new run', () => {
		const seen: boolean[] = []
		let again = true
		const debounce = createDebounce(
			() => {
				seen.push(debounce.pending())
				if (again) {
					again = false
					debounce.call()
				}
			},
			{ debounce: 10 },
		)
		debounce.call()
		vi.advanceTimersByTime(10)
		expect(seen).toEqual([false])
		expect(debounce.pending()).toBe(true)
		vi.advanceTimersByTime(10)
		expect(seen).toEqual([false, false])
		expect(debounce.pending()).toBe(false)
	})

	test('a wrong argument fails with what is valid', () => {
		expect(() => createDebounce(undefined as never)).toThrow(
			'`createDebounce` takes a function to run.',
		)
		const debounce = createDebounce(() => {}, { debounce: 'soon' as never })
		expect(() => debounce.call()).toThrow(
			'`debounce` is a number of milliseconds, or a function that returns one.',
		)
	})
})
