import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, query = '') {
	await page.goto(`/?page=window${query}`)
	const table = page.getByRole('grid', { name: 'People' })
	await expect(table).toBeVisible()
	return table
}

const dataRows = (table: Locator) => table.locator('tbody tr[data-slot="table-row"]')
/** The row of a person, by the id that the name cell shows. */
const rowOf = (table: Locator, id: string) =>
	table.locator('tbody tr[data-slot="table-row"]', {
		has: table.page().getByText(new RegExp(`^${id} `)),
	})
const cell = (table: Locator, row: number, col: number) =>
	table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)

/**
 * Where a row is between the header and the footer. The cells are measured:
 * a row that stays in view has cells that stick, and the row element itself
 * stays at its place in the table.
 */
async function place(page: Page, row: Locator) {
	const head = await page.locator('thead th').last().boundingBox()
	const foot = await page.locator('tfoot td').first().boundingBox()
	const box = await row.locator('td').first().boundingBox()
	if (!head || !foot || !box) throw new Error('The row is not in the page.')
	return {
		top: Math.round(box.y - (head.y + head.height)),
		bottom: Math.round(foot.y - (box.y + box.height)),
		height: box.height,
	}
}

const scrollTop = (page: Page) => page.getByTestId('scroller').evaluate((el) => el.scrollTop)

test('only the rows near the frame are in the page, for 10,000 and 50,000 rows', async ({
	page,
}) => {
	const table = await open(page)
	// One header row, 10,000 rows and the footer row.
	await expect(table).toHaveAttribute('aria-rowcount', '10002')
	expect(await dataRows(table).count()).toBeLessThan(60)
	await expect(dataRows(table).first()).toHaveAttribute('aria-rowindex', '2')
	// The spacers hold the place of the rows that are left out, and assistive technology skips them.
	const spacers = table.locator('tbody tr[data-slot="table-spacer"]')
	await expect(spacers).toHaveCount(2)
	await expect(spacers.last()).toHaveAttribute('aria-hidden', 'true')
	const height = await page.getByTestId('scroller').evaluate((el) => el.scrollHeight)
	// Each row is 36 pixels high.
	expect(height).toBeGreaterThan(10000 * 36)
	expect(height).toBeLessThan(10000 * 36 + 200)

	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = 180000))
	await expect(rowOf(table, 'p5000')).toBeVisible()
	await expect(rowOf(table, 'p5000')).toHaveAttribute('aria-rowindex', '5002')
	expect(await dataRows(table).count()).toBeLessThan(60)
	// The header and the footer stay in view.
	await expect(table.locator('thead th').first()).toBeInViewport()
	await expect(table.locator('tfoot td').first()).toBeInViewport()
	const frame = await page.getByTestId('scroller').boundingBox()
	const head = await table.locator('thead th').first().boundingBox()
	const foot = await table.locator('tfoot td').first().boundingBox()
	// One pixel is the border of the frame.
	expect(Math.round((head?.y ?? 0) - (frame?.y ?? 0))).toBe(1)
	expect(
		Math.round((foot?.y ?? 0) + (foot?.height ?? 0) - (frame?.y ?? 0) - (frame?.height ?? 0)),
	).toBe(-1)

	await page.getByRole('button', { name: '50,000 rows' }).click()
	await expect(table).toHaveAttribute('aria-rowcount', '50002')
	await page.getByRole('button', { name: 'Go to the last row' }).click()
	const last = rowOf(table, 'p49999')
	await expect(last).toBeVisible()
	await expect(last).toHaveAttribute('aria-rowindex', '50001')
	expect((await place(page, last)).bottom).toBe(0)
	expect(await dataRows(table).count()).toBeLessThan(60)

	// A wheel moves through the rows, and the rows that come into view are rendered.
	await page.getByTestId('scroller').hover()
	await page.mouse.wheel(0, -3600)
	await expect(rowOf(table, 'p49890')).toBeVisible()
	await page.getByRole('button', { name: 'Go to the first row' }).click()
	expect(await scrollTop(page)).toBe(0)
	await expect(rowOf(table, 'p0')).toBeVisible()
})

