import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function open(page: Page, query = '') {
	await page.goto(`/?page=sheet${query}`)
	const table = page.locator('[data-slot="table"]')
	await expect(table).toBeVisible()
	await expect(table).toHaveAttribute('data-sheet', '')
	return table
}

// The page has the row of letters, which is `aria-rowindex` 1. The tests count
// the rows after it, from 1: row 1 is the header row, rows 2 to 13 are the
// products p1 to p12, row 14 is the footer. Column 1 holds the numbers of the
// rows; then product, group, price, discount, stock, date.
const LETTERS = 1
const rowAt = (table: Locator, row: number) => table.locator(`tr[aria-rowindex="${row + LETTERS}"]`)
const cell = (table: Locator, row: number, col: number) =>
	rowAt(table, row).locator(`> [aria-colindex="${col}"]`)
// The footer cell of a column holds the picker of its function, and then its text.
const total = (table: Locator, col: number) =>
	table.locator(`tfoot [aria-colindex="${col}"] .total-text`)
const editor = (table: Locator) => table.locator('[data-slot="table-editor"]')
const selected = (table: Locator) => table.locator('[aria-selected="true"]')
const log = (page: Page) => page.getByTestId('log').locator('li')
const steps = (page: Page) => page.getByTestId('steps')
const status = (page: Page) => page.getByTestId('status')
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())
const polite = (page: Page) => page.locator('[aria-live="polite"]')
const assertive = (page: Page) => page.locator('[aria-live="assertive"]')
const PRODUCT = 2
const GROUP = 3
const PRICE = 4
const DISCOUNT = 5
const STOCK = 6
const DATE = 7

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
	await expect(table).toHaveAttribute('aria-rowcount', '50003')
	// The row of letters, the header row, 50,000 products and the footer.
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
	await expect(total(table, STOCK)).toHaveText('8,628')
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
	await expect(rowAt(table, 7)).toContainText('Tools')
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

// --- Row numbers -----------------------------------------------------------

const NUMBER = 1
const handle = (table: Locator) => table.locator('[data-slot="table-fill-handle"]')
const summary = (page: Page) => page.getByTestId('summary')
const frame = (page: Page) => page.locator('.scroller')

async function center(target: Locator) {
	const box = await target.boundingBox()
	if (!box) throw new Error('The element has no box.')
	return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

/** Drags with the mouse from one element to another, and lifts unless told to hold. */
async function drag(page: Page, from: Locator, to: Locator, lift = true) {
	const start = await center(from)
	const end = await center(to)
	await page.mouse.move(start.x, start.y)
	await page.mouse.down()
	await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 })
	await page.mouse.move(end.x, end.y, { steps: 4 })
	if (lift) await page.mouse.up()
}

test('the number of a row is its header: a press selects the row, Shift more rows, and a drag three rows', async ({
	page,
}) => {
	const table = await open(page)
	await expect(table.getByRole('rowheader')).toHaveCount(12)
	const third = cell(table, 4, NUMBER)
	await expect(third).toHaveText('3')
	await expect(third).toHaveAccessibleName('Row 3')
	// A cell of the row is named with the header of its row and of its column.
	await expect(table.getByRole('gridcell', { name: 'Washer 6 mm' })).toHaveCount(1)

	await third.click()
	// Focus is on the number, and the cells of its row are the range.
	await expect(third).toBeFocused()
	await expect(status(page)).toHaveText('p3 #, 1 by 6 cells from p3 product to p3 date')
	await expect(selected(table)).toHaveCount(6)
	// The number itself is in no range, and a copy leaves it out.
	await expect(third).not.toHaveAttribute('aria-selected')
	await page.keyboard.press('Control+c')
	expect(await clipboard(page)).toBe('Washer 6 mm\tFasteners\t0.02\t0.1\t15000\t2026-01-19')

	await cell(table, 6, NUMBER).click({ modifiers: ['Shift'] })
	await expect(selected(table)).toHaveCount(18)

	await drag(page, cell(table, 8, NUMBER), cell(table, 10, NUMBER))
	await expect(status(page)).toHaveText('p7 #, 3 by 6 cells from p7 product to p9 date')
	// The keys go on from the number that was pressed: an arrow moves to the number under it.
	await expect(cell(table, 8, NUMBER)).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 9, NUMBER)).toBeFocused()
	// Delete on a number empties the cells of the rows that are selected, as on any cell of a sheet.
	await cell(table, 12, NUMBER).click()
	await page.keyboard.press('Delete')
	await expect(
		assertive(page).filter({ hasText: 'Nothing was cleared. Product refuses an empty value' }),
	).not.toHaveCount(0)
	await expect(cell(table, 12, NUMBER)).toHaveText('11')
})

