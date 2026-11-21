import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function open(page: Page, query = '') {
	await page.goto(`/?page=sheet${query}`)
	const table = page.locator('[data-slot="table"]')
	await expect(table).toBeVisible()
	await expect(table).toHaveAttribute('data-sheet', '')
	return table
}

// Rows and columns as `aria-rowindex` and `aria-colindex` count them, from 1.
// Row 1 is the header row, rows 2 to 13 are the products p1 to p12, row 14 is
// the footer. The columns are product, group, price, discount, stock, date.
const cell = (table: Locator, row: number, col: number) =>
	table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)
const editor = (table: Locator) => table.locator('[data-slot="table-editor"]')
const selected = (table: Locator) => table.locator('[aria-selected="true"]')
const log = (page: Page) => page.getByTestId('log').locator('li')
const steps = (page: Page) => page.getByTestId('steps')
const status = (page: Page) => page.getByTestId('status')
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())
const polite = (page: Page) => page.locator('[aria-live="polite"]')
const assertive = (page: Page) => page.locator('[aria-live="assertive"]')
const PRODUCT = 1
const GROUP = 2
const PRICE = 3
const DISCOUNT = 4
const STOCK = 5
const DATE = 6

test('Ctrl+Z takes an edit back, Ctrl+Y and Ctrl+Shift+Z put it on again, and focus is on the cell', async ({
	page,
}) => {
	const table = await open(page)
	const price = cell(table, 2, PRICE)
	await price.click()
	await page.keyboard.type('3')
	await page.keyboard.press('Enter')
	await expect(price).toHaveText('€3.00')
	await expect(cell(table, 3, PRICE)).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: p1.price=3')
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')

	// The key works from any cell, and the cell of the step gets focus.
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€0.12')
	await expect(price).toBeFocused()
	await expect(log(page).first()).toHaveText('undo: p1.price=0.12')
	await expect(steps(page)).toHaveText('0 to undo, 1 to redo')
	await expect(polite(page).filter({ hasText: '1 cell changed back.' })).not.toHaveCount(0)

	await page.keyboard.press('Control+y')
	await expect(price).toHaveText('€3.00')
	await expect(log(page).first()).toHaveText('redo: p1.price=3')
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€0.12')
	await page.keyboard.press('Control+Shift+z')
	await expect(price).toHaveText('€3.00')
	await expect(price).toBeFocused()
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')

	// A key with nothing to do changes nothing.
	await page.keyboard.press('Control+y')
	await expect(log(page)).toHaveCount(5)
})

test('Ctrl+Z in an open editor undoes the typing in the field and no step of the table', async ({
	page,
}) => {
	const table = await open(page)
	const price = cell(table, 2, PRICE)
	await price.click()
	await page.keyboard.type('3')
	await page.keyboard.press('Enter')
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')

	const product = cell(table, 2, PRODUCT)
	await product.click()
	await page.keyboard.press('F2')
	const input = editor(table)
	await expect(input).toHaveValue('Bolt M6')
	// Out of the selection, to the end of the text.
	await page.keyboard.press('End')
	await page.keyboard.type(' long')
	await expect(input).toHaveValue('Bolt M6 long')
	await page.keyboard.press('Control+z')
	// The browser took typing back, and the table took nothing back.
	await expect(input).not.toHaveValue('Bolt M6 long')
	await expect(input).toBeFocused()
	await expect(price).toHaveText('€3.00')
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')
	await page.keyboard.press('Escape')
	await expect(product).toHaveText('Bolt M6')

	// On the cell again, the key is the table's.
	await expect(product).toBeFocused()
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€0.12')
})

test('a paste of 3 by 2 cells is one step', async ({ page }) => {
	const table = await open(page)
	await page.evaluate(() => navigator.clipboard.writeText('1\t0.5\n2\t0.5\n3\t0.5'))
	await cell(table, 2, PRICE).click()
	await page.keyboard.press('Control+v')
	await expect(cell(table, 4, PRICE)).toHaveText('€3.00')
	await expect(cell(table, 2, DISCOUNT)).toHaveText('50%')
	await expect(selected(table)).toHaveCount(6)
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')
	await expect(log(page)).toHaveCount(1)

	await page.keyboard.press('Control+z')
	await expect(cell(table, 2, PRICE)).toHaveText('€0.12')
	await expect(cell(table, 4, PRICE)).toHaveText('€0.02')
	await expect(cell(table, 4, DISCOUNT)).toHaveText('10%')
	await expect(log(page).first()).toHaveText(
		'undo: p1.price=0.12 p1.discount=0 p2.price=0.05 p2.discount=0 p3.price=0.02 p3.discount=0.1',
	)
	// The cells of the step are the range again.
	await expect(selected(table)).toHaveCount(6)
	await expect(steps(page)).toHaveText('0 to undo, 1 to redo')
})