test('with rows of their own heights, a jump to any row takes one step', async ({ page }) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Rows with their own heights' }).check()
	await expect(rowOf(table, 'p0')).toBeVisible()
	const heights = await dataRows(table).evaluateAll((rows) =>
		rows.slice(0, 4).map((row) => Math.round(row.getBoundingClientRect().height)),
	)
	expect(new Set(heights).size).toBeGreaterThan(1)

	// Every scroll position from now on, to see that the frame goes to the row and stays there.
	await page.getByTestId('scroller').evaluate((el) => {
		const seen: number[] = []
		;(window as unknown as { seen: number[] }).seen = seen
		el.addEventListener('scroll', () => seen.push(el.scrollTop))
	})
	const seen = () => page.evaluate(() => (window as unknown as { seen: number[] }).seen)

	await page.getByRole('button', { name: 'Go to the last row' }).click()
	const last = rowOf(table, 'p9999')
	// No wait: the row is there when the click is done.
	expect(await last.count()).toBe(1)
	expect((await place(page, last)).bottom).toBe(0)
	await page.waitForTimeout(400)
	expect((await place(page, last)).bottom).toBe(0)
	const positions = await seen()
	// The frame never went back to the top, and it moved in one direction. Rows
	// have heights with parts of a pixel, so one pixel back is rounding.
	expect(Math.min(...positions)).toBeGreaterThan(300000)
	const back = positions.filter((at, index) => index > 0 && at < (positions[index - 1] ?? 0) - 1)
	expect(back).toEqual([])

	await page.getByRole('button', { name: 'Go to that row' }).click()
	const middle = rowOf(table, 'p5000')
	expect(await middle.count()).toBe(1)
	const centered = await place(page, middle)
	expect(Math.abs(centered.top - centered.bottom)).toBeLessThanOrEqual(2)
	await page.waitForTimeout(400)
	const later = await place(page, middle)
	expect(Math.abs(later.top - later.bottom)).toBeLessThanOrEqual(2)

	// Rows above the frame get their real heights while a person scrolls up.
	// The rows in view must move by what the person scrolled, and by no more.
	await page.getByTestId('scroller').hover()
	// A height can be half a pixel and a scroll position is a whole number, so one pixel is the limit.
	const start = (await place(page, middle)).top
	for (let step = 1; step <= 4; step++) {
		await page.mouse.wheel(0, -100)
		await expect
			.poll(async () => Math.abs((await place(page, middle)).top - start - step * 100))
			.toBeLessThanOrEqual(1)
	}
	// New rows came into the page above the frame, so the test did measure rows there.
	await expect(rowOf(table, 'p4978')).toHaveCount(1)
})

test('focus stays on its cell while the rows scroll, and the arrow keys go on from it', async ({
	page,
}) => {
	const table = await open(page)
	const start = cell(table, 6, 2)
	await start.click()
	await expect(start).toBeFocused()

	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = 200000))
	await expect(rowOf(table, 'p5560')).toBeVisible()
	// The row with focus is still in the page, far from the frame, and it has focus.
	await expect(start).toBeFocused()
	expect(await dataRows(table).count()).toBeLessThan(60)
	await expect(table.locator('tbody tr[data-slot="table-spacer"]')).toHaveCount(3)

	// The next key moves from that cell, and the frame comes back to it.
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 7, 2)).toBeFocused()
	await expect(cell(table, 7, 2)).toBeInViewport()

	// The last row of the grid is the footer row. The row above it is not rendered yet.
	await page.keyboard.press('Control+End')
	await expect(cell(table, 10002, 5)).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(cell(table, 10001, 5)).toBeFocused()
	expect((await place(page, rowOf(table, 'p9999'))).bottom).toBe(0)
	await page.keyboard.press('PageUp')
	await expect(cell(table, 9991, 5)).toBeFocused()
	await expect(cell(table, 9991, 5)).toBeInViewport()

	// A cell under the sticky header scrolls out from under it.
	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop -= 500))
	await page.keyboard.press('ArrowUp')
	await expect(cell(table, 9990, 5)).toBeFocused()
	expect((await place(page, rowOf(table, 'p9988'))).top).toBeGreaterThanOrEqual(0)

	// The table is one tab stop, also when its active cell is far from the frame.
	await page.keyboard.press('Control+Home')
	await expect(table.locator('thead th').first()).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 2, 1)).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = 200000))
	await expect(rowOf(table, 'p5560')).toBeVisible()
	await expect(table.locator('[data-slot="table-cell"][tabindex="0"]')).toHaveCount(1)
	await page.keyboard.press('Tab')
	await expect(cell(table, 2, 1)).toBeFocused()
	await expect(cell(table, 2, 1)).toBeInViewport()
})