test('the numbers stay at the start while the table scrolls sideways, and a pinned column stays beside them', async ({
	page,
}) => {
	await page.setViewportSize({ width: 520, height: 700 })
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Pin Product' }).check()
	const number = cell(table, 3, NUMBER)
	const product = cell(table, 3, PRODUCT)
	await expect(product).toHaveAttribute('data-pinned', 'start')
	const before = [await number.boundingBox(), await product.boundingBox()]
	await frame(page).evaluate((el) => el.scrollTo({ left: 300, behavior: 'instant' }))
	await expect.poll(() => frame(page).evaluate((el) => el.scrollLeft)).toBe(300)
	expect((await number.boundingBox())?.x).toBeCloseTo(before[0]?.x ?? -1, 0)
	expect((await product.boundingBox())?.x).toBeCloseTo(before[1]?.x ?? -1, 0)
	// The number of the header row and of the footer row stay too.
	expect((await cell(table, 1, NUMBER).boundingBox())?.x).toBeCloseTo(before[0]?.x ?? -1, 0)
})

// --- Column letters --------------------------------------------------------

const letter = (table: Locator, col: number) =>
	table.locator(`tr[aria-rowindex="1"] > [aria-colindex="${col}"]`)
const letterRow = (table: Locator) => table.locator('tr[aria-rowindex="1"]')

test('the letters stand above the headers: a press selects a column, Shift more columns, and a drag three columns', async ({
	page,
}) => {
	const table = await open(page)
	await expect(letterRow(table)).toHaveAttribute('data-kind', 'letters')
	await expect(letterRow(table).locator('> th')).toHaveText(['', 'A', 'B', 'C', 'D', 'E', 'F'])
	await expect(table).toHaveAttribute('aria-rowcount', '15')
	// The header row is the second row of the grid, and the first product the third.
	await expect(table.locator('tr[aria-rowindex="2"] > [aria-colindex="2"]')).toContainText(
		'Product',
	)
	await expect(table.locator('tr[aria-rowindex="3"] > [aria-colindex="2"]')).toHaveText('Bolt M6')

	await letter(table, PRICE).click()
	await expect(letter(table, PRICE)).toBeFocused()
	await expect(status(page)).toHaveText('No cell, 12 by 1 cells from p1 price to p12 price')
	await expect(selected(table)).toHaveCount(12)
	await expect(letter(table, PRICE)).toHaveAttribute('data-selected', '')
	await page.keyboard.press('Control+c')
	expect((await clipboard(page)).split('\n').slice(0, 2)).toEqual(['0.12', '0.05'])

	// Shift goes from the active cell: the letter of the price, to the stock.
	await letter(table, STOCK).click({ modifiers: ['Shift'] })
	await expect(status(page)).toHaveText('No cell, 12 by 3 cells from p1 price to p12 stock')
	await expect(letter(table, PRICE)).toBeFocused()
	// From a cell of the body, Shift on a letter takes the columns from that cell's column.
	await cell(table, 3, GROUP).click()
	await letter(table, PRICE).click({ modifiers: ['Shift'] })
	await expect(status(page)).toHaveText('p2 group, 12 by 2 cells from p1 group to p12 price')

	// A drag over three letters, back to the first, and out again.
	await drag(page, letter(table, PRODUCT), letter(table, DISCOUNT), false)
	await expect(status(page)).toHaveText('No cell, 12 by 4 cells from p1 product to p12 discount')
	const back = await center(letter(table, PRODUCT))
	await page.mouse.move(back.x, back.y, { steps: 4 })
	await expect(status(page)).toHaveText('No cell, 12 by 1 cells from p1 product to p12 product')
	const end = await center(letter(table, PRICE))
	// Down into the rows: the drag still takes whole columns.
	await page.mouse.move(end.x, end.y + 120, { steps: 4 })
	await page.mouse.up()
	await expect(status(page)).toHaveText('No cell, 12 by 3 cells from p1 product to p12 price')
	await expect(table.locator('tr[aria-rowindex="1"] > [data-selected]')).toHaveCount(3)
	// The letters are no cells of a range, and neither are the numbers of the rows.
	await expect(selected(table)).toHaveCount(36)
})

