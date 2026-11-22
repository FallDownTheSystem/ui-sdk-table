import { expect, test, type Locator, type Page } from '@playwright/test'
import {
	colourOf,
	contrastOf,
	contrastOfPair,
	contrastOver,
	installContrast,
	type ContrastKind,
} from './contrast'

const TONES = [
	'paper',
	'sand',
	'mist',
	'moss',
	'sun',
	'plum',
	'clay',
	'ink',
	'navy',
	'pine',
	'wine',
] as const

/** What the page writes to the console as an error, and what it throws. */
function watchErrors(page: Page): string[] {
	const errors: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text())
	})
	page.on('pageerror', (error) => errors.push(String(error)))
	return errors
}

async function open(page: Page, query = '') {
	await page.goto(`/?page=sink${query}`)
	await expect(page.locator('.tile[data-placed]').first()).toBeVisible()
}

const tiles = (page: Page) => page.locator('.tile')
const tile = (page: Page, id: string) => page.locator(`#${id}`)
const tableOf = (page: Page, id: string) => tile(page, id).locator('[data-slot="table"]')
const frameOf = (page: Page, id: string) => tile(page, id).locator('.sink-frame')
const tagOf = (page: Page, id: string, name: string) =>
	tile(page, id).locator('.tile-uses').getByRole('button', { name, exact: true })
const header = (table: Locator, id: string) => table.locator(`thead th[data-column="${id}"]`)
const cell = (table: Locator, row: string, id: string) =>
	table.locator('tbody tr', { hasText: row }).locator(`td[data-column="${id}"]`)
const filter = (page: Page) => page.getByRole('region', { name: 'Filter of the tiles' })

/** The tiles that list a name of the library, whether the filter shows them or not. */
const withTag = (page: Page, name: string) =>
	tiles(page).filter({
		has: page.locator('.tile-uses').getByRole('button', { name, exact: true }),
	})

const ids = (page: Page) => tiles(page).evaluateAll((list) => list.map((item) => item.id))

const pageOverflow = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

const gridColumns = (page: Page) =>
	page
		.locator('.bento')
		.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)

async function box(locator: Locator) {
	const found = await locator.boundingBox()
	if (!found) throw new Error('The element is not on the page.')
	return found
}

async function drag(page: Page, from: Locator, dx: number) {
	const { x, y, width, height } = await box(from)
	await page.mouse.move(x + width / 2, y + height / 2)
	await page.mouse.down()
	await page.mouse.move(x + width / 2 + dx / 2, y + height / 2, { steps: 4 })
	await page.mouse.move(x + width / 2 + dx, y + height / 2, { steps: 4 })
	await page.mouse.up()
}

/** Where the header cells of a table are, to see that a drag elsewhere left them alone. */
const headerBoxes = (table: Locator) =>
	table.locator('thead th').evaluateAll((cells) =>
		cells.map((item) => {
			const { x, y, width } = item.getBoundingClientRect()
			return `${item.getAttribute('data-column')} ${Math.round(x)} ${Math.round(y)} ${Math.round(width)}`
		}),
	)

test('the sink page opens at its address', async ({ page }) => {
	await page.goto('/?page=sink')
	await expect(page.getByRole('heading', { level: 1, name: 'Table sink' })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Sink' })).toHaveAttribute('aria-current', 'page')
})

test('every tile shows a table with rows, and the console stays clean', async ({ page }) => {
	const errors = watchErrors(page)
	await open(page, '&eager')
	const all = await ids(page)
	expect(all.length).toBeGreaterThanOrEqual(30)

	for (const id of all) {
		const tables = tableOf(page, id)
		await expect(tables, `${id} has one table`).toHaveCount(1)
		await expect(tables.locator('tbody tr').first(), `${id} has rows`).toBeAttached()
		// A grid without a name is nothing that an agent or a screen reader can ask for.
		await expect(tables, `${id} has a name`).toHaveAttribute('aria-label', /\S/)
		await expect(tile(page, id).locator('.tile-title'), `${id} has a title`).toHaveText(/\.$/)
		await expect(
			tile(page, id).locator('.tile-uses').getByRole('button').first(),
			`${id} has tags`,
		).toBeVisible()
	}
	await expect(page.locator('.tile-error')).toHaveCount(0)
	expect(errors).toEqual([])
})

test('a tile mounts its table when it comes near the screen', async ({ page }) => {
	await open(page)
	const count = await tiles(page).count()
	const last = tiles(page).last()
	await expect(tableOf(page, 'group-totals')).toBeVisible()
	// The page starts with the tiles of the first screens only.
	expect(await page.locator('.tile [data-slot="table"]').count()).toBeLessThan(count / 2)
	await expect(last.locator('[data-slot="table"]')).toHaveCount(0)

	await last.scrollIntoViewIfNeeded()
	await expect(last.locator('[data-slot="table"]')).toBeVisible()
})

test('one broken tile shows its error, and the others go on', async ({ page }) => {
	// The file of one tile answers with a component that throws when it is set up.
	await page.route('**/sink/tiles/sort/SortAlways.vue*', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: 'export default { setup() { throw new Error("broken on purpose") } }',
		}),
	)
	await open(page, '&only=sort&eager')
	await expect(tile(page, 'sort-always').getByRole('alert')).toHaveText(
		'sort-always failed: broken on purpose',
	)
	await expect(tableOf(page, 'sort-always')).toHaveCount(0)
	for (const id of ['sort-two-columns', 'sort-mode', 'sort-own-order']) {
		await expect(tableOf(page, id)).toBeVisible()
	}
})

test('a name under a tile filters the page: any, all, one less, clear', async ({ page }) => {
	await open(page)
	const total = await tiles(page).count()
	const multi = await withTag(page, 'multiSort').evaluateAll((list) => list.map((item) => item.id))
	const sticky = await withTag(page, 'stickyHeader').evaluateAll((list) =>
		list.map((item) => item.id),
	)
	const both = multi.filter((id) => sticky.includes(id))
	const either = new Set([...multi, ...sticky])
	expect(multi).toContain('sort-mode')
	expect(both.length).toBeGreaterThan(0)
	expect(both.length).toBeLessThan(either.size)

	// The bar is not there until a name is chosen.
	await expect(filter(page)).not.toHaveAttribute('data-open')

	await tagOf(page, 'sort-mode', 'multiSort').click()
	await expect(tiles(page)).toHaveCount(multi.length)
	await expect(page).toHaveURL(/[?&]uses=multiSort(?:&|$)/)
	await expect(filter(page)).toHaveAttribute('data-open', '')
	await expect(filter(page).getByRole('status')).toHaveText(`${multi.length} tiles`)
	// The name is pressed in every tile that has it.
	for (const id of multi) {
		await expect(tagOf(page, id, 'multiSort')).toHaveAttribute('aria-pressed', 'true')
	}

	// A second name: any of the two.
	await tagOf(page, 'sort-mode', 'stickyHeader').click()
	await expect(tiles(page)).toHaveCount(either.size)
	await expect(page).toHaveURL(/[?&]uses=multiSort,stickyHeader(?:&|$)/)
	expect(page.url()).not.toContain('mode=')

	// All of them.
	await filter(page).getByRole('radio', { name: 'All' }).click()
	await expect(tiles(page)).toHaveCount(both.length)
	await expect(page).toHaveURL(/[?&]mode=all(?:&|$)/)
	expect(await ids(page)).toEqual(expect.arrayContaining(both))

	// One name less, from the bar.
	await filter(page).getByRole('button', { name: 'Remove stickyHeader' }).click()
	await expect(tiles(page)).toHaveCount(multi.length)
	await expect(page).toHaveURL(/[?&]uses=multiSort(?:&|$)/)

	await filter(page).getByRole('button', { name: 'Clear' }).click()
	await expect(tiles(page)).toHaveCount(total)
	expect(page.url()).not.toContain('uses=')
	await expect(filter(page)).not.toHaveAttribute('data-open')
	await expect(tagOf(page, 'sort-mode', 'multiSort')).toHaveAttribute('aria-pressed', 'false')
})

