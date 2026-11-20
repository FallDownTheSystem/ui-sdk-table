import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page) {
	await page.goto('/?page=columns')
	const table = page.getByRole('grid', { name: 'People' })
	await expect(table).toBeVisible()
	return table
}

const header = (table: Locator, id: string) => table.locator(`thead th[data-column="${id}"]`)
const resizer = (table: Locator, id: string) =>
	table.locator(`[data-slot="table-resizer"][data-column="${id}"]`)
const cell = (table: Locator, row: number, col: number) =>
	table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)
const width = async (locator: Locator) => Math.round((await locator.boundingBox())?.width ?? 0)
const left = async (locator: Locator) => Math.round((await locator.boundingBox())?.x ?? 0)

/** The ids of the columns in the order of the last header row and of the first body row. */
async function shownColumns(table: Locator) {
	const body = await table
		.locator('tbody tr')
		.first()
		.locator('td')
		.evaluateAll((cells) => cells.map((item) => item.getAttribute('data-column')))
	const cols = await table
		.locator('colgroup col')
		.evaluateAll((cols) => cols.map((item) => item.getAttribute('data-column')))
	expect(cols).toEqual(body)
	return body
}

async function drag(page: Page, from: Locator, dx: number, options: { release?: boolean } = {}) {
	// An element outside the scroll frame gets no pointer events.
	await from.scrollIntoViewIfNeeded()
	const box = await from.boundingBox()
	if (!box) throw new Error('The element to drag is not on the page.')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await page.mouse.down()
	await page.mouse.move(x + dx / 2, y, { steps: 4 })
	await page.mouse.move(x + dx, y, { steps: 4 })
	if (options.release ?? true) await page.mouse.up()
}

test('header groups span their columns, and the arrow keys cross them', async ({ page }) => {
	const table = await open(page)

	// Two header rows, 40 rows and the footer row.
	await expect(table).toHaveAttribute('aria-rowcount', '43')
	await expect(table).toHaveAttribute('aria-colcount', '5')
	await expect(header(table, 'work')).toHaveAttribute('colspan', '2')
	await expect(header(table, 'name')).toHaveAttribute('rowspan', '2')
	await expect(header(table, 'work')).toHaveRole('columnheader')
	await expect(table.locator('thead tr')).toHaveCount(2)
	// A group is as wide as its two columns.
	expect(await width(header(table, 'work'))).toBe(
		(await width(header(table, 'team'))) + (await width(header(table, 'country'))),
	)

	await page.getByRole('checkbox', { name: 'Narrow frame' }).focus()
	await page.keyboard.press('Tab')
	await expect(header(table, 'name')).toBeFocused()
	await page.keyboard.press('ArrowRight')
	await expect(header(table, 'work')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(header(table, 'team')).toBeFocused()
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('ArrowUp')
	await expect(header(table, 'work')).toBeFocused()
	// Down again goes back to the column the person came from.
	await page.keyboard.press('ArrowDown')
	await expect(header(table, 'country')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 3, 3)).toBeFocused()
	await page.keyboard.press('Home')
	await page.keyboard.press('ArrowUp')
	// "Name" covers both header rows.
	await expect(header(table, 'name')).toBeFocused()
	await page.keyboard.press('Control+End')
	await expect(cell(table, 43, 5)).toBeFocused()
	await expect(cell(table, 43, 5)).toHaveAttribute('data-column', 'joined')
	await expect(table.locator('[tabindex="0"][data-slot="table-cell"]')).toHaveCount(1)
})

test('a column hides and shows, and focus stays in the table', async ({ page }) => {
	const table = await open(page)

	await page.getByRole('checkbox', { name: 'Show country' }).uncheck()
	expect(await shownColumns(table)).toEqual(['name', 'team', 'score', 'joined'])
	await expect(header(table, 'work')).not.toHaveAttribute('colspan')
	await expect(table).toHaveAttribute('aria-colcount', '4')

	await page.getByRole('checkbox', { name: 'Show the Work group' }).uncheck()
	expect(await shownColumns(table)).toEqual(['name', 'score', 'joined'])
	await expect(header(table, 'work')).toHaveCount(0)
	await page.getByRole('checkbox', { name: 'Show the Work group' }).check()
	await page.getByRole('checkbox', { name: 'Show country' }).check()
	expect(await shownColumns(table)).toEqual(['name', 'team', 'country', 'score', 'joined'])

	// The cell with focus is in a column that hides. Focus goes to a cell that is left.
	await cell(table, 3, 5).focus()
	// A script hides the column, as a press on the checkbox would move focus out of the table first.
	await page.getByRole('checkbox', { name: 'Show joined' }).dispatchEvent('change')
	expect(await shownColumns(table)).toEqual(['name', 'team', 'country', 'score'])
	await expect(cell(table, 3, 4)).toBeFocused()
	await page.keyboard.press('ArrowLeft')
	await expect(cell(table, 3, 3)).toBeFocused()
})