test('the corner selects every cell, without the numbers of the rows', async ({ page }) => {
	const table = await open(page)
	const corner = letter(table, NUMBER)
	await expect(corner).toHaveAccessibleName('All cells')
	await expect(corner).toHaveText('')
	await corner.click()
	await expect(status(page)).toHaveText('No cell, 12 by 6 cells from p1 product to p12 date')
	await expect(selected(table)).toHaveCount(72)
	await page.keyboard.press('Control+c')
	expect((await clipboard(page)).split('\n')[0]).toBe(
		'Bolt M6\tFasteners\t0.12\t0\t4200\t2026-01-12',
	)
	await expect(summary(page)).toContainText('72 cells with a value')
})

test('the arrows reach the letters, Space selects a column, Shift with an arrow the next, Delete empties them, and Tab leaves', async ({
	page,
}) => {
	const table = await open(page)
	// Up from a product passes the header of its column to its letter.
	await cell(table, 2, STOCK).click()
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('ArrowUp')
	await expect(letter(table, STOCK)).toBeFocused()
	await page.keyboard.press('Space')
	await expect(status(page)).toHaveText('No cell, 12 by 1 cells from p1 stock to p12 stock')
	await expect(polite(page).filter({ hasText: '12 rows by 1 column selected.' })).not.toHaveCount(0)
	await page.keyboard.press('Shift+ArrowLeft')
	await expect(status(page)).toHaveText('No cell, 12 by 2 cells from p1 discount to p12 stock')
	await page.keyboard.press('Escape')
	await expect(selected(table)).toHaveCount(0)
	// Control+Space, the key of a spreadsheet, selects the column too.
	await page.keyboard.press('Control+Space')
	await expect(selected(table)).toHaveCount(12)
	await page.keyboard.press('Delete')
	await expect(log(page).first()).toHaveText(
		'clear: p1.stock=null p2.stock=null p3.stock=null p4.stock=null p5.stock=null p6.stock=null and 6 more',
	)
	await expect(letter(table, STOCK)).toBeFocused()
	await page.keyboard.press('Control+z')
	await expect(cell(table, 2, STOCK)).toHaveText('4,200')
	// The undo put focus on the first cell that changed. Up twice is its letter again.
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('ArrowUp')
	await expect(letter(table, STOCK)).toBeFocused()
	// Left of the first letter is the corner, and Enter there selects every cell.
	await page.keyboard.press('Home')
	await expect(letter(table, NUMBER)).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(selected(table)).toHaveCount(72)
	// Down from a letter is the header of its column.
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 1, PRODUCT)).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('Tab')
	await expect(table.locator(':focus')).toHaveCount(0)
})

test('with Product pinned, its letter and the corner stay while the table scrolls sideways', async ({
	page,
}) => {
	await page.setViewportSize({ width: 520, height: 700 })
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Pin Product' }).check()
	await expect(letter(table, PRODUCT)).toHaveAttribute('data-pinned', 'start')
	await expect(letter(table, NUMBER)).toHaveAttribute('data-pinned', 'start')
	const before = [
		await letter(table, NUMBER).boundingBox(),
		await letter(table, PRODUCT).boundingBox(),
	]
	await frame(page).evaluate((el) => el.scrollTo({ left: 300, behavior: 'instant' }))
	await expect.poll(() => frame(page).evaluate((el) => el.scrollLeft)).toBe(300)
	expect((await letter(table, NUMBER).boundingBox())?.x).toBeCloseTo(before[0]?.x ?? -1, 0)
	expect((await letter(table, PRODUCT).boundingBox())?.x).toBeCloseTo(before[1]?.x ?? -1, 0)
	// A letter that is not pinned scrolls with its column.
	const price = await letter(table, PRICE).boundingBox()
	const priceCell = await cell(table, 3, PRICE).boundingBox()
	expect(price?.x).toBeCloseTo(priceCell?.x ?? -1, 0)
	await letter(table, PRICE).click()
	await expect(selected(table)).toHaveCount(12)
})

