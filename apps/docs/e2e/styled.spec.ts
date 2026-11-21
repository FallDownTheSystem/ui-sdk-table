import { expect, test, type Locator, type Page } from '@playwright/test'
import { box, dataRows, focused, open, section } from './styled-page'

/** The customer directory, once its rows are there. */
async function customers(page: Page) {
	const found = await section(page, 'customer-directory')
	const table = found.getByRole('grid', { name: 'Customers' })
	await expect(table.locator('tbody tr[data-slot="table-row"]')).toHaveCount(10)
	return { section: found, table }
}

const firstCells = (table: Locator) => table.locator('tbody tr > td:first-child')

/** Keeps the files that the page writes in the page, where a browser test can read them. */
const catchFiles = (page: Page) =>
	page.addInitScript(() => {
		const files: Blob[] = []
		Object.assign(window, { exported: files })
		const create = URL.createObjectURL.bind(URL)
		URL.createObjectURL = (blob: Blob | MediaSource) => {
			if (blob instanceof Blob) files.push(blob)
			return create(blob)
		}
	})

/** The text of a file that the page wrote, without the mark at its start. */
const fileText = async (page: Page, index: number) => {
	const text = await page.evaluate(
		(index) => (window as unknown as { exported: Blob[] }).exported[index]?.text(),
		index,
	)
	return (text ?? '').replace(/^\uFEFF/, '')
}

/**
 * The cells of the first sheet of an Excel file that the page wrote, by their
 * place: `A1`, `B2`. The file is a zip archive, and the sheet is one XML file
 * in it. The page reads it, as a program that opens the file would.
 */