test('a column moves by drag and by keyboard, and the cells follow', async ({ page }) => {
	const table = await open(page)

	// Drag "Team" past "Country".
	await drag(page, header(table, 'team'), 170, { release: false })
	// The order shows before the release, and the state waits for it.
	expect(await shownColumns(table)).toEqual(['name', 'country', 'team', 'score', 'joined'])
	await expect(page.getByTestId('order')).toHaveText('definition order')
	await expect(header(table, 'team')).toHaveAttribute('data-grabbed', '')
	await page.mouse.up()
	await expect(page.getByTestId('order')).toHaveText('name,country,team,score,joined')
	expect(await shownColumns(table)).toEqual(['name', 'country', 'team', 'score', 'joined'])
	await expect(header(table, 'team')).not.toHaveAttribute('data-grabbed')
	// A drag is not a press: the column is not sorted.
	await expect(header(table, 'team')).toHaveAttribute('aria-sort', 'none')

	// Keyboard: Space picks the column up, the arrows move it, Space drops it.
	await header(table, 'name').focus()
	await page.keyboard.press('Space')
	await expect(header(table, 'name')).toHaveAttribute('data-moving', '')
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('ArrowRight')
	expect(await shownColumns(table)).toEqual(['country', 'team', 'name', 'score', 'joined'])
	await page.keyboard.press('Space')
	await expect(page.getByTestId('order')).toHaveText('country,team,name,score,joined')
	await expect(header(table, 'name')).toBeFocused()
	await expect(header(table, 'name')).toHaveAttribute('aria-colindex', '3')

	// The arrow keys work from the new place of the column.
	await page.keyboard.press('ArrowRight')
	await expect(header(table, 'numbers')).toBeFocused()
	await page.keyboard.press('ArrowLeft')
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 3, 3)).toBeFocused()
	await expect(cell(table, 3, 3)).toHaveAttribute('data-column', 'name')

	// Escape puts a picked-up column back.
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('Space')
	await page.keyboard.press('Home')
	expect(await shownColumns(table)).toEqual(['name', 'country', 'team', 'score', 'joined'])
	await page.keyboard.press('Escape')
	expect(await shownColumns(table)).toEqual(['country', 'team', 'name', 'score', 'joined'])
	await expect(header(table, 'name')).toBeFocused()

	// A header group that the order splits gives one header cell for each part.
	await page.getByRole('button', { name: 'Move joined first' }).click()
	expect(await shownColumns(table)).toEqual(['joined', 'country', 'team', 'name', 'score'])
	await expect(table.locator('thead th[data-column="numbers"]')).toHaveCount(2)
})