test('with 50,000 rows the letters stick above the header, and a letter selects the column of every row', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('button', { name: '50,000 rows' }).click()
	await expect(table).toHaveAttribute('aria-rowcount', '50003')
	await frame(page).evaluate((el) => el.scrollTo({ top: 300 * 36, behavior: 'instant' }))
	const box = await frame(page).boundingBox()
	// The letters stick at the top edge of the frame, inside its border of one pixel.
	await expect
		.poll(async () =>
			Math.abs(((await letter(table, PRICE).boundingBox())?.y ?? 0) - (box?.y ?? 0)),
		)
		.toBeLessThanOrEqual(1)
	const letters = await letter(table, PRICE).boundingBox()
	const header = await cell(table, 1, PRICE).boundingBox()
	expect(header?.y).toBeCloseTo((letters?.y ?? 0) + (letters?.height ?? 0), 0)
	await letter(table, PRICE).click()
	await expect(status(page)).toHaveText('No cell, 50000 by 1 cells from p1 price to p50000 price')
	await expect(summary(page)).toContainText('50000 of 50000 cells with a value', {
		timeout: 10_000,
	})
	// The rows did not move for the press.
	expect(await frame(page).evaluate((el) => el.scrollTop)).toBe(300 * 36)
})

test('from right to left, Shift with the left arrow on a letter takes the column after it', async ({
	page,
}) => {
	const table = await open(page, '&dir=rtl')
	await letter(table, PRICE).click()
	await page.keyboard.press('Shift+ArrowLeft')
	await expect(status(page)).toHaveText('No cell, 12 by 2 cells from p1 price to p12 discount')
	// The corner is at the right edge, over the numbers.
	const corner = await letter(table, NUMBER).boundingBox()
	const product = await letter(table, PRODUCT).boundingBox()
	expect(corner?.x ?? 0).toBeGreaterThan(product?.x ?? 0)
	await drag(page, letter(table, PRICE), letter(table, STOCK))
	await expect(status(page)).toHaveText('No cell, 12 by 3 cells from p1 price to p12 stock')
})

// --- Fill ------------------------------------------------------------------

test('a drag of the handle down three rows repeats a value, marks the cells on its way, and Ctrl+Z takes it back', async ({
	page,
}) => {
	const table = await open(page)
	const first = cell(table, 2, STOCK)
	await first.click()
	await expect(handle(table)).toHaveCount(1)
	await drag(page, handle(table), cell(table, 5, STOCK), false)
	await expect(table).toHaveAttribute('data-filling', '')
	await expect(table.locator('[data-fill-target]')).toHaveCount(3)
	await expect(cell(table, 3, STOCK)).toHaveAttribute('data-fill-edge', 'top left right')
	await expect(cell(table, 5, STOCK)).toHaveAttribute('data-fill-edge', 'bottom left right')
	await expect(log(page)).toHaveCount(0)
	await page.mouse.up()

	await expect(table).not.toHaveAttribute('data-filling')
	await expect(table.locator('[data-fill-target]')).toHaveCount(0)
	await expect(log(page).first()).toHaveText('fill: p2.stock=4200 p3.stock=4200 p4.stock=4200')
	for (const row of [3, 4, 5]) await expect(cell(table, row, STOCK)).toHaveText('4,200')
	await expect(polite(page).filter({ hasText: '3 cells filled.' })).not.toHaveCount(0)
	// The source and the target are the range now, with the handle at its end, and focus stayed on the cell.
	await expect(selected(table)).toHaveCount(4)
	await expect(first).toBeFocused()
	await expect(cell(table, 5, STOCK).locator('[data-slot="table-fill-handle"]')).toHaveCount(1)
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')

	await page.keyboard.press('Control+z')
	await expect(cell(table, 3, STOCK)).toHaveText('9,800')
	await expect(cell(table, 4, STOCK)).toHaveText('15,000')
	await expect(cell(table, 5, STOCK)).toHaveText('7,600')
	await expect(steps(page)).toHaveText('0 to undo, 1 to redo')
})

test('1, 2 dragged down gives 3, 4, 5, and a drag upward goes on backwards', async ({ page }) => {
	const table = await open(page)
	await cell(table, 6, STOCK).click()
	await page.keyboard.type('1')
	await page.keyboard.press('Enter')
	await page.keyboard.type('2')
	await page.keyboard.press('Enter')
	await cell(table, 6, STOCK).click()
	await page.keyboard.press('Shift+ArrowDown')
	await drag(page, handle(table), cell(table, 10, STOCK))
	await expect(log(page).first()).toHaveText('fill: p7.stock=3 p8.stock=4 p9.stock=5')

	// Upward from the same two cells: 0 and then a number under zero, which the column refuses. Nothing changes.
	await cell(table, 6, STOCK).click()
	await page.keyboard.press('Shift+ArrowDown')
	await drag(page, handle(table), cell(table, 4, STOCK))
	await expect(
		assertive(page).filter({ hasText: 'Nothing was filled. Stock refuses "-1"' }),
	).not.toHaveCount(0)
	await expect(cell(table, 5, STOCK)).toHaveText('7,600')
	await expect(cell(table, 4, STOCK)).toHaveText('15,000')
	await expect(log(page)).toHaveCount(3)
})

