import { expect, test, type Locator, type Page } from '@playwright/test'
import { box, dataRows, focused, frameOf, open, section } from './styled-page'

// Rows and columns as `aria-rowindex` and `aria-colindex` count them, from 1.
const cell = (table: Locator, row: number, col: number) =>
	table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)
const header = (table: Locator, id: string) => table.locator(`thead th[data-column="${id}"]`)
const resizer = (table: Locator, id: string) =>
	table.locator(`[data-slot="table-resizer"][data-column="${id}"]`)
const headers = (table: Locator) =>
	table
		.locator('thead th')
		.evaluateAll((cells) => cells.map((found) => found.getAttribute('data-column')))

/** The fill of a row, and the two layers that one of its cells paints. */
const fills = (row: Locator, column: string) =>
	row.evaluate((found, column) => {
		const cell = found.querySelector(`[data-column="${column}"]`)
		if (!cell) throw new Error(`The row has no cell of "${column}".`)
		const style = getComputedStyle(cell)
		return {
			row: getComputedStyle(found).backgroundColor,
			fill: style.backgroundColor,
			tint: style.backgroundImage,
		}
	}, column)

async function drag(page: Page, from: Locator, dx: number) {
	const start = await box(from)
	const x = start.x + start.width / 2
	const y = start.y + start.height / 2
	await page.mouse.move(x, y)
	await page.mouse.down()
	await page.mouse.move(x + dx / 2, y, { steps: 4 })
	await page.mouse.move(x + dx, y, { steps: 4 })
	await page.mouse.up()
}