test('an undo of a row that the sort moved finds the row', async ({ page }) => {
	const table = await open(page)
	const first = cell(table, 2, PRODUCT)
	await first.click()
	await page.keyboard.type('Zinc bolt')
	await page.keyboard.press('Enter')
	await table.getByRole('button', { name: 'Product', exact: true }).click()
	await expect(cell(table, 13, PRODUCT)).toHaveText('Zinc bolt')
	await expect(first).toHaveText('Brush 50 mm')

	await page.getByRole('button', { name: 'Undo' }).click()
	await expect(log(page).first()).toHaveText('undo: p1.product="Bolt M6"')
	// The row is sorted to its old name, and the active cell is with it.
	await expect(first).toHaveText('Bolt M6')
	await expect(status(page)).toHaveText('p1 product')
})

test('an undo of a row that the search hides puts the value back and says that it is not in view', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, PRICE).click()
	await page.keyboard.type('3')
	await page.keyboard.press('Enter')
	const search = page.getByRole('searchbox', { name: 'Search' })
	await search.fill('Hammer')
	await expect(table.locator('tbody tr')).toHaveCount(1)

	await page.getByRole('button', { name: 'Undo' }).click()
	await expect(log(page).first()).toHaveText('undo: p1.price=0.12')
	await expect(
		polite(page).filter({ hasText: '1 cell changed back. 1 cell of them is not in view.' }),
	).not.toHaveCount(0)
	await search.press('Escape')
	await expect(cell(table, 2, PRICE)).toHaveText('€0.12')
})

test('the buttons follow the steps', async ({ page }) => {
	const table = await open(page)
	const undo = page.getByRole('button', { name: 'Undo' })
	const redo = page.getByRole('button', { name: 'Redo' })
	await expect(undo).toBeDisabled()
	await expect(redo).toBeDisabled()
	await cell(table, 2, STOCK).click()
	await page.keyboard.type('7')
	await page.keyboard.press('Enter')
	await expect(undo).toBeEnabled()
	await expect(redo).toBeDisabled()
	await undo.click()
	await expect(cell(table, 2, STOCK)).toHaveText('4,200')
	await expect(undo).toBeDisabled()
	await expect(redo).toBeEnabled()
	await redo.click()
	await expect(cell(table, 2, STOCK)).toHaveText('7')
	await page.getByRole('button', { name: 'Forget the steps' }).click()
	await expect(undo).toBeDisabled()
	await expect(redo).toBeDisabled()
	await expect(steps(page)).toHaveText('0 to undo, 0 to redo')
})

test('with 50,000 rows and the row window, an undo of a row far away scrolls to it', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('button', { name: '50,000 rows' }).click()
	await expect(table).toHaveAttribute('aria-rowcount', '50002')
	const price = cell(table, 2, PRICE)
	await price.click()
	await page.keyboard.type('9')
	await page.keyboard.press('Enter')
	await expect(price).toHaveText('€9.00')

	// To the footer, which is in view at all times, and up to the last product. The first rows leave the page.
	const toLastRow = async () => {
		await page.keyboard.press('Control+End')
		await expect(cell(table, 50002, DATE)).toBeFocused()
		await page.keyboard.press('ArrowUp')
		await expect(cell(table, 50001, DATE)).toBeFocused()
	}
	await toLastRow()
	await expect(price).toHaveCount(0)
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€0.12')
	await expect(price).toBeFocused()
	await expect(price).toBeInViewport()

	// From a button outside the table, focus stays on the button, and the row comes into view all the same.
	await toLastRow()
	await expect(price).toHaveCount(0)
	const redo = page.getByRole('button', { name: 'Redo' })
	await redo.click()
	await expect(price).toHaveText('€9.00')
	await expect(price).toBeInViewport()
	await expect(status(page)).toHaveText('p1 price')
})

test('type 5, Enter, type 6, Enter fills two cells of a column', async ({ page }) => {
	const table = await open(page)
	await cell(table, 2, STOCK).click()
	await page.keyboard.type('5')
	await page.keyboard.press('Enter')
	await page.keyboard.type('6')
	await page.keyboard.press('Enter')
	await expect(cell(table, 2, STOCK)).toHaveText('5')
	await expect(cell(table, 3, STOCK)).toHaveText('6')
	await expect(cell(table, 4, STOCK)).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: p2.stock=6')

	// Shift+Enter goes up.
	await page.keyboard.type('7')
	await page.keyboard.press('Shift+Enter')
	await expect(cell(table, 4, STOCK)).toHaveText('7')
	await expect(cell(table, 3, STOCK)).toBeFocused()
	// The footer follows the rows.
	await expect(cell(table, 14, STOCK)).toHaveText('8,628')
})