test('a drag forward fills along the row, and Escape during a drag changes nothing', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, DISCOUNT).click()
	await drag(page, handle(table), cell(table, 2, STOCK))
	await expect(log(page).first()).toHaveText('fill: p1.stock=0')
	await expect(cell(table, 2, STOCK)).toHaveText('0')

	await cell(table, 3, STOCK).click()
	await drag(page, handle(table), cell(table, 6, STOCK), false)
	await expect(table.locator('[data-fill-target]')).toHaveCount(3)
	await page.keyboard.press('Escape')
	await expect(table.locator('[data-fill-target]')).toHaveCount(0)
	await expect(table).not.toHaveAttribute('data-filling')
	await page.mouse.up()
	await expect(cell(table, 4, STOCK)).toHaveText('15,000')
	await expect(log(page)).toHaveCount(1)
})

test('Ctrl+D fills the range down and Ctrl+R forward; with one cell the keys are not taken', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, PRICE).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+d')
	await expect(log(page).first()).toHaveText('fill: p2.price=0.12 p3.price=0.12')
	await expect(cell(table, 2, PRICE)).toBeFocused()

	await cell(table, 6, DISCOUNT).click()
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Control+r')
	// The discount of the hammer is 0.15, which is no whole number: the stock column refuses it.
	await expect(
		assertive(page).filter({ hasText: 'Nothing was filled. Stock refuses "0.15"' }),
	).not.toHaveCount(0)
	await cell(table, 7, DISCOUNT).click()
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Control+r')
	await expect(log(page).first()).toHaveText('fill: p6.stock=0')

	// One cell has nothing to fill, so Control+R stays the reload of the browser.
	await cell(table, 9, PRICE).click()
	const taken = await page.evaluate(
		() =>
			new Promise<boolean>((resolve) => {
				addEventListener('keydown', (event) => {
					if (event.key !== 'r') return
					queueMicrotask(() => resolve(event.defaultPrevented))
					// The test must stay on the page.
					event.preventDefault()
				})
				document.activeElement?.dispatchEvent(
					new KeyboardEvent('keydown', {
						key: 'r',
						code: 'KeyR',
						ctrlKey: true,
						bubbles: true,
						cancelable: true,
					}),
				)
			}),
	)
	expect(taken).toBe(true)
	await expect(log(page)).toHaveCount(2)
})

test('with 50,000 rows, a drag of the handle to the edge of the frame scrolls and fills more rows than were in view', async ({
	page,
}) => {
	// The rows go by one step for each frame, so a slow machine needs longer for the same way.
	test.setTimeout(120_000)
	// High enough that the lower edge of the frame is in the window: the rows scroll in the frame.
	await page.setViewportSize({ width: 1280, height: 1100 })
	const table = await open(page)
	await page.getByRole('button', { name: '50,000 rows' }).click()
	await expect(table).toHaveAttribute('aria-rowcount', '50003')
	await cell(table, 2, STOCK).click()
	const from = await center(handle(table))
	const box = await frame(page).boundingBox()
	if (!box) throw new Error('The frame has no box.')
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(from.x, from.y + 60, { steps: 4 })
	// Near the lower edge, over the footer that sticks there. The pointer rests, and the rows go by under it.
	await page.mouse.move(from.x, box.y + box.height - 10, { steps: 6 })
	await expect
		.poll(() => frame(page).evaluate((el) => el.scrollTop), { timeout: 60_000 })
		.toBeGreaterThan(200 * 36)
	// The rows of the start left the page long ago, and the drag goes on. The row of the active
	// cell is kept in the page, so the row after it is the one to look for.
	await expect(rowAt(table, 3)).toHaveCount(0)
	await page.mouse.up()
	const line = (await log(page).first().textContent()) ?? ''
	expect(line).toMatch(/^fill: p2\.stock=4200 p3\.stock=4200 .* and \d+ more$/)
	// The fill passed row 200. Every twelfth row holds 4200 already and is no edit, and the line names six cells.
	expect(Number(/and (\d+) more/.exec(line)?.[1])).toBeGreaterThan(150)
	await expect(steps(page)).toHaveText('1 to undo, 0 to redo')
	// The undo brings the person back to the first cell of the step.
	await page.keyboard.press('Control+z')
	await expect(cell(table, 3, STOCK)).toHaveText('9,800')
})