test.describe('pinned columns', () => {
	test('pinned columns and the checkbox column stay at their edges while the others scroll', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'pinned-columns')
		const table = found.getByRole('grid', { name: 'Orders with pinned columns' })
		const frame = frameOf(table)
		const row = dataRows(table).first()
		const box_ = row.locator('td[data-column="data-table-select"]')
		const product = row.locator('td[data-column="product"]')
		const category = row.locator('td[data-column="category"]')
		const revenue = row.locator('td[data-column="revenue"]')

		// The checkbox column is not a column of the caller. It sticks with the start pin, before it.
		await expect(box_).toHaveAttribute('data-pinned', 'start')
		await expect(product).toHaveAttribute('data-pinned', 'start')
		await expect(revenue).toHaveAttribute('data-pinned', 'end')
		expect(await headers(table)).toEqual([
			'data-table-select',
			'product',
			'category',
			'region',
			'units',
			'price',
			'isReturn',
			'revenue',
		])

		const before = {
			frame: await box(frame),
			box: await box(box_),
			product: await box(product),
			category: await box(category),
			revenue: await box(revenue),
		}
		// The table is wider than its frame, or nothing would scroll.
		expect(await frame.evaluate((found) => found.scrollWidth - found.clientWidth)).toBeGreaterThan(
			100,
		)
		await frame.evaluate((found) => found.scrollTo({ left: 100 }))

		await expect.poll(async () => (await box(category)).x).toBe(before.category.x - 100)
		expect((await box(box_)).x).toBe(before.box.x)
		expect((await box(product)).x).toBe(before.product.x)
		expect(Math.round((await box(product)).x)).toBe(Math.round(before.box.x + before.box.width))
		const end = await box(revenue)
		// One pixel is the line of the frame.
		expect(Math.round(end.x + end.width)).toBe(Math.round(before.frame.x + before.frame.width) - 1)

		// The cell that scrolled is under the pinned one, and the pinned one covers it.
		expect(
			await product.evaluate((found) => {
				const rect = found.getBoundingClientRect()
				return found.contains(document.elementFromPoint(rect.right - 4, rect.y + rect.height / 2))
			}),
		).toBe(true)

		// The header stays at the top, and its pinned cells at both edges.
		await frame.evaluate((found) => found.scrollTo({ top: 80 }))
		const corner = header(table, 'product')
		await expect
			.poll(async () => Math.round((await box(corner)).y))
			.toBe(Math.round(before.frame.y) + 1)
		expect((await box(corner)).x).toBe(before.product.x)
	})

	test('a pinned cell shows the hover, the selection and the tint of its row', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await open(page)
		const found = await section(page, 'pinned-columns')
		const table = found.getByRole('grid', { name: 'Orders with pinned columns' })
		// An order that was not returned: a row without a tint of the caller.
		const plain = table.locator('tbody tr[data-slot="table-row"]:not([class*="bg-warning"])').nth(1)
		const page_ = 'oklch(1 0 0)'

		// A plain row: the pinned cell is opaque and has no layer over its fill.
		await page.mouse.move(0, 0)
		expect(await fills(plain, 'product')).toEqual({
			row: 'rgba(0, 0, 0, 0)',
			fill: page_,
			tint: 'none',
		})
		// A cell that is not pinned shows the fill of its row through itself.
		expect(await fills(plain, 'category')).toMatchObject({ fill: 'rgba(0, 0, 0, 0)', tint: 'none' })

		// Each tint of the row is the layer of the pinned cell, in the same colour.
		// The fill of the row is on its way for a moment, so the two are read until they agree.
		const tinted = async (row: Locator, column: string) => {
			await expect
				.poll(async () => {
					const now = await fills(row, column)
					return now.tint === `linear-gradient(${now.row} 100%, rgba(0, 0, 0, 0) 100%)`
				})
				.toBe(true)
			const now = await fills(row, column)
			expect(now.row).not.toMatch(/ \/ 0\)$|^rgba\(0, 0, 0, 0\)$/)
			expect(now.fill).toBe(page_)
			return now.row
		}
		await plain.hover()
		const hovered = await tinted(plain, 'product')
		await tinted(plain, 'revenue')
		await tinted(plain, 'data-table-select')

		await plain.getByRole('checkbox').click()
		await page.mouse.move(0, 0)
		await expect(plain).toHaveAttribute('aria-selected', 'true')
		const selected = await tinted(plain, 'product')
		expect(selected).toBe('oklch(0.97 0 0)')
		expect(selected).not.toBe(hovered)

		// The tint of the caller, through `rowClass`: a returned order.
		const returned = table.locator('tbody tr[class*="bg-warning"]').first()
		await expect(returned).toHaveAttribute('aria-selected', 'false')
		const warned = await tinted(returned, 'product')
		await tinted(returned, 'revenue')
		expect(warned).not.toBe(selected)
	})

	test('in right-to-left text, the start pins are at the right edge', async ({ page }) => {
		await open(page)
		await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'))
		const found = await section(page, 'pinned-columns')
		const table = found.getByRole('grid', { name: 'Orders with pinned columns' })
		const frame = frameOf(table)
		const row = dataRows(table).first()
		const edge = async () => {
			const outer = await box(frame)
			return Math.round(outer.x + outer.width) - 1
		}
		const right = async (locator: Locator) => {
			const found = await box(locator)
			return Math.round(found.x + found.width)
		}

		expect(await right(row.locator('td[data-column="data-table-select"]'))).toBe(await edge())
		await frame.evaluate((found) => found.scrollTo({ left: -100 }))
		await expect
			.poll(() => right(row.locator('td[data-column="data-table-select"]')))
			.toBe(await edge())
		const select = await box(row.locator('td[data-column="data-table-select"]'))
		expect(await right(row.locator('td[data-column="product"]'))).toBe(Math.round(select.x))
		// The end pin is at the left edge.
		const outer = await box(frame)
		expect(Math.round((await box(row.locator('td[data-column="revenue"]'))).x)).toBe(
			Math.round(outer.x) + 1,
		)
	})
})