const sheetCells = (page: Page, index: number) =>
	page.evaluate(async (index) => {
		const file = (window as unknown as { exported: Blob[] }).exported[index]
		if (!file) throw new Error(`The page wrote no file ${index}.`)
		const bytes = new Uint8Array(await file.arrayBuffer())
		const view = new DataView(bytes.buffer)
		// The end record of an archive without a comment is its last 22 bytes.
		const end = bytes.length - 22
		if (view.getUint32(end, true) !== 0x06054b50) throw new Error('The file is not a zip archive.')
		let at = view.getUint32(end + 16, true)
		let sheet = ''
		for (let entry = 0; entry < view.getUint16(end + 10, true); entry++) {
			const method = view.getUint16(at + 10, true)
			const size = view.getUint32(at + 20, true)
			const nameLength = view.getUint16(at + 28, true)
			const local = view.getUint32(at + 42, true)
			const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
			if (name === 'xl/worksheets/sheet1.xml') {
				const start =
					local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
				const data = new Blob([bytes.slice(start, start + size)])
				sheet =
					method === 0
						? await data.text()
						: await new Response(
								data.stream().pipeThrough(new DecompressionStream('deflate-raw')),
							).text()
			}
			at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
		}
		const cells: Record<string, string> = {}
		const pattern =
			/<c r="([A-Z]+\d+)"[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g
		for (const match of sheet.matchAll(pattern)) {
			cells[match[1] ?? ''] = match[2] ?? match[3] ?? ''
		}
		return cells
	}, index)

test.describe('page', () => {
	test('the styled page has the tokens of the app, and the theme follows the dark class', async ({
		page,
	}) => {
		await open(page)
		const colours = () =>
			page.evaluate(() => {
				const style = getComputedStyle(document.body)
				return { background: style.backgroundColor, text: style.color }
			})

		expect(await colours()).toEqual({ background: 'oklch(1 0 0)', text: 'oklch(0.145 0 0)' })
		await page.getByRole('switch', { name: 'Dark theme' }).click()
		await expect(page.locator('html')).toHaveClass(/dark/)
		expect(await colours()).toEqual({ background: 'oklch(0.145 0 0)', text: 'oklch(0.985 0 0)' })
	})

	test('the plain pages keep their stylesheet, without the base layer of Tailwind', async ({
		page,
	}) => {
		await page.goto('/?page=columns')
		await expect(page.getByRole('grid', { name: 'People' })).toBeVisible()

		const plain = await page.evaluate(() => {
			const button = document.querySelector('.toolbar button')
			const cell = document.querySelector('[data-slot="table"] td')
			if (!button || !cell) throw new Error('The page has no button or no cell.')
			return {
				// The plain stylesheet sets 14 pixels and a padding of 1rem. Tailwind would set neither.
				body: getComputedStyle(document.body).padding,
				font: getComputedStyle(document.documentElement).fontSize,
				// The base layer of Tailwind takes the border of a button away.
				button: getComputedStyle(button).borderTopWidth,
				cell: getComputedStyle(cell).padding,
				tailwind: [...document.styleSheets].some((sheet) =>
					[...sheet.cssRules].some((rule) => rule.cssText.includes('--tw-')),
				),
			}
		})
		expect(plain).toEqual({
			body: '14px',
			font: '14px',
			button: '2px',
			cell: '5.25px 8.75px',
			tailwind: false,
		})
	})

	test('every demo has its section and its table', async ({ page }) => {
		await open(page)
		const ids = await page
			.locator('[data-slot="page-section"]')
			.evaluateAll((sections) => sections.map((found) => found.id))
		expect(ids).toEqual([
			'basic',
			'sorting',
			'pagination',
			'global-filter',
			'column-filters',
			'expansion-children',
			'expansion-custom',
			'grouping',
			'nested-grouping',
			'grouping-aggregations',
			'header-groups',
			'sticky-header',
			'column-footers',
			'virtualization',
			'selection',
			'selection-grouping',
			'column-visibility',
			'export',
			'custom-controls',
			// Five demos that the old page did not have: what the new table adds.
			'pinned-columns',
			'column-resize',
			'cell-editing',
			'server-pages',
			'sticky-offset',
			'format-types',
			'localization',
			'ui-translations',
			'custom-slots',
			'row-styling',
			'cell-styling',
			'auto-width',
			'headless-compose',
			'class-overrides',
			'empty-loading',
			'customer-directory',
		])
		// 43 styled tables and the headless one. The 50,000-row table comes with its button.
		await expect(page.locator('table[data-slot="table"]')).toHaveCount(44)
		// Every table has a name of its own.
		const names = await page
			.locator('table[data-slot="table"]')
			.evaluateAll((tables) => tables.map((table) => table.getAttribute('aria-label')))
		expect(names.every(Boolean)).toBe(true)
		expect(new Set(names).size).toBe(44)
	})

	test('the stress case shows 2,000 customers on pages of 50 behind ?stress=1', async ({
		page,
	}) => {
		await open(page)
		await expect(page.locator('#stress-test')).toHaveCount(0)

		await open(page, '&stress=1')
		const stress = await section(page, 'stress-test')
		const table = stress.getByRole('grid', { name: 'Stress customers' })
		const count = stress.locator('[data-slot="data-table-rows"]')
		await expect(dataRows(table)).toHaveCount(50)
		await expect(count).toHaveText('Showing 1 to 50 of 2000 rows')

		await stress.getByRole('textbox', { name: 'Search, Stress customers' }).fill('smith')
		await expect(count).not.toHaveText('Showing 1 to 50 of 2000 rows')
		for (const name of await dataRows(table).locator('td:nth-child(2)').allInnerTexts()) {
			expect(name.toLowerCase()).toContain('smith')
		}
	})
})

test.describe('keyboard and focus', () => {
	test('Tab goes through the toolbar, into the table as one stop, and through the pages', async ({
		page,
	}) => {
		await open(page)
		const { section: found } = await customers(page)

		await found.getByRole('textbox', { name: 'Search, Customers' }).focus()
		await page.keyboard.press('Tab')
		await expect(focused(page)).toHaveText('Filters')
		await page.keyboard.press('Tab')
		await expect(focused(page)).toHaveText('Columns')
		await page.keyboard.press('Tab')
		await expect(focused(page)).toHaveText('Export')

		// The table is one stop: a cell. The checkboxes and the buttons in its cells are not stops.
		await page.keyboard.press('Tab')
		await expect(focused(page)).toHaveAttribute('data-slot', 'table-cell')
		expect(await focused(page).evaluate((cell) => cell.closest('table')?.ariaLabel)).toBe(
			'Customers',
		)

		await page.keyboard.press('Tab')
		await expect(focused(page)).toHaveAccessibleName('Rows per page, Customers')
		const stops: string[] = []
		for (let index = 0; index < 10; index++) {
			await page.keyboard.press('Tab')
			stops.push((await focused(page).getAttribute('aria-label')) ?? '')
		}
		// A button that is off on the first page stays a stop, so a screen reader finds it.
		expect(stops).toEqual(
			[
				'First page',
				'Previous page',
				'Page 1',
				'Page 2',
				'Page 3',
				'Page 4',
				'Page 5',
				'Page 8',
				'Next page',
				'Last page',
			].map((name) => `${name}, Customers`),
		)

		// And back: from the page sizes into the table, then to the toolbar.
		await found.getByRole('combobox', { name: 'Rows per page, Customers' }).focus()
		await page.keyboard.press('Shift+Tab')
		await expect(focused(page)).toHaveAttribute('data-slot', 'table-cell')
		await page.keyboard.press('Shift+Tab')
		await expect(focused(page)).toHaveText('Export')
	})

	test('the search filters while a person writes, and its clear button keeps focus in the field', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'global-filter')
		const table = found.getByRole('grid', { name: 'Searchable people' })
		const search = found.getByRole('textbox', { name: 'Search, Searchable people' })

		await search.fill('viewer')
		await expect(firstCells(table)).toHaveText(['Helmi Virtanen', 'Saara Nieminen'])
		await expect(found.getByTestId('search')).toHaveText('Search text: viewer')

		await search.fill('nobody at all')
		await expect(found.locator('[data-slot="data-table-empty"]')).toContainText(
			'No rows match “nobody at all”.',
		)
		// The empty state offers the way out.
		await found.getByRole('button', { name: 'Clear all filters' }).click()
		await expect(dataRows(table)).toHaveCount(5)
		await expect(search).toHaveValue('')

		await search.fill('admin')
		await expect(dataRows(table)).toHaveCount(1)
		await found.getByRole('button', { name: 'Clear search' }).click()
		await expect(search).toHaveValue('')
		await expect(search).toBeFocused()
		await expect(dataRows(table)).toHaveCount(5)
	})

	test('the filter popover opens from the keyboard, closes with Escape and gives focus back', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'column-filters')
		const table = found.getByRole('grid', { name: 'Filtered people' })
		const trigger = found.locator('[data-slot="popover-trigger"]')
		const popover = page.getByRole('dialog', { name: 'Column filters' })

		await trigger.focus()
		await page.keyboard.press('Enter')
		await expect(popover).toBeVisible()
		await expect(trigger).toHaveAttribute('aria-expanded', 'true')
		// Focus goes into the popover, to its first field.
		await expect(focused(page)).toHaveAccessibleName('Filter Name')

		// The popover sits under its trigger, from its start edge, and over the table.
		// It grows while it opens, so the width is read when it has settled.
		await expect.poll(async () => (await box(popover)).width).toBe(420)
		const [anchor, panel] = [await box(trigger), await box(popover)]
		expect(panel.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)
		expect(Math.abs(panel.x - anchor.x)).toBeLessThanOrEqual(1)
		expect(
			await popover.evaluate((element) => {
				const rect = element.getBoundingClientRect()
				const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + 8)
				return element.contains(top)
			}),
		).toBe(true)

		// One field for each kind of filter.
		await page.keyboard.type('l')
		await expect(firstCells(table)).toHaveText(['Eero Laine', 'Helmi Virtanen', 'Lauri Mäkinen'])
		await popover.getByRole('spinbutton', { name: 'Lowest Age' }).fill('35')
		await expect(firstCells(table)).toHaveText(['Helmi Virtanen', 'Lauri Mäkinen'])
		await popover.getByLabel('Joined from').fill('2020-01-01')
		await expect(firstCells(table)).toHaveText(['Lauri Mäkinen'])
		await expect(trigger).toHaveText('3 filters applied')

		await page.keyboard.press('Escape')
		await expect(popover).toBeHidden()
		await expect(trigger).toBeFocused()
		// The filters stay when the popover closes.
		await expect(firstCells(table)).toHaveText(['Lauri Mäkinen'])

		// With the pointer: the button clears, and a press outside closes.
		await trigger.click()
		await expect(popover).toBeVisible()
		await popover.getByRole('button', { name: 'Clear all filters' }).click()
		await expect(dataRows(table)).toHaveCount(5)
		await expect(trigger).toHaveText('Filters')
		await page.locator('#column-filters-heading').click()
		await expect(popover).toBeHidden()
	})

	test('a list inside the popover closes alone with Escape, and its choice filters the rows', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'column-filters')
		const table = found.getByRole('grid', { name: 'Filtered people' })
		const popover = page.getByRole('dialog', { name: 'Column filters' })

		await found.locator('[data-slot="popover-trigger"]').click()
		const list = popover.getByRole('combobox', { name: 'Values of Role' })
		await expect(list).toHaveText('Any value')
		await list.focus()
		await page.keyboard.press('Enter')
		const options = page.getByRole('listbox', { name: 'Values of Role' }).getByRole('option')
		// The values of the column, sorted.
		await expect(options).toHaveText(['Admin', 'Editor', 'Viewer'])

		await page.keyboard.press('Escape')
		await expect(options).toHaveCount(0)
		await expect(popover).toBeVisible()
		await expect(list).toBeFocused()

		await list.click()
		await options.filter({ hasText: 'Editor' }).click()
		await expect(firstCells(table)).toHaveText(['Eero Laine', 'Lauri Mäkinen'])
		await options.filter({ hasText: 'Admin' }).click()
		await expect(dataRows(table)).toHaveCount(3)
		await expect(options.filter({ hasText: 'Admin' })).toHaveAttribute('aria-selected', 'true')
		await page.keyboard.press('Escape')
		await expect(list).toHaveText('Admin and Editor')

		await popover.getByRole('button', { name: 'Reset filter of Role' }).click()
		await expect(dataRows(table)).toHaveCount(5)
		await expect(list).toHaveText('Any value')
	})
})