test('the handle sits at the end corner of its cell: the right side, and the left side from right to left', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 3, STOCK).click()
	let at = await center(handle(table))
	let box = (await center(cell(table, 3, STOCK))).box
	expect(at.x).toBeGreaterThan(box.x + box.width - 12)
	expect(at.y).toBeGreaterThan(box.y + box.height - 12)

	const rtl = await open(page, '&dir=rtl')
	await cell(rtl, 3, STOCK).click()
	at = await center(handle(rtl))
	box = (await center(cell(rtl, 3, STOCK))).box
	expect(at.x).toBeLessThan(box.x + 12)
	expect(at.y).toBeGreaterThan(box.y + box.height - 12)
	// The end side is the left: Control+R fills to the left of the pointer of a reader, into the next column.
	await cell(rtl, 3, DISCOUNT).click()
	await page.keyboard.press('Shift+ArrowLeft')
	await expect(selected(rtl)).toHaveCount(2)
	await page.keyboard.press('Control+r')
	await expect(log(page).first()).toHaveText('fill: p2.stock=0')
})

test('the handle of a cell in a pinned column is in view and can be dragged while the table is scrolled sideways', async ({
	page,
}) => {
	// Narrow, so the table scrolls sideways, and high, so the drag is far from an edge that scrolls.
	await page.setViewportSize({ width: 520, height: 1400 })
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Pin Product' }).check()
	await cell(table, 3, PRODUCT).click()
	await frame(page).evaluate((el) => el.scrollTo({ left: 300, behavior: 'instant' }))
	const at = await center(handle(table))
	const top = await page.evaluate(
		({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-slot'),
		{ x: at.x, y: at.y },
	)
	expect(top).toBe('table-fill-handle')
	await drag(page, handle(table), cell(table, 5, PRODUCT))
	await expect(log(page).first()).toHaveText('fill: p3.product="Nut M6" p4.product="Nut M6"')
})

// --- The summary of the selected cells ---------------------------------------

test('the status bar shows the sum of a dragged range after the drag pauses, and follows an edit inside it', async ({
	page,
}) => {
	const table = await open(page)
	await expect(summary(page)).toHaveText('No cell is selected')
	await drag(page, cell(table, 2, STOCK), cell(table, 4, STOCK))
	await expect(selected(table)).toHaveCount(3)
	await expect(summary(page)).toHaveText(
		'Sum 29,000, average 9,667, smallest 4,200, largest 15,000, 3 of 3 cells with a value',
	)
	// The bar is a plain region: a sum after each step of a selection would be noise for a person who listens.
	await expect(summary(page)).not.toHaveAttribute('aria-live')

	await page.keyboard.type('1000')
	await page.keyboard.press('Enter')
	await expect(summary(page)).toContainText('Sum 25,800')
	// Cells of two columns have no one format, so the numbers are plain.
	await page.keyboard.press('Escape')
	await drag(page, cell(table, 6, PRICE), cell(table, 6, STOCK))
	await expect(summary(page)).toHaveText(
		'Sum 100.05, average 33.35, smallest 0.15, largest 85, 3 of 3 cells with a value',
	)
	await cell(table, 2, PRODUCT).click()
	await expect(summary(page)).toHaveText('1 of 1 cells with a value')
})

// --- The function of a total -------------------------------------------------

test('a select in a footer cell changes sum to average, the group rows follow, and the footer row goes with its last total', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Group by group' }).check()
	const pick = table.getByRole('combobox', { name: 'Total of Stock' })
	const groupTotals = table.locator('td[data-kind="group-total"][data-column="stock"]')
	await expect(pick).toHaveValue('sum')
	await expect(total(table, STOCK)).toHaveText('37,610')
	await expect(groupTotals.first()).toHaveText('36,600')

	await pick.selectOption('mean')
	await expect(total(table, STOCK)).toHaveText('3,134')
	await expect(groupTotals.first()).toHaveText('9,150')
	await expect(groupTotals.first()).toHaveAttribute('data-aggregate', 'mean')
	// A person who cannot see the picker hears the function with the number.
	await expect(table.locator('tfoot [data-column="stock"]')).toHaveAttribute(
		'aria-label',
		'Average: 3,134',
	)
	// The choice is no step of the history.
	await expect(steps(page)).toHaveText('0 to undo, 0 to redo')

	// A column without a total in its definition gets one.
	await table.getByRole('combobox', { name: 'Total of Price' }).selectOption('max')
	await expect(total(table, PRICE)).toHaveText('€54.00')

	await table.getByRole('combobox', { name: 'Total of Price' }).selectOption('')
	await table.getByRole('combobox', { name: 'Total of Stock' }).selectOption('')
	await expect(table.locator('tfoot')).toHaveCount(0)
	await expect(groupTotals).toHaveCount(0)
	await page.getByRole('button', { name: 'Totals as defined' }).click()
	await expect(total(table, STOCK)).toHaveText('37,610')
})

// --- Cell formats ------------------------------------------------------------

test('one decimal more on a range changes the text of those cells only, and the format stays on its row after a sort', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, PRICE).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.getByRole('button', { name: 'One decimal more' }).click()
	await expect(cell(table, 2, PRICE)).toHaveText('€0.120')
	await expect(cell(table, 3, PRICE)).toHaveText('€0.050')
	await expect(cell(table, 4, PRICE)).toHaveText('€0.02')
	await expect(log(page).first()).toHaveText('formats: imperative')
	await expect(polite(page).filter({ hasText: '2 cells formatted.' })).not.toHaveCount(0)
	// A press on a button of the page takes focus, and the cells stay selected.
	await expect(selected(table)).toHaveCount(2)

	// Highest price first: the bolt and the nut are far down now, with their format.
	await table.getByRole('button', { name: /^Price/ }).click()
	await table.getByRole('button', { name: /^Price/ }).click()
	await expect(cell(table, 2, PRICE)).toHaveText('€54.00')
	await expect(table.locator('tbody td', { hasText: '€0.120' })).toHaveCount(1)
	await expect(table.locator('tbody td', { hasText: '€0.050' })).toHaveCount(1)
	await expect(
		table.locator('tbody tr', { hasText: 'Bolt M6' }).locator(`[aria-colindex="${PRICE}"]`),
	).toHaveText('€0.120')
})

