import { expect, test } from '@playwright/test'

test('the table sorts, searches and pages 50,000 rows', async ({ page }) => {
	await page.goto('/?page=benchmark')

	const table = page.getByRole('grid', { name: 'People' })
	await expect(table).toHaveAttribute('data-slot', 'table')
	// One header row, one page of 25 rows, and the footer row with the mean score.
	await expect(table).toHaveAttribute('aria-rowcount', '27')
	await expect(table.locator('tbody tr')).toHaveCount(25)

	await page.getByRole('button', { name: '50,000 rows' }).click()
	await expect(page.getByTestId('update-time')).toHaveText(/Updated in \d+ ms/)

	await page.getByRole('button', { name: 'Highest score first' }).click()
	await expect(table.getByRole('columnheader', { name: 'Score' })).toHaveAttribute(
		'aria-sort',
		'descending',
	)
	const first = Number(await table.locator('tbody tr').first().locator('td').nth(3).innerText())
	const last = Number(await table.locator('tbody tr').last().locator('td').nth(3).innerText())
	expect(first).toBeGreaterThanOrEqual(last)

	await page.getByRole('searchbox', { name: 'Search' }).fill('Aino Aalto')
	await expect(table.locator('tbody tr').first()).toContainText('Aino Aalto')
	await page.getByRole('button', { name: 'Next page' }).click()
	await expect(page.getByTestId('page')).toHaveText('Page 2')
	await expect(table.locator('tbody tr').first()).toContainText('Aino Aalto')

	await page.getByRole('searchbox', { name: 'Search' }).fill('no such person')
	await expect(table.locator('tbody')).toHaveText('No person matches the search.')
	// A new search starts on the first page.
	await expect(page.getByTestId('page')).toHaveText('Page 1')
})

test('the keyboard moves between cells and into a cell', async ({ page }) => {
	await page.goto('/?page=benchmark')
	const table = page.getByRole('grid', { name: 'People' })
	const cell = (row: number, col: number) =>
		table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)

	await page.getByRole('button', { name: 'Highest score first' }).focus()
	await page.keyboard.press('Tab')
	await expect(cell(1, 1)).toBeFocused()

	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowRight')
	await expect(cell(2, 2)).toBeFocused()
	await page.keyboard.press('End')
	await expect(cell(2, 5)).toBeFocused()
	await page.keyboard.press('Home')
	await expect(cell(2, 1)).toBeFocused()

	// Space selects the row. Enter goes into the cell, to its checkbox; Escape comes back.
	await page.keyboard.press('Space')
	await expect(page.getByTestId('selected-count')).toHaveText('1 selected')
	await expect(table.locator('tr[aria-rowindex="2"]')).toHaveAttribute('aria-selected', 'true')
	await page.keyboard.press('Enter')
	await expect(cell(2, 1).getByRole('checkbox')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(cell(2, 1).getByRole('checkbox')).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(cell(2, 1)).toBeFocused()

	// Enter on a sortable header sorts by its column.
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('Enter')
	await expect(cell(1, 1)).toHaveAttribute('aria-sort', 'ascending')
	await expect(cell(1, 1)).toBeFocused()

	// The table is one stop in the tab order.
	await page.keyboard.press('Tab')
	await expect(page.getByRole('button', { name: 'Next page' })).toBeFocused()
	// On the way back, focus goes to the cell that was active, not to the last checkbox.
	await page.keyboard.press('Shift+Tab')
	await expect(cell(1, 1)).toBeFocused()
})

test('groups open and close, and a group row has its label and its total', async ({ page }) => {
	await page.goto('/?page=benchmark')
	const table = page.getByRole('treegrid', { name: 'People' })

	await page.getByRole('checkbox', { name: 'Group by team' }).check()
	await expect(table.locator('tbody tr')).toHaveCount(5)
	const billing = table.locator('tbody tr').first()
	await expect(billing).toHaveAttribute('aria-expanded', 'false')
	await expect(billing).toHaveAttribute('aria-level', '1')

	// The label covers the columns before the total of the score, and the total is under its header.
	const label = billing.getByRole('gridcell').first()
	await expect(label).toHaveAttribute('colspan', '3')
	await expect(billing.getByRole('gridcell')).toHaveCount(3)
	await expect(billing.locator('td[data-column="score"]')).toHaveText(/^[\d.]+$/)
	await label.focus()
	await page.keyboard.press('Enter')
	await expect(billing).toHaveAttribute('aria-expanded', 'true')
	await expect(table.locator('tbody tr').nth(1)).toHaveAttribute('aria-level', '2')

	// From the label, the arrow keys still reach the rows below and the header above.
	await page.keyboard.press('ArrowDown')
	await expect(table.locator('tbody tr').nth(1).getByRole('gridcell').first()).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(label).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(table.locator('thead th').first()).toBeFocused()
})

test('after a sort, the arrow keys move from the place the cell has now', async ({ page }) => {
	await page.goto('/?page=benchmark')
	const table = page.getByRole('grid', { name: 'People' })
	const cell = (row: number, col: number) =>
		table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)

	// The row with this cell is somewhere else after the sort, in the same row element.
	await cell(3, 2).focus()
	await page.getByRole('button', { name: 'Highest score first' }).click()
	await expect(table.getByRole('columnheader', { name: 'Score' })).toHaveAttribute(
		'aria-sort',
		'descending',
	)
	await cell(4, 2).focus()
	await page.keyboard.press('ArrowDown')
	await expect(cell(5, 2)).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('ArrowUp')
	await expect(cell(3, 2)).toBeFocused()
})

test('the row that says "no rows" is a row of the keyboard grid', async ({ page }) => {
	await page.goto('/?page=benchmark')
	const table = page.getByRole('grid', { name: 'People' })
	await page.getByRole('searchbox', { name: 'Search' }).fill('no such person')
	const empty = table.locator('tbody td')
	await expect(empty).toHaveText('No person matches the search.')
	const header = table.locator('thead th')

	await header.nth(2).focus()
	await page.keyboard.press('ArrowDown')
	await expect(empty).toBeFocused()
	await expect(empty.locator('xpath=..')).toHaveAttribute('aria-rowindex', '2')
	// The row is one wide cell, so the arrows to the side have no other cell to go to.
	await page.keyboard.press('ArrowRight')
	await expect(empty).toBeFocused()
	// The person came down the third column, and goes back up the same column.
	await page.keyboard.press('ArrowUp')
	await expect(header.nth(2)).toBeFocused()
})