test('pinned rows stay at their edge, outside the filter and the row window', async ({ page }) => {
	const table = await open(page)
	await page.getByRole('button', { name: 'Pin row 2 to the top' }).click()
	await page.getByRole('button', { name: 'Pin row 9 to the top' }).click()
	await page.getByRole('button', { name: 'Pin row 4 to the bottom' }).click()
	await expect(page.getByTestId('pinning')).toHaveText('{"top":["p2","p9"],"bottom":["p4"]}')

	// The pinned rows are the first and the last rows of the body, and each row is there once.
	await expect(table).toHaveAttribute('aria-rowcount', '10002')
	await expect(rowOf(table, 'p2')).toHaveCount(1)
	await expect(rowOf(table, 'p2')).toHaveAttribute('aria-rowindex', '2')
	await expect(rowOf(table, 'p9')).toHaveAttribute('aria-rowindex', '3')
	await expect(rowOf(table, 'p0')).toHaveAttribute('aria-rowindex', '4')
	await expect(rowOf(table, 'p3')).toHaveAttribute('aria-rowindex', '6')
	await expect(rowOf(table, 'p5')).toHaveAttribute('aria-rowindex', '7')
	await expect(rowOf(table, 'p4')).toHaveAttribute('aria-rowindex', '10001')
	await expect(rowOf(table, 'p2')).toHaveAttribute('data-pinned', 'top')
	await expect(rowOf(table, 'p4')).toHaveAttribute('data-pinned', 'bottom')

	// They stay in view while the rows scroll: under the header in their order, and over the footer.
	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = 150000))
	await expect(rowOf(table, 'p4173')).toBeInViewport()
	expect((await place(page, rowOf(table, 'p2'))).top).toBe(0)
	expect((await place(page, rowOf(table, 'p9'))).top).toBe(36)
	expect((await place(page, rowOf(table, 'p4'))).bottom).toBe(0)

	// A row that is asked for stops beside the pinned rows, not under them.
	await page.getByRole('button', { name: 'Go to the last row' }).click()
	expect((await place(page, rowOf(table, 'p9999'))).bottom).toBe(36)
	await page.getByRole('button', { name: 'Go to the first row' }).click()
	expect((await place(page, rowOf(table, 'p0'))).top).toBe(72)

	// The arrow keys go from the header through the pinned rows into the list.
	await table.locator('thead th').first().focus()
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 2, 1)).toContainText('p2 ')
	await expect(cell(table, 2, 1)).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 4, 1)).toContainText('p0 ')
	await expect(cell(table, 4, 1)).toBeFocused()

	// A search does not hide a pinned row.
	const name = (await rowOf(table, 'p7').locator('td').first().innerText()).replace('p7 ', '')
	await page.getByRole('searchbox', { name: 'Search' }).fill(name)
	await expect(rowOf(table, 'p7')).toBeVisible()
	await expect(rowOf(table, 'p2')).toHaveAttribute('aria-rowindex', '2')
	await expect(rowOf(table, 'p4')).toHaveCount(1)
	await page.getByRole('searchbox', { name: 'Search' }).fill('')

	await page.getByRole('button', { name: 'Pin row 2 to the top' }).click()
	await expect(rowOf(table, 'p2')).not.toHaveAttribute('data-pinned')
	await expect(rowOf(table, 'p2')).toHaveAttribute('aria-rowindex', '5')
	await expect(rowOf(table, 'p9')).toHaveAttribute('aria-rowindex', '2')
})