test('Ctrl+B makes the range bold and Ctrl+I italic, the buttons show it, and Ctrl+Z takes each away', async ({
	page,
}) => {
	const table = await open(page)
	const first = cell(table, 2, PRODUCT)
	await first.click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+b')
	await expect(table.locator('[data-bold]')).toHaveCount(2)
	await expect(first).toHaveCSS('font-weight', '700')
	await expect(cell(table, 4, PRODUCT)).toHaveCSS('font-weight', '400')
	await expect(log(page).first()).toHaveText('formats: shortcut')
	await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
	// The key is the table's: focus is on the cell, and no bookmark bar or other thing of the browser took it.
	await expect(first).toBeFocused()

	await page.keyboard.press('Control+i')
	await expect(first).toHaveCSS('font-style', 'italic')
	await expect(steps(page)).toHaveText('2 to undo, 0 to redo')

	await page.keyboard.press('Control+z')
	await expect(table.locator('[data-italic]')).toHaveCount(0)
	await expect(table.locator('[data-bold]')).toHaveCount(2)
	await expect(log(page).first()).toHaveText('formats: undo')
	await page.keyboard.press('Control+z')
	await expect(table.locator('[data-bold]')).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false')
	await page.keyboard.press('Control+y')
	await expect(table.locator('[data-bold]')).toHaveCount(2)

	// Every cell is bold, so the key takes it away. The button of the page does the same.
	await page.keyboard.press('Control+b')
	await expect(table.locator('[data-bold]')).toHaveCount(0)
	await page.getByRole('button', { name: 'Bold' }).click()
	await expect(table.locator('[data-bold]')).toHaveCount(2)

	// In an open editor the keys are the field's, and change no format.
	await first.click()
	await page.keyboard.press('F2')
	await page.keyboard.press('Control+b')
	await page.keyboard.press('Escape')
	await expect(table.locator('[data-bold]')).toHaveCount(2)
})

test('a fill colour is on a pinned cell while the table scrolls sideways, and hides the cells under it', async ({
	page,
}) => {
	await page.setViewportSize({ width: 520, height: 700 })
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Pin Product' }).check()
	const product = cell(table, 3, PRODUCT)
	await product.click()
	await page.getByTestId('format-fill').selectOption('amber')
	await page.getByTestId('format-color').selectOption('red')
	await expect(product).toHaveAttribute('data-fill', 'amber')
	await expect(product).toHaveAttribute('data-color', 'red')
	// Another cell, so the tint of the selection is not on the one that is measured.
	await cell(table, 6, PRODUCT).click()
	const filled = await product.evaluate((el) => getComputedStyle(el).backgroundColor)
	expect(filled).toBe('rgb(255, 241, 207)')

	await frame(page).evaluate((el) => el.scrollTo({ left: 300, behavior: 'instant' }))
	const at = await center(product)
	const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.textContent, {
		x: at.x,
		y: at.y,
	})
	expect(top).toBe('Nut M6')
	expect(await product.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(filled)
})