test.describe('columns', () => {
	test('a column of a styled table resizes with its handle and with the keyboard', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'column-resize')
		const table = found.getByRole('grid', { name: 'People with columns to resize and move' })
		const role = header(table, 'role')
		const width = async () => Math.round((await box(role)).width)

		// The handle is a thin bar at the end edge of the header, as high as the header without its line.
		const handle = resizer(table, 'role')
		const [bar, head] = [await box(handle), await box(role)]
		expect(bar.width).toBe(6)
		expect(bar.height).toBe(head.height - 1)
		expect(Math.round(bar.x + bar.width)).toBe(Math.round(head.x + head.width))
		await expect(handle).toHaveCSS('cursor', 'ew-resize')

		const start = await width()
		await drag(page, handle, 60)
		expect(await width()).toBe(start + 60)
		// A drag on the handle is not a press on the header: the column is not sorted.
		await expect(role).toHaveAttribute('aria-sort', 'none')

		// Alt with an arrow key on the header cell.
		await role.focus()
		await page.keyboard.press('Alt+ArrowRight')
		expect(await width()).toBe(start + 70)
		await page.keyboard.press('Alt+ArrowLeft')
		await page.keyboard.press('Alt+ArrowLeft')
		expect(await width()).toBe(start + 50)
		await expect(role).toBeFocused()

		// The arrow keys on the handle itself. The handle shows where it is.
		await handle.focus()
		await page.keyboard.press('ArrowRight')
		expect(await width()).toBe(start + 60)
		await expect(handle).toBeFocused()
		// The colour of the ring of the app.
		await expect(handle).toHaveCSS('background-color', 'oklch(0.596 0.145 163.225)')
	})

	test('a column of a styled table moves with the keyboard and with a drag', async ({ page }) => {
		await open(page)
		const found = await section(page, 'column-resize')
		const table = found.getByRole('grid', { name: 'People with columns to resize and move' })
		expect(await headers(table)).toEqual(['name', 'role', 'age'])

		// Space picks the column up, the arrow keys move it, Space drops it.
		await header(table, 'name').focus()
		await page.keyboard.press('Space')
		await expect(header(table, 'name')).toHaveAttribute('data-moving', '')
		await expect(header(table, 'name')).toHaveCSS('background-color', 'oklch(0.97 0 0)')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('Space')
		expect(await headers(table)).toEqual(['role', 'name', 'age'])
		await expect(header(table, 'name')).toBeFocused()
		await expect(header(table, 'name')).not.toHaveAttribute('data-moving')
		// The cells follow their header.
		await expect(dataRows(table).first().locator('td').first()).toHaveAttribute(
			'data-column',
			'role',
		)

		// Enter on the header still sorts, and the button of the header too.
		await page.keyboard.press('Enter')
		await expect(header(table, 'name')).toHaveAttribute('aria-sort', 'ascending')

		// A drag of the header.
		const from = await box(header(table, 'age'))
		const to = await box(header(table, 'role'))
		await drag(page, header(table, 'age'), to.x - from.x - 20)
		expect(await headers(table)).toEqual(['age', 'role', 'name'])
		// A drag is not a press: the sort is as it was.
		await expect(header(table, 'age')).toHaveAttribute('aria-sort', 'none')
		await expect(header(table, 'name')).toHaveAttribute('aria-sort', 'ascending')
	})
})

test.describe('cells', () => {
	test('a cell of a styled table opens its editor with Enter, saves with Enter and keeps focus', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'cell-editing')
		const table = found.getByRole('grid', { name: 'People to edit' })
		const editor = table.locator('[data-slot="table-editor"]')
		const name = cell(table, 2, 1)
		const before = await box(name)
		const widths = () =>
			table
				.locator('thead th')
				.evaluateAll((cells) => cells.map((found) => found.getBoundingClientRect().width))
		const columns = await widths()

		await name.click()
		await expect(name).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(editor).toBeFocused()
		await expect(editor).toHaveAccessibleName('Edit Name')
		// The editor fills its cell and asks for no width of its own: the columns
		// of a table without fixed widths stay where they are, and the row keeps its height.
		expect(await widths()).toEqual(columns)
		const open_ = await box(editor)
		expect(Math.round(open_.width)).toBe(Math.round(before.width))
		expect((await box(name)).height).toBe(before.height)
		// It has the ring of a control with focus.
		await expect(editor).toHaveCSS('outline-style', 'solid')
		await expect(editor).toHaveCSS('outline-width', '2px')

		await page.keyboard.type('Anna Aalto')
		await page.keyboard.press('Enter')
		await expect(editor).toHaveCount(0)
		await expect(name).toHaveText('Anna Aalto')
		await expect(name).toBeFocused()
		await expect(found.getByTestId('last-edit')).toContainText('Last edit: name of Aino Korhonen')

		// Escape puts the value back.
		await page.keyboard.press('F2')
		await page.keyboard.type('Someone else')
		await page.keyboard.press('Escape')
		await expect(name).toHaveText('Anna Aalto')
		await expect(name).toBeFocused()

		// A column that cannot be edited opens no editor.
		await page.keyboard.press('ArrowRight')
		await expect(cell(table, 2, 2)).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(editor).toHaveCount(0)
		// A double press of the pointer opens the editor of a number.
		await cell(table, 3, 3).dblclick()
		await expect(editor).toBeFocused()
		await page.keyboard.type('41')
		await page.keyboard.press('Tab')
		await expect(cell(table, 3, 3)).toHaveText('41')
	})

	test('a range of cells of a styled table grows with Shift and the arrow keys, and with a drag', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'cell-editing')
		const table = found.getByRole('grid', { name: 'People to edit' })
		const inRange = table.locator('td[data-selected]')

		await cell(table, 2, 1).click()
		await page.keyboard.press('Shift+ArrowDown')
		await page.keyboard.press('Shift+ArrowRight')
		await expect(inRange).toHaveCount(4)
		await expect(cell(table, 3, 2)).toHaveAttribute('aria-selected', 'true')
		// Focus stays on the cell where the range started.
		await expect(cell(table, 2, 1)).toBeFocused()
		// A cell of the range has a tint, and a cell beside it has none.
		await expect(cell(table, 3, 2)).toHaveCSS('background-image', /^linear-gradient\(/)
		await expect(cell(table, 4, 1)).toHaveCSS('background-image', 'none')

		// Escape drops the range.
		await page.keyboard.press('Escape')
		await expect(inRange).toHaveCount(0)

		// A drag from one cell to another, and no text of the page is selected by it.
		const from = await box(cell(table, 3, 1))
		const to = await box(cell(table, 5, 3))
		await page.mouse.move(from.x + 10, from.y + from.height / 2)
		await page.mouse.down()
		await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 6 })
		await page.mouse.up()
		await expect(inRange).toHaveCount(9)
		expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')
	})
})