test('the address holds the filter, and a filter that fits no tile says so', async ({ page }) => {
	await open(page, '&uses=multiSort,stickyHeader&mode=all')
	const shown = await ids(page)
	expect(shown.length).toBeGreaterThan(0)
	for (const id of shown) {
		await expect(tagOf(page, id, 'multiSort')).toHaveAttribute('aria-pressed', 'true')
		await expect(tagOf(page, id, 'stickyHeader')).toHaveAttribute('aria-pressed', 'true')
	}
	await expect(filter(page).getByRole('radio', { name: 'All' })).toBeChecked()

	// `only` takes a group or single tiles.
	await open(page, '&only=sort')
	expect((await ids(page)).every((id) => id.startsWith('sort-'))).toBe(true)
	await expect(tiles(page)).toHaveCount(4)
	await open(page, '&only=edit-price,rows-window')
	expect(await ids(page)).toEqual(['rows-window', 'edit-price'])

	await page.goto('/?page=sink&uses=alwaysSorted,rowWindow&mode=all')
	await expect(page.getByText('No tile uses all of these names together.')).toBeVisible()
	await expect(tiles(page)).toHaveCount(0)
	await expect(filter(page).getByRole('status')).toHaveText('0 tiles')
	// The way back is in the bar.
	await filter(page).getByRole('radio', { name: 'Any' }).click()
	expect(await tiles(page).count()).toBeGreaterThan(1)
})

test('Tab goes through the tiles as they read, and a table is one stop', async ({ page }) => {
	await open(page, '&only=sort')
	const order = await ids(page)
	for (const id of order) await expect(tableOf(page, id)).toBeVisible()

	const stops: { tile: string; part: string }[] = []
	// The last stop of the bar is the stop before the first tile.
	await page.getByRole('navigation', { name: 'Site' }).getByRole('link').last().focus()
	for (let step = 0; step < 30; step++) {
		await page.keyboard.press('Tab')
		const stop = await page.evaluate(() => {
			const active = document.activeElement
			const owner = active?.closest('.tile')
			if (!active || !owner) return null
			const part = active.closest('[data-slot="table"]')
				? 'table'
				: active.closest('.tile-uses')
					? 'tags'
					: 'control'
			return { tile: owner.id, part }
		})
		if (!stop) break
		stops.push(stop)
	}

	// The tiles come in the order of the document, which `pack` holds equal to the screen.
	expect([...new Set(stops.map((stop) => stop.tile))]).toEqual(order)
	for (const id of order) {
		const parts = stops.filter((stop) => stop.tile === id).map((stop) => stop.part)
		// Controls, then the table as one stop, then the tags as one stop.
		expect(
			parts.filter((part) => part === 'table'),
			id,
		).toHaveLength(1)
		expect(parts.at(-1), id).toBe('tags')
		expect(parts.at(-2), id).toBe('table')
	}

	// The places on the screen agree: each stop is below or after the one before.
	const places = await Promise.all(
		order.map(async (id) => {
			const { x, y } = await box(tile(page, id))
			return Math.round(y) * 10_000 + Math.round(x)
		}),
	)
	expect(places).toEqual(places.toSorted((a, b) => a - b))
})

test('the keys sort a table in a tile, and the arrow keys stay inside it', async ({ page }) => {
	await open(page, '&only=sort-two-columns,sort-mode')
	const table = tableOf(page, 'sort-two-columns')
	await expect(table).toBeVisible()
	await expect(header(table, 'city')).toHaveAttribute('data-sort-index', '1')
	await expect(header(table, 'total')).toHaveAttribute('data-sort-index', '2')

	// Tab from the last page link enters the table at one cell.
	// The last stop of the bar is the stop before the first tile.
	await page.getByRole('navigation', { name: 'Site' }).getByRole('link').last().focus()
	await page.keyboard.press('Tab')
	await expect(header(table, 'city')).toBeFocused()

	// Enter turns the order of the column and drops the second rule.
	await page.keyboard.press('Enter')
	await expect(header(table, 'city')).toHaveAttribute('aria-sort', 'descending')
	await expect(header(table, 'total')).not.toHaveAttribute('data-sort-index')

	// Shift with Enter on another header adds it.
	await page.keyboard.press('End')
	await expect(header(table, 'total')).toBeFocused()
	await page.keyboard.press('Shift+Enter')
	await expect(header(table, 'total')).toHaveAttribute('data-sort-index', '2')
	await expect(header(table, 'total')).toHaveAttribute('aria-sort', 'ascending')
	await expect(table.locator('tbody tr').first()).toContainText('Tallinn')

	// The arrow keys move in this table and end at its edge; the next tile is a Tab away.
	const scrolled = await page.evaluate(() => scrollY)
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowRight')
	await expect(table.locator('tbody tr').first().locator('td').last()).toBeFocused()
	expect(await page.evaluate(() => scrollY)).toBe(scrolled)
	await page.keyboard.press('Tab')
	await expect(
		tile(page, 'sort-two-columns').locator('.tile-uses').getByRole('button').first(),
	).toBeFocused()
})

test('a name pressed with the keyboard keeps the focus when the tiles move', async ({ page }) => {
	await open(page)
	const tag = tagOf(page, 'sort-two-columns', 'sort')
	await tag.focus()
	await page.keyboard.press('Space')
	await expect(tag).toHaveAttribute('aria-pressed', 'true')
	await expect(filter(page)).toHaveAttribute('data-open', '')
	// The tile is in another place of the grid now, and its name still has the focus.
	await expect(tag).toBeFocused()
	await expect(tag).toBeInViewport()

	// The arrow keys reach every name of the tile, also the ones past the edge of the list.
	await page.keyboard.press('End')
	const last = tile(page, 'sort-two-columns').locator('.tile-uses').getByRole('button').last()
	await expect(last).toBeFocused()
	await expect(last).toBeInViewport()
})