test('a detail row opens under its row, by the pointer and by Enter', async ({ page }) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Rows with their own heights' }).check()
	await page.getByRole('checkbox', { name: 'Detail rows' }).check()
	const row = rowOf(table, 'p1')
	await expect(row).toHaveAttribute('aria-expanded', 'false')
	await row.getByRole('button', { name: /^Open the details/ }).click()
	await expect(row).toHaveAttribute('aria-expanded', 'true')
	await expect(table).toHaveAttribute('aria-rowcount', '10003')
	const detail = table.locator('tbody tr[data-kind="detail"]')
	await expect(detail).toHaveCount(1)
	await expect(detail).toHaveAttribute('aria-rowindex', '4')
	await expect(detail.locator('td')).toHaveAttribute('colspan', '5')
	await expect(detail).toContainText('Joined on')
	await expect(rowOf(table, 'p2')).toHaveAttribute('aria-rowindex', '5')

	// The detail row is one wide cell of the grid, with a control that Enter goes into.
	await cell(table, 3, 3).click()
	await page.keyboard.press('ArrowDown')
	await expect(detail.locator('td')).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(detail.getByRole('button', { name: 'Send a message' })).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(detail.locator('td')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 5, 3)).toBeFocused()

	// Enter on a cell of the row closes its detail row.
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('ArrowUp')
	await expect(cell(table, 3, 3)).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(detail).toHaveCount(0)
	await expect(row).toHaveAttribute('aria-expanded', 'false')
	await expect(cell(table, 3, 3)).toBeFocused()

	// The rows after an open detail row keep their places in the window.
	await page.keyboard.press('Enter')
	await expect(detail).toHaveCount(1)
	await page.getByRole('button', { name: 'Go to the last row' }).click()
	expect((await place(page, rowOf(table, 'p9999'))).bottom).toBe(0)
})

test('without a frame around the table, the page scrolls the rows', async ({ page }) => {
	const table = await open(page, '&frame=page')
	expect(await dataRows(table).count()).toBeLessThan(80)
	await page.evaluate(() => window.scrollTo(0, 180000))
	await expect(rowOf(table, 'p5000')).toBeVisible()
	expect(await dataRows(table).count()).toBeLessThan(80)
	await expect(table.locator('thead th').first()).toBeInViewport()

	await page.getByRole('button', { name: 'Go to the last row' }).dispatchEvent('click')
	const last = rowOf(table, 'p9999')
	await expect(last).toBeInViewport()
	const view = page.viewportSize()
	const box = await last.boundingBox()
	const foot = await table.locator('tfoot td').first().boundingBox()
	expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(Math.round(foot?.y ?? -1))
	expect(Math.round((foot?.y ?? 0) + (foot?.height ?? 0))).toBeLessThanOrEqual(view?.height ?? 0)
})