test('after a character, an arrow saves and moves; after F2, an arrow moves the caret', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, PRICE).click()
	await page.keyboard.type('7')
	await page.keyboard.press('ArrowRight')
	await expect(cell(table, 2, PRICE)).toHaveText('€7.00')
	await expect(cell(table, 2, DISCOUNT)).toBeFocused()
	await expect(log(page).first()).toHaveText('list-navigation: p1.price=7')

	await cell(table, 3, PRICE).click()
	await page.keyboard.type('8')
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 3, PRICE)).toHaveText('€8.00')
	await expect(cell(table, 4, PRICE)).toBeFocused()

	// F2 in the editor: the arrows are the caret's from then on.
	await page.keyboard.type('5')
	await page.keyboard.press('F2')
	await page.keyboard.press('ArrowLeft')
	await expect(editor(table)).toBeFocused()
	await page.keyboard.type('1')
	await expect(editor(table)).toHaveValue('15')
	await page.keyboard.press('Enter')
	await expect(cell(table, 4, PRICE)).toHaveText('€15.00')

	// An editor that F2 opened holds a value to change, so an arrow never leaves it.
	await cell(table, 6, PRODUCT).click()
	await page.keyboard.press('F2')
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowRight')
	await expect(editor(table)).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(log(page)).toHaveCount(3)
})

test('with a range of 2 by 2 cells, Enter visits each cell and comes back, and the range stays', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, STOCK).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowRight')
	await expect(selected(table)).toHaveCount(4)

	await page.keyboard.type('1')
	await page.keyboard.press('Enter')
	await expect(cell(table, 3, STOCK)).toBeFocused()
	await page.keyboard.type('2')
	await page.keyboard.press('Enter')
	// After the last row of the range, the first row of its next column.
	await expect(cell(table, 2, DATE)).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveValue('2026-01-12')
	await page.keyboard.press('Enter')
	await expect(cell(table, 3, DATE)).toBeFocused()
	await page.keyboard.press('Enter')
	await page.keyboard.press('Enter')
	await expect(cell(table, 2, STOCK)).toBeFocused()
	await expect(selected(table)).toHaveCount(4)
	await expect(cell(table, 2, STOCK)).toHaveText('1')
	await expect(cell(table, 3, STOCK)).toHaveText('2')

	// Tab in the editor walks the range row by row.
	await page.keyboard.type('3')
	await page.keyboard.press('Tab')
	await expect(cell(table, 2, DATE)).toBeFocused()
	await expect(selected(table)).toHaveCount(4)
})

test('Tab on a cell leaves the table; with a range it stays inside; after Escape it leaves again', async ({
	page,
}) => {
	const table = await open(page)
	const after = page.getByRole('button', { name: 'Clear the list' })
	const first = cell(table, 2, PRODUCT)
	await first.click()
	// No keyboard trap: one Tab leaves the table, and Shift+Tab comes back to the cell.
	await page.keyboard.press('Tab')
	await expect(after).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(first).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(table.locator(':focus')).toHaveCount(0)
	await page.keyboard.press('Tab')
	await expect(first).toBeFocused()

	// With a range, Tab walks it, and after its last cell comes its first.
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowRight')
	await expect(selected(table)).toHaveCount(4)
	await page.keyboard.press('Tab')
	await expect(cell(table, 2, GROUP)).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(cell(table, 3, PRODUCT)).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(cell(table, 3, GROUP)).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(first).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(cell(table, 3, GROUP)).toBeFocused()
	await expect(selected(table)).toHaveCount(4)

	// Escape drops the range, and the next Tab is the way out.
	await page.keyboard.press('Escape')
	await expect(selected(table)).toHaveCount(0)
	await page.keyboard.press('Tab')
	await expect(after).toBeFocused()
})

test('an editor of the page gets the character that opened it, and its Enter moves down', async ({
	page,
}) => {
	const table = await open(page)
	const discount = cell(table, 2, DISCOUNT)
	await discount.click()
	await page.keyboard.type('0')
	const own = page.getByRole('textbox', { name: 'Edit Discount' })
	await expect(own).toBeFocused()
	await expect(own).toHaveValue('0')
	await expect(own).toHaveAttribute('data-mode', 'replace')
	await page.keyboard.type('.25')
	await expect(own).toHaveValue('0.25')
	await page.keyboard.press('Enter')
	await expect(discount).toHaveText('25%')
	await expect(cell(table, 3, DISCOUNT)).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: p1.discount=0.25')

	await page.keyboard.press('F2')
	await expect(own).toHaveValue('0')
	await expect(own).toHaveAttribute('data-mode', 'edit')
	await page.keyboard.press('Escape')
	await expect(cell(table, 3, DISCOUNT)).toBeFocused()
})

