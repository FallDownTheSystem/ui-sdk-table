import { expect, test, type Page } from '@playwright/test'

// Proofs of what a browser does, for the sheet behaviors of the table. The
// unit proofs are in `packages/core/src/proofs/`. Only Chromium runs here, so
// Firefox and Safari are not proven.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

/** Records the clipboard and key events that reach the document, after the page handled them. */
async function record(page: Page) {
	await page.evaluate(() => {
		const seen: {
			type: string
			key?: string
			tag: string
			prevented: boolean
			cancelable: boolean
		}[] = []
		;(window as unknown as { seen: typeof seen }).seen = seen
		for (const type of ['cut', 'copy', 'keydown']) {
			document.addEventListener(type, (event) => {
				seen.push({
					type,
					key: event instanceof KeyboardEvent ? event.key : undefined,
					tag: event.target instanceof Element ? event.target.tagName : '',
					prevented: event.defaultPrevented,
					cancelable: event.cancelable,
				})
			})
		}
	})
	return () =>
		page.evaluate(
			() =>
				(
					window as unknown as {
						seen: {
							type: string
							key?: string
							tag: string
							prevented: boolean
							cancelable: boolean
						}[]
					}
				).seen,
		)
}

test('P3: a cut event reaches a cell that has focus, and a table without `sheet` leaves it alone', async ({
	page,
}) => {
	await page.goto('/?page=sheet')
	const sheet = page.locator('[data-slot="table"]')
	let seen = await record(page)
	// Row 1 of the sheet is the row of letters, and row 2 the header row.
	await sheet.locator('tr[aria-rowindex="3"] > [aria-colindex="2"]').click()
	await page.keyboard.press('Control+x')
	const cut = (await seen()).find((event) => event.type === 'cut')
	// A `td` with a tab index is the target of the event, as it is for a copy.
	expect(cut).toMatchObject({ tag: 'TD', prevented: true, cancelable: true })
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Bolt M6')

	await page.goto('/?page=editing')
	const table = page.getByRole('grid', { name: 'People' })
	seen = await record(page)
	await table.locator('tr[aria-rowindex="2"] > [aria-colindex="2"]').click()
	await page.keyboard.press('Control+x')
	expect((await seen()).find((event) => event.type === 'cut')).toMatchObject({
		tag: 'TD',
		prevented: false,
	})
})

test('P3: the keys of a sheet that a browser also uses reach the page and can be taken', async ({
	page,
}) => {
	await page.goto('/?page=sheet')
	const seen = await record(page)
	await page.locator('[data-slot="table"] tr[aria-rowindex="3"] > [aria-colindex="2"]').click()
	// Control+Y is the history of the browser, Control+D a bookmark, Control+R a reload.
	await page.keyboard.press('Control+y')
	await page.keyboard.press('Control+d')
	const keys = (await seen()).filter((event) => event.type === 'keydown' && event.key !== 'Control')
	// The table takes the redo key, also with no step. The fill key is one that a page can take; with
	// one cell selected there is nothing to fill, so the table leaves it to the browser.
	expect(keys).toEqual([
		{ type: 'keydown', key: 'y', tag: 'TD', prevented: true, cancelable: true },
		{ type: 'keydown', key: 'd', tag: 'TD', prevented: false, cancelable: true },
	])
	// The page is still the page: no key of the browser took it away.
	await expect(page.locator('[data-slot="table"]')).toHaveAttribute('data-sheet', '')
})

test('P4: a drag that is bound to the root of the table goes on while the row window takes the pressed row away', async ({
	page,
}) => {
	await page.goto('/?page=proofs')
	const table = page.getByRole('grid', { name: 'People' })
	const frame = page.locator('.scroller')
	const pressed = table.locator('tr[aria-rowindex="4"] > [aria-colindex="2"]')
	await expect(pressed).toBeVisible()
	const drag = async () =>
		JSON.parse((await page.getByTestId('drag').textContent()) ?? '{}') as {
			moves: number
			cell: string
			pressedInPage: boolean
			ended: string
		}
	const from = await pressed.boundingBox()
	const box = await frame.boundingBox()
	if (!from || !box) throw new Error('No box.')
	const x = from.x + from.width / 2

	await page.keyboard.down('Alt')
	await page.mouse.move(x, from.y + from.height / 2)
	await page.mouse.down()
	await page.mouse.move(x, from.y + from.height / 2 + 40, { steps: 4 })
	expect((await drag()).cell).toBe('5:2')
	// Near the lower edge of the frame, over the footer that sticks there. The frame scrolls by itself.
	const edge = box.y + box.height - 12
	await page.mouse.move(x, edge, { steps: 6 })
	await expect
		.poll(() => frame.evaluate((el) => el.scrollTop), { timeout: 15_000 })
		.toBeGreaterThan(4000)
	// The row that was pressed is out of the page, and the drag still hears the pointer.
	await expect(pressed).toHaveCount(0)
	const before = await drag()
	expect(before.pressedInPage).toBe(false)
	await page.mouse.move(x, edge - 120, { steps: 4 })
	const after = await drag()
	expect(after.moves).toBeGreaterThan(before.moves)
	// The cell under the pointer is found by its place, far below the row of the press.
	const [row, col] = after.cell.split(':').map(Number)
	expect(col).toBe(2)
	expect(row).toBeGreaterThan(100)
	await page.mouse.up()
	await page.keyboard.up('Alt')
	expect((await drag()).ended).toBe('done')
})
