import { definePrimitive } from '@ui-sdk/core'
import { mount } from '@ui-sdk/core/testing'
import { expect, test, vi } from 'vite-plus/test'

// P10 of the formula work, its second half: a cell with an error says why in
// its description (`aria-description`), so a screen reader reads the code and
// then the words. A proof of UI SDK 0.1.0-beta.13: the attribute passes the
// type of `attrs`, and `mount` writes it and takes it away without a warning.
// A role on this part would need the behaviors of that role, so the part has
// none: the type of `attrs` is the same for every role. `checkPattern` of
// `@ui-sdk/core/testing` has no grid pattern, so no pattern check reads a
// grid cell of the table at all. The first half, a state key
// outside `controlled`, is R7 in `packages/vue/src/proofs/reader.test.ts`,
// which holds for any name of the key.

const proof = definePrimitive({
	name: 'description-proof',
	options: {},
	state: () => ({ error: 'div0' as string | null }),
	api: (context) => ({ set: (error: string | null) => context.store.set({ error }) }),
	slots: (slot) => ({
		root: slot({ role: 'group' }),
		cell: slot<{ value: string }>({
			props: { value: 'string' },
			attrs: (state) => ({
				'data-formula-error': state.error ?? undefined,
				'aria-description': state.error ? 'The formula divides by zero.' : undefined,
			}),
		}),
	}),
})

test('P10: a cell takes `aria-description` without a warning, and the description follows the state', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
	const error = vi.spyOn(console, 'error').mockImplementation(() => {})
	const view = mount(proof, {}, '<root aria-label="Prices"><cell value="a">#DIV/0!</cell></root>')
	try {
		await view.settle()
		const cell = view.part('cell', 'a')
		expect(cell?.getAttribute('aria-description')).toBe('The formula divides by zero.')
		expect(cell?.getAttribute('data-formula-error')).toBe('div0')
		view.api.set(null)
		await view.settle()
		expect(cell?.hasAttribute('aria-description')).toBe(false)
		expect(cell?.hasAttribute('data-formula-error')).toBe(false)
		expect(warn).not.toHaveBeenCalled()
		expect(error).not.toHaveBeenCalled()
	} finally {
		view.unmount()
		warn.mockRestore()
		error.mockRestore()
	}
})
