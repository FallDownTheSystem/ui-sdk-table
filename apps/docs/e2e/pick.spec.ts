import { expect, test, type Locator, type Page } from '@playwright/test'

// The pick mode (`pickCells`) on `?page=pick`: a press and a drag on cells
// report them, and the field where a person writes a formula keeps its editor,
// its focus and its caret, while the active cell and the selected cells stay.

const table = (page: Page) => page.getByRole('grid', { name: 'Lines' })
const cell = (page: Page, row: number, column: string) =>
	table(page).locator(`tbody tr:nth-child(${row}) td[data-column="${column}"]`)

async function center(target: Locator) {
	const box = await target.boundingBox()
	if (!box) throw new Error('The cell is not in view.')
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function drag(page: Page, from: Locator, to: Locator) {
	const a = await center(from)
	const b = await center(to)
	await page.mouse.move(a.x, a.y)
	await page.mouse.down()
	await page.mouse.move(b.x, b.y, { steps: 6 })
	await page.mouse.up()
}

/** What must not move during a pick: the active cell and the selected cells. */
async function selection(page: Page) {
	return {
		active: await table(page).locator('[data-active]').getAttribute('data-column'),
		selected: await table(page).locator('td[data-selected]').count(),
	}
}

const fields = [
	{ name: 'the text field of the table editor', field: 'own', input: '[data-slot="table-editor"]' },
	{ name: 'a field of the editor slot', field: 'slot', input: '[data-testid="slot-field"]' },
	{ name: 'a formula bar outside the table', field: 'bar', input: '[aria-label="Formula bar"]' },
]

for (const { name, field, input } of fields) {
	test(`with ${name}, a press and a drag pick cells and change nothing else`, async ({ page }) => {
		await page.goto(`/?page=pick&field=${field}`)
		await cell(page, 4, 'total').click()
		if (field === 'bar') await page.locator(input).click()
		else await page.keyboard.press('Enter')
		const text = page.locator(input)
		await expect(text).toBeFocused()
		await text.fill('=SUM(')
		const before = await selection(page)

		await cell(page, 1, 'price').click()
		await expect(page.getByTestId('picks')).toHaveText('B1')
		await expect(text).toBeFocused()
		await expect(text).toHaveValue('=SUM(B1')
		await expect(cell(page, 1, 'price')).toHaveAttribute('data-picked', '')

		await drag(page, cell(page, 1, 'qty'), cell(page, 3, 'qty'))
		await expect(text).toBeFocused()
		// Each step of the drag replaced the reference of the step before.
		await expect(text).toHaveValue('=SUM(C1:C3')
		await expect(table(page).locator('td[data-picked]')).toHaveCount(3)
		expect(await selection(page)).toEqual(before)
		// The caret stays at the end of the reference, so typing goes on there.
		await page.keyboard.type(')')
		await expect(text).toHaveValue('=SUM(C1:C3)')
		if (field !== 'bar') await expect(table(page).locator('td[data-editing]')).toHaveCount(1)
		// The field saves the text that the picks wrote: 4 + 2 + 3.
		await page.keyboard.press('Enter')
		await expect(cell(page, 4, 'total')).toHaveText('9')
	})
}

test('a press on a letter picks its column, and a press on a row number picks nothing', async ({
	page,
}) => {
	await page.goto('/?page=pick')
	await cell(page, 4, 'total').click()
	const bar = page.getByRole('textbox', { name: 'Formula bar' })
	await bar.click()
	await bar.fill('=SUM(')
	await table(page).locator('tr[data-kind="letters"] th').nth(3).click()
	await expect(bar).toHaveValue('=SUM(C:C')
	await expect(bar).toBeFocused()
	await table(page).locator('tbody tr:nth-child(2) th').click()
	await expect(page.getByTestId('picks')).toHaveText('C:C')
	await expect(bar).toBeFocused()
})

test('with the pick mode off, a press on a cell ends the edit and moves the active cell', async ({
	page,
}) => {
	await page.goto('/?page=pick&field=own&pick=off')
	await cell(page, 4, 'total').click()
	await page.keyboard.press('Enter')
	await page.locator('[data-slot="table-editor"]').fill('7')
	await cell(page, 1, 'price').click()
	await expect(table(page).locator('td[data-editing]')).toHaveCount(0)
	await expect(cell(page, 1, 'price')).toBeFocused()
	await expect(cell(page, 4, 'total')).toHaveText('7')
	await expect(page.getByTestId('picks')).toHaveText('')
	await expect(table(page)).not.toHaveAttribute('data-pick', '')
})

for (const { name, field, input } of fields) {
	test(`with ${name}, the arrow keys pick cells from the cell of the field`, async ({ page }) => {
		await page.goto(`/?page=pick&field=${field}`)
		await cell(page, 4, 'total').click()
		if (field === 'bar') await page.locator(input).click()
		else await page.keyboard.press('Enter')
		const text = page.locator(input)
		await text.fill('=SUM(')
		const before = await selection(page)

		// The first arrow picks the cell next to D4 and writes one address.
		await page.keyboard.press('ArrowLeft')
		await expect(text).toHaveValue('=SUM(C4')
		// More arrows move the pick and replace its address.
		await page.keyboard.press('ArrowUp')
		await expect(text).toHaveValue('=SUM(C3')
		// Shift keeps the first cell and grows a range.
		await page.keyboard.press('Shift+ArrowUp')
		await expect(text).toHaveValue('=SUM(C2:C3')
		await expect(table(page).locator('td[data-picked]')).toHaveCount(2)
		await expect(text).toBeFocused()
		expect(await text.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(10)

		// A typed character keeps the reference, and the next arrow starts from D4 again.
		await page.keyboard.type(',')
		await page.keyboard.press('ArrowUp')
		await expect(text).toHaveValue('=SUM(C2:C3,D3')
		await expect(text).toBeFocused()
		expect(await selection(page)).toEqual(before)
		if (field !== 'bar') await expect(table(page).locator('td[data-editing]')).toHaveCount(1)

		// Where no reference fits, an arrow is the caret's.
		await page.keyboard.type(')')
		await page.keyboard.press('ArrowLeft')
		await expect(text).toHaveValue('=SUM(C2:C3,D3)')
		expect(await text.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(13)
		await page.keyboard.press('End')
		// 2 + 3 + 0.
		await page.keyboard.press('Enter')
		await expect(cell(page, 4, 'total')).toHaveText('5')
	})
}

test('a pick with the arrow keys scrolls its cell into the row window', async ({ page }) => {
	await page.goto('/?page=pick&field=own&rows=50000&attrs=off')
	await table(page).locator('td[data-column="total"]').first().click()
	await page.keyboard.press('Enter')
	const text = page.locator('[data-slot="table-editor"]')
	await text.fill('=')
	await page.keyboard.press('ArrowLeft')
	await page.keyboard.press('Control+ArrowDown')
	await expect(text).toHaveValue('=C50000')
	await expect(table(page).locator('td[data-picked]')).toHaveCount(1)
	await expect(text).toBeFocused()
})

test('with the pick mode off, an arrow in the editor is the caret of its field, as before', async ({
	page,
}) => {
	await page.goto('/?page=pick&field=own&pick=off')
	await cell(page, 4, 'total').click()
	await page.keyboard.press('Enter')
	const text = page.locator('[data-slot="table-editor"]')
	await text.fill('=1+')
	const before = await selection(page)
	for (const key of ['ArrowUp', 'Shift+ArrowLeft', 'Control+ArrowDown'])
		await page.keyboard.press(key)
	await expect(text).toHaveValue('=1+')
	await expect(text).toBeFocused()
	await expect(table(page).locator('td[data-picked]')).toHaveCount(0)
	await expect(page.getByTestId('picks')).toHaveText('')
	expect(await selection(page)).toEqual(before)
})