test('under a header and a footer of the page, the sticky rows stop at them by two variables', async ({
	page,
}) => {
	const table = await open(page, '&frame=page&bars')
	const bar = await page.getByTestId('app-bar').boundingBox()
	const footer = await page.getByTestId('app-foot').boundingBox()
	const view = page.viewportSize()
	expect(bar?.height).toBe(56)
	expect(footer?.height).toBe(40)
	const head = table.locator('thead th').first()
	const foot = table.locator('tfoot td').first()

	await page.evaluate(() => window.scrollTo(0, 20000))
	// The header of the table is under the header of the page, not behind it and not at the top of the window.
	await expect.poll(async () => Math.round((await head.boundingBox())?.y ?? -1)).toBe(56)
	await expect(head).toHaveCSS('top', '56px')
	const low = await foot.boundingBox()
	expect(Math.round((low?.y ?? 0) + (low?.height ?? 0))).toBe((view?.height ?? 0) - 40)
	// A row that scrolled on is behind the header of the table.
	expect(
		await head.evaluate((cell) => {
			const box = cell.getBoundingClientRect()
			return cell.contains(document.elementFromPoint(box.x + 10, box.y + box.height / 2))
		}),
	).toBe(true)

	// A row that is asked for lands between the two bars, and a pinned row stacks under the header.
	await page.getByRole('button', { name: 'Pin row 2 to the top' }).dispatchEvent('click')
	const pinned = rowOf(table, 'p2').locator('td').first()
	const headBox = await head.boundingBox()
	await expect
		.poll(async () => Math.round((await pinned.boundingBox())?.y ?? -1))
		.toBe(Math.round((headBox?.y ?? 0) + (headBox?.height ?? 0)))
	await page.getByRole('button', { name: 'Go to that row' }).dispatchEvent('click')
	const row = await rowOf(table, 'p5000').boundingBox()
	expect(row?.y ?? 0).toBeGreaterThan(56)
	expect((row?.y ?? 0) + (row?.height ?? 0)).toBeLessThan((view?.height ?? 0) - 40)
})

test('a wrapper that scrolls only sideways leaves the page as the frame', async ({ page }) => {
	const table = await open(page, '&frame=wide')
	await expect(page.getByTestId('scroller')).toHaveCSS('overflow-y', 'auto')
	expect(await dataRows(table).count()).toBeLessThan(80)
	await page.evaluate(() => window.scrollTo(0, 180000))
	await expect(rowOf(table, 'p5000')).toBeVisible()
	expect(await dataRows(table).count()).toBeLessThan(80)
})

test('a jump is one step on a page that animates its scrolls, and lands at the right place', async ({
	page,
}) => {
	const table = await open(page, '&frame=page')
	await page.addStyleTag({ content: 'html { scroll-behavior: smooth }' })
	await page.getByRole('checkbox', { name: 'Rows with their own heights' }).check()
	await page.getByRole('button', { name: 'Go to the last row' }).dispatchEvent('click')
	const last = rowOf(table, 'p9999')
	await expect(last).toBeInViewport()
	expect((await place(page, last)).bottom).toBe(0)

	// From the top of the page, where the header is not at the edge of the view
	// yet: the row is in the middle of what the header and the footer leave free.
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
	await expect(rowOf(table, 'p0')).toBeVisible()
	await page.getByRole('button', { name: 'Go to that row' }).dispatchEvent('click')
	const middle = rowOf(table, 'p5000')
	await expect(middle).toBeInViewport()
	await expect
		.poll(async () => {
			const at = await place(page, middle)
			return Math.abs(at.top - at.bottom)
		})
		.toBeLessThanOrEqual(1)
})

test('a frame that animates its scrolls still jumps in one step', async ({ page }) => {
	const table = await open(page)
	await page.addStyleTag({ content: '.scroller { scroll-behavior: smooth }' })
	await page.getByRole('checkbox', { name: 'Rows with their own heights' }).check()
	await page.getByRole('button', { name: 'Go to the last row' }).click()
	const last = rowOf(table, 'p9999')
	await expect(last).toBeVisible()
	expect((await place(page, last)).bottom).toBe(0)
})

test('with one row height, an open detail row keeps the rows after it in place', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Detail rows' }).check()
	await rowOf(table, 'p1')
		.getByRole('button', { name: /^Open the details/ })
		.click()
	const detail = table.locator('tbody tr[data-kind="detail"]')
	await expect(detail).toHaveCount(1)
	const scroller = page.getByTestId('scroller')
	const height = () => scroller.evaluate((el) => el.scrollHeight)
	const open1 = await height()
	// The detail row is higher than a row, and the list counts its real height.
	expect(open1).toBeGreaterThan(10000 * 36 + 60)

	// Far from the detail row, a spacer stands in for it, with the same height.
	await page.getByRole('button', { name: 'Go to that row' }).click()
	await expect(rowOf(table, 'p5000')).toBeVisible()
	await expect(detail).toHaveCount(0)
	expect(Math.abs((await height()) - open1)).toBeLessThanOrEqual(1)

	// On the way back, a row in view moves as far as the scroll, also when the detail row is rendered again.
	await scroller.evaluate((el) => (el.scrollTop = 600))
	const row = rowOf(table, 'p18')
	await expect(row).toBeVisible()
	await expect(detail).toHaveCount(0)
	for (let step = 0; step < 4; step++) {
		const before = (await row.locator('td').first().boundingBox())?.y ?? 0
		await scroller.evaluate((el) => (el.scrollTop -= 72))
		await page.evaluate(() => new Promise(requestAnimationFrame))
		await page.evaluate(() => new Promise(requestAnimationFrame))
		const after = (await row.locator('td').first().boundingBox())?.y ?? 0
		expect(Math.abs(after - before - 72)).toBeLessThanOrEqual(1)
	}
	await expect(detail).toHaveCount(1)
})