test.describe('keyboard, rows and pages', () => {
	test('the checkbox of a group works from the keyboard: Space on its row, or inside the cell', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'selection-grouping')
		const table = found.getByRole('treegrid', { name: 'Selectable tasks' })
		const output = found.getByTestId('selected-tasks')
		const high = table.getByRole('checkbox', { name: 'Select group High' })
		const cell = table.locator('td:has([aria-label="Select group High"])')

		await table.locator('thead th').first().focus()
		await page.keyboard.press('ArrowDown')
		await expect(cell).toBeFocused()
		// Space on the row of a group is the choice of its rows.
		await page.keyboard.press('Space')
		await expect(high).toBeChecked()
		await expect(output).toHaveText(
			'Selected tasks: Move billing to the new provider, Fix the export of large reports',
		)
		await expect(cell).toBeFocused()
		await expect(table.locator('tbody tr[aria-selected="true"]')).toHaveCount(2)
		await page.keyboard.press('Space')
		await expect(high).not.toBeChecked()
		await expect(output).toHaveText('Selected tasks: none')

		// One row of the group: the checkbox of the group is mixed, and Space takes the rest.
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Space')
		await expect(high).toHaveAttribute('aria-checked', 'mixed')
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('Space')
		await expect(high).toBeChecked()

		// F2 goes into the cell, to the checkbox. Enter stays the button of the group.
		await page.keyboard.press('F2')
		await expect(high).toBeFocused()
		await page.keyboard.press('Space')
		await expect(high).not.toBeChecked()
		await expect(output).toHaveText('Selected tasks: none')
		await page.keyboard.press('Escape')
		await expect(cell).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(dataRows(table)).toHaveCount(7)
		await page.keyboard.press('Enter')
		await expect(dataRows(table)).toHaveCount(9)
	})

	test('the button of the header opens and closes all rows from the keyboard', async ({ page }) => {
		await open(page)
		const found = await section(page, 'expansion-children')
		const table = found.getByRole('treegrid', { name: 'Teams' })
		const head = table.locator('thead th').first()

		await head.focus()
		// Enter goes into the header cell, to its button.
		await page.keyboard.press('Enter')
		const button = table.locator('thead').getByRole('button', { name: /all rows, Teams$/ })
		await expect(button).toBeFocused()
		await expect(button).toHaveAccessibleName('Expand all rows, Teams')
		await expect(button).toHaveAttribute('aria-expanded', 'false')
		await page.keyboard.press('Enter')
		await expect(dataRows(table)).toHaveCount(6)
		// The button is the same one, with its other name, and it keeps focus.
		await expect(button).toBeFocused()
		await expect(button).toHaveAccessibleName('Collapse all rows, Teams')
		await expect(button).toHaveAttribute('aria-expanded', 'true')
		await page.keyboard.press('Space')
		await expect(dataRows(table)).toHaveCount(2)
		await expect(button).toBeFocused()
		// Escape goes back to the cell, and the arrow keys work again.
		await page.keyboard.press('Escape')
		await expect(head).toBeFocused()
		await page.keyboard.press('ArrowDown')
		await expect(focused(page)).toHaveAttribute('role', 'gridcell')
	})

	test('focus stays on a control of the pages while the pages change under it', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'pagination')
		const pages = found.getByRole('navigation', { name: 'Pages, Paged people' })
		const status = found.locator('[data-slot="data-table-page"]').first()
		const next = pages.getByRole('button', { name: 'Next page' })
		await expect(status).toHaveText('Page 1 of 5')

		// To the last page with Enter. The button is off there and keeps focus, so a
		// screen reader says why nothing happens, and Shift+Tab still starts from it.
		await next.focus()
		for (let press = 0; press < 4; press++) await page.keyboard.press('Enter')
		await expect(status).toHaveText('Page 5 of 5')
		await expect(next).toBeDisabled()
		await expect(next).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(status).toHaveText('Page 5 of 5')

		// The link of a page keeps focus when its page becomes the current one.
		await page.keyboard.press('Shift+Tab')
		await expect(focused(page)).toHaveAccessibleName('Page 5, Paged people')
		await page.keyboard.press('Shift+Tab')
		await expect(focused(page)).toHaveAccessibleName('Page 4, Paged people')
		await page.keyboard.press('Enter')
		await expect(status).toHaveText('Page 4 of 5')
		await expect(focused(page)).toHaveAccessibleName('Page 4, Paged people')
		await expect(focused(page)).toHaveAttribute('aria-current', 'page')

		// First page: its button is off after the press, and keeps focus too.
		const first = pages.getByRole('button', { name: 'First page' })
		await first.focus()
		await page.keyboard.press('Enter')
		await expect(status).toHaveText('Page 1 of 5')
		await expect(first).toBeFocused()

		// A new page size makes fewer pages. Focus is back on the list of sizes.
		const sizes = found.getByRole('combobox', { name: 'Rows per page, Paged people' })
		await sizes.focus()
		await page.keyboard.press('Enter')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
		await expect(status).not.toHaveText('Page 1 of 5')
		await expect(sizes).toBeFocused()
	})

	test('a search, a sort and a page are said to assistive technology, once after a pause', async ({
		page,
	}) => {
		await open(page)
		const { section: found, table } = await customers(page)
		const status = found.locator('[data-slot="data-table-status"]')
		await expect(status).toHaveAttribute('role', 'status')
		await expect(status).toHaveAttribute('aria-live', 'polite')
		// It is on the page for a screen reader and takes no place that a person sees.
		expect((await box(status)).width).toBeLessThanOrEqual(1)
		await expect(status).toHaveText('')

		// Every text that the region gets, in order.
		await status.evaluate((region) => {
			const said: string[] = []
			Object.assign(window, { said })
			new MutationObserver(() => {
				const text = region.textContent?.trim() ?? ''
				if (text && said.at(-1) !== text) said.push(text)
			}).observe(region, { childList: true, characterData: true, subtree: true })
		})
		const said = () => page.evaluate(() => (window as unknown as { said: string[] }).said)

		// Four letters, faster than the pause: nothing while they come, one text after them.
		const search = found.getByRole('textbox', { name: 'Search, Customers' })
		await search.pressSequentially('labs', { delay: 80 })
		expect(await said()).toEqual([])
		await expect(status).toHaveText(/^\d+ rows? found\.$/)
		expect(await said()).toHaveLength(1)
		const count = Number((await status.innerText()).replace(/\D/g, ''))
		expect(count).toBeGreaterThan(0)
		await expect(found.locator('[data-slot="data-table-rows"]')).toContainText(`of ${count} row`)

		await table
			.getByRole('columnheader', { name: 'Customer', exact: true })
			.getByRole('button')
			.click()
		await expect(status).toHaveText('Sorted by Customer, ascending.')

		await search.fill('')
		await expect(status).toHaveText(/^\d+ rows found\.$/)
		await found.getByRole('button', { name: 'Next page' }).click()
		await expect(status).toHaveText(/^Page 2 of \d+$/)
		expect(await said()).toHaveLength(4)
	})
})