test('a drag in one tile moves nothing in the tile beside it', async ({ page }) => {
	// Both tiles in view at once, so a drag in one can be held against the boxes of the other.
	await page.setViewportSize({ width: 1280, height: 1200 })
	await open(page, '&only=columns-resize,columns-drag')
	const resize = tableOf(page, 'columns-resize')
	const move = tableOf(page, 'columns-drag')
	await expect(resize).toBeVisible()
	await expect(move).toBeVisible()
	const widths = page.getByTestId('column-widths')
	const order = page.getByTestId('column-order')

	// Resize: the bar at the end of a header.
	const before = await headerBoxes(move)
	const scrolled = await page.evaluate(() => scrollY)
	const start = (await box(header(resize, 'customer'))).width
	await drag(page, header(resize, 'customer').locator('[data-slot="table-resizer"]'), 60)
	await expect(widths).toHaveText('Customer 260 px, saved 1 times')
	expect(Math.round((await box(header(resize, 'customer'))).width)).toBe(Math.round(start) + 60)
	expect(await headerBoxes(move)).toEqual(before)
	await expect(order).toHaveText('The order of the definitions')
	expect(await page.evaluate(() => scrollY)).toBe(scrolled)

	// A width has its bounds, from the column.
	await drag(page, header(resize, 'customer').locator('[data-slot="table-resizer"]'), 400)
	await expect(widths).toHaveText('Customer 320 px, saved 2 times')

	// Reorder: a header, dragged over the one before it.
	const resized = await headerBoxes(resize)
	const from = await box(header(move, 'city'))
	const to = await box(header(move, 'customer'))
	await drag(page, header(move, 'city'), to.x + 10 - (from.x + from.width / 2))
	await expect(order).toHaveText('city, customer, status, total, id')
	expect(await headerBoxes(resize)).toEqual(resized)
	await expect(widths).toHaveText('Customer 320 px, saved 2 times')

	await tile(page, 'columns-drag').getByRole('button', { name: 'Reset', exact: true }).click()
	await expect(order).toHaveText('The order of the definitions')
	await tile(page, 'columns-resize').getByRole('button', { name: 'Reset the widths' }).click()
	// The reset is the end of an interaction too, so it is a moment to save.
	await expect(widths).toHaveText('Customer 200 px, saved 3 times')
})

test('a price is edited in its cell, and a price below zero is refused', async ({ page }) => {
	await open(page, '&only=edit-price')
	const table = tableOf(page, 'edit-price')
	const price = cell(table, 'Espresso beans', 'price')
	const editor = table.locator('[data-slot="table-editor"]')
	const last = page.getByTestId('last-edit')
	const mean = table.locator('tfoot td[data-column="price"]')
	await expect(price).toHaveText('€12.50')
	const meanBefore = await mean.innerText()

	// The name cannot be edited.
	await cell(table, 'Espresso beans', 'name').dblclick()
	await expect(editor).toHaveCount(0)

	await price.dblclick()
	await expect(editor).toBeFocused()
	await expect(editor).toHaveAttribute('inputmode', 'decimal')
	await editor.fill('-1')
	await page.keyboard.press('Enter')
	// The refusal keeps the editor open, with its reason, and no row changed.
	await expect(table.locator('[data-slot="table-edit-error"]')).toHaveText(
		'A price is a number, zero or more.',
	)
	await expect(editor).toHaveAttribute('aria-invalid', 'true')
	await expect(editor).toBeFocused()
	await expect(last).toHaveText('Nothing edited yet')

	await editor.fill('9.5')
	await page.keyboard.press('Enter')
	await expect(editor).toHaveCount(0)
	await expect(price).toHaveText('€9.50')
	await expect(last).toContainText('Espresso beans: Price 12.5 to 9.5')
	expect(await mean.innerText()).not.toBe(meanBefore)

	// With the keys: Enter opens the cell that has the focus, Escape leaves it as it was.
	await expect(price).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('Enter')
	await expect(editor).toBeFocused()
	await editor.fill('1')
	await page.keyboard.press('Escape')
	await expect(editor).toHaveCount(0)
	await expect(cell(table, 'Filter roast', 'price')).toHaveText('€10.90')
	await expect(cell(table, 'Filter roast', 'price')).toBeFocused()
})

test('a switch in a cell reports its edit, and the row follows', async ({ page }) => {
	await open(page, '&only=edit-switch')
	const weekly = tile(page, 'edit-switch').getByRole('switch', { name: 'Weekly summary' })
	await expect(weekly).not.toBeChecked()
	await weekly.click()
	await expect(weekly).toBeChecked()
	await expect(tile(page, 'edit-switch').getByRole('status')).toHaveText('1 edits reported')
	await weekly.click()
	await expect(weekly).not.toBeChecked()
	await expect(tile(page, 'edit-switch').getByRole('status')).toHaveText('2 edits reported')
})

test('a sheet in a tile takes a typed number, goes down, and Control+Z takes it back', async ({
	page,
}) => {
	await open(page, '&only=sheet-type')
	const table = tableOf(page, 'sheet-type')
	const food = cell(table, 'Food', 'mar')
	const total = table.locator('tfoot td[data-column="mar"]')
	await expect(total).toHaveText('1,271')
	const columns = await headerBoxes(table)

	await food.click()
	await page.keyboard.type('402')
	await expect(table.locator('[data-slot="table-editor"]')).toHaveValue('402')
	// The text field has a width of its own, and it must not make its column wider.
	expect(await headerBoxes(table)).toEqual(columns)
	await page.keyboard.press('Enter')
	await expect(food).toHaveText('402')
	await expect(total).toHaveText('1,673')
	await expect(page.getByTestId('sheet-last')).toHaveText('Food, Mar: 402, by enter-key')
	// Enter went down, as in a sheet.
	await expect(cell(table, 'Train', 'mar')).toBeFocused()

	await page.keyboard.press('Control+z')
	await expect(food).toHaveText('')
	await expect(total).toHaveText('1,271')
	await expect(page.getByTestId('sheet-last')).toHaveText('Food, Mar: empty, by undo')
	// The step shows where it was: focus is on the cell that changed.
	await expect(food).toBeFocused()
})