test('from right to left, the arrow to the left saves and goes on, and Enter goes down', async ({
	page,
}) => {
	const table = await open(page, '&dir=rtl')
	await cell(table, 2, PRICE).click()
	await page.keyboard.type('7')
	await page.keyboard.press('ArrowLeft')
	await expect(cell(table, 2, PRICE)).toHaveText('€7.00')
	await expect(cell(table, 2, DISCOUNT)).toBeFocused()
	await cell(table, 2, STOCK).click()
	await page.keyboard.type('5')
	await page.keyboard.press('Enter')
	await expect(cell(table, 3, STOCK)).toBeFocused()
})

test('with groups, Enter passes over a group row to the next row of values', async ({ page }) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Group by group' }).check()
	// Row 2 is the group of the fasteners, rows 3 to 6 are its products, row 7 is the group of the tools.
	await expect(table.locator('tr[aria-rowindex="7"]')).toContainText('Tools')
	await cell(table, 6, STOCK).click()
	await page.keyboard.type('5')
	await page.keyboard.press('Enter')
	await expect(cell(table, 6, STOCK)).toHaveText('5')
	await expect(cell(table, 8, STOCK)).toBeFocused()
	await page.keyboard.type('6')
	await page.keyboard.press('Shift+Enter')
	await expect(cell(table, 6, STOCK)).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: p5.stock=6')
})

test('Delete empties the range, and Ctrl+Z brings it back', async ({ page }) => {
	const table = await open(page)
	await cell(table, 2, PRICE).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Shift+ArrowRight')
	await expect(selected(table)).toHaveCount(6)
	await page.keyboard.press('Delete')
	await expect(log(page).first()).toHaveText(
		'clear: p1.price=null p1.discount=null p1.stock=null p2.price=null p2.discount=null p2.stock=null',
	)
	await expect(cell(table, 3, STOCK)).not.toHaveText('9,800')
	await expect(polite(page).filter({ hasText: '6 cells cleared.' })).not.toHaveCount(0)
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')
	await expect(cell(table, 2, PRICE)).toBeFocused()

	await page.keyboard.press('Control+z')
	await expect(cell(table, 2, PRICE)).toHaveText('€0.12')
	await expect(cell(table, 3, STOCK)).toHaveText('9,800')
	await expect(selected(table)).toHaveCount(6)
})

test('Backspace empties one cell, and a cell that cannot be edited stays as it is', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 5, STOCK).click()
	await page.keyboard.press('Backspace')
	await expect(log(page).first()).toHaveText('clear: p4.stock=null')
	await cell(table, 5, GROUP).click()
	await page.keyboard.press('Delete')
	await expect(cell(table, 5, GROUP)).toHaveText('Fasteners')
	await expect(log(page)).toHaveCount(1)
	await expect(
		assertive(page).filter({ hasText: 'Nothing was cleared. No cell here can be edited.' }),
	).not.toHaveCount(0)
})

test('Ctrl+X, then Ctrl+V in another place moves the block', async ({ page }) => {
	const table = await open(page)
	await cell(table, 2, STOCK).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+x')
	expect(await clipboard(page)).toBe('4200\n9800')
	await expect(log(page).first()).toHaveText('cut: p1.stock=null p2.stock=null')
	await expect(polite(page).filter({ hasText: '2 cells cut.' })).not.toHaveCount(0)

	await cell(table, 6, STOCK).click()
	await page.keyboard.press('Control+v')
	await expect(cell(table, 6, STOCK)).toHaveText('4,200')
	await expect(cell(table, 7, STOCK)).toHaveText('9,800')
	await expect(log(page).first()).toHaveText('paste: p5.stock=4200 p6.stock=9800')
	// Two steps: the cut and the paste.
	await expect(steps(page)).toHaveText('2 to undo, 0 to redo')
})

test('Delete over a column that needs a value says why, and changes nothing', async ({ page }) => {
	const table = await open(page)
	await cell(table, 2, PRODUCT).click()
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Delete')
	await expect(
		assertive(page).filter({
			hasText: 'Nothing was cleared. Product refuses an empty value: A product has a name.',
		}),
	).not.toHaveCount(0)
	await expect(cell(table, 2, PRODUCT)).toHaveText('Bolt M6')
	await expect(cell(table, 2, PRICE)).toHaveText('€0.12')
	await expect(log(page)).toHaveCount(0)
	await expect(steps(page)).toHaveText('0 to undo, 0 to redo')
})