test.describe('menus and pages', () => {
	test('the column menu opens from the keyboard, stays open while columns change, and gives focus back', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'column-visibility')
		const table = found.getByRole('grid', { name: 'People with a column menu' })
		const trigger = found.getByRole('button', { name: 'Columns' })
		const menu = page.getByRole('menu', { name: 'Columns' })
		const headers = table.locator('thead th')

		await expect(headers).toHaveText(['Name', 'Role'])
		await trigger.focus()
		await page.keyboard.press('Enter')
		await expect(menu).toBeVisible()
		// The name cannot be hidden, so the menu does not list it.
		await expect(menu.getByRole('menuitemcheckbox')).toHaveText(['Role', 'Age'])
		await expect(focused(page)).toHaveText('Role')
		await expect(menu.getByRole('menuitemcheckbox', { name: 'Age' })).toHaveAttribute(
			'aria-checked',
			'false',
		)

		// The menu ends at the end edge of its trigger, under it.
		await expect(menu).toHaveCSS('scale', 'none')
		const [anchor, panel] = [await box(trigger), await box(menu)]
		expect(Math.abs(panel.x + panel.width - (anchor.x + anchor.width))).toBeLessThanOrEqual(1)
		expect(panel.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)

		await page.keyboard.press('ArrowDown')
		await expect(focused(page)).toHaveText('Age')
		await page.keyboard.press('Enter')
		await expect(headers).toHaveText(['Name', 'Role', 'Age'])
		await expect(menu).toBeVisible()
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('Space')
		await expect(headers).toHaveText(['Name', 'Age'])
		await expect(menu).toBeVisible()

		await page.keyboard.press('End')
		await expect(focused(page)).toHaveText('Show all')
		await page.keyboard.press('Enter')
		await expect(headers).toHaveText(['Name', 'Role', 'Age'])

		await page.keyboard.press('Escape')
		await expect(menu).toBeHidden()
		await expect(trigger).toBeFocused()

		// With the pointer: a click on an item, and a press outside closes.
		await trigger.click()
		await menu.getByRole('menuitemcheckbox', { name: 'Role' }).click()
		await expect(headers).toHaveText(['Name', 'Age'])
		await found.getByRole('heading', { name: 'Column visibility' }).click()
		await expect(menu).toBeHidden()
	})

	test('the export menu writes a CSV and an Excel file, and loads the writers on the first export', async ({
		page,
	}) => {
		const writers: string[] = []
		page.on('request', (request) => {
			if (/\/export\/\w+\.ts/.test(request.url())) writers.push(request.url())
		})
		await catchFiles(page)
		await open(page)
		const found = await section(page, 'export')
		const trigger = found.getByRole('button', { name: 'Export' })
		const menu = page.getByRole('menu', { name: 'Export' })

		await trigger.focus()
		await page.keyboard.press('Enter')
		await expect(menu.getByRole('menuitem')).toHaveText(['Export CSV', 'Export Excel'])
		await page.keyboard.press('Escape')
		await expect(menu).toBeHidden()
		await expect(trigger).toBeFocused()
		// The page with all its tables has not asked for the writers.
		expect(writers.filter((url) => /\/(csv|xlsx|zip|download)\.ts/.test(url))).toEqual([])

		await page.keyboard.press('Enter')
		await expect(focused(page)).toHaveText('Export CSV')
		const csv = page.waitForEvent('download')
		await page.keyboard.press('Enter')
		const file = await csv
		expect(file.suggestedFilename()).toBe('people.csv')
		expect(writers.some((url) => url.includes('/csv.ts'))).toBe(true)
		await expect(menu).toBeHidden()
		await expect(trigger).toBeFocused()

		const lines = (await fileText(page, 0)).trim().split(/\r?\n/)
		expect(lines[0]).toBe('Name,Role,Age')
		expect(lines).toHaveLength(6)

		await trigger.click()
		const xlsx = page.waitForEvent('download')
		await menu.getByRole('menuitem', { name: 'Export Excel' }).click()
		const book = await xlsx
		expect(book.suggestedFilename()).toBe('people.xlsx')
		// The file opens, and holds the header row and the rows of the table: a text and a number.
		const cells = await sheetCells(page, 1)
		expect([cells.A1, cells.B1, cells.C1]).toEqual(['Name', 'Role', 'Age'])
		const first = dataRows(found.getByRole('grid', { name: 'People to export' })).first()
		expect(cells.A2).toBe(await first.locator('td').nth(0).innerText())
		expect(cells.C2).toBe(await first.locator('td').nth(2).innerText())
		expect(Object.keys(cells).filter((place) => place.startsWith('A'))).toHaveLength(6)
	})

	test('an export that gives no file says so, and the message goes away with its button', async ({
		page,
	}) => {
		// The part of the page that writes a CSV file does not arrive.
		await page.route(/\/export\/csv\.ts/, (route) => route.abort())
		await open(page)
		const found = await section(page, 'export')
		const trigger = found.getByRole('button', { name: 'Export' })
		const menu = page.getByRole('menu', { name: 'Export' })
		const alert = found.getByRole('alert')
		await expect(alert).toHaveCount(0)

		await trigger.focus()
		await page.keyboard.press('Enter')
		await page.keyboard.press('Enter')
		await expect(alert).toHaveText('The export failed. Try again.')
		await expect(menu).toBeHidden()
		await expect(trigger).toBeFocused()

		// The message has a button, and focus is not lost with the message.
		await alert.getByRole('button', { name: 'Dismiss' }).focus()
		await page.keyboard.press('Enter')
		await expect(alert).toHaveCount(0)
		await expect(trigger).toBeFocused()

		// The next export starts without the old message, and one that works leaves none.
		await trigger.click()
		await menu.getByRole('menuitem', { name: 'Export CSV' }).click()
		await expect(alert).toBeVisible()
		await page.unroute(/\/export\/csv\.ts/)
		await trigger.click()
		const xlsx = page.waitForEvent('download')
		await menu.getByRole('menuitem', { name: 'Export Excel' }).click()
		expect((await xlsx).suggestedFilename()).toBe('people.xlsx')
		await expect(alert).toHaveCount(0)
	})

	test('the page sizes are a list that opens from the keyboard, and the pages move', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'pagination')
		const table = found.getByRole('grid', { name: 'Paged people' })
		const sizes = found.getByRole('combobox', { name: 'Rows per page, Paged people' })
		const status = found.locator('[data-slot="data-table-page"]')
		const pages = found.getByRole('navigation', { name: 'Pages, Paged people' })

		await expect(dataRows(table)).toHaveCount(5)
		await expect(status).toHaveText('Page 1 of 5')
		await expect(pages.getByRole('button', { name: 'Previous page' })).toBeDisabled()

		await pages.getByRole('button', { name: 'Next page' }).click()
		await expect(status).toHaveText('Page 2 of 5')
		await expect(pages.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
			'aria-current',
			'page',
		)
		await pages.getByRole('button', { name: 'Page 4' }).click()
		await expect(found.locator('[data-slot="data-table-rows"]')).toHaveText(
			'Showing 16 to 20 of 23 rows',
		)
		await pages.getByRole('button', { name: 'Last page' }).click()
		await expect(dataRows(table)).toHaveCount(3)
		await expect(pages.getByRole('button', { name: 'Next page' })).toBeDisabled()
		await pages.getByRole('button', { name: 'Previous page' }).click()
		await expect(status).toHaveText('Page 4 of 5')

		await sizes.focus()
		await page.keyboard.press('Enter')
		const options = page.getByRole('listbox', { name: 'Rows per page' }).getByRole('option')
		await expect(options).toHaveText(['5 per page', '10 per page', '25 per page', '50 per page'])
		await page.keyboard.press('Escape')
		await expect(options).toHaveCount(0)
		await expect(sizes).toBeFocused()

		await page.keyboard.press('Enter')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
		await expect(sizes).toHaveText('10 per page')
		await expect(sizes).toBeFocused()
		await expect(dataRows(table)).toHaveCount(10)
		await expect(status).toHaveText(/of 3$/)
	})
})

