import { expect, test, type Locator, type Page } from '@playwright/test'
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

test('the sidebar and "On this page" show no scrollbar while the window has room for them', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	await page.goto('/?page=installation')
	for (const name of ['.sidebar', '.toc']) {
		const sizes = await page.locator(name).evaluate((el) => ({
			sideways: el.scrollWidth - el.clientWidth,
			down: el.scrollHeight - el.clientHeight,
		}))
		// The list of pages is taller than a window of 900 px: the sidebar scrolls down, and never sideways.
		expect(sizes, name).toEqual({ sideways: 0, down: name === '.sidebar' ? sizes.down : 0 })
	}
	// The fill of the link of the page in view is whole: the sidebar cuts nothing of it.
	const cut = await page.locator('.sidebar a[aria-current]').evaluate((link) => {
		const inside = link.getBoundingClientRect()
		const frame = link.closest('.sidebar')?.getBoundingClientRect()
		return !frame || inside.left < frame.left || inside.right > frame.right
	})
	expect(cut).toBe(false)
})

test('Tab goes through the bar, the sidebar and the page in the order of the screen', async ({
	page,
}) => {
	await page.goto('/?page=installation')
	await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible()
	const stops: { area: string; x: number; y: number }[] = []
	// Enough presses for every link of the sidebar and of the page.
	for (let step = 0; step < 100; step++) {
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
			// The sidebar scrolls inside itself, so a place in it counts from the top of its content.
			const { x, y } = active.getBoundingClientRect()
			let scrolled = 0
			for (let parent = active.parentElement; parent; parent = parent.parentElement)
				scrolled += parent.scrollTop
			return { area, x: x + scrollX, y: y + scrolled }
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

// One test for each page of a guide: its example does the main thing that its caption says.
// A table with tree rows or group rows is a treegrid, so the name finds both.
const grid = (page: Page, example: string, name: string) =>
	page.locator(
		`[data-example="${example}"] :is([role="grid"], [role="treegrid"])[aria-label="${name}"]`,
	)
const firstCells = (table: ReturnType<typeof grid>) =>
	table
		.locator('tbody tr')
		.evaluateAll((rows) => rows.map((row) => row.querySelector('td')?.textContent?.trim()))

test('Columns: a header group spans its columns, and a pinned column has its attribute', async ({
	page,
}) => {
	await page.goto('/?page=column-definitions')
	const books = grid(page, 'column-definitions/formats', 'Books and their sales')
	await expect(books.getByRole('columnheader', { name: 'Sales' })).toHaveAttribute('colspan', '3')
	await expect(books.locator('td[data-column="price"]').first()).toHaveText('$18.50')
	await books.getByRole('button', { name: 'Copies' }).click()
	expect(await firstCells(books)).toEqual(['Small Hours', 'The River Road', 'Salt and Iron'])

	const example = page.locator('[data-example="column-definitions/layout"]')
	const cities = grid(page, 'column-definitions/layout', 'Cities')
	await example.getByRole('button', { name: 'Hide the country' }).click()
	await expect(cities.locator('th[data-column="country"]')).toHaveCount(0)
	await example.getByRole('button', { name: 'Pin the city' }).click()
	await expect(cities.locator('td[data-column="name"]').first()).toHaveAttribute(
		'data-pinned',
		'start',
	)
})

test('Cells and slots: a column slot, a header slot and a footer slot fill their cells', async ({
	page,
}) => {
	await page.goto('/?page=cells-and-slots')
	const table = grid(page, 'cells-and-slots/slots', 'Tasks of the week')
	await expect(table.locator('td[data-column="state"] mark').first()).toHaveText('Doing')
	await expect(table.locator('td[data-column="state"]').first()).toHaveClass('state')
	await expect(table.getByRole('columnheader', { name: 'Hours (sum below)' })).toBeVisible()
	await expect(table.locator('tfoot')).toContainText('All tasks')
	await expect(table.locator('tfoot td[data-column="hours"]')).toHaveText('10')
})

test('State and events: a sort reports its reason, and a refused sort changes nothing', async ({
	page,
}) => {
	await page.goto('/?page=state-and-events')
	const example = page.locator('[data-example="state-and-events/controlled"]')
	const table = grid(page, 'state-and-events/controlled', 'Goals of the season')
	await table.getByRole('button', { name: 'Player' }).click()
	await expect(example.getByRole('status')).toHaveText('name up, by press')
	await table.getByRole('button', { name: 'Club' }).click()
	await expect(example.getByRole('status')).toContainText('Refused')
	await expect(table.getByRole('columnheader', { name: 'Player' })).toHaveAttribute(
		'aria-sort',
		'ascending',
	)
	await expect(table.getByRole('columnheader', { name: 'Club' })).toHaveAttribute(
		'aria-sort',
		'none',
	)
})

test('Styling: the header and the pinned column stay while the frame scrolls', async ({ page }) => {
	await page.goto('/?page=styling')
	const table = grid(page, 'styling/sticky', 'Weather readings')
	const frame = page.locator('[data-example="styling/sticky"] .frame')
	const header = table.getByRole('columnheader', { name: 'Station' })
	const before = await header.boundingBox()
	await frame.evaluate((element) => element.scrollTo({ top: 200, left: 200, behavior: 'instant' }))
	await expect(async () => {
		const after = await header.boundingBox()
		expect(Math.round(after?.y ?? 0)).toBe(Math.round(before?.y ?? 1))
		expect(Math.round(after?.x ?? 0)).toBe(Math.round(before?.x ?? 1))
	}).toPass()
})

test('Controller and view: buttons beside the table sort and filter, and the view follows', async ({
	page,
}) => {
	await page.goto('/?page=controller-and-view')
	const example = page.locator('[data-example="controller-and-view/outside"]')
	const table = grid(page, 'controller-and-view/outside', 'Departures')
	await example.getByRole('button', { name: 'Most delayed first' }).click()
	expect((await firstCells(table))[0]).toBe('BA 795')
	await example.getByRole('button', { name: 'Only delayed' }).click()
	await expect(example.getByRole('status')).toHaveText('3 of 5 flights, sorted by delay')
	await example.getByRole('button', { name: 'Every flight' }).click()
	await expect(table.locator('tbody tr')).toHaveCount(5)
})

test('Sort, filter and search: two columns sort, a search waits, facets follow the other list', async ({
	page,
}) => {
	await page.goto('/?page=sort-filter-and-search')
	const runners = grid(page, 'sort-filter-and-search/sort', 'Results of the 10 km run')
	await runners.getByRole('button', { name: 'Club' }).click()
	await runners.getByRole('button', { name: '10 km' }).click({ modifiers: ['Shift'] })
	expect(await firstCells(runners)).toEqual([
		'Jack Ellis',
		'Cleo Vance',
		'Rosa Diaz',
		'Ben Nolan',
		'Ivy Adams',
	])
	await expect(runners.getByRole('columnheader', { name: /10 km/ })).toHaveAttribute(
		'data-sort-index',
		'2',
	)

	const search = page.locator('[data-example="sort-filter-and-search/search"]')
	await search.getByRole('searchbox', { name: 'Search the members' }).fill('desi')
	await expect(search.getByRole('status')).toHaveText('2 members found')
	await expect(
		grid(page, 'sort-filter-and-search/search', 'Members of the team').locator('tbody tr'),
	).toHaveCount(2)

	const facets = page.locator('[data-example="sort-filter-and-search/facets"]')
	await facets.getByRole('button', { name: /^Northway/ }).click()
	await expect(facets.getByRole('group', { name: 'Color' })).toContainText('Black (2)')
	await facets.getByRole('button', { name: /^Black/ }).click()
	await expect(
		grid(page, 'sort-filter-and-search/facets', 'Running shoes').locator('tbody tr'),
	).toHaveCount(2)
})

test('Groups and totals: a group opens, and each group row has its totals', async ({ page }) => {
	await page.goto('/?page=groups-and-totals')
	const table = grid(page, 'groups-and-totals/groups', 'Sales by region')
	const south = table.locator('tr[data-kind="group"]').nth(1)
	await expect(south.locator('[data-kind="group-total"]').first()).toHaveText('10')
	await expect(table.locator('tbody tr')).toHaveCount(4)
	await south.getByRole('button').click()
	await expect(table.locator('tbody tr')).toHaveCount(7)
	await expect(table.locator('tfoot')).toContainText('€47,750.00')
})

test('Pages and server mode: the pages move, and the server answers with its page', async ({
	page,
}) => {
	await page.goto('/?page=pages-and-server-mode')
	const pages = page.locator('[data-example="pages-and-server-mode/pages"]')
	await pages.getByRole('button', { name: /3/ }).click()
	await expect(pages.getByRole('status')).toHaveText('Page 3 of 5, 23 invoices')
	expect((await firstCells(grid(page, 'pages-and-server-mode/pages', 'Invoices')))[0]).toBe(
		'INV-1011',
	)

	const server = page.locator('[data-example="pages-and-server-mode/server"]')
	const people = grid(page, 'pages-and-server-mode/server', 'People from a server')
	await expect(server.getByRole('status')).toHaveText('Page 1 of 8')
	await server.getByRole('button', { name: 'Next' }).click()
	await expect(server.getByRole('status')).toHaveText('Page 2 of 8')
	expect((await firstCells(people))[0]).toBe('Person 6')
	await people.getByRole('button', { name: 'Score' }).click()
	await expect(server.getByRole('status')).toHaveText('Page 1 of 8')
	await expect(people.locator('tbody tr td[data-column="score"]').first()).toHaveText('0')
})

test('Rows: a folder opens, a detail row opens, a row pins, and the window jumps', async ({
	page,
}) => {
	await page.goto('/?page=rows')
	const files = grid(page, 'rows/tree', 'Files of a project')
	await files.getByRole('button', { name: 'Folder docs' }).click()
	await expect(files.locator('tbody tr')).toHaveCount(6)

	const orders = grid(page, 'rows/detail', 'Orders with notes')
	await orders.getByRole('button', { name: 'Note of Sola' }).click()
	await expect(orders.locator('tr[data-kind="detail"]')).toHaveText(
		'Ten days late. Send a reminder today.',
	)
	await expect(orders.getByRole('button', { name: 'Note of Northway' })).toHaveCount(0)

	const products = grid(page, 'rows/pinned', 'Products, the pinned ones on top')
	await products.getByRole('button', { name: 'Pin Honey to the top' }).click()
	expect((await firstCells(products)).slice(0, 2)).toEqual(['★ Dark coffee', '★ Honey'])

	const example = page.locator('[data-example="rows/window"]')
	const readings = grid(page, 'rows/window', 'Ten thousand readings')
	await example.getByRole('button', { name: 'Row 5,000' }).click()
	await expect(
		readings.locator('td[data-column="number"]', { hasText: /^5,000$/ }),
	).toBeInViewport()
	expect(await readings.locator('tbody tr[data-kind="row"]').count()).toBeLessThan(60)
})

test('Selection and keyboard: a box picks a row, the header picks all, a locked row stays out', async ({
	page,
}) => {
	await page.goto('/?page=selection-and-keyboard')
	const example = page.locator('[data-example="selection-and-keyboard/select"]')
	const table = grid(page, 'selection-and-keyboard/select', 'Inbox')
	await table.getByRole('checkbox', { name: 'Pick the mail from Ada' }).click()
	await expect(example.getByRole('status')).toHaveText('1 picked')
	await expect(table.getByRole('checkbox', { name: 'Pick every mail' })).toHaveAttribute(
		'aria-checked',
		'mixed',
	)
	await table.getByRole('checkbox', { name: 'Pick every mail' }).click()
	await expect(example.getByRole('status')).toHaveText('3 picked')
	await expect(table.locator('tr[aria-selected="true"]')).toHaveCount(3)

	// Space on a cell selects its row, as the keys of the page say.
	await table.locator('tr[aria-selected="true"]').first().locator('td').nth(1).click()
	await page.keyboard.press('Space')
	await expect(example.getByRole('status')).toHaveText('2 picked')
})

test('Editing: a price saves with Enter, and a price below zero keeps the editor open', async ({
	page,
}) => {
	await page.goto('/?page=cell-editing')
	const example = page.locator('[data-example="cell-editing/prices"]')
	const table = grid(page, 'cell-editing/prices', 'Prices')
	const price = table.locator('td[data-column="price"]').first()
	await price.dblclick()
	await page.keyboard.press('ControlOrMeta+a')
	await page.keyboard.type('7')
	await page.keyboard.press('Enter')
	await expect(price).toHaveText('7.00')
	await expect(example.getByRole('status')).toHaveText('Green tea: Price 6.5 to 7, by enter-key')

	await price.dblclick()
	await page.keyboard.press('ControlOrMeta+a')
	await page.keyboard.type('-1')
	await page.keyboard.press('Enter')
	await expect(table.locator('[data-slot="table-editor"]')).toHaveAttribute('aria-invalid', 'true')
	await expect(table.locator('[data-slot="table-edit-error"]')).toHaveText(
		'A price is a number, zero or more.',
	)
	await page.keyboard.press('Escape')
	await expect(price).toHaveText('7.00')
})

test('Editing: in the entry mode Tab walks the cells, and Save and Cancel act on the draft', async ({
	page,
}) => {
	await page.goto('/?page=cell-editing')
	const example = page.locator('[data-example="cell-editing/entry"]')
	const table = grid(page, 'cell-editing/entry', 'Shifts')
	const day = table.locator('td[data-column="day"]').first()
	const hours = table.locator('td[data-column="hours"]').first()
	// Out of the mode, a press opens no editor.
	await day.click()
	await expect(table.locator('[data-slot="table-editor"]')).toHaveCount(0)

	await example.getByRole('button', { name: 'Edit' }).click()
	await expect(table).toHaveAttribute('data-entry', '')
	await day.click()
	await page.keyboard.press('ControlOrMeta+a')
	await page.keyboard.type('Sunday')
	await page.keyboard.press('Tab')
	await expect(hours).toBeFocused()
	await page.keyboard.type('7')
	await page.keyboard.press('Tab')
	await expect(day).toHaveText('Sunday')
	await expect(hours).toHaveText('7.00')
	await expect(day).toHaveClass(/changed/)
	await expect(example.getByText('2 changed')).toBeVisible()

	await example.getByRole('button', { name: 'Cancel' }).click()
	await expect(day).toHaveText('Monday')
	await expect(hours).toHaveText('8.00')
	await expect(table).not.toHaveAttribute('data-entry')

	await example.getByRole('button', { name: 'Edit' }).click()
	await day.click()
	await page.keyboard.press('ControlOrMeta+a')
	await page.keyboard.type('Sunday')
	await page.keyboard.press('Tab')
	await example.getByRole('button', { name: 'Save' }).click()
	await expect(example.getByRole('status')).toHaveText('Saved 1 cell.')
	await expect(day).toHaveText('Sunday')
	await expect(day).not.toHaveClass(/changed/)
})

test('Editing: in the entry mode a press on another cell after a change saves it and opens the pressed cell', async ({
	page,
}) => {
	await page.goto('/?page=cell-editing')
	const example = page.locator('[data-example="cell-editing/entry"]')
	const table = grid(page, 'cell-editing/entry', 'Shifts')
	const input = table.locator('[data-slot="table-editor"]')
	const at = (row: number, column: string) => table.locator(`td[data-column="${column}"]`).nth(row)
	await example.getByRole('button', { name: 'Edit' }).click()
	// A cell of the same row.
	await at(1, 'day').click()
	await input.fill('Sunday')
	await at(1, 'hours').click()
	await expect(at(1, 'day')).toHaveText('Sunday')
	await expect(at(1, 'hours')).toHaveAttribute('data-editing', '')
	await expect(input).toBeFocused()
	await expect(input).toHaveValue('6.5')
	// A cell of another row.
	await input.fill('7')
	await at(2, 'note').click()
	await expect(at(1, 'hours')).toHaveText('7.00')
	await expect(at(2, 'note')).toHaveAttribute('data-editing', '')
	await expect(input).toBeFocused()
	await expect(example.getByText('2 changed')).toBeVisible()
})

test('Export: the CSV holds the text of the screen and the totals, without the id', async ({
	page,
}) => {
	await page.goto('/?page=export')
	const example = page.locator('[data-example="export/files"]')
	await example.getByRole('button', { name: 'Show the CSV' }).click()
	const csv = await example.getByTestId('csv').textContent()
	// The file starts with a byte order mark, so Excel reads it as UTF-8.
	expect(csv?.startsWith('\uFEFF')).toBe(true)
	expect(csv?.slice(1).split(/\r?\n/).slice(0, 2)).toEqual([
		'Customer,City,Total',
		'Northway,Oslo,"1,240.00"',
	])
	expect(csv).not.toContain('Id')
	const download = page.waitForEvent('download')
	await example.getByRole('button', { name: 'Download Excel' }).click()
	expect((await download).suggestedFilename()).toBe('orders.xlsx')
})

test('Agents: an agent sorts the table by its name, and a wrong column is refused with the list', async ({
	page,
}) => {
	await page.goto('/?page=agents')
	const example = page.locator('[data-example="agents/agent"]')
	const table = grid(page, 'agents/agent', 'Ships in port')
	await example.getByRole('button', { name: 'Heaviest first' }).click()
	await expect(example.getByRole('status')).toHaveText('sortBy done.')
	expect((await firstCells(table))[0]).toBe('Blue Heron')
	await example.getByRole('button', { name: 'Sort by weight' }).click()
	await expect(example.getByRole('status')).toContainText(
		'No column "weight" to sort by. Columns: name, port, tons.',
	)
})

test('the text of a page with tables in its examples holds 4.5 to 1', async ({ page }) => {
	await page.goto('/?page=groups-and-totals')
	const texts = page.locator('.example-preview :is(th, td, button, p)')
	const low: string[] = []
	for (let index = 0; index < (await texts.count()); index++) {
		const text = texts.nth(index)
		if (!(await text.isVisible()) || !(await text.textContent())?.trim()) continue
		const ratio = await contrastOf(text, 'text')
		if (ratio < 4.5) low.push(`${await text.textContent()}: ${ratio.toFixed(2)}`)
	}
	expect(low).toEqual([])
})

test('The sheet options: a character opens the editor, Delete clears, Undo brings it back, and a footer changes its function', async ({
	page,
}) => {
	await page.goto('/?page=sheet-options')
	const example = page.locator('[data-example="sheet-options/sheet"]')
	const table = grid(page, 'sheet-options/sheet', 'Stock of the shop')
	const price = table.locator('td[data-column="price"]').first()
	await price.click()
	await page.keyboard.type('5')
	await expect(table.locator('[data-slot="table-editor"]')).toHaveValue('5')
	await page.keyboard.press('Enter')
	await expect(price).toHaveText('5.00')
	await expect(table.locator('td[data-column="price"]').nth(1)).toBeFocused()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Delete')
	await expect(table.locator('td[data-column="price"]').nth(2)).toHaveText('')
	await example.getByRole('button', { name: 'Undo' }).click()
	await expect(table.locator('td[data-column="price"]').nth(2)).toHaveText('1.20')

	const trips = grid(page, 'sheet-options/totals', 'Trips of the year')
	await trips.getByRole('button', { name: 'mean of Nights' }).click()
	await expect(trips.locator('tfoot td[data-column="nights"]')).toContainText('3')
	await expect(trips.locator('tfoot td[data-column="nights"]')).toHaveAttribute(
		'data-aggregate',
		'mean',
	)
})

test('Range, copy and paste: Shift with an arrow selects a range, the summary adds it, and a paste copies it', async ({
	page,
}) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
	await page.goto('/?page=range-copy-and-paste')
	const example = page.locator('[data-example="range-copy-and-paste/range"]')
	const table = grid(page, 'range-copy-and-paste/range', 'Hours of the week')
	await table.locator('td[data-column="mon"]').first().click()
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Shift+ArrowRight')
	await expect(table.locator('td[data-selected]')).toHaveCount(3)
	await expect(example.getByTestId('summary')).toHaveText('3 cells, sum 21.5, average 7.17')
	await page.keyboard.press('ControlOrMeta+c')
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('7.5\t8\t6')
	await table.locator('td[data-column="mon"]').nth(2).click()
	await page.keyboard.press('ControlOrMeta+v')
	await expect(table.locator('tbody tr').nth(2)).toHaveText('Cleo7.508.006.00')
})

test('Fill: two rows go on as a series of weeks and days, and the rooms repeat', async ({
	page,
}) => {
	await page.goto('/?page=fill')
	const example = page.locator('[data-example="fill/fill"]')
	const table = grid(page, 'fill/fill', 'Lessons of a course')
	await example.getByRole('button', { name: 'Fill down from two rows' }).click()
	await expect(table.locator('td[data-column="week"]')).toHaveText(['1', '2', '3', '4', '5'])
	await expect(table.locator('td[data-column="day"]')).toHaveText([
		'2027-01-04',
		'2027-01-11',
		'2027-01-18',
		'2027-01-25',
		'2027-02-01',
	])
	await expect(table.locator('td[data-column="room"]')).toHaveText(['A1', 'B2', 'A1', 'B2', 'A1'])
	await expect(table.locator('[data-slot="table-fill-handle"]')).toHaveCount(1)
})

test('History: three edits come back one by one with Undo, each as a report with the reason undo', async ({
	page,
}) => {
	await page.goto('/?page=history')
	const example = page.locator('[data-example="history/undo"]')
	const table = grid(page, 'history/undo', 'Meeting rooms')
	await example.getByRole('button', { name: 'One seat more in each room' }).click()
	await expect(table.locator('td[data-column="seats"]')).toHaveText(['9', '13', '5'])
	await expect(example.getByRole('status')).toContainText('Step 3 of 3')
	await example.getByRole('button', { name: 'Undo' }).click()
	await expect(example.getByRole('status')).toHaveText('Step 2 of 3. Last report: undo: Birch 4')
	await example.getByRole('button', { name: 'Undo' }).click()
	await example.getByRole('button', { name: 'Undo' }).click()
	await expect(table.locator('td[data-column="seats"]')).toHaveText(['8', '12', '4'])
	await example.getByRole('button', { name: 'Redo' }).click()
	await expect(table.locator('td[data-column="seats"]').first()).toHaveText('9')
})

test('Formats: Percent and Bold change the selected cells, and the button shows Bold pressed', async ({
	page,
}) => {
	await page.goto('/?page=formats')
	const example = page.locator('[data-example="formats/formats"]')
	const table = grid(page, 'formats/formats', 'Funds')
	await expect(table.locator('td[data-column="year"]').nth(1)).toHaveAttribute(
		'data-color',
		'alert',
	)
	await table.locator('td[data-column="fee"]').first().click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowDown')
	await example.getByRole('button', { name: 'Percent' }).click()
	await expect(table.locator('td[data-column="fee"]')).toHaveText(['0.2%', '0.4%', '1.1%'])
	await example.getByRole('button', { name: 'Bold' }).click()
	await expect(table.locator('td[data-column="fee"][data-bold]')).toHaveCount(3)
	await expect(example.getByRole('button', { name: 'Bold' })).toHaveAttribute(
		'aria-pressed',
		'true',
	)
	await example.getByRole('button', { name: 'Clear' }).click()
	await expect(table.locator('td[data-column="fee"]').first()).toHaveText('0.0020')
})

test('Row numbers and letters: a letter selects its column, Shift on a number selects rows, and the corner every cell', async ({
	page,
}) => {
	await page.goto('/?page=row-numbers-and-letters')
	const example = page.locator('[data-example="row-numbers-and-letters/letters"]')
	const table = grid(page, 'row-numbers-and-letters/letters', 'Cities')
	await table.getByRole('columnheader', { name: 'A', exact: true }).click()
	await expect(example.getByRole('status')).toHaveText('3 by 1 cells')
	await expect(table.locator('th[data-kind="letter"][data-selected]')).toHaveText('A')
	await table.getByRole('rowheader', { name: 'Row 2' }).click()
	await table.getByRole('rowheader', { name: 'Row 3' }).click({ modifiers: ['Shift'] })
	await expect(example.getByRole('status')).toHaveText('2 by 3 cells')
	await table.getByRole('columnheader', { name: 'All cells' }).click()
	await expect(example.getByRole('status')).toHaveText('3 by 3 cells')
	await expect(table.locator('th[data-row-header][data-selected]')).toHaveCount(0)
})

test('Formulas: a computed column sorts and adds up, a new price changes the totals, and the bar refuses a wrong function', async ({
	page,
}) => {
	await page.goto('/?page=sheet-formulas')
	const orders = grid(page, 'sheet-formulas/column', 'Orders')
	await expect(orders.locator('tbody td[data-column="total"]')).toHaveText([
		'156.00',
		'249.00',
		'60.00',
	])
	await expect(orders.locator('tbody td[data-column="band"]')).toHaveText([
		'medium',
		'large',
		'small',
	])
	await orders.getByRole('button', { name: 'Total' }).click()
	await expect(orders.locator('tbody td[data-column="total"]')).toHaveText([
		'60.00',
		'156.00',
		'249.00',
	])
	await expect(orders.locator('tfoot td[data-column="total"]')).toHaveText('465.00')

	const example = page.locator('[data-example="sheet-formulas/cells"]')
	const sheet = grid(page, 'sheet-formulas/cells', 'An order with formulas')
	await sheet.locator('td[data-column="price"]').first().click()
	await page.keyboard.type('49')
	await page.keyboard.press('Enter')
	await expect(sheet.locator('td[data-column="total"]').first()).toHaveText('196.00')
	await expect(sheet.locator('td[data-column="total"]').last()).toHaveText('551.00')

	await sheet.locator('td[data-column="total"]').last().click()
	await expect(example.getByTestId('address')).toHaveText('D4')
	const field = example.getByRole('textbox', { name: 'Formula of the active cell' })
	await expect(field).toHaveValue('=SUM(D1:D3)')
	await field.fill('=SUMM(D1:D3)')
	await field.press('Enter')
	await expect(example.locator('form p[role="status"]')).toContainText('SUMM')
	await expect(field).toHaveAttribute('aria-invalid', 'true')
	await expect(sheet.locator('td[data-column="total"]').last()).toHaveText('551.00')
})

test('An Excel file with formulas: the file holds the formula of each profit cell, with its result', async ({
	page,
}) => {
	await page.addInitScript(() => {
		const files: Blob[] = []
		Object.assign(window, { exported: files })
		const create = URL.createObjectURL.bind(URL)
		URL.createObjectURL = (blob: Blob | MediaSource) => {
			if (blob instanceof Blob) files.push(blob)
			return create(blob)
		}
	})
	await page.goto('/?page=excel-formulas')
	const example = page.locator('[data-example="excel-formulas/file"]')
	await expect(grid(page, 'excel-formulas/file', 'Profit by month')).toBeVisible()
	const download = page.waitForEvent('download')
	await example.getByRole('button', { name: 'Download Excel' }).click()
	expect((await download).suggestedFilename()).toBe('profit.xlsx')
	// The sheet of the file, unzipped in the page.
	const sheet = await page.evaluate(async () => {
		const blob = (window as unknown as { exported: Blob[] }).exported[0]
		if (!blob) return null
		const bytes = new Uint8Array(await blob.arrayBuffer())
		const view = new DataView(bytes.buffer)
		const end = bytes.length - 22
		let at = view.getUint32(end + 16, true)
		for (let index = 0; index < view.getUint16(end + 10, true); index++) {
			const method = view.getUint16(at + 10, true)
			const packed = view.getUint32(at + 20, true)
			const nameLength = view.getUint16(at + 28, true)
			const local = view.getUint32(at + 42, true)
			const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
			if (name === 'xl/worksheets/sheet1.xml') {
				const start = local + 30 + nameLength + view.getUint16(local + 28, true)
				const body = bytes.subarray(start, start + packed)
				if (method === 0) return new TextDecoder().decode(body)
				const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
				return await new Response(stream).text()
			}
			at += 46 + nameLength
		}
		return null
	})
	expect(sheet).toMatch(/<c r="D2"(?: s="\d+")?><f>B2-C2<\/f><v>3100<\/v><\/c>/)
	expect(sheet).toMatch(/<c r="D4"(?: s="\d+")?><f>B4-C4<\/f><v>4050<\/v><\/c>/)
})

test('no part of an example lies over the bar of the site while the page scrolls', async ({
	page,
}) => {
	for (const [id, name] of [
		['rows', 'rows/pinned'],
		['styling', 'styling/sticky'],
		['rows', 'rows/window'],
	] as const) {
		await page.goto(`/?page=${id}`)
		const table = page.locator(`[data-example="${name}"] [data-slot="table"]`)
		await expect(table).toBeVisible()
		// The top of the table goes up under the bar, and the page goes on scrolling past it.
		for (const under of [10, 60, 120]) {
			await table.evaluate((element, by) => {
				const top = element.getBoundingClientRect().top + scrollY
				scrollTo({ top: top + by - 20, behavior: 'instant' })
			}, under)
			const box = await table.boundingBox()
			const onTop = await page.evaluate(
				({ x }) => {
					const bar = document.querySelector('.pages')?.getBoundingClientRect()
					if (!bar) return 'no bar'
					const found = document.elementFromPoint(x, bar.top + bar.height / 2)
					return found?.closest('.pages') ? 'bar' : (found?.outerHTML.slice(0, 80) ?? 'nothing')
				},
				{ x: (box?.x ?? 0) + (box?.width ?? 0) / 2 },
			)
			expect(onTop, `${name}, ${under}px under the bar`).toBe('bar')
		}
	}
})

test('an open editor keeps the width of its column and the height of its row, also with a long text', async ({
	page,
}) => {
	const cases = [
		{ page: 'cell-editing', example: 'cell-editing/prices', column: 'price' },
		{ page: 'range-copy-and-paste', example: 'range-copy-and-paste/range', column: 'mon' },
	]
	for (const item of cases) {
		await page.goto(`/?page=${item.page}`)
		const example = page.locator(`[data-example="${item.example}"]`)
		const cell = example.locator(`td[data-column="${item.column}"]`).first()
		const size = async () => {
			const box = await cell.boundingBox()
			return { width: box?.width, height: box?.height }
		}
		const before = await size()
		await cell.dblclick()
		const editor = example.locator('[data-slot="table-editor"]')
		await expect(editor).toBeFocused()
		expect(await size(), `${item.example}, open`).toEqual(before)
		await editor.fill('A text much longer than any value of this column')
		expect(await size(), `${item.example}, a long text`).toEqual(before)
		const field = await editor.boundingBox()
		expect(field?.width, `${item.example}, the field fills its cell`).toBe(before.width)
	}
})

test('the controls of an example hold their contrast: text 4.5 to 1, edges and marks 3 to 1', async ({
	page,
}) => {
	const low: string[] = []
	const check = async (
		what: string,
		kind: 'text' | 'border' | 'fill',
		locator: Locator,
		least: number,
	) => {
		const ratio = await contrastOf(locator, kind)
		if (ratio < least) low.push(`${what} (${kind}): ${ratio.toFixed(2)}`)
	}

	await page.goto('/?page=pages-and-server-mode')
	const pages = page.locator('[data-example="pages-and-server-mode/pages"]')
	await pages.getByRole('button', { name: '3', exact: true }).click()
	const current = pages.locator('[aria-current="page"]')
	await expect(current).toHaveText('3')
	await check('a button', 'text', pages.getByRole('button', { name: 'Next' }), 4.5)
	await check('a button', 'border', pages.getByRole('button', { name: 'Next' }), 3)
	await check('the current page', 'text', current, 4.5)
	await check('the current page', 'fill', current, 3)
	const server = page.locator('[data-example="pages-and-server-mode/server"]')
	await check('a disabled button', 'text', server.getByRole('button', { name: 'Previous' }), 4.5)

	await page.goto('/?page=selection-and-keyboard')
	const inbox = page.locator('[data-example="selection-and-keyboard/select"]')
	await inbox.getByRole('checkbox', { name: 'Pick the mail from Ada' }).click()
	await check(
		'a box',
		'border',
		inbox.getByRole('checkbox', { name: 'Pick the mail from Maya' }),
		3,
	)
	await check(
		'a checked box',
		'fill',
		inbox.getByRole('checkbox', { name: 'Pick the mail from Ada' }),
		3,
	)

	await page.goto('/?page=sort-filter-and-search')
	const facets = page.locator('[data-example="sort-filter-and-search/facets"]')
	const northway = facets.getByRole('button', { name: /^Northway/ })
	await northway.click()
	await expect(northway).toHaveAttribute('aria-pressed', 'true')
	await check('a pressed button', 'text', northway, 4.5)
	await check('a pressed button', 'fill', northway, 3)
	await check('the label of a group', 'text', facets.locator('#facet-brand'), 4.5)
	const field = page.getByRole('searchbox', { name: 'Search the members' })
	await check('a text field', 'border', field, 3)

	expect(low).toEqual([])
})

test('How the table is built: a table from the parts has the roles of a grid, and the arrow keys move focus', async ({
	page,
}) => {
	await page.goto('/?page=how-the-table-is-built')
	const table = grid(page, 'how-the-table-is-built/parts', 'Planets and their moons')
	await expect(table.getByRole('columnheader')).toHaveText(['Planet', 'Moons'])
	await expect(table.getByRole('row').nth(2)).toHaveAttribute('aria-rowindex', '3')
	await table.getByRole('gridcell', { name: 'Mars' }).click()
	await page.keyboard.press('ArrowRight')
	await expect(table.getByRole('gridcell', { name: '2', exact: true })).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(table.getByRole('gridcell', { name: '95' })).toBeFocused()
})

test('A styled table for an app: the search, the box of a column and the pages work from outside the table', async ({
	page,
}) => {
	await page.goto('/?page=styled-table')
	const example = page.locator('[data-example="styled-table/toolbar"]')
	const table = grid(page, 'styled-table/toolbar', 'Books')
	await expect(table.locator('tbody tr')).toHaveCount(2)
	await expect(example.getByRole('status')).toHaveText('Page 1 of 3')
	await example.getByRole('button', { name: 'Next' }).click()
	await expect(example.getByRole('status')).toHaveText('Page 2 of 3')

	await example.getByRole('checkbox', { name: 'Year' }).click()
	await expect(table.locator('th[data-column="year"]')).toHaveCount(0)
	await expect(example.getByRole('checkbox', { name: 'Title' })).toHaveCount(0)

	await example.getByRole('searchbox', { name: 'Search the books' }).fill('Ashby')
	await expect(table.locator('tbody tr')).toHaveCount(2)
	await expect(example.getByRole('status')).toHaveText('Page 1 of 1')
})

test('a reference page shows the members of its types, and no marker is left on the page', async ({
	page,
}) => {
	await page.goto('/?page=reference-table')
	const props = page.locator('h2#props + ul > li')
	await expect(props.first()).toContainText('rows?')
	expect(await props.count()).toBeGreaterThan(50)
	await expect(page.locator('h2#props + ul')).toContainText(
		'defaultSort? (readonly SortRule[]): The sort at first',
	)
	await expect(page.locator('main, body').first()).not.toContainText('<Members')
	await page.goto('/?page=reference-columns')
	await expect(page.locator('h3#currencyformatoptions + p + ul')).toContainText('currencyDisplay?')
	await expect(page.locator('body')).not.toContainText('<Members')
})

test('A formula writer: a drag writes one range into the field, the hint marks its argument, and the list shows functions', async ({
	page,
}) => {
	await page.goto('/?page=formula-writer')
	const example = page.locator('[data-example="formula-writer/writer"]')
	const sheet = grid(page, 'formula-writer/writer', 'An order with a formula writer')
	const totals = sheet.locator('td[data-column="total"]')
	await totals.last().click()
	await expect(example.getByTestId('address')).toHaveText('D4')
	const field = example.getByRole('textbox', { name: 'Formula of the active cell' })
	await field.click()
	await page.keyboard.type('=SUM(')
	await expect(example.getByTestId('hint').locator('strong')).toHaveText('number1')
	await expect(sheet).toHaveAttribute('data-pick', '')

	const center = async (cell: Locator) => {
		const box = await cell.boundingBox()
		if (!box) throw new Error('The cell is not in view.')
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
	}
	const from = await center(totals.nth(0))
	const to = await center(totals.nth(2))
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(to.x, to.y, { steps: 6 })
	await page.mouse.up()
	await expect(field).toHaveValue('=SUM(D1:D3')
	await expect(field).toBeFocused()
	await expect(sheet.locator('td[data-reference="0"]')).toHaveCount(3)
	await expect(sheet.locator('td[data-picked]')).toHaveCount(3)
	await expect(example.getByTestId('address')).toHaveText('D4')

	await page.keyboard.type(')')
	await page.keyboard.press('Enter')
	await expect(totals.last()).toHaveText('511.00')

	await field.click()
	await field.press('Control+a')
	await page.keyboard.type('=su')
	await expect(example.getByRole('list', { name: 'Functions' }).getByRole('button')).toHaveText([
		/^SUBSTITUTE/,
		/^SUM/,
		/^SUMIF/,
		/^SUMIFS/,
	])
	await example.getByRole('button', { name: /^SUMIF / }).click()
	await expect(field).toHaveValue('=SUMIF(')
	await expect(field).toBeFocused()
	await expect(example.getByTestId('hint').locator('strong')).toHaveText('range')
})