test('a press on a row that the header cuts leaves the rows where they are', async ({ page }) => {
	const table = await open(page)
	const scroller = page.getByTestId('scroller')
	await scroller.evaluate((el) => (el.scrollTop = 3618))
	// The header covers the upper part of this row.
	const target = rowOf(table, 'p100').locator('td').nth(2)
	await expect(target).toBeVisible()
	const head = await table.locator('thead th').first().boundingBox()
	const box = await target.boundingBox()
	if (!head || !box) throw new Error('The row is not in the page.')
	const visible = box.y + box.height - (head.y + head.height)
	expect(visible).toBeGreaterThan(4)
	expect(visible).toBeLessThan(box.height)
	await page.mouse.click(box.x + 20, box.y + box.height - 3)
	await expect(target).toBeFocused()
	expect(await scrollTop(page)).toBe(3618)
	// A key that comes back to the row shows all of it.
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowUp')
	await expect(target).toBeFocused()
	expect((await place(page, rowOf(table, 'p100'))).top).toBeGreaterThanOrEqual(0)
})

test('the row window switches off and on, and a row is still found', async ({ page }) => {
	const table = await open(page)
	const name = (await rowOf(table, 'p0').locator('td').first().innerText()).replace('p0 ', '')
	await page.getByRole('searchbox', { name: 'Search' }).fill(name)
	const count = Number(await table.getAttribute('aria-rowcount')) - 2
	expect(count).toBeGreaterThan(60)
	expect(await dataRows(table).count()).toBeLessThan(60)

	await page.getByRole('checkbox', { name: 'Row window' }).uncheck()
	await expect(dataRows(table)).toHaveCount(count)
	await expect(table.locator('tbody tr[data-slot="table-spacer"]')).toHaveCount(0)
	await expect(table).not.toHaveAttribute('data-row-window')
	// Without the row window, a row that is asked for stops beside the sticky header, not under it.
	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = el.scrollHeight))
	await page.getByRole('button', { name: 'Go to the first row' }).click()
	expect((await place(page, rowOf(table, 'p0'))).top).toBe(0)

	await page.getByRole('checkbox', { name: 'Row window' }).check()
	expect(await dataRows(table).count()).toBeLessThan(60)
	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = el.scrollHeight))
	await expect(dataRows(table).last()).toHaveAttribute('aria-rowindex', String(count + 1))
	await expect(dataRows(table).last()).toBeInViewport()
})

test('in the entry mode Tab goes to the next row also when it is not rendered', async ({
	page,
}) => {
	const table = await open(page, '&entry')
	const first = cell(table, 2, 5)
	await first.click()
	await page.keyboard.press('Escape')
	await expect(first).toBeFocused()
	// The person scrolls far away: the focused row stays in the page, and the row after it goes.
	await page.getByTestId('scroller').evaluate((el) => (el.scrollTop = el.scrollHeight / 2))
	await expect(table.locator('tr[aria-rowindex="3"]')).toHaveCount(0)
	await expect(first).toBeFocused()
	await page.keyboard.press('Tab')
	const next = cell(table, 3, 1)
	await expect(next).toBeFocused()
	await expect(next).toBeInViewport()
})