test.describe('selection and rows', () => {
	test('Space selects a row from its cell and from its checkbox, and the header checkbox selects all', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'selection')
		const table = found.getByRole('grid', { name: 'Selectable people' })
		const output = found.getByTestId('selected')
		const all = table.getByRole('checkbox', { name: /^Select all \d+ rows?/ })
		const aino = table.getByRole('checkbox', { name: 'Select row Aino Korhonen' })

		// The arrow keys move through the checkbox column, cell by cell.
		await table.locator('thead th').first().focus()
		await page.keyboard.press('ArrowDown')
		await expect(focused(page)).toHaveAttribute('data-slot', 'table-cell')
		await page.keyboard.press('Space')
		await expect(output).toHaveText('Selected ids: 1')
		await expect(aino).toBeChecked()
		await expect(dataRows(table).first()).toHaveAttribute('aria-selected', 'true')
		await expect(all).toHaveAttribute('aria-checked', 'mixed')

		// Enter moves into the cell, to its checkbox. Space there is the checkbox.
		await page.keyboard.press('Enter')
		await expect(aino).toBeFocused()
		await page.keyboard.press('Space')
		await expect(aino).not.toBeChecked()
		await expect(output).toHaveText('Selected ids: none')
		// Escape goes back to the cell, and the arrow keys work again.
		await page.keyboard.press('Escape')
		await expect(focused(page)).toHaveAttribute('data-slot', 'table-cell')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Space')
		await expect(output).toHaveText('Selected ids: 2')

		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('Enter')
		await expect(all).toBeFocused()
		await page.keyboard.press('Space')
		await expect(all).toBeChecked()
		await expect(dataRows(table).locator('[role="checkbox"][aria-checked="true"]')).toHaveCount(5)
		await page.keyboard.press('Space')
		await expect(output).toHaveText('Selected ids: none')

		// With the pointer. A selected row has the fill of the app.
		await table.getByRole('checkbox', { name: 'Select row Helmi Virtanen' }).click()
		await expect(output).toHaveText('Selected ids: 3')
		await page.mouse.move(0, 0)
		await expect(dataRows(table).nth(2)).toHaveCSS('background-color', 'oklch(0.97 0 0)')
	})

	test('a row that cannot be selected has a checkbox that is off, also for its group', async ({
		page,
	}) => {
		await open(page)
		const people = (await section(page, 'selection')).getByRole('grid', {
			name: 'People without admins',
		})
		const admin = people.getByRole('checkbox', { name: 'Select row Aino Korhonen' })
		await expect(admin).toBeDisabled()
		await people.getByRole('checkbox', { name: /^Select all \d+ rows?/ }).click()
		await expect(admin).not.toBeChecked()
		await expect(people.locator('tbody tr[aria-selected="true"]')).toHaveCount(4)

		const found = await section(page, 'selection-grouping')
		const tasks = found.getByRole('treegrid', { name: 'Tasks that are not done' })
		await expect(tasks.getByRole('checkbox', { name: 'Select group Done' })).toBeDisabled()
		await tasks.getByRole('checkbox', { name: 'Select group To do' }).click()
		await expect(tasks.locator('tbody tr[aria-selected="true"]')).toHaveCount(2)
	})

	test('the selection of a grouped table stays when the grouping changes', async ({ page }) => {
		await open(page)
		const found = await section(page, 'selection-grouping')
		const table = found.getByRole('treegrid', { name: 'Selectable tasks' })
		const output = found.getByTestId('selected-tasks')

		await table.getByRole('checkbox', { name: 'Select group High' }).click()
		await expect(output).toHaveText(
			'Selected tasks: Move billing to the new provider, Fix the export of large reports',
		)
		await expect(table.getByRole('checkbox', { name: /^Select all \d+ rows?/ })).toHaveAttribute(
			'aria-checked',
			'mixed',
		)

		await found.getByRole('combobox', { name: 'Group tasks by' }).click()
		await page.getByRole('option', { name: 'Group by status' }).click()
		await expect(table.getByRole('button', { name: 'In progress (2)' })).toBeVisible()
		// The new groups are open, and the two tasks are still selected.
		await expect(table.locator('tbody tr[aria-selected="true"]')).toHaveCount(2)
		await expect(table.getByRole('checkbox', { name: 'Select group To do' })).toHaveAttribute(
			'aria-checked',
			'mixed',
		)
	})

	test('a header sorts with a click and with Enter, and Shift adds a column', async ({ page }) => {
		await open(page)
		const found = await section(page, 'sorting')
		const table = found.getByRole('grid', { name: 'Sorted people' })
		const output = found.getByTestId('sort')
		const header = (name: string) => table.getByRole('columnheader', { name })

		await expect(output).toHaveText('Sort: role ascending, age descending')
		await expect(header('Role')).toHaveAttribute('aria-sort', 'ascending')
		await expect(firstCells(table)).toHaveText([
			'Aino Korhonen',
			'Lauri Mäkinen',
			'Eero Laine',
			'Helmi Virtanen',
			'Saara Nieminen',
		])

		await header('Name').getByRole('button').click()
		await expect(output).toHaveText('Sort: name ascending')
		await header('Age')
			.getByRole('button')
			.click({ modifiers: ['Shift'] })
		await expect(output).toHaveText('Sort: name ascending, age ascending')

		// Enter on the header cell sorts too: the cell is the stop of the arrow keys.
		await header('Role').focus()
		await page.keyboard.press('Enter')
		await expect(output).toHaveText('Sort: role ascending')
		await page.keyboard.press('Enter')
		await expect(output).toHaveText('Sort: role descending')
		await expect(header('Role')).toHaveAttribute('aria-sort', 'descending')
	})

	test('rows with child rows, detail rows and groups open with their buttons and with Enter', async ({
		page,
	}) => {
		await open(page)
		const children = await section(page, 'expansion-children')
		const teams = children.getByRole('treegrid', { name: 'Teams' })
		await expect(dataRows(teams)).toHaveCount(2)
		await teams.getByRole('button', { name: 'Expand row Engineering' }).click()
		await expect(dataRows(teams)).toHaveCount(4)
		await expect(teams.getByRole('button', { name: 'Collapse row Engineering' })).toHaveAttribute(
			'aria-expanded',
			'true',
		)
		// From the keyboard: Enter on the button, and Enter on a cell of the row.
		await teams.getByRole('button', { name: 'Collapse row Engineering' }).focus()
		await page.keyboard.press('Enter')
		await expect(dataRows(teams)).toHaveCount(2)
		await expect(teams.getByRole('button', { name: 'Expand row Engineering' })).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(dataRows(teams)).toHaveCount(4)
		await page.keyboard.press('Escape')
		await expect(focused(page)).toHaveAttribute('data-slot', 'table-cell')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('Enter')
		await expect(dataRows(teams)).toHaveCount(2)
		await page.keyboard.press('Enter')
		await expect(dataRows(teams)).toHaveCount(4)

		// With a row open, the button of the header closes every row. With none open, it opens all.
		await teams.getByRole('button', { name: 'Collapse all rows' }).click()
		await expect(dataRows(teams)).toHaveCount(2)
		await teams.getByRole('button', { name: 'Expand all rows' }).click()
		await expect(dataRows(teams)).toHaveCount(6)
		await teams.getByRole('button', { name: 'Collapse all rows' }).click()
		// The switch of the page works through the controller of the table.
		await children.getByRole('switch', { name: 'Expand all rows' }).click()
		await expect(dataRows(teams)).toHaveCount(6)
		await children.getByRole('switch', { name: 'Expand all rows' }).click()
		await expect(dataRows(teams)).toHaveCount(2)

		const custom = await section(page, 'expansion-custom')
		const products = custom.getByRole('grid', { name: 'Products' })
		await products.getByRole('button', { name: 'Expand row Steel bottle' }).focus()
		await page.keyboard.press('Enter')
		await expect(products.getByText('Keeps a drink cold for a day.')).toBeVisible()
		await page.keyboard.press('Enter')
		await expect(products.getByText('Keeps a drink cold for a day.')).toBeHidden()

		const grouping = await section(page, 'grouping')
		const tasks = grouping.getByRole('treegrid', { name: 'Tasks by priority', exact: true })
		// Every group starts open: three group rows and six rows.
		await expect(dataRows(tasks)).toHaveCount(9)
		await tasks.getByRole('button', { name: 'High (2)' }).click()
		await expect(dataRows(tasks)).toHaveCount(7)
		// Enter on the cell of a group row opens the group again.
		await tasks.locator('td', { has: page.getByRole('button', { name: 'High (2)' }) }).focus()
		await page.keyboard.press('Enter')
		await expect(dataRows(tasks)).toHaveCount(9)
		// The rows that cannot be grouped stay outside the groups.
		const apart = grouping.getByRole('treegrid', { name: 'Tasks by priority, low ones apart' })
		await expect(apart.getByRole('button', { name: /^Low/ })).toHaveCount(0)
		await expect(apart.getByText('Archive old projects')).toBeVisible()
	})

	test('the texts of the controls change with the language while the table is on the page', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'ui-translations')
		const table = found.getByRole('grid', { name: 'Translated controls' })
		const search = found.getByRole('textbox')
		const language = found.getByRole('combobox', { name: 'Language of the controls' })

		await found.getByRole('button', { name: 'Next page' }).click()
		await search.fill('a')
		await language.click()
		await page.getByRole('option', { name: 'Deutsch' }).click()

		await expect(search).toHaveAttribute('placeholder', 'Suchen')
		// The table was not built again: the text of the search is still there.
		await expect(search).toHaveValue('a')
		await expect(found.getByRole('button', { name: 'Spalten' })).toBeVisible()
		await expect(found.locator('[data-slot="data-table-page"]')).toHaveText(/^Seite 1 von \d$/)
		await expect(found.getByRole('button', { name: 'Nächste Seite' })).toBeVisible()
		await expect(found.getByRole('combobox', { name: /Rows per page/ })).toHaveText('5 pro Seite')
		await search.fill('nobody at all')
		await expect(table).toContainText('Keine Zeilen für „nobody at all“.')

		await language.click()
		await page.getByRole('option', { name: '日本語' }).click()
		await expect(search).toHaveAttribute('placeholder', '検索')
	})

	test('the locale and the time zone change how the cells read', async ({ page }) => {
		await open(page)
		const found = await section(page, 'localization')
		const row = dataRows(found.getByRole('grid', { name: 'Localized values' })).first()

		await expect(row.locator('td').nth(0)).toHaveText('1,234,567.89')
		await expect(row.locator('td').nth(4)).toContainText('08:05 AM UTC')
		await found.getByRole('combobox', { name: 'Locale' }).click()
		await page.getByRole('option', { name: 'German (Germany)' }).click()
		await expect(row.locator('td').nth(0)).toHaveText('1.234.567,89')
		await expect(row.locator('td').nth(1)).toContainText('€')
		await found.getByRole('combobox', { name: 'Time zone' }).click()
		await page.getByRole('option', { name: 'Asia/Tokyo' }).click()
		await expect(row.locator('td').nth(4)).toContainText('17:05')
	})

	test('the custom controls of the toolbar add a row and bring the first rows back', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'custom-controls')
		const table = found.getByRole('grid', { name: 'People with controls' })

		await found.getByRole('button', { name: 'Add row' }).click()
		await found.getByRole('button', { name: 'Add row' }).click()
		await expect(dataRows(table)).toHaveCount(7)
		await found.getByRole('button', { name: 'Refresh' }).click()
		await expect(dataRows(table)).toHaveCount(5)
	})
})

