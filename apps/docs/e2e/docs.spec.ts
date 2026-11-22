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
