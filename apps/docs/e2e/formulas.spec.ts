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
	await table
		.locator('thead th:not([data-kind="letter"])[data-column="total"]')
		.getByRole('button')
		.click()
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
		'No column `Pric`. Columns: Product, Created, Quantity, Price.',
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

const spaces = (text: string) => text.replace(/[\s\u2009\u202f\u00a0]+/g, ' ').trim()
/** The labels of the groups in the page, without their counts, and the counts. */
async function groups(table: Locator) {
	const texts = (await groupRows(table).getByRole('button').allInnerTexts()).map(spaces)
	return texts.map((text) => {
		const found = /^(.*) \((\d+)\)$/.exec(text)
		return { label: found?.[1] ?? text, count: Number(found?.[2]) }
	})
}
/** The first day of the label of a week, such as `Nov 30 – Dec 6, 2026` or `Dec 29, 2025 – Jan 4, 2026`. */
function weekStart(label: string): Date {
	const [first = '', last = ''] = label.split(' – ')
	const year = /\d{4}$/.exec(last)?.[0] ?? ''
	return new Date(/\d{4}$/.test(first) ? first : `${first}, ${year}`)
}

async function groupByPeriod(page: Page, table: Locator, formula: string) {
	await page.getByTestId('period').selectOption(formula)
	await page.getByTestId('grouping').selectOption('period')
	// A sort by the column puts the groups in time order: a group keeps the order of its rows.
	await table
		.locator('thead th:not([data-kind="letter"])[data-column="period"]')
		.getByRole('button')
		.click()
	await expect(groupRows(table).first()).toBeVisible()
	return groups(table)
}

test('a group by WEEKOF starts each week on Sunday, and with type 2 on Monday, in time order', async ({
	page,
}) => {
	const table = await open(page)
	for (const [formula, weekday] of [
		['=WEEKOF([created])', 0],
		['=WEEKOF([created], 2)', 1],
	] as const) {
		const found = await groupByPeriod(page, table, formula)
		const starts = found.map((group) => weekStart(group.label))
		expect(starts.every((start) => start.getDay() === weekday)).toBe(true)
		const times = starts.map((start) => start.getTime())
		expect(times).toEqual([...times].sort((a, b) => a - b))
		expect(found.reduce((sum, group) => sum + group.count, 0)).toBe(48)
		// Back to no sort, so the next round sorts up again.
		await table
			.locator('thead th:not([data-kind="letter"])[data-column="period"]')
			.getByRole('button')
			.click()
		await table
			.locator('thead th:not([data-kind="letter"])[data-column="period"]')
			.getByRole('button')
			.click()
	}
})

test('a group by MONTHOF holds the orders of its month, and the other periods have their texts', async ({
	page,
}) => {
	const table = await open(page)
	const months = await groupByPeriod(page, table, '=MONTHOF([created])')
	expect(months.every((group) => /^[A-Z][a-z]+ \d{4}$/.test(group.label))).toBe(true)
	const times = months.map((group) => new Date(`1 ${group.label}`).getTime())
	expect(times).toEqual([...times].sort((a, b) => a - b))
	// Every order of the first group was created in that month, on the clock of Helsinki.
	const first = groupRows(table).first()
	await first.getByRole('button').click()
	const [name = '', year = ''] = months[0]?.label.split(' ') ?? []
	const created = await dataRows(table).locator('td[data-column="created"]').allInnerTexts()
	expect(created).toHaveLength(months[0]?.count ?? 0)
	for (const text of created)
		expect(text).toMatch(new RegExp(`^${name.slice(0, 3)} \\d+, ${year},`))
	await first.getByRole('button').click()

	const patterns: [string, RegExp][] = [
		['=QUARTEROF([created])', /^Q[1-4] \d{4}$/],
		['=YEAROF([created])', /^\d{4}$/],
		['=DAYOF([created])', /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/],
		['=HOUROF([created])', /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:00 [AP]M$/],
	]
	for (const [formula, pattern] of patterns) {
		await table
			.locator('thead th:not([data-kind="letter"])[data-column="period"]')
			.getByRole('button')
			.click()
		await table
			.locator('thead th:not([data-kind="letter"])[data-column="period"]')
			.getByRole('button')
			.click()
		const found = await groupByPeriod(page, table, formula)
		expect(found.every((group) => pattern.test(group.label))).toBe(true)
		expect(found.reduce((sum, group) => sum + group.count, 0)).toBe(48)
	}
	expect((await groups(table)).map((group) => group.label)).toContain('Dec 1, 2026, 12:00 AM')
})

test('busy days: a group by WEEKDAY with type 2 gives the days from Monday to Sunday', async ({
	page,
}) => {
	const table = await open(page)
	const found = await groupByPeriod(page, table, '=WEEKDAY([created], 2)')
	const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
	expect(found.map((group) => group.label)).toEqual(
		week.filter((day) => found.some((group) => group.label === day)),
	)
	expect(found.reduce((sum, group) => sum + group.count, 0)).toBe(48)
})

test('a date range filter on the week column keeps the weeks that start in the range', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByTestId('period').selectOption('=WEEKOF([created], 2)')
	await page.getByTestId('period-from').fill('2026-03-01')
	await page.getByTestId('period-to').fill('2026-05-31')
	await page.getByTestId('period-to').press('Tab')
	const labels = (await dataRows(table).locator('td[data-column="period"]').allInnerTexts()).map(
		spaces,
	)
	expect(labels.length).toBeGreaterThan(0)
	expect(labels.length).toBeLessThan(48)
	for (const label of labels) {
		const start = weekStart(label).getTime()
		expect(start).toBeGreaterThanOrEqual(new Date(2026, 2, 1).getTime())
		expect(start).toBeLessThanOrEqual(new Date(2026, 4, 31).getTime())
	}
})