test.describe('layout', () => {
	test('the header of a table that scrolls with the page stays at the top of the window', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'sticky-header')
		const table = found.getByRole('grid', { name: 'Members' })
		const header = table.locator('thead th').first()
		const sixth = dataRows(table).nth(5).locator('td').first()

		// Scroll until the sixth row is where the header would be.
		const target = await box(sixth)
		await page.evaluate((y) => window.scrollBy(0, y), target.y)
		await expect.poll(async () => Math.round((await box(header)).y)).toBe(0)
		// The row is under the header, and the header covers it: it is opaque.
		expect((await box(sixth)).y).toBeLessThan((await box(header)).height)
		await expect(header).toHaveCSS('position', 'sticky')
		await expect(header).toHaveCSS('background-color', 'oklch(1 0 0)')
		expect(
			await header.evaluate((cell) => {
				const rect = cell.getBoundingClientRect()
				return cell.contains(document.elementFromPoint(rect.x + 10, rect.y + rect.height / 2))
			}),
		).toBe(true)
	})

	test('the header and the footer of a table in a frame stay in view while the rows scroll', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'column-footers')
		const table = found.getByRole('grid', { name: 'Orders in a frame' })
		const frame = found.locator('[data-slot="data-table-frame"]').last()
		const header = table.locator('thead th').first()
		const footer = table.locator('tfoot td').first()

		await frame.scrollIntoViewIfNeeded()
		const edges = async () => {
			const [outer, top, bottom] = [await box(frame), await box(header), await box(footer)]
			return {
				// The frame has a line of one pixel around it.
				top: Math.round(top.y - outer.y),
				bottom: Math.round(outer.y + outer.height - (bottom.y + bottom.height)),
			}
		}
		expect((await box(frame)).height).toBe(320)
		expect(await edges()).toEqual({ top: 1, bottom: 1 })
		await expect(footer).toHaveText('Totals')
		await expect(table.locator('tfoot td').nth(2)).toHaveText('468')

		await frame.evaluate((element) => (element.scrollTop = 600))
		expect(await frame.evaluate((element) => element.scrollTop)).toBe(600)
		expect(await edges()).toEqual({ top: 1, bottom: 1 })
		await frame.evaluate((element) => (element.scrollTop = element.scrollHeight))
		expect(await edges()).toEqual({ top: 1, bottom: 1 })
		await expect(dataRows(table).last()).toBeInViewport()

		// Both are opaque, and they are over the rows.
		for (const cell of [header, footer]) {
			await expect(cell).toHaveCSS('background-color', 'oklch(1 0 0)')
			await expect(cell).toHaveCSS('position', 'sticky')
		}
		// A row that a key brings into view stops beside the sticky rows, not under them.
		await frame.evaluate((element) => (element.scrollTop = 0))
		await dataRows(table).first().locator('td').first().focus()
		for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowDown')
		const active = await box(focused(page))
		expect(active.y + active.height).toBeLessThanOrEqual((await box(footer)).y + 1)
		expect(active.y).toBeGreaterThanOrEqual((await box(header)).y + (await box(header)).height - 1)
	})

	test('a table on its way shows skeleton rows with bars, then its rows', async ({ page }) => {
		await open(page)
		const found = await section(page, 'empty-loading')
		const loading = found.getByRole('grid', { name: 'People on their way' })
		const skeleton = loading.getByRole('status', { name: 'Loading rows.' })
		const rows = skeleton.locator('[data-slot="data-table-skeleton-row"]')

		await expect(rows).toHaveCount(3)
		// The header is there while the rows are on their way.
		await expect(loading.locator('thead th')).toHaveText(['Name', 'Role', 'Age'])
		// One bar for each column, side by side, inside the frame of the table.
		const frame = await box(found.locator('[data-slot="data-table-frame"]').last())
		const bars = await rows
			.first()
			.locator('div')
			.evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect()
					return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
				}),
			)
		expect(bars).toHaveLength(3)
		for (const bar of bars) {
			expect(bar.height).toBe(16)
			expect(bar.width).toBeGreaterThan(40)
			expect(bar.x).toBeGreaterThan(frame.x)
			expect(bar.x + bar.width).toBeLessThan(frame.x + frame.width)
		}
		expect(new Set(bars.map((bar) => bar.y)).size).toBe(1)
		expect(bars[1]?.x).toBeGreaterThan((bars[0]?.x ?? 0) + (bars[0]?.width ?? 0))

		await expect(found.getByRole('grid', { name: 'No people', exact: true })).toContainText(
			'No rows yet.',
		)
		await expect(found.getByRole('grid', { name: 'No people, own text' })).toContainText(
			'No people found. Try adjusting your filters.',
		)

		// The customer directory starts with its skeleton, and the rows take its place.
		await page.reload()
		const directory = page.getByRole('grid', { name: 'Customers' })
		await expect(directory.locator('[data-slot="data-table-skeleton-row"]')).toHaveCount(5)
		await expect(dataRows(directory)).toHaveCount(10)
		await expect(directory.locator('[data-slot="data-table-skeleton-row"]')).toHaveCount(0)
	})

	test('the 50,000-row table renders the rows near its frame, and scrolls to the end', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'virtualization')
		await found.getByRole('button', { name: 'Load the 50,000-row dataset' }).click()
		const table = found.getByRole('grid', { name: 'Fifty thousand rows' })
		const frame = found.locator('[data-slot="data-table-frame"]')
		const search = found.getByRole('textbox', { name: 'Search, Fifty thousand rows' })
		await expect(found.getByTestId('big-count')).toHaveText('50,000 rows, fixed heights')
		// The frame is higher than the button that loaded it, so it comes into the window first.
		await frame.evaluate((element) => element.scrollIntoView({ block: 'center' }))

		// One header row, 50,000 rows and the footer row with the mean score.
		await expect(table).toHaveAttribute('aria-rowcount', '50002')
		expect(await dataRows(table).count()).toBeLessThan(60)
		expect((await box(frame)).height).toBe(560)
		expect((await box(dataRows(table).first())).height).toBe(41)
		// Every column has a width, so the table is as wide as their sum and the frame scrolls sideways.
		expect((await box(table)).width).toBe(1540)

		await frame.evaluate((element) => (element.scrollTop = 41 * 25_000))
		await expect(
			dataRows(table)
				.filter({ hasText: /^25,0\d\d/ })
				.first(),
		).toBeVisible()
		expect(await dataRows(table).count()).toBeLessThan(60)
		expect(await frame.evaluate((element) => element.scrollTop)).toBe(41 * 25_000)

		await frame.evaluate((element) => (element.scrollTop = element.scrollHeight))
		const last = dataRows(table).last()
		await expect(last.locator('td').first()).toHaveText('50,000')
		await expect(last).toBeInViewport()
		// The last row ends where the footer starts, and the header is at the top of the frame.
		const [end, foot, head, outer] = [
			await box(last),
			await box(table.locator('tfoot td').first()),
			await box(table.locator('thead th').first()),
			await box(frame),
		]
		expect(Math.round(end.y + end.height)).toBe(Math.round(foot.y))
		expect(Math.round(head.y - outer.y)).toBe(1)
		// Under the footer there is the bar that scrolls the table sideways, and nothing else.
		expect(outer.y + outer.height - (foot.y + foot.height)).toBeLessThanOrEqual(20)

		// The search reads all rows.
		await search.fill('jules.novak')
		await expect
			.poll(async () => Number(await table.getAttribute('aria-rowcount')))
			.toBeLessThan(2000)
		await expect(dataRows(table).first()).toContainText('jules.novak')

		// Measured heights: a note breaks into lines, and the rows differ in height.
		await search.fill('')
		await found.getByRole('button', { name: 'Use measured heights' }).click()
		await expect(found.getByTestId('big-count')).toHaveText('50,000 rows, measured heights')
		await expect(table).toHaveAttribute('aria-rowcount', '50002')
		const heights = await dataRows(table).evaluateAll((rows) =>
			rows.map((row) => Math.round(row.getBoundingClientRect().height)),
		)
		expect(new Set(heights).size).toBeGreaterThan(1)
		await frame.evaluate((element) => (element.scrollTop = element.scrollHeight / 2))
		await expect
			.poll(async () => Number(await dataRows(table).first().getAttribute('aria-rowindex')))
			.toBeGreaterThan(10_000)
		// The middle of the frame holds a row, not the spacer.
		await expect
			.poll(() =>
				frame.evaluate((element) => {
					const rect = element.getBoundingClientRect()
					const at = document.elementFromPoint(rect.x + 100, rect.y + rect.height / 2)
					return at?.closest('tr')?.getAttribute('data-slot')
				}),
			)
			.toBe('table-row')
	})

	test('a table is as wide as its place, or as wide as its columns need', async ({ page }) => {
		await open(page)
		const found = await section(page, 'auto-width')
		const frames = found.locator('[data-slot="data-table-frame"]')
		const [full, auto] = [await box(frames.first()), await box(frames.last())]
		const column = await box(found.locator('h3').first())

		expect(Math.round(full.width)).toBe(Math.round(column.width))
		expect(auto.width).toBeLessThan(full.width / 2)
		// The frame ends with its table: no empty band beside the last column.
		const table = await box(found.getByRole('grid', { name: 'People at auto width' }))
		expect(Math.round(auto.width - table.width)).toBe(2)
	})

	test('the classes of a caller reach each part, and win over the classes of the table', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'class-overrides')
		const table = found.getByRole('grid', { name: 'People with own classes' })

		await expect(found.locator('[data-slot="data-table-frame"]')).toHaveCSS(
			'border-top-width',
			'2px',
		)
		await expect(table).toHaveCSS('border-collapse', 'collapse')
		await expect(table.locator('thead th').first()).toHaveCSS('background-color', 'oklch(0.97 0 0)')
		await expect(table.locator('tbody td').first()).toHaveCSS('font-style', 'italic')
		// `hover:bg-primary/5` of the caller, in place of `hover:bg-muted/50` of the table.
		const row = dataRows(table).first()
		const plain = dataRows(
			(await section(page, 'basic')).getByRole('grid', { name: 'Basic people' }),
		).first()
		// The fill of a hovered row comes with a transition; the end value is what counts.
		const fill = (locator: Locator) =>
			locator.evaluate(async (element) => {
				await Promise.all(
					element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
				)
				return getComputedStyle(element).backgroundColor
			})
		await plain.hover()
		const usual = await fill(plain)
		await row.scrollIntoViewIfNeeded()
		await row.hover()
		const own = await fill(row)
		expect(usual).toMatch(/^oklab\(0\.97/)
		expect(own).toMatch(/^oklab\(0\.596/)
		expect(own).not.toBe(usual)
	})

	test('a row and a cell take their class from a function of the caller', async ({ page }) => {
		await open(page)
		const rows = dataRows(
			(await section(page, 'row-styling')).getByRole('grid', { name: 'Inventory by row' }),
		)
		await expect(rows.nth(0)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		await expect(rows.nth(1)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		await expect(rows.nth(2)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

		const cells = (await section(page, 'cell-styling'))
			.getByRole('grid', { name: 'Inventory by cell' })
			.locator('tbody td:last-child')
		await expect(cells.nth(0)).toHaveCSS('font-weight', '600')
		await expect(cells.nth(1)).toHaveCSS('color', 'oklch(0.577 0.245 27.325)')
		await expect(cells.nth(3)).toHaveCSS('font-weight', '400')
	})

	test('header groups span their columns, and footers show totals and the slots of the caller', async ({
		page,
	}) => {
		await open(page)
		const sales = (await section(page, 'header-groups')).getByRole('grid', {
			name: 'Sales by quarter',
		})
		const group = sales.getByRole('columnheader', { name: '2024 sales (€)' })
		await expect(group).toHaveAttribute('colspan', '4')
		await expect(group).toHaveCSS('text-align', 'center')
		await expect(sales.getByRole('columnheader', { name: 'Region' })).toHaveAttribute(
			'rowspan',
			'2',
		)
		const [first, last, span] = [
			await box(sales.getByRole('columnheader', { name: 'Q1' })),
			await box(sales.getByRole('columnheader', { name: 'Q4' })),
			await box(group),
		]
		expect(Math.round(span.x)).toBe(Math.round(first.x))
		expect(Math.round(span.x + span.width)).toBe(Math.round(last.x + last.width))
		// The header of the group is over its columns, not beside them.
		expect(Math.round(span.y + span.height)).toBe(Math.round(first.y))

		const footers = await section(page, 'column-footers')
		const totals = footers.getByRole('grid', { name: 'Orders with totals' }).locator('tfoot td')
		await expect(totals).toHaveText(['Totals', '', '117', '€83.77', '€9,801.00'])
		// A total sits under the numbers of its column.
		await expect(totals.nth(2)).toHaveCSS('text-align', 'end')
		await expect(
			footers.getByRole('grid', { name: 'Orders with a marked total' }).locator('tfoot strong'),
		).toHaveText('€9,801.00')

		const aggregations = await section(page, 'grouping-aggregations')
		const grouped = aggregations.getByRole('treegrid', { name: 'Orders by category' })
		await expect(grouped.locator('[data-slot="data-table-group-totals"]').first()).toHaveText(
			/Units\s*45\s*Price\s*€111\.50\s*Revenue\s*€4,265\.00/,
		)
		await expect(grouped.locator('tfoot td').last()).toHaveText('€9,801.00')
		await expect(
			aggregations
				.getByRole('treegrid', { name: 'Orders with own totals' })
				.locator('tfoot td')
				.last(),
		).toHaveText('3 returned')
	})

	test('the customer directory works with everything at once', async ({ page }) => {
		await catchFiles(page)
		await open(page)
		const { section: found, table } = await customers(page)
		const count = found.locator('[data-slot="data-table-rows"]')

		// Nine of seventeen columns, beside the checkbox and the detail column.
		await expect(table.locator('thead th')).toHaveCount(11)
		await expect(table.getByRole('columnheader', { name: 'MRR' })).toHaveAttribute(
			'aria-sort',
			'descending',
		)
		await expect(count).toHaveText('Showing 1 to 10 of 75 rows')

		// The search reads a computed column.
		const search = found.getByRole('textbox', { name: 'Search, Customers' })
		await search.fill('aalto')
		await expect(count).not.toHaveText('Showing 1 to 10 of 75 rows')
		for (const name of await dataRows(table).locator('td:nth-child(3)').allInnerTexts()) {
			expect(name.toLowerCase()).toContain('aalto')
		}
		await search.fill('')
		await expect(count).toHaveText('Showing 1 to 10 of 75 rows')

		// The popover lists the columns in view that have a filter. `Active` has none.
		await found.locator('[data-slot="popover-trigger"]').click()
		const popover = page.getByRole('dialog', { name: 'Column filters' })
		await expect(popover.locator('[data-slot="data-table-filter"] > span')).toHaveText([
			'Customer',
			'Company',
			'Country',
			'Plan',
			'MRR',
			'LTV',
			'Churn risk',
			'Contract ends',
		])
		await popover.getByRole('combobox', { name: 'Values of Country' }).click()
		await page.getByRole('option', { name: 'Finland' }).click()
		await page.keyboard.press('Escape')
		await popover.getByRole('spinbutton', { name: 'Lowest MRR' }).fill('3000')
		await page.keyboard.press('Escape')
		await expect(popover).toBeHidden()
		await expect(found.locator('[data-slot="popover-trigger"]')).toHaveText('2 filters applied')
		await expect(count).not.toHaveText('Showing 1 to 10 of 75 rows')
		for (const country of await dataRows(table).locator('td:nth-child(5)').allInnerTexts()) {
			expect(country).toContain('Finland')
		}

		// Selection of every row that passes the filters, with the count under the table and in the toolbar.
		await table.getByRole('checkbox', { name: /^Select all \d+ rows?/ }).click()
		const total = Number(
			(await found.getByTestId('selected-customers').innerText()).replace(/\D/g, ''),
		)
		expect(total).toBeGreaterThan(0)
		expect(total).toBeLessThan(75)
		await expect(found.locator('[data-slot="data-table-selected"]')).toHaveText(
			`${total} ${total === 1 ? 'row' : 'rows'} selected`,
		)
		await expect(found.getByRole('button', { name: `Email ${total} selected` })).toBeVisible()

		// A detail row with the invoices of the customer.
		await table
			.getByRole('button', { name: /^Expand row/ })
			.first()
			.click()
		await expect(table.locator('p', { hasText: /Invoices for \S+ \S+ \(\d\)/ })).toBeVisible()

		// A hidden column comes into view.
		await found.getByRole('button', { name: 'Columns' }).click()
		await page.getByRole('menuitemcheckbox', { name: 'Open invoices' }).click()
		await page.keyboard.press('Escape')
		await expect(table.getByRole('columnheader', { name: 'Open invoices' })).toBeVisible()

		// The file holds every row and every column, the hidden ones too, whatever the filters say.
		await found.getByRole('button', { name: 'Export' }).click()
		const download = page.waitForEvent('download')
		await page.getByRole('menuitem', { name: 'Export CSV' }).click()
		expect((await download).suggestedFilename()).toBe('customers.csv')
		const lines = (await fileText(page, 0)).trim().split(/\r?\n/)
		expect(lines).toHaveLength(76)
		// The columns in view come first, in their order, and the hidden ones after them.
		expect(lines[0]).toBe(
			'Customer,Company,Country,Plan,MRR,LTV,Open invoices,Churn risk,Active,Contract ends,Title,Email,Phone,Website,NPS,Last seen,Tags',
		)
	})
})

test.describe('headless', () => {
	test('a table built on the table without styles sorts from its header', async ({ page }) => {
		await open(page)
		const found = await section(page, 'headless-compose')
		const table = found.getByRole('grid', { name: 'Headless people' })
		const age = table.getByRole('columnheader', { name: 'Age' })

		await expect(firstCells(table).first()).toHaveText('Aino Korhonen')
		await age.getByRole('button').click()
		await expect(age).toHaveAttribute('aria-sort', 'ascending')
		await expect(firstCells(table).first()).toHaveText('Eero Laine')
		// Enter on the header cell sorts too, without a line of code in the page.
		await age.focus()
		await page.keyboard.press('Enter')
		await expect(firstCells(table).first()).toHaveText('Helmi Virtanen')
		await expect(age).toHaveAttribute('aria-sort', 'descending')
		// The classes of the page, and none of the styled table.
		await expect(table.locator('tbody td').first()).toHaveCSS('padding', '8px 12px')
		await expect(found.locator('[data-slot="data-table"]')).toHaveCount(0)
	})
})