test('the tiles of formulas: a typed formula, a refused circle, a period, a decimal comma, a saved file', async ({
	page,
}) => {
	await open(page, '&eager&only=formula')

	// A price changes, and the total of its line and the sum under it follow; Control+Z takes it back.
	const sheet = tableOf(page, 'formula-sheet')
	const sum = cell(sheet, 'Order total', 'total')
	await expect(sum).toHaveText('1,849.00')
	await cell(sheet, 'Desk lamp', 'price').click()
	await page.keyboard.type('40')
	await page.keyboard.press('Enter')
	await expect(cell(sheet, 'Desk lamp', 'total')).toHaveText('160.00')
	await expect(sum).toHaveText('1,853.00')
	await page.keyboard.press('Control+z')
	await expect(sum).toHaveText('1,849.00')
	// The bar shows the formula of the active cell and takes a new one.
	await sum.click()
	await expect(page.getByTestId('formula-address')).toHaveText('D15')
	const field = tile(page, 'formula-sheet').getByRole('textbox', {
		name: 'Formula of the active cell',
	})
	await expect(field).toHaveValue('=SUM(D1:D14)')
	await field.fill('=SUM(D1:D3)')
	await field.press('Enter')
	await expect(sum).toHaveText('511.00')
	await expect(sum).toBeFocused()

	// A division by zero shows its code; a circle is refused with its path.
	const errors = tile(page, 'formula-errors')
	await expect(cell(tableOf(page, 'formula-errors'), 'Sales', 'each')).toHaveAttribute(
		'data-formula-error',
	)
	await errors.getByRole('button', { name: 'Make B1 read D1' }).click()
	await expect(errors.getByRole('status')).toContainText('B1 reads D1 reads B1')
	await expect(errors.getByRole('status')).not.toContainText('cannot be set')

	// The period of a date: as many groups as the sales have weeks, months or quarters.
	const period = tile(page, 'formula-period')
	await expect(period.locator('.readout .display')).toHaveText('11 weeks')
	await period.getByRole('radio', { name: 'Month' }).click()
	await expect(period.locator('.readout .display')).toHaveText('3 months')
	await expect(tableOf(page, 'formula-period').locator('tbody tr').first()).toContainText(
		'September 2026',
	)

	// The same formula in two languages: only its signs change.
	const typed = page.getByTestId('locale-formula')
	await expect(typed).toHaveText('=ROUND(B1*1,5; 1)')
	await tile(page, 'formula-locale').getByRole('radio', { name: 'English' }).click()
	await expect(typed).toHaveText('=ROUND(B1*1.5, 1)')

	// A formula of a column that cannot be read is refused, and the one before stays.
	const own = tile(page, 'formula-own')
	await own.getByRole('button', { name: 'Broken' }).click()
	await expect(own.getByRole('status')).toHaveText('The formula ends too soon.')
	await expect(cell(tableOf(page, 'formula-own'), 'Hall', 'area')).toHaveText('7.28')
	await own.getByRole('button', { name: 'IF' }).click()
	await expect(cell(tableOf(page, 'formula-own'), 'Hall', 'area')).toHaveText('0.00')

	// A saved file: the results that are out of date are computed again, and the Excel file comes.
	const file = tile(page, 'formula-file')
	const year = cell(tableOf(page, 'formula-file'), 'Year', 'profit')
	await expect(year).toHaveText('18,000')
	await file.getByRole('button', { name: 'Check the formulas' }).click()
	await expect(page.getByTestId('file-fixed')).toHaveText('5 fixed')
	await expect(year).toHaveText('42,250')
	const download = page.waitForEvent('download')
	await file.getByRole('button', { name: 'Excel', exact: true }).click()
	expect((await download).suggestedFilename()).toBe('year.xlsx')
})

test('the square of a fill tile goes on with a series, and another tile does not move', async ({
	page,
}) => {
	await open(page, '&only=sheet-fill,sheet-numbers')
	const table = tableOf(page, 'sheet-fill')
	const week = (row: number) => table.locator(`tbody tr:nth-child(${row}) td[data-column="week"]`)
	const other = await tableOf(page, 'sheet-numbers').locator('tbody').innerText()

	await week(1).click()
	await week(2).click({ modifiers: ['Shift'] })
	const square = table.locator('[data-slot="table-fill-handle"]')
	await expect(square).toHaveCount(1)
	const from = await box(square)
	const to = await box(week(5))
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
	await page.mouse.down()
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 })
	await expect(table.locator('[data-fill-target]')).toHaveCount(3)
	await page.mouse.up()

	await expect(week(3)).toHaveText('18')
	await expect(week(4)).toHaveText('20')
	await expect(week(5)).toHaveText('22')
	await expect(week(6)).toHaveText('')
	expect(await tableOf(page, 'sheet-numbers').locator('tbody').innerText()).toBe(other)
	expect(await pageOverflow(page)).toBe(0)

	// From code: the first two lines are the pattern, and the days pass the leap day.
	await tile(page, 'sheet-fill').getByRole('button', { name: 'Fill weeks and days' }).click()
	await expect(week(14)).toHaveText('40')
	await expect(table.locator('tbody tr:nth-child(3) td[data-column="due"]')).toHaveText(
		'Mar 7, 2028',
	)
})

