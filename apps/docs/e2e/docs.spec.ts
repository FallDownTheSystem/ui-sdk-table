import { expect, test, type Page } from '@playwright/test'
import { contrastOf, installContrast } from './contrast'

test.beforeEach(async ({ page }) => {
	await installContrast(page)
})

const example = (page: Page, name: string) => page.locator(`[data-example="${name}"]`)

test('the address of the site opens the Introduction', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { level: 1, name: 'Introduction' })).toBeVisible()
	await expect(
		page.getByRole('navigation', { name: 'Docs' }).getByRole('link', { name: 'Introduction' }),
	).toHaveAttribute('aria-current', 'page')
	await expect(
		page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Docs' }),
	).toHaveAttribute('aria-current', 'page')
})

test('the page in view has aria-current in the sidebar, and only it', async ({ page }) => {
	await page.goto('/?page=installation')
	const sidebar = page.getByRole('navigation', { name: 'Docs' })
	await expect(sidebar.locator('[aria-current]')).toHaveCount(1)
	await expect(sidebar.getByRole('link', { name: 'Installation' })).toHaveAttribute(
		'aria-current',
		'page',
	)
	// The test pages are in the sidebar; a hidden page is not.
	await expect(sidebar.getByRole('link', { name: 'Groups and filters' })).toHaveAttribute(
		'href',
		'?page=groups',
	)
	await expect(sidebar.getByRole('link', { name: 'Proofs' })).toHaveCount(0)
})

test('Tab goes through the bar, the sidebar and the page in the order of the screen', async ({
	page,
}) => {
	await page.goto('/?page=installation')
	await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible()
	const stops: { area: string; x: number; y: number }[] = []
	for (let step = 0; step < 40; step++) {
		await page.keyboard.press('Tab')
		const stop = await page.evaluate(() => {
			const active = document.activeElement
			if (!active || active === document.body) return null
			const area = active.closest('.pages')
				? 'bar'
				: active.closest('.sidebar')
					? 'sidebar'
					: active.closest('.doc')
						? 'page'
						: active.closest('.toc')
							? 'toc'
							: 'other'
			const { x, y } = active.getBoundingClientRect()
			return { area, x: x + scrollX, y: y + scrollY }
		})
		if (!stop) break
		stops.push(stop)
	}
	const areas = stops.map((stop) => stop.area).filter((area, index, all) => area !== all[index - 1])
	expect(areas).toEqual(['bar', 'sidebar', 'page', 'toc'])
	// Within the bar the stops go from the start edge to the end edge, and in the sidebar from the top down.
	const bar = stops.filter((stop) => stop.area === 'bar').map((stop) => stop.x)
	expect(bar).toEqual(bar.toSorted((a, b) => a - b))
	const sidebar = stops.filter((stop) => stop.area === 'sidebar').map((stop) => stop.y)
	expect(sidebar).toEqual(sidebar.toSorted((a, b) => a - b))
})

test('an example runs in Preview and shows its code in Code', async ({ page }) => {
	await page.goto('/?page=first-table')
	const styled = example(page, 'first-table/styled')
	const table = styled.getByRole('grid', { name: 'People by score' })
	await expect(table.locator('tbody tr').first()).toContainText('Kofi Mensah')

	// The table works: a press on the header turns the order.
	await table.getByRole('button', { name: 'Score' }).click()
	await expect(table.getByRole('columnheader', { name: 'Score' })).toHaveAttribute(
		'aria-sort',
		'ascending',
	)
	await expect(table.locator('tbody tr').first()).toContainText('Wren Takahashi')

	await styled.getByRole('tab', { name: 'Code' }).click()
	const code = styled.getByRole('tabpanel')
	await expect(code).toContainText("import { Table, type ColumnDef } from 'ui-sdk-table-vue'")
	await expect(code).toContainText('aria-label="People by score"')

	// The preview kept its state while the code was in view.
	await styled.getByRole('tab', { name: 'Preview' }).click()
	await expect(table.locator('tbody tr').first()).toContainText('Wren Takahashi')
})

test('Open as Markdown answers with the Markdown of the page', async ({ page, request }) => {
	await page.goto('/?page=first-table')
	const link = page.getByRole('link', { name: 'Open as Markdown' })
	const href = await link.getAttribute('href')
	expect(href).toBe('docs/first-table.md')
	const response = await request.get(new URL(href ?? '', page.url()).href)
	expect(response.ok()).toBe(true)
	const text = await response.text()
	expect(text).toMatch(/^# First table\n/)
	expect(text).toContain('```vue title="styled.vue"')

	const llms = await request.get(new URL('docs/llms.txt', page.url()).href)
	expect(await llms.text()).toContain('## Every page')
})

test('a link between pages and a link to a heading open the page and the heading', async ({
	page,
}) => {
	await page.goto('/?page=first-table')
	await page.locator('.prose').getByRole('link', { name: 'Installation' }).first().click()
	await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible()
	await page.getByRole('complementary').getByRole('link', { name: 'Entries' }).click()
	await expect(page).toHaveURL(/\?page=installation#entries$/)
	await expect(page.getByRole('heading', { level: 2, name: 'Entries' })).toBeInViewport()
})

test('a narrow screen opens the sidebar from a menu button', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/?page=installation')
	const sidebar = page.getByRole('navigation', { name: 'Docs' })
	await expect(sidebar).toBeHidden()
	await page.getByRole('button', { name: 'Menu' }).click()
	await expect(sidebar.getByRole('link', { name: 'First table' })).toBeVisible()
})

test('the text of the shell and of a code block holds 4.5 to 1', async ({ page }) => {
	await page.goto('/?page=first-table')
	await example(page, 'first-table/people').getByRole('tab', { name: 'Code' }).click()
	const texts = page.locator(
		[
			'.pages a',
			'.sidebar a',
			'.group-title',
			'.toc a',
			'.toc-title',
			'.prose :is(h1, h2, p, li, th, td, code, a)',
			'[data-slot="tabs-tab"]',
			'.example-file',
			'.example figcaption',
			'.pager a',
			'.pager-hint',
			'.shiki span span',
		].join(', '),
	)
	const count = await texts.count()
	expect(count).toBeGreaterThan(100)
	const low: string[] = []
	for (let index = 0; index < count; index++) {
		const text = texts.nth(index)
		if (!(await text.isVisible())) continue
		const ratio = await contrastOf(text, 'text')
		if (ratio < 4.5) low.push(`${await text.textContent()}: ${ratio.toFixed(2)}`)
	}
	expect(low).toEqual([])
})
