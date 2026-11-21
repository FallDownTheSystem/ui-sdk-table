import { expect, test } from 'vite-plus/test'
import { createTurnValue } from './turn'

test('a value that the owner holds is read as the table reported it, for one turn', async () => {
	let given: string | undefined = 'first'
	const state = { value: 'first' }
	const held = createTurnValue(
		() => given,
		() => state.value,
	)
	expect(held.read()).toBe('first')
	held.took('second')
	// The owner did not pass the value back yet, and the state still holds the old one.
	expect(held.read()).toBe('second')
	held.took('third')
	expect(held.read()).toBe('third')

	// The turn is over and the owner passed nothing: the state is the truth again.
	await Promise.resolve()
	expect(held.read()).toBe('first')
})

test('a value from the owner ends the hold at once, whatever it is', () => {
	let given: string | undefined = 'first'
	const state = { value: 'first' }
	const held = createTurnValue(
		() => given,
		() => state.value,
	)
	held.took('second')
	// The owner answered with a value of its own.
	given = 'other'
	state.value = 'other'
	expect(held.read()).toBe('other')
})

test('a value that the table keeps itself is never held: the state is right at once', () => {
	const state = { value: 'first' }
	const held = createTurnValue(
		() => undefined,
		() => state.value,
	)
	held.took('second')
	expect(held.read()).toBe('first')
	state.value = 'second'
	expect(held.read()).toBe('second')
})
