import { mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import type { Component } from 'vue'

const examples = import.meta.glob<{ default: Component }>('./examples/**/*.vue')

afterEach(() => {
	vi.restoreAllMocks()
	document.body.innerHTML = ''
})

test('there are examples', () => {
	expect(Object.keys(examples).length).toBeGreaterThan(0)
})

for (const [path, load] of Object.entries(examples)) {
	test(`${path} mounts without an error or a warning`, async () => {
		const error = vi.spyOn(console, 'error')
		const warn = vi.spyOn(console, 'warn')
		const { default: example } = await load()
		const wrapper = mount(example, { attachTo: document.body })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(wrapper.find('[data-slot="table"]').exists()).toBe(true)
		expect(error).not.toHaveBeenCalled()
		expect(warn).not.toHaveBeenCalled()
		wrapper.unmount()
	})
}