test('the tile of letters: a letter selects its column over a header group, Shift more columns, and the arrows go down through the group', async ({
	page,
}) => {
	await open(page, '&eager&only=sheet-letters')
	const table = tableOf(page, 'sheet-letters')
	const said = page.getByTestId('letters-said')
	const letter = (id: string) => table.locator(`th[data-kind="letter"][data-column="${id}"]`)
	await expect(table.locator('tr[data-kind="letters"] > th')).toHaveText(['', 'A', 'B', 'C', 'D'])
	await expect(letter('#')).toHaveAccessibleName('All cells')
	await letter('items').click()
	await expect(said).toHaveText('3 by 1 cells')
	await expect(letter('items')).toHaveAttribute('data-selected', '')
	await letter('city').click({ modifiers: ['Shift'] })
	await expect(said).toHaveText('3 by 2 cells')
	await expect(table.locator('th[data-kind="letter"][data-selected]')).toHaveCount(2)
	await letter('#').click()
	await expect(said).toHaveText('3 by 4 cells')

	// The letter of a column under a group is a cell of one column. Down goes to the group, then to the column.
	await letter('total').click()
	await expect(letter('total')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(table.locator('thead th[data-column="order"]')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(table.locator('thead th[data-column="total"]:not([data-kind])')).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('ArrowUp')
	await expect(letter('total')).toBeFocused()
})

test('the tiles of a sheet: a number selects its row, a format is data, a total changes its function', async ({
	page,
}) => {
	await open(page, '&eager&only=sheet-numbers,sheet-formats,sheet-totals,sheet-sum,sheet-cut')
	const numbers = tableOf(page, 'sheet-numbers')
	await numbers.locator('tbody tr:nth-child(2) th[data-row-header]').click()
	await expect(page.getByTestId('numbers-said')).toHaveText('1 by 3 cells')
	await numbers.locator('tbody tr:nth-child(4) th[data-row-header]').click({ modifiers: ['Shift'] })
	await expect(page.getByTestId('numbers-said')).toHaveText('3 by 3 cells')
	await expect(numbers.locator('th[data-row-header][data-selected]')).toHaveCount(0)

	const formats = tableOf(page, 'sheet-formats')
	const bold = tile(page, 'sheet-formats').getByRole('button', { name: 'Bold', exact: true })
	await expect(bold).toBeDisabled()
	const fee = cell(formats, 'Small Caps', 'fee')
	await fee.click()
	await bold.click()
	await expect(fee).toHaveAttribute('data-bold', '')
	await expect(bold).toHaveAttribute('aria-pressed', 'true')
	await tile(page, 'sheet-formats').getByRole('button', { name: 'One decimal more' }).click()
	await expect(fee).toHaveText('1.100')
	await expect(page.getByTestId('formats-count')).toHaveText('3 rows hold a format of their own')
	await tile(page, 'sheet-formats').getByRole('button', { name: 'Clear', exact: true }).click()
	await expect(fee).toHaveText('1.10')
	await expect(fee).not.toHaveAttribute('data-bold')

	const totals = tableOf(page, 'sheet-totals')
	const foot = totals.locator('tfoot td[data-column="total"]')
	const sum = await foot.innerText()
	await tile(page, 'sheet-totals').getByRole('radio', { name: 'Average' }).click()
	await expect(page.getByTestId('totals-kind')).toHaveText('Average of each city')
	await expect(foot).toHaveAttribute('data-aggregate', 'mean')
	expect(await foot.innerText()).not.toBe(sum)

	await tile(page, 'sheet-sum').getByRole('button', { name: 'Distance', exact: true }).click()
	await expect(page.getByTestId('sum-bar')).toContainText('Sum 98.60')

	const cut = tableOf(page, 'sheet-cut')
	await tile(page, 'sheet-cut').getByRole('button', { name: 'Move two days' }).click()
	await expect(cell(cut, 'Wed', 'early')).toHaveText('Ada')
	await expect(cell(cut, 'Mon', 'early')).toHaveText('')
	// A cut and a paste are two steps.
	const undo = tile(page, 'sheet-cut').getByRole('button', { name: 'Undo', exact: true })
	await undo.click()
	await expect(cell(cut, 'Wed', 'early')).toHaveText('')
	await undo.click()
	await expect(cell(cut, 'Mon', 'early')).toHaveText('Ada')
})

test('a row window works in a tile of fixed height', async ({ page }) => {
	await open(page, '&only=rows-window')
	const table = tableOf(page, 'rows-window')
	const frame = frameOf(page, 'rows-window')
	await expect(table).toHaveAttribute('aria-rowcount', '50001')
	const height = (await box(tile(page, 'rows-window'))).height

	await tile(page, 'rows-window').getByRole('button', { name: 'Row 40,000' }).click()
	const row = table.locator('tbody tr[aria-rowindex="40001"]')
	await expect(row).toBeVisible()
	// The row is inside the frame of the tile, near its middle.
	const outer = await box(frame)
	const inner = await box(row)
	expect(inner.y).toBeGreaterThan(outer.y)
	expect(inner.y + inner.height).toBeLessThan(outer.y + outer.height)
	// The page holds the rows in view and a few around them, and the tile kept its height.
	expect(await table.locator('tbody tr[data-kind="row"]').count()).toBeLessThan(60)
	expect((await box(tile(page, 'rows-window'))).height).toBe(height)
	expect(await page.evaluate(() => scrollY)).toBe(0)

	await tile(page, 'rows-window').getByRole('button', { name: 'Last row' }).click()
	const end = table.locator('tbody tr[aria-rowindex="50001"]')
	await expect(end).toBeVisible()
	// The last row stands at the end of the frame, wherever the frame is on the screen.
	const endBox = await box(end)
	expect(Math.round(endBox.y + endBox.height)).toBeLessThanOrEqual(
		Math.round(outer.y + outer.height),
	)
	expect(endBox.y).toBeGreaterThan(outer.y + outer.height / 2)
})

test('the wheel over a table moves the page when the table has no more to scroll', async ({
	page,
}) => {
	await open(page)
	// The wheel acts where the pointer is, so each frame is brought into view first.
	const scrollY = () => page.evaluate(() => window.scrollY)
	// A wheel goes on scrolling after its event, so a measurement waits for the page to rest.
	const settled = () =>
		page.evaluate(
			() =>
				new Promise<void>((done) => {
					let last = window.scrollY
					let still = 0
					const look = () => {
						still = window.scrollY === last ? still + 1 : 0
						last = window.scrollY
						if (still >= 5) done()
						else requestAnimationFrame(look)
					}
					requestAnimationFrame(look)
				}),
		)
	// A table that fits its tile: the page scrolls at once.
	const fitting = frameOf(page, 'edit-range')
	// A demo mounts when its tile comes near the screen.
	await tile(page, 'edit-range').scrollIntoViewIfNeeded()
	await expect(tableOf(page, 'edit-range')).toBeVisible()
	expect(await fitting.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0)
	await fitting.scrollIntoViewIfNeeded()
	const fitsFrom = await scrollY()
	const fits = await box(fitting)
	await page.mouse.move(fits.x + fits.width / 2, fits.y + fits.height / 2)
	await page.mouse.wheel(0, 300)
	await expect.poll(scrollY).toBeGreaterThan(fitsFrom)
	await settled()

	// A table that scrolls: first the table to its end, then the page.
	await page.evaluate(() => scrollTo(0, 0))
	const frame = frameOf(page, 'rows-sticky')
	await tile(page, 'rows-sticky').scrollIntoViewIfNeeded()
	await expect(tableOf(page, 'rows-sticky')).toBeVisible()
	await frame.scrollIntoViewIfNeeded()
	await settled()
	const scrollsFrom = await scrollY()
	const scrolls = await box(frame)
	await page.mouse.move(scrolls.x + scrolls.width / 2, scrolls.y + scrolls.height / 2)
	for (let step = 0; step < 8; step++) {
		await page.mouse.wheel(0, 400)
		await page.waitForTimeout(80)
	}
	expect(await frame.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
	expect(await scrollY()).toBeGreaterThan(scrollsFrom)
})

for (const { width, columns } of [
	{ width: 360, columns: 1 },
	{ width: 768, columns: 2 },
	{ width: 1280, columns: 3 },
	{ width: 1480, columns: 4 },
]) {
	test(`at ${width} px the grid has ${columns} columns, no hole inside, and the page does not scroll sideways`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 800 })
		await open(page, '&eager')
		const count = await tiles(page).count()
		await expect(page.locator('.tile [data-slot="table"]')).toHaveCount(count)
		expect(await gridColumns(page)).toBe(columns)
		expect(await pageOverflow(page)).toBe(0)

		const placed = await tiles(page).evaluateAll((list) =>
			list.map((item) => {
				const read = (name: string) => Number(getComputedStyle(item).getPropertyValue(name))
				const { left, right } = item.getBoundingClientRect()
				return {
					full: item.getAttribute('data-size') === 'full',
					row: read('--tile-row'),
					column: read('--tile-column'),
					rows: read('--tile-rows'),
					columns: read('--tile-columns'),
					left,
					right,
				}
			}),
		)
		// Every cell of the grid belongs to one tile.
		const cells = placed.flatMap((item) =>
			Array.from({ length: item.rows * item.columns }, (_, index) =>
				[item.row + Math.floor(index / item.columns), item.column + (index % item.columns)].join(
					':',
				),
			),
		)
		// Only the last line of tiles, before the tile that closes the page, may end early.
		const lastLine = Math.max(...placed.filter((item) => !item.full).map((item) => item.row))
		const inside = cells.filter((cell) => Number(cell.split(':')[0]) < lastLine)
		expect(new Set(cells).size).toBe(cells.length)
		expect(inside).toHaveLength((lastLine - 1) * columns)
		for (const item of placed) {
			expect(item.left).toBeGreaterThanOrEqual(0)
			expect(item.right).toBeLessThanOrEqual(width)
		}

		// A table that is wider than its tile scrolls inside the tile.
		const wide = frameOf(page, 'columns-pin')
		const [inner, outer] = await wide.evaluate((element) => [
			element.scrollWidth,
			element.clientWidth,
		])
		expect(inner).toBeGreaterThan(outer ?? 0)
		await wide.evaluate((element) => element.scrollTo({ left: 200, behavior: 'instant' }))
		expect(await pageOverflow(page)).toBe(0)
		// The pinned column stays at the start of the frame.
		const pinned = await box(header(tableOf(page, 'columns-pin'), 'customer'))
		expect(Math.round(pinned.x)).toBe(Math.round((await box(wide)).x))
	})
}