test('Delete and Backspace inside an open editor remove a character', async ({ page }) => {
	const table = await open(page)
	await cell(table, 2, PRODUCT).click()
	await page.keyboard.press('F2')
	const input = editor(table)
	await page.keyboard.press('End')
	await page.keyboard.press('Backspace')
	await expect(input).toHaveValue('Bolt M')
	await page.keyboard.press('Home')
	await page.keyboard.press('Delete')
	await expect(input).toHaveValue('olt M')
	await expect(log(page)).toHaveCount(0)
	await page.keyboard.press('Escape')
	await expect(cell(table, 2, PRODUCT)).toHaveText('Bolt M6')
})

test('a button in a header selects the cells of its column, and the sort button still sorts', async ({
	page,
}) => {
	const table = await open(page)
	await table.getByRole('button', { name: 'Select the cells of Stock' }).click()
	await expect(selected(table)).toHaveCount(12)
	await expect(status(page)).toHaveText('p1 stock, 12 by 1 cells from p1 stock to p12 stock')
	// Focus is on the first cell of the column, so the keys of the range work at once.
	await expect(cell(table, 2, STOCK)).toBeFocused()
	await page.keyboard.press('Control+c')
	expect((await clipboard(page)).split('\n')).toHaveLength(12)

	// With Shift, the columns from the active cell on.
	await table
		.getByRole('button', { name: 'Select the cells of Price' })
		.click({ modifiers: ['Shift'] })
	await expect(selected(table)).toHaveCount(36)

	await table.getByRole('button', { name: 'Stock', exact: true }).click()
	await expect(table.getByRole('columnheader', { name: 'Stock' })).toHaveAttribute(
		'aria-sort',
		'ascending',
	)
	await expect(cell(table, 2, PRODUCT)).toHaveText('Spirit level 60 cm')
})

test('copy two cells, select six, paste: three copies, as one step', async ({ page }) => {
	const table = await open(page)
	await cell(table, 2, STOCK).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+c')
	await cell(table, 6, STOCK).click()
	for (let step = 0; step < 5; step++) await page.keyboard.press('Shift+ArrowDown')
	await expect(selected(table)).toHaveCount(6)
	await page.keyboard.press('Control+v')
	for (const [row, text] of [
		[6, '4,200'],
		[7, '9,800'],
		[8, '4,200'],
		[9, '9,800'],
		[10, '4,200'],
		[11, '9,800'],
	] as const) {
		await expect(cell(table, row, STOCK)).toHaveText(text)
	}
	await expect(selected(table)).toHaveCount(6)
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')

	// Five rows do not hold a whole number of copies: the block is pasted once, from the first cell.
	await cell(table, 2, DISCOUNT).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+c')
	await cell(table, 6, DISCOUNT).click()
	for (let step = 0; step < 4; step++) await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+v')
	await expect(selected(table)).toHaveCount(2)
	await expect(cell(table, 8, DISCOUNT)).toHaveText('20%')
})

test('while a price is checked on a slow server, Ctrl+Z waits; the step is there after the answer', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Slow check of prices' }).check()
	const price = cell(table, 2, PRICE)
	await price.click()
	await page.keyboard.type('4')
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveAttribute('aria-busy', 'true')
	// The key goes to the field that waits, and the table takes no step back.
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€4.00')
	// The move of Enter comes with the answer.
	await expect(cell(table, 3, PRICE)).toBeFocused()
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')
	await expect(log(page)).toHaveCount(1)

	// An undo asks no schema, so it does not wait for the server.
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€0.12', { timeout: 300 })
})

test('an undo that the owner refuses keeps its step, and the table says so', async ({ page }) => {
	const table = await open(page)
	const price = cell(table, 2, PRICE)
	await price.click()
	await page.keyboard.type('3')
	await page.keyboard.press('Enter')
	await page.getByRole('checkbox', { name: 'Refuse every edit' }).check()
	await price.click()
	await page.keyboard.press('Control+z')
	await expect(
		assertive(page).filter({ hasText: 'The change was not taken back.' }),
	).not.toHaveCount(0)
	await expect(price).toHaveText('€3.00')
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')
	await page.getByRole('checkbox', { name: 'Refuse every edit' }).uncheck()
	await price.click()
	await page.keyboard.press('Control+z')
	await expect(price).toHaveText('€0.12')
})