test('a column resizes by its handle, by keys, and inside its limits', async ({ page }) => {
	const table = await open(page)
	expect(await width(header(table, 'score'))).toBe(100)

	// Each step of the drag shows, and the release is one commit.
	await drag(page, resizer(table, 'score'), 60, { release: false })
	expect(await width(header(table, 'score'))).toBe(160)
	await expect(page.getByTestId('commits')).toHaveText('0 commits')
	expect(await width(header(table, 'team'))).toBe(140)
	await page.mouse.up()
	await expect(page.getByTestId('commits')).toHaveText('1 commits')
	await expect(page.getByTestId('widths')).toContainText('"score":160')
	await expect(resizer(table, 'score')).toHaveAttribute('aria-valuenow', '160')
	// The resize did not move the column, sort it or move focus into the table.
	expect(await shownColumns(table)).toEqual(['name', 'team', 'country', 'score', 'joined'])
	await expect(page.getByTestId('order')).toHaveText('definition order')
	await expect(header(table, 'score')).toHaveAttribute('aria-sort', 'none')

	// The limits of the column hold.
	await drag(page, resizer(table, 'score'), 400)
	expect(await width(header(table, 'score'))).toBe(300)
	await drag(page, resizer(table, 'score'), -400)
	expect(await width(header(table, 'score'))).toBe(60)
	await expect(page.getByTestId('commits')).toHaveText('3 commits')

	// Escape during a drag puts the width back, and is no commit.
	await drag(page, resizer(table, 'score'), 80, { release: false })
	expect(await width(header(table, 'score'))).toBe(140)
	await page.keyboard.press('Escape')
	await expect(page.getByTestId('widths')).toContainText('"score":60')
	expect(await width(header(table, 'score'))).toBe(60)
	await page.mouse.up()
	await expect(page.getByTestId('commits')).toHaveText('3 commits')

	// Alt with an arrow on the header cell.
	await header(table, 'team').focus()
	await page.keyboard.press('Alt+ArrowRight')
	expect(await width(header(table, 'team'))).toBe(150)
	await page.keyboard.press('Alt+Shift+ArrowLeft')
	expect(await width(header(table, 'team'))).toBe(100)
	await expect(header(table, 'team')).toBeFocused()
	await expect(page.getByTestId('commits')).toHaveText('5 commits')

	// Enter on the header goes to the first control in it; the handle is reached with a click or with Alt.
	await resizer(table, 'team').focus()
	await page.keyboard.press('ArrowRight')
	expect(await width(header(table, 'team'))).toBe(110)
	await expect(resizer(table, 'team')).toBeFocused()

	await page.getByRole('button', { name: 'Reset widths' }).click()
	await expect(page.getByTestId('widths')).toHaveText('{}')
	expect(await width(header(table, 'score'))).toBe(100)
})

test('in right-to-left text, the handle is on the left edge and a drag to the left widens', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Right to left' }).check()

	const cellBox = await header(table, 'score').boundingBox()
	const handleBox = await resizer(table, 'score').boundingBox()
	expect(Math.round(handleBox?.x ?? -1)).toBe(Math.round(cellBox?.x ?? -2))

	await drag(page, resizer(table, 'score'), -60)
	expect(await width(header(table, 'score'))).toBe(160)
	await header(table, 'score').focus()
	await page.keyboard.press('Alt+ArrowLeft')
	expect(await width(header(table, 'score'))).toBe(170)

	// The arrow keys follow the reading direction: left goes to the next column.
	await page.keyboard.press('ArrowLeft')
	await expect(header(table, 'joined')).toBeFocused()
})