test.describe('pages from a server', () => {
	test('the pages stay on the page and keep focus while a page loads', async ({ page }) => {
		await open(page, '&delay=600')
		const found = await section(page, 'server-pages')
		const table = found.getByRole('grid', { name: 'People from a server' })
		const pages = found.getByRole('navigation', { name: 'Pages, People from a server' })
		const next = pages.getByRole('button', { name: 'Next page' })
		const status = found.locator('[data-slot="data-table-page"]')
		await expect(dataRows(table)).toHaveCount(5)
		const first = await dataRows(table).first().locator('td').first().innerText()
		// The server does not say how many rows it has, so the text names the page only.
		await expect(status).toHaveText('Page 1')
		await expect(pages.getByRole('button', { name: 'Last page' })).toHaveCount(0)

		await next.focus()
		await page.keyboard.press('Enter')
		// The page is asked for and not here yet: the rows of the page before
		// stay, and so do the pages and the focus of the keyboard.
		await expect(table).toHaveAttribute('aria-busy', 'true')
		await expect(status).toHaveText('Page 2')
		await expect(dataRows(table).first().locator('td').first()).toHaveText(first)
		await expect(pages).toBeVisible()
		await expect(next).toBeFocused()
		// Rows on their way are as easy to read as rows that are here.
		await expect(dataRows(table).first()).toHaveCSS('opacity', '1')

		await expect(table).not.toHaveAttribute('aria-busy', 'true')
		await expect(dataRows(table).first().locator('td').first()).not.toHaveText(first)
		await expect(next).toBeFocused()

		// A new page size from the keyboard: focus is back on the list, also after the rows came.
		const sizes = found.getByRole('combobox', { name: 'Rows per page, People from a server' })
		await sizes.focus()
		await page.keyboard.press('Enter')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
		await expect(sizes).toHaveText('10 per page')
		await expect(sizes).toBeFocused()
		await expect(dataRows(table)).toHaveCount(10)
		await expect(sizes).toBeFocused()
		await expect(status).toHaveText('Page 1')
	})
})