test.describe('in a browser in New York', () => {
	test.use({ timezoneId: 'America/New_York' })

	test('an order at 00:30 on the first of December in Helsinki is in December', async ({
		page,
	}) => {
		const table = await open(page)
		await page.getByTestId('period').selectOption('=MONTHOF([created])')
		const row = dataRows(table).filter({ hasText: 'Dec 1, 2026, 12:30 AM' })
		await expect(row).toHaveCount(1)
		await expect(cellOf(row, 'period')).toHaveText('December 2026')
		// The computer is in New York, where that moment is still the 30th of November.
		expect(await page.evaluate(() => new Date(Date.UTC(2026, 10, 30, 22, 30)).getDate())).toBe(30)
	})
})

test('a formula of a column that the table holds: set it, group by it, change it, and Control+Z brings the first one back', async ({
	page,
}) => {
	const table = await open(page)
	const field = page.getByTestId('custom-formula')
	const quantities = await column(table, 'qty')
	await expect(
		table.locator('thead th:not([data-kind="letter"])[data-column="custom"]'),
	).toHaveAttribute('data-formula-column', '')
	expect(await column(table, 'custom')).toEqual(quantities.map((qty) => qty * 2))

	await field.fill('=IF([Quantity]>20, "many", "few")')
	await field.press('Enter')
	await expect(page.getByTestId('custom-stored')).toHaveText('=IF([qty]>20, "many", "few")')
	await page.getByTestId('grouping').selectOption('custom')
	await expect(groupRows(table)).toHaveCount(2)
	const many = quantities.filter((qty) => qty > 20).length
	await expect(groupRows(table).filter({ hasText: 'many' }).getByRole('button')).toHaveText(
		`many (${many})`,
	)
	await expect(groupRows(table).filter({ hasText: 'few' }).getByRole('button')).toHaveText(
		`few (${quantities.length - many})`,
	)

	await field.fill('=IF([Quantity]>30, "many", "few")')
	await field.press('Enter')
	await expect(groupRows(table).filter({ hasText: 'many' }).getByRole('button')).toHaveText(
		`many (${quantities.filter((qty) => qty > 30).length})`,
	)

	// The key acts on a cell of the table, and takes the last change of the formula back.
	await page.getByTestId('grouping').selectOption('none')
	await cellOf(dataRows(table).first(), 'product').click()
	await page.keyboard.press('Control+z')
	await expect(page.getByTestId('custom-stored')).toHaveText('=IF([qty]>20, "many", "few")')
	await page.keyboard.press('Control+z')
	await expect(page.getByTestId('custom-stored')).toHaveText('=[qty]*2')
	expect(await column(table, 'custom')).toEqual(quantities.map((qty) => qty * 2))
	await page.keyboard.press('Control+Shift+z')
	await expect(page.getByTestId('custom-stored')).toHaveText('=IF([qty]>20, "many", "few")')

	// A formula that reads its own column is refused with words, and nothing changes.
	await field.fill('=[Custom]+1')
	await field.press('Enter')
	await expect(page.getByTestId('custom-issue')).toContainText('reads that column itself')
	await expect(page.getByTestId('custom-stored')).toHaveText('=IF([qty]>20, "many", "few")')
})

test('the gutter shows the numbers of the document after a sort, and the letters stay with their columns', async ({
	page,
}) => {
	const table = await open(page)
	const numbers = () => dataRows(table).locator('th[data-row-header]').allInnerTexts()
	const first = await numbers()
	expect(first.slice(0, 3)).toEqual(['1', '2', '3'])
	const products = await dataRows(table).locator('td[data-column="product"]').allInnerTexts()

	// After a sort the numbers read out of order, and each row keeps its number.
	await table
		.locator('thead th:not([data-kind="letter"])[data-column="price"]')
		.getByRole('button')
		.click()
	const sorted = await numbers()
	expect(sorted).not.toEqual(first)
	expect([...sorted].sort((a, b) => Number(a) - Number(b))).toEqual(first)
	const after = await dataRows(table).locator('td[data-column="product"]').allInnerTexts()
	sorted.forEach((number, index) => expect(after[index]).toBe(products[Number(number) - 1]))
	await expect(dataRows(table).first().locator('th[data-row-header]')).toHaveAttribute(
		'aria-label',
		`Row ${sorted[0]}`,
	)

	// A filter leaves gaps in the numbers.
	await page.getByTestId('total-min').fill('500')
	await page.getByTestId('total-min').press('Tab')
	const filtered = (await numbers()).map(Number)
	expect(filtered.length).toBeLessThan(first.length)
	expect(Math.max(...filtered)).toBeGreaterThan(filtered.length)

	const letters = () =>
		table.locator('thead th[data-kind="letter"]:not([data-lead])').allInnerTexts()
	expect(await letters()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
	// A hidden column leaves a gap, and a moved column keeps its letter.
	await page.getByTestId('hide-qty').click()
	expect(await letters()).toEqual(['A', 'B', 'D', 'E', 'F', 'G', 'H'])
	await page.getByTestId('hide-qty').click()
	await page.getByTestId('move-total').click()
	expect(await letters()).toEqual(['A', 'E', 'B', 'C', 'D', 'F', 'G', 'H'])
})
