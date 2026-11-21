import { expect, type Locator, type Page } from '@playwright/test'

/** Opens the styled page, with more of the query when a test needs it. */
export async function open(page: Page, query = '') {
	await page.goto(`/?page=styled${query}`)
	await expect(page.getByRole('heading', { level: 1, name: 'Data table examples' })).toBeVisible()
}

/** A demo of the page, scrolled into view. */
export async function section(page: Page, id: string) {
	const found = page.locator(`#${id}`)
	await found.scrollIntoViewIfNeeded()
	return found
}

export const dataRows = (table: Locator) => table.locator('tbody tr[data-slot="table-row"]')
export const focused = (page: Page) => page.locator(':focus')
export const box = async (locator: Locator) => {
	const found = await locator.boundingBox()
	if (!found) throw new Error('The element is not in the page.')
	return found
}

/** The frame around a table: what has the border, and what scrolls. */
export const frameOf = (table: Locator) => table.locator('xpath=..')
