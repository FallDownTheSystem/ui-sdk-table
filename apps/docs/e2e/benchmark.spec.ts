import { expect, test } from '@playwright/test'

test('the table sorts, searches and pages 50,000 rows', async ({ page }) => {
	await page.goto('/')

	const table = page.getByRole('grid', { name: 'People' })
	await expect(table).toHaveAttribute('data-slot', 'table')
	// One header row and one page of 25 rows.
	await expect(table).toHaveAttribute('aria-rowcount', '26')
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
	await page.goto('/')
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

test('groups open and close, and a group row is one wide cell', async ({ page }) => {
	await page.goto('/')
	const table = page.getByRole('treegrid', { name: 'People' })

	await page.getByRole('checkbox', { name: 'Group by team' }).check()
	await expect(table.locator('tbody tr')).toHaveCount(5)
	const billing = table.locator('tbody tr').first()
	await expect(billing).toHaveAttribute('aria-expanded', 'false')
	await expect(billing).toHaveAttribute('aria-level', '1')

	await billing.getByRole('gridcell').focus()
	await page.keyboard.press('Enter')
	await expect(billing).toHaveAttribute('aria-expanded', 'true')
	await expect(table.locator('tbody tr').nth(1)).toHaveAttribute('aria-level', '2')

	// From the wide group cell, the arrow keys still reach the rows below and the header above.
	await page.keyboard.press('ArrowDown')
	await expect(table.locator('tbody tr').nth(1).getByRole('gridcell').first()).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(billing.getByRole('gridcell')).toBeFocused()
})