// The tiles that hold, between them, every kind of text and control of the page.
const CONTRAST_TILES = [
	'filter-search',
	'filter-range',
	'columns-pin',
	'columns-hide',
	'columns-formats',
	'group-totals',
	'rows-select',
	'rows-detail',
	'rows-pages',
	'rows-empty',
	'sort-two-columns',
	'sort-own-order',
	'edit-price',
	'edit-switch',
	'more-marks',
	'sheet-fill',
	'sheet-formats',
	'sheet-saved',
	'sheet-letters',
	'formula-sheet',
	'formula-errors',
]

type Pair = [what: string, part: Locator, kind: ContrastKind, least: number]

for (const tone of TONES) {
	test(`the tone ${tone} holds its text at 4.5 to 1 and its controls at 3 to 1`, async ({
		page,
	}) => {
		await installContrast(page)
		await page.setViewportSize({ width: 1280, height: 900 })
		await open(page, `&eager&tone=${tone}&only=${CONTRAST_TILES.join(',')}`)
		for (const id of CONTRAST_TILES) {
			await expect(tile(page, id)).toHaveAttribute('data-tone', tone)
			await expect(tableOf(page, id)).toBeVisible()
		}
		const part = (id: string, selector: string) => tile(page, id).locator(selector).first()
		const TEXT = 4.5
		const EDGE = 3

		// The looks of a format: a marked cell with a coloured text, selected, is the hardest pair.
		const year = cell(tableOf(page, 'sheet-formats'), 'Global Bonds', 'year')
		await year.click()
		await tile(page, 'sheet-formats').getByRole('button', { name: 'Mark', exact: true }).click()
		await expect(year).toHaveAttribute('data-fill', 'accent')
		await cell(tableOf(page, 'sheet-fill'), 'Ada', 'week').click()
		await tableOf(page, 'sheet-letters')
			.locator('th[data-kind="letter"][data-column="city"]')
			.click()

		// A state that the pairs below read: a typed text, an open and refused editor, a hovered row.
		const price = cell(tableOf(page, 'edit-price'), 'Espresso beans', 'price')
		await price.dblclick()
		await part('edit-price', '[data-slot="table-editor"]').fill('-1')
		await page.keyboard.press('Enter')
		await expect(part('edit-price', '[data-slot="table-edit-error"]')).toBeVisible()
		await tableOf(page, 'more-marks').locator('tbody tr', { hasText: 'Aalto Works' }).hover()

		const pairs: Pair[] = [
			['the title of a tile', part('columns-pin', '.tile-title'), 'text', TEXT],
			['the blurb of a tile', part('columns-pin', '.tile-blurb'), 'text', TEXT],
			['a name under a tile', part('columns-pin', '.tile-uses [data-slot="toggle"]'), 'text', TEXT],
			['a note beside a table', part('edit-price', '.demo-note'), 'text', TEXT],
			['a number read out large', part('filter-search', '.readout .display'), 'text', TEXT],
			['the label of a number', part('filter-search', '.readout-label'), 'text', TEXT],
			[
				'the placeholder of a field',
				part('filter-search', '[data-slot="input"]'),
				'placeholder',
				TEXT,
			],
			['the text of a field', part('filter-search', '[data-slot="input"]'), 'text', TEXT],
			['the line of a field', part('filter-search', '[data-slot="input"]'), 'border', EDGE],
			[
				'the icon of a field',
				part('filter-search', '[data-slot="input-group"] > .sink-icon'),
				'text',
				EDGE,
			],
			['a header cell', part('columns-pin', 'thead th'), 'text', TEXT],
			['a body cell', part('columns-pin', 'tbody td'), 'text', TEXT],
			[
				'a body cell that scrolls',
				part('columns-pin', 'tbody td:not([data-pinned])'),
				'text',
				TEXT,
			],
			['a button', part('columns-pin', '[data-slot="button"][aria-pressed="false"]'), 'text', TEXT],
			[
				'the line of a button',
				part('columns-pin', '[data-slot="button"][aria-pressed="false"]'),
				'border',
				EDGE,
			],
			[
				'a pressed button',
				part('columns-pin', '[data-slot="button"][aria-pressed="true"]'),
				'text',
				TEXT,
			],
			[
				'the fill of a pressed button',
				part('columns-pin', '[data-slot="button"][aria-pressed="true"]'),
				'fill',
				EDGE,
			],
			[
				'a choice beside a table',
				part('columns-hide', '.facet .tile-use:not([data-pressed])'),
				'text',
				TEXT,
			],
			[
				'a chosen choice beside a table',
				part('columns-hide', '.facet .tile-use[data-pressed]'),
				'text',
				TEXT,
			],
			['a main button', part('rows-empty', '[data-slot="button"].primary'), 'text', TEXT],
			[
				'the fill of a main button',
				part('rows-empty', '[data-slot="button"].primary'),
				'fill',
				EDGE,
			],
			['the text for no rows', part('rows-empty', 'tbody td'), 'text', TEXT],
			['a link in a cell', part('columns-formats', '.cell-link'), 'text', TEXT],
			[
				'the label of a group row',
				part('group-totals', 'tbody tr[data-kind="group"] td'),
				'text',
				TEXT,
			],
			[
				'the second text of a group row',
				part('group-totals', 'tbody tr[data-kind="group"] .cell-sub'),
				'text',
				TEXT,
			],
			[
				'a total of a group row',
				part('group-totals', 'tbody tr[data-kind="group"] td[data-kind="group-total"]'),
				'text',
				TEXT,
			],
			['a total of the footer', part('group-totals', 'tfoot td'), 'text', TEXT],
			[
				'a cell of a picked row',
				part('rows-select', 'tbody tr[aria-selected="true"] td[data-column="customer"]'),
				'text',
				TEXT,
			],
			[
				'the line of a box',
				part('rows-select', 'tbody [data-slot="checkbox"]:not([data-checked])'),
				'border',
				EDGE,
			],
			[
				'the fill of a checked box',
				part('rows-select', 'tbody [data-slot="checkbox"][data-checked]'),
				'fill',
				EDGE,
			],
			[
				'the mark of a checked box',
				part('rows-select', 'tbody [data-slot="checkbox"][data-checked]'),
				'text',
				EDGE,
			],
			['the lock of a row', part('rows-select', 'tbody td .sink-icon'), 'text', EDGE],
			['a term of a detail row', part('rows-detail', '.detail-list dt'), 'text', TEXT],
			['a text of a detail row', part('rows-detail', '.detail-list dd'), 'text', TEXT],
			['the arrow of a row', part('rows-detail', '[data-slot="button"].twist'), 'text', EDGE],
			[
				'the page in view',
				part('rows-pages', '[data-slot="pagination-link"][data-current]'),
				'text',
				TEXT,
			],
			[
				'another page',
				part('rows-pages', '[data-slot="pagination-link"]:not([data-current])'),
				'text',
				TEXT,
			],
			[
				'the arrow to the next page',
				part('rows-pages', '[data-slot="pagination-next"]'),
				'text',
				EDGE,
			],
			[
				'a choice that is not taken',
				part('rows-pages', '[data-slot="segmented-control-item"]:not([data-checked])'),
				'text',
				TEXT,
			],
			[
				'the line of a choice',
				part('rows-pages', '[data-slot="segmented-control"]'),
				'border',
				EDGE,
			],
			['a tag in a cell', part('sort-own-order', '.cell-tag:not([data-state])'), 'text', TEXT],
			[
				'an urgent tag in a cell',
				part('sort-own-order', '.cell-tag[data-state="late"]'),
				'text',
				TEXT,
			],
			[
				'the line of a switch',
				part('edit-switch', '[data-slot="switch"]:not([data-checked])'),
				'border',
				EDGE,
			],
			[
				'the thumb of a switch',
				part('edit-switch', '[data-slot="switch"]:not([data-checked]) [data-slot="switch-thumb"]'),
				'fill',
				EDGE,
			],
			[
				'the fill of a switch that is on',
				part('edit-switch', '[data-slot="switch"][data-checked]'),
				'fill',
				EDGE,
			],
			[
				'the thumb of a switch that is on',
				part('edit-switch', '[data-slot="switch"][data-checked] [data-slot="switch-thumb"]'),
				'fill',
				EDGE,
			],
			['the track of a slider', part('filter-range', '[data-slot="slider-track"]'), 'fill', EDGE],
			['the value of a slider', part('filter-range', '[data-slot="slider-value"]'), 'text', TEXT],
			['a cell of a late row', part('more-marks', 'tbody tr.is-late td'), 'text', TEXT],
			['a flag in a late row', part('more-marks', 'tbody tr.is-late .cell-flag'), 'text', TEXT],
			['a credit', part('more-marks', 'tbody tr:not(.is-late) td.is-credit'), 'text', TEXT],
			['a credit in a late row', part('more-marks', 'tbody tr.is-late td.is-credit'), 'text', TEXT],
			['a cell of a row under the pointer', part('more-marks', 'tbody tr:hover td'), 'text', TEXT],
			['the editor of a cell', part('edit-price', '[data-slot="table-editor"]'), 'text', TEXT],
			[
				'the ring of a refused editor',
				part('edit-price', '[data-slot="table-editor"]'),
				'outline',
				EDGE,
			],
			[
				'the reason of a refusal',
				part('edit-price', '[data-slot="table-edit-error"]'),
				'text',
				TEXT,
			],
		]

		pairs.push(
			['the number of a row', part('sheet-fill', 'tbody th[data-row-header]'), 'text', TEXT],
			[
				'the square to fill from',
				part('sheet-fill', '[data-slot="table-fill-handle"]'),
				'fill',
				EDGE,
			],
			[
				'the letter of a column',
				part('sheet-letters', 'th[data-kind="letter"]:not([data-selected], [data-lead])'),
				'text',
				TEXT,
			],
			[
				'the letter of a selected column',
				part('sheet-letters', 'th[data-kind="letter"][data-selected]'),
				'text',
				TEXT,
			],
			['a text in an alert colour', part('sheet-saved', 'td[data-color="alert"]'), 'text', TEXT],
			['a text on a fill', part('sheet-saved', 'td[data-fill="accent"]'), 'text', TEXT],
			['the error of a formula', part('formula-errors', 'td[data-formula-error]'), 'text', TEXT],
			['the address of a formula bar', part('formula-sheet', '.formula-address'), 'text', TEXT],
			['a coloured text on a fill that is selected', year, 'text', TEXT],
			[
				'a pressed button of a format',
				part('sheet-formats', '[data-slot="button"][aria-pressed="true"]'),
				'text',
				TEXT,
			],
		)

		const measured: string[] = []
		const failed: string[] = []
		const hold = (what: string, ratio: number, least: number) => {
			const line = `${what}: ${ratio.toFixed(2)} (at least ${least})`
			measured.push(line)
			if (ratio < least) failed.push(line)
		}
		for (const [what, locator, kind, least] of pairs) {
			await expect(locator, what).toBeAttached()
			hold(what, await contrastOf(locator, kind), least)
		}

		// A choice that is taken reads against the indicator behind it, which is not one of its parents.
		// The indicator is a veil, so the ground is its fill over the tray and the card.
		const taken = part('rows-pages', '[data-slot="segmented-control-item"][data-checked]')
		const indicator = part('rows-pages', '[data-slot="segmented-control-indicator"]')
		hold(
			'a choice that is taken',
			await contrastOver(await colourOf(taken, 'color'), indicator),
			TEXT,
		)
		// The thumb of a slider is a child of its track and stands over the ground of the tile.
		hold(
			'the line of a slider thumb',
			await contrastOfPair(
				page,
				await colourOf(part('filter-range', '[data-slot="slider-thumb"]'), 'border-top-color'),
				await colourOf(tile(page, 'filter-range'), 'background-color'),
			),
			EDGE,
		)
		// The mark of a cell with a formula is drawn by the cell over the card, which shows through it.
		hold(
			'the mark of a formula',
			await contrastOfPair(
				page,
				await colourOf(part('formula-errors', 'td[data-formula]'), 'border-top-color', '::before'),
				await colourOf(tile(page, 'formula-errors'), 'background-color'),
			),
			EDGE,
		)
		// The place of a column in the sort is drawn by the header cell, after its name.
		const sorted = part('sort-two-columns', 'thead th[data-sort-index="2"]')
		hold(
			'the place of a column in the sort',
			await contrastOfPair(
				page,
				await colourOf(sorted, 'color', '::after'),
				await colourOf(sorted, 'background-color', '::after'),
			),
			TEXT,
		)

		// The focus rings, with the keys: the editor, a cell of the table, a button, a name.
		await page.keyboard.press('Escape')
		await expect(price).toBeFocused()
		hold('the ring of a cell', await contrastOf(price, 'outline'), EDGE)
		await page.keyboard.press('Enter')
		const editor = part('edit-price', '[data-slot="table-editor"]')
		await expect(editor).toBeFocused()
		hold('the ring of an editor', await contrastOf(editor, 'outline'), EDGE)
		await page.keyboard.press('Escape')
		await page.keyboard.press('Tab')
		const name = part('edit-price', '.tile-uses [data-slot="toggle"]')
		await expect(name).toBeFocused()
		hold('the ring of a name', await contrastOf(name, 'outline'), EDGE)
		await part('columns-pin', '[data-slot="button"]').focus()
		await page.keyboard.press('Tab')
		const button = tile(page, 'columns-pin').getByRole('button', { name: 'Pin the total' })
		await expect(button).toBeFocused()
		hold('the ring of a button', await contrastOf(button, 'outline'), EDGE)
		await part('filter-search', '[data-slot="input"]').focus()
		hold(
			'the ring of a field',
			await contrastOf(part('filter-search', '[data-slot="input"]'), 'outline'),
			EDGE,
		)

		// A pressed name: the page filters by it, and the bar of the filter comes in.
		await name.press('Space')
		await expect(name).toHaveAttribute('aria-pressed', 'true')
		hold('a pressed name', await contrastOf(name, 'text'), TEXT)

		test.info().annotations.push({ type: `contrast of ${tone}`, description: measured.join('; ') })
		expect(failed, `${tone}: ${measured.length} pairs measured`).toEqual([])
	})
}

