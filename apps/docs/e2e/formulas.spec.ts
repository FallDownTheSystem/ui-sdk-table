import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, query = '') {
	await page.goto(`/?page=formulas${query}`)
	const table = page
		.getByRole('grid', { name: 'Orders' })
		.or(page.getByRole('treegrid', { name: 'Orders' }))
	await expect(table).toBeVisible()
	return table
}

const dataRows = (table: Locator) => table.locator('tbody tr[data-kind="row"]')
const groupRows = (table: Locator) => table.locator('tbody tr[data-kind="group"]')
const cellOf = (row: Locator, id: string) => row.locator(`td[data-column="${id}"]`)
const number = (text: string) => Number(text.replace(/[^0-9.,-]/g, '').replace(',', '.'))
// A number as the page shows it in en-US, with a comma between the thousands.
const english = (text: string) => Number(text.replace(/,/g, ''))

/** The values of a column of every data row in the page, as numbers. */
async function column(table: Locator, id: string, read = english) {
	const texts = await dataRows(table).locator(`td[data-column="${id}"]`).allInnerTexts()
	return texts.map(read)
}

test('a column of a formula shows the product of its row, sorts, filters and adds up', async ({
	page,
}) => {
	const table = await open(page)
	await expect(dataRows(table)).toHaveCount(48)
	const prices = await column(table, 'price')
	const quantities = await column(table, 'qty')
	const totals = await column(table, 'total')
	totals.forEach((total, index) => {
		expect(total).toBeCloseTo((prices[index] ?? 0) * (quantities[index] ?? 0), 2)
	})

	// The footer sums the column.
	const sum = totals.reduce((all, value) => all + value, 0)
	expect(english(await table.locator('tfoot td[data-column="total"]').innerText())).toBeCloseTo(
		sum,
		1,
	)

	// A press on the header sorts by the computed value.
	await table.locator('thead th[data-column="total"]').getByRole('button').click()
	const sorted = await column(table, 'total')
	expect(sorted).toEqual([...totals].sort((a, b) => a - b))

	// A range filter reads the computed value.
	await page.getByTestId('total-min').fill('100')
	await page.getByTestId('total-max').fill('999.99')
	await page.getByTestId('total-max').press('Tab')
	const shown = await column(table, 'total')
	expect(shown.length).toBe(totals.filter((total) => total >= 100 && total <= 999.99).length)
	expect(shown.every((total) => total >= 100 && total <= 999.99)).toBe(true)
})

test('a group by a column of IFS gives three groups with their counts and totals', async ({
	page,
}) => {
	const table = await open(page)
	const totals = await column(table, 'total')
	const expected = {
		small: totals.filter((total) => total < 100),
		medium: totals.filter((total) => total >= 100 && total < 1000),
		large: totals.filter((total) => total >= 1000),
	}
	await page.getByTestId('grouping').selectOption('band')
	await expect(groupRows(table)).toHaveCount(3)
	for (const [band, values] of Object.entries(expected)) {
		const group = groupRows(table).filter({ hasText: band })
		await expect(group.getByRole('button')).toHaveText(`${band} (${values.length})`)
		const total = values.reduce((all, value) => all + value, 0)
		expect(english(await cellOf(group, 'total').innerText())).toBeCloseTo(total, 1)
	}
})

test('a new formula from the field changes the column, and a wrong one is refused with words', async ({
	page,
}) => {
	const table = await open(page)
	const field = page.getByTestId('formula')
	await expect(field).toHaveValue('=[Price]*[Quantity]')
	await field.fill('=ROUND([Price]*[Quantity]*1.24, 2)')
	await field.press('Enter')
	await expect(page.getByTestId('stored')).toHaveText('=ROUND([price]*[qty]*1.24, 2)')
	const prices = await column(table, 'price')
	const quantities = await column(table, 'qty')
	const totals = await column(table, 'total')
	expect(totals[0]).toBeCloseTo(Math.round((prices[0] ?? 0) * (quantities[0] ?? 0) * 124) / 100, 2)

	await field.fill('=[Pric]*2')
	await field.press('Enter')
	await expect(page.getByRole('alert')).toHaveText(
		'No column `Pric`. Columns: Product, Quantity, Price.',
	)
	await expect(page.getByTestId('stored')).toHaveText('=ROUND([price]*[qty]*1.24, 2)')
})

test('in fi-FI, a formula is typed with a decimal comma and `;`, and stored as in every locale', async ({
	page,
}) => {
	const table = await open(page, '&locale=fi-FI')
	const field = page.getByTestId('formula')
	await field.fill('=ROUND([Price]*[Quantity]*1,24; 2)')
	await field.press('Enter')
	await expect(page.getByTestId('issue')).toHaveText('')
	await expect(page.getByTestId('stored')).toHaveText('=ROUND([price]*[qty]*1.24, 2)')
	await expect(field).toHaveValue('=ROUND([Price]*[Quantity]*1,24; 2)')
	const finnish = (text: string) => number(text.replace(/\s/g, ''))
	const prices = await column(table, 'price', finnish)
	const quantities = await column(table, 'qty', finnish)
	const totals = await column(table, 'total', finnish)
	expect(totals[0]).toBeCloseTo(Math.round((prices[0] ?? 0) * (quantities[0] ?? 0) * 124) / 100, 2)

	await field.fill('=ROUND([Price]*1.24, 2)')
	await field.press('Enter')
	await expect(page.getByRole('alert')).toHaveText(
		'This language writes a decimal number with `,`, such as 1,5.',
	)
	await field.fill('=ROUND([Price]*1,24, 2)')
	await field.press('Enter')
	await expect(page.getByRole('alert')).toHaveText(
		'This language puts `;` between the values of a function, such as IF([a]>1; "yes"; "no").',
	)
})