test('a whole column shown as a percentage holds for rows that come later', async ({ page }) => {
	const table = await open(page)
	await table.getByRole('button', { name: 'Select the cells of Stock' }).click()
	await expect(selected(table)).toHaveCount(12)
	await page.getByTestId('format-kind').selectOption('percentage')
	await expect(cell(table, 2, STOCK)).toHaveText('420,000%')
	await expect(cell(table, 2, STOCK)).toHaveAttribute('data-format', 'percentage')
	// The header and the total of the column show as the column does.
	await expect(cell(table, 1, STOCK)).toHaveAttribute('data-format', 'percentage')
	await expect(total(table, STOCK)).toHaveText('3,761,000%')

	// Other rows: none of them was there when the format was given.
	await page.getByRole('button', { name: '50,000 rows' }).click()
	await expect(table).toHaveAttribute('aria-rowcount', '50003')
	await expect(cell(table, 20, STOCK)).toHaveText('4,000%')

	await cell(table, 20, STOCK).click()
	await page.getByRole('button', { name: 'Clear the format' }).click()
	// One cell says nothing of its own, so the column still decides.
	await expect(cell(table, 20, STOCK)).toHaveText('4,000%')
})

test('the field of a cell that shows a percentage holds the number of the screen, and a copy holds the value', async ({
	page,
}) => {
	const table = await open(page)
	const price = cell(table, 2, PRICE)
	await price.click()
	await page.getByTestId('format-kind').selectOption('percentage')
	await expect(price).toHaveText('12%')

	// Enter on the text as it is reports nothing.
	await price.click()
	const reports = await log(page).count()
	await page.keyboard.press('F2')
	await expect(editor(table)).toHaveValue('12')
	await page.keyboard.press('Enter')
	await expect(cell(table, 3, PRICE)).toBeFocused()
	await expect(log(page)).toHaveCount(reports)

	// A person who reads 12 % types 30 for 30 %, with the sign or without it.
	await price.click()
	await page.keyboard.type('30')
	await expect(editor(table)).toHaveValue('30')
	await page.keyboard.press('Enter')
	await expect(price).toHaveText('30%')
	await expect(log(page).first()).toHaveText('enter-key: p1.price=0.3')
	await price.click()
	await page.keyboard.type('45%')
	await page.keyboard.press('Enter')
	await expect(price).toHaveText('45%')
	await expect(log(page).first()).toHaveText('enter-key: p1.price=0.45')

	// A copy holds the value, so a paste into another column keeps it: the
	// text of a paste is no text of a field, and 0.45 there is 45 %.
	await price.click()
	await page.keyboard.press('Control+c')
	expect(await clipboard(page)).toBe('0.45')
	await cell(table, 2, DISCOUNT).click()
	await page.keyboard.press('Control+v')
	await expect(cell(table, 2, DISCOUNT)).toHaveText('45%')
	await expect(log(page).first()).toHaveText('paste: p1.discount=0.45')
})

test('a CSV export holds the text of the screen for cells with a format of their own', async ({
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
	const table = await open(page)
	await cell(table, 2, PRICE).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.getByRole('button', { name: 'One decimal more' }).click()
	await cell(table, 4, DISCOUNT).click()
	await page.getByTestId('format-kind').selectOption('decimal')
	await page.getByTestId('format-fill').selectOption('green')
	await expect(cell(table, 4, DISCOUNT)).toHaveText('0.10')

	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Export CSV' }).click()
	expect((await download).suggestedFilename()).toBe('price-list.csv')
	const csv = await page.evaluate(() =>
		(window as unknown as { exported: Blob[] }).exported[0]?.text(),
	)
	const lines = csv?.split('\r\n') ?? []
	// No column of row numbers, and each cell as the screen shows it.
	expect(lines[0]).toBe('Product,Group,Price,Discount,Stock,Listed')
	expect(lines[1]).toBe('Bolt M6,Fasteners,€0.120,0%,"4,200","Jan 12, 2026"')
	expect(lines[2]).toBe('Nut M6,Fasteners,€0.050,0%,"9,800","Jan 12, 2026"')
	expect(lines[3]).toBe('Washer 6 mm,Fasteners,€0.02,0.10,"15,000","Jan 19, 2026"')
})