test('the tiles with a look of their own hold their text at 4.5 to 1', async ({ page }) => {
	await installContrast(page)
	await page.setViewportSize({ width: 1280, height: 900 })
	await open(page, '&eager&only=style')
	const part = (id: string, selector: string) => tile(page, id).locator(selector).first()
	const pairs: Pair[] = []
	for (const id of ['style-brutal', 'style-pixel', 'style-swiss', 'style-deco']) {
		await expect(tableOf(page, id)).toBeVisible()
		pairs.push(
			[`${id}: the title`, part(id, '.tile-title'), 'text', 4.5],
			[`${id}: the blurb`, part(id, '.tile-blurb'), 'text', 4.5],
			[`${id}: a name under it`, part(id, '.tile-uses [data-slot="toggle"]'), 'text', 4.5],
			[`${id}: a header cell`, part(id, 'thead th'), 'text', 4.5],
			[`${id}: a body cell`, part(id, 'tbody td'), 'text', 4.5],
			[`${id}: a body cell at the end`, part(id, 'tbody tr:last-child td:last-child'), 'text', 4.5],
		)
	}
	for (const state of ['todo', 'doing', 'done']) {
		pairs.push([
			`a task in ${state}`,
			part('style-brutal', `td[data-state="${state}"]`),
			'text',
			4.5,
		])
	}
	for (const place of [1, 2, 3, 4]) {
		pairs.push([
			`the score in place ${place}`,
			part('style-pixel', `tbody tr:nth-child(${place}) td[data-column="score"]`),
			'text',
			4.5,
		])
		pairs.push([
			`the name in place ${place}`,
			part('style-pixel', `tbody tr:nth-child(${place}) td[data-column="player"]`),
			'text',
			4.5,
		])
	}
	pairs.push(
		['a track', part('style-swiss', 'td[data-column="track"]'), 'text', 4.5],
		['a cabin', part('style-deco', 'td[data-column="cabin"]'), 'text', 4.5],
	)
	const failed: string[] = []
	for (const [what, locator, kind, least] of pairs) {
		const ratio = await contrastOf(locator, kind)
		if (ratio < least) failed.push(`${what}: ${ratio.toFixed(2)} (at least ${least})`)
	}
	expect(failed).toEqual([])
})