test('pinned columns stay at their edge while the others scroll', async ({ page }) => {
	const table = await open(page)
	const scroller = page.getByTestId('scroller')
	const edge = async () => {
		const box = await scroller.boundingBox()
		return {
			left: Math.round((box?.x ?? 0) + 1),
			right: Math.round((box?.x ?? 0) + (box?.width ?? 0) - 1),
		}
	}

	await page.getByRole('button', { name: 'Pin name to the start' }).click()
	await page.getByRole('button', { name: 'Pin joined to the end' }).click()
	await expect(page.getByTestId('pinning')).toHaveText('{"start":["name"],"end":["joined"]}')
	await expect(header(table, 'name')).toHaveAttribute('data-pinned', 'start')

	await scroller.evaluate((el) => (el.scrollLeft = 150))
	const { left: start, right: end } = await edge()
	expect(await left(header(table, 'name'))).toBe(start)
	expect(await left(cell(table, 3, 1))).toBe(start)
	const joined = await cell(table, 3, 5).boundingBox()
	expect(Math.round((joined?.x ?? 0) + (joined?.width ?? 0))).toBeLessThanOrEqual(end + 1)
	expect(Math.round((joined?.x ?? 0) + (joined?.width ?? 0))).toBeGreaterThanOrEqual(end - 16)
	// A free column went under the pinned one.
	expect(await left(header(table, 'team'))).toBeLessThan(start + 180)

	// A second pinned column starts where the first one ends, also after a resize of the first.
	await page.getByRole('button', { name: 'Pin team to the start' }).click()
	expect(await shownColumns(table)).toEqual(['name', 'team', 'country', 'score', 'joined'])
	await scroller.evaluate((el) => (el.scrollLeft = 100))
	expect(await left(cell(table, 3, 2))).toBe(start + 180)
	await drag(page, resizer(table, 'name'), 40)
	await expect(resizer(table, 'name')).toHaveAttribute('aria-valuenow', '220')
	await expect.poll(async () => left(cell(table, 3, 2))).toBe(start + 220)
	await expect(header(table, 'team')).toHaveAttribute('data-pinned-edge', '')
	await expect(header(table, 'name')).not.toHaveAttribute('data-pinned-edge')

	// A pinned column cannot be picked up; a free column moves among the free ones.
	await header(table, 'name').focus()
	await page.keyboard.press('Space')
	await expect(header(table, 'name')).not.toHaveAttribute('data-moving')
	await header(table, 'country').focus()
	await page.keyboard.press('Space')
	await page.keyboard.press('End')
	await page.keyboard.press('Space')
	expect(await shownColumns(table)).toEqual(['name', 'team', 'score', 'country', 'joined'])

	// A cell that gets focus stops beside the pinned columns, not under them.
	// The frame leaves room for one free column between the pinned ones.
	await scroller.evaluate((el) => {
		el.style.maxInlineSize = '700px'
		el.scrollLeft = el.scrollWidth
	})
	await cell(table, 3, 4).focus()
	await page.keyboard.press('ArrowLeft')
	await expect(cell(table, 3, 3)).toBeFocused()
	const pinnedEnd = start + (await width(cell(table, 3, 1))) + (await width(cell(table, 3, 2)))
	expect(await left(cell(table, 3, 3))).toBeGreaterThanOrEqual(pinnedEnd)
	await page.keyboard.press('ArrowRight')
	await expect(cell(table, 3, 4)).toBeFocused()
	const free = await cell(table, 3, 4).boundingBox()
	const last = await cell(table, 3, 5).boundingBox()
	expect(Math.round((free?.x ?? 0) + (free?.width ?? 0))).toBeLessThanOrEqual(
		Math.round(last?.x ?? 0),
	)
})

test('all column features work together with the keyboard grid', async ({ page }) => {
	const table = await open(page)

	await page.getByRole('button', { name: 'Pin joined to the end' }).click()
	await page.getByRole('checkbox', { name: 'Show country' }).uncheck()
	await drag(page, resizer(table, 'team'), 50)
	await header(table, 'score').focus()
	await page.keyboard.press('Space')
	await page.keyboard.press('Home')
	await page.keyboard.press('Space')
	expect(await shownColumns(table)).toEqual(['score', 'name', 'team', 'joined'])
	await expect(header(table, 'score')).toBeFocused()
	await expect(table).toHaveAttribute('aria-colcount', '4')

	// From the moved header, walk down and across every visible column.
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 3, 1)).toBeFocused()
	const seen: (string | null)[] = []
	for (let step = 0; step < 4; step++) {
		seen.push(
			await page.evaluate(() => document.activeElement?.getAttribute('data-column') ?? null),
		)
		await page.keyboard.press('ArrowRight')
	}
	expect(seen).toEqual(['score', 'name', 'team', 'joined'])
	await expect(cell(table, 3, 4)).toBeFocused()

	// Enter goes into the cell with a button, Escape comes back, and the table is one tab stop.
	await page.keyboard.press('Home')
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('Enter')
	await expect(cell(table, 3, 2).getByRole('button')).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(cell(table, 3, 2)).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(page.getByRole('checkbox', { name: 'Narrow frame' })).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(cell(table, 3, 2)).toBeFocused()

	// Sort from the header, and the footer row is a row of the grid.
	await page.keyboard.press('ArrowUp')
	await expect(header(table, 'name')).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(header(table, 'name')).toHaveAttribute('aria-sort', 'ascending')
	await page.keyboard.press('Control+End')
	await expect(cell(table, 43, 4)).toBeFocused()
	await expect(table.locator('tfoot tr')).toHaveAttribute('aria-rowindex', '43')
	await page.keyboard.press('ArrowUp')
	await expect(cell(table, 42, 4)).toBeFocused()
})