test.describe('layout', () => {
	test('the sticky header stays under the header of the app, by a variable of the app', async ({
		page,
	}) => {
		await open(page)
		const found = await section(page, 'sticky-offset')
		const table = found.getByRole('grid', { name: 'Members under an app header' })
		const bar = found.getByTestId('app-bar')
		const head = table.locator('thead th').first()
		const tenth = dataRows(table).nth(9).locator('td').first()

		// Scroll until the tenth row is where the header of the table would be.
		const target = await box(tenth)
		await page.evaluate((y) => window.scrollBy(0, y - 60), target.y)
		await expect.poll(async () => Math.round((await box(bar)).y)).toBe(0)
		const height = (await box(bar)).height
		expect(height).toBe(56)
		// The header of the table is under the bar, not under the top of the page and not behind the bar.
		await expect.poll(async () => Math.round((await box(head)).y)).toBe(height)
		await expect(head).toHaveCSS('top', '56px')
		// A row that scrolled on is behind the header of the table.
		expect(
			await head.evaluate((found) => {
				const rect = found.getBoundingClientRect()
				return found.contains(document.elementFromPoint(rect.x + 10, rect.y + rect.height / 2))
			}),
		).toBe(true)
	})

	test('at 360 pixels, a table that scrolls with the page stays inside its frame', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 360, height: 720 })
		await open(page)
		const found = await section(page, 'sticky-header')
		const table = found.getByRole('grid', { name: 'Members', exact: true })
		const [outer, inner, place] = [await box(frameOf(table)), await box(table), await box(found)]
		// The table is wider than its place, so this is the case that matters.
		expect(inner.width).toBeGreaterThan(place.width)
		// The frame is around all of the table: its line is at both edges of it.
		expect(Math.round(outer.x)).toBe(Math.round(inner.x) - 1)
		expect(Math.round(outer.x + outer.width)).toBe(Math.round(inner.x + inner.width) + 1)
		// The frame does not scroll, so the header can still stick to the page.
		await expect(frameOf(table)).toHaveCSS('overflow-x', 'visible')
		await expect(table.locator('thead th').first()).toHaveCSS('position', 'sticky')
		// The page scrolls to the end of the table.
		await page.evaluate(() => window.scrollTo({ left: 10_000 }))
		const last = dataRows(table).first().locator('td').last()
		await expect(last).toBeInViewport({ ratio: 1 })

		// A table in a frame that scrolls is as wide as its place, and scrolls inside.
		const basic = await section(page, 'customer-directory')
		const customers = basic.getByRole('grid', { name: 'Customers' })
		await page.evaluate(() => window.scrollTo({ left: 0 }))
		const frame = await box(frameOf(customers))
		expect(Math.round(frame.width)).toBe(Math.round((await box(basic)).width))
	})

	test('in right-to-left text, the parts of the controls are at the other side', async ({
		page,
	}) => {
		await open(page)
		await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'))
		const found = await section(page, 'customer-directory')
		const search = found.getByRole('textbox', { name: 'Search, Customers' })
		const field = await box(search)
		const middle = field.x + field.width / 2

		// The mark of the search is at the start of the field: the right side.
		const mark = await box(search.locator('xpath=..').locator('svg').first())
		expect(mark.x).toBeGreaterThan(middle)
		expect(mark.x + mark.width).toBeLessThan(field.x + field.width)
		// The text starts beside the mark, not under it.
		const padding = await search.evaluate((input) => {
			const style = getComputedStyle(input)
			return [Number.parseFloat(style.paddingRight), Number.parseFloat(style.paddingLeft)]
		})
		expect(padding[0]).toBeGreaterThan(field.x + field.width - mark.x)

		// The button that clears the search is at the end: the left side, inside the field.
		await search.fill('a')
		const clear = await box(found.getByRole('button', { name: 'Clear search' }))
		expect(clear.x + clear.width).toBeLessThan(middle)
		expect(clear.x).toBeGreaterThan(field.x)
		await search.fill('')

		// The mark of a list is at its end, and the check of a chosen entry too.
		const sizes = found.getByRole('combobox', { name: 'Rows per page, Customers' })
		await sizes.scrollIntoViewIfNeeded()
		const trigger = await box(sizes)
		const chevron = await box(sizes.locator('svg'))
		expect(chevron.x + chevron.width / 2).toBeLessThan(trigger.x + trigger.width / 2)
		await sizes.click()
		const chosen = page.getByRole('option', { selected: true })
		const entry = await box(chosen)
		const check = await box(chosen.locator('svg'))
		expect(check.x + check.width / 2).toBeLessThan(entry.x + entry.width / 2)
		await page.keyboard.press('Escape')
		await expect(focused(page)).toHaveAccessibleName('Rows per page, Customers')
	})
})