test('the bar of the filter holds its text at 4.5 to 1 and its controls at 3 to 1', async ({
	page,
}) => {
	await installContrast(page)
	await open(page, '&uses=multiSort,stickyHeader')
	const bar = filter(page)
	await expect(bar).toHaveAttribute('data-open', '')
	// The bar slides in; its colours are read when it stands.
	await expect.poll(() => bar.evaluate((element) => getComputedStyle(element).opacity)).toBe('1')

	const pairs: Pair[] = [
		['the count', bar.getByRole('status'), 'text', 4.5],
		['a chosen name', bar.getByRole('button', { name: 'Remove multiSort' }), 'text', 4.5],
		[
			'the line of a chosen name',
			bar.getByRole('button', { name: 'Remove multiSort' }),
			'border',
			3,
		],
		['the clear button', bar.getByRole('button', { name: 'Clear' }), 'text', 4.5],
		['the fill of the clear button', bar.getByRole('button', { name: 'Clear' }), 'fill', 3],
		['a mode that is not taken', bar.getByRole('radio', { name: 'All' }), 'text', 4.5],
		['the line of the modes', bar.locator('[data-slot="segmented-control"]'), 'border', 3],
	]
	const failed: string[] = []
	for (const [what, locator, kind, least] of pairs) {
		const ratio = await contrastOf(locator, kind)
		if (ratio < least) failed.push(`${what}: ${ratio.toFixed(2)} (at least ${least})`)
	}
	expect(failed).toEqual([])

	// The page text over the page ground.
	const head = page.locator('.sink-head')
	expect(await contrastOf(head.locator('h1'), 'text')).toBeGreaterThanOrEqual(4.5)
	expect(await contrastOf(head.locator('p'), 'text')).toBeGreaterThanOrEqual(4.5)
	expect(await contrastOf(page.locator('.pages a').nth(1), 'text')).toBeGreaterThanOrEqual(4.5)
})
