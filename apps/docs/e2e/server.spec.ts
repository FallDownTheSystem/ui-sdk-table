import { expect, test, type Page } from '@playwright/test'

const open = async (page: Page, delay = 50) => {
	await page.goto(`/?page=server&delay=${delay}`)
	const table = page.getByRole('grid', { name: 'People' })
	await expect(page.getByTestId('status')).toHaveText('Ready')
	return table
}

const column = (page: Page, index: number) =>
	page.getByRole('grid', { name: 'People' }).locator(`tbody tr > td:nth-child(${index})`)

test('the first rows load, and the pages come from the count of the server', async ({ page }) => {
	const table = await open(page)
	await expect(table.locator('tbody tr')).toHaveCount(25)
	await expect(page.getByTestId('page')).toHaveText('Page 1 of 400')
	await expect(page.getByTestId('total')).toHaveText('10,000 people')
	await expect(page.getByTestId('requests')).toHaveText('1 requests')
	await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()

	const first = await column(page, 1).first().innerText()
	await page.getByRole('button', { name: 'Next page' }).click()
	await expect(page.getByTestId('page')).toHaveText('Page 2 of 400')
	await expect(page.getByTestId('status')).toHaveText('Ready')
	await expect(page.getByTestId('requests')).toHaveText('2 requests')
	await expect(table.locator('tbody tr')).toHaveCount(25)
	expect(await table.locator('tbody tr').first().getAttribute('aria-rowindex')).toBe('2')
	expect(await page.locator('tbody tr').first().innerText()).not.toContain(`${first}\t`)

	await page.getByRole('button', { name: 'Last page' }).click()
	await expect(page.getByTestId('page')).toHaveText('Page 400 of 400')
	await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test('a click on a header asks the server for the sort', async ({ page }) => {
	const table = await open(page)
	const header = table.getByRole('columnheader', { name: 'Score' })
	await header.getByRole('button').click()
	await expect(header).toHaveAttribute('aria-sort', 'ascending')
	await expect(page.getByTestId('status')).toHaveText('Ready')
	await expect(page.getByTestId('requests')).toHaveText('2 requests')
	const up = (await column(page, 4).allInnerTexts()).map(Number)
	expect(up).toEqual([...up].sort((a, b) => a - b))
	expect(up[0]).toBeLessThan(1)

	// The keyboard asks the same way: Enter on the header cell.
	await header.focus()
	await page.keyboard.press('Enter')
	await expect(header).toHaveAttribute('aria-sort', 'descending')
	await expect(page.getByTestId('status')).toHaveText('Ready')
	const down = (await column(page, 4).allInnerTexts()).map(Number)
	expect(down).toEqual([...down].sort((a, b) => b - a))
	expect(down[0]).toBeGreaterThan(99)
})

test('a search and a filter go to the server, and start on the first page', async ({ page }) => {
	const table = await open(page)
	await page.getByRole('button', { name: 'Next page' }).click()
	await expect(page.getByTestId('page')).toHaveText('Page 2 of 400')

	await page.getByRole('searchbox', { name: 'Search' }).fill('Aino Aalto')
	await expect(page.getByTestId('status')).toHaveText('Ready')
	await expect(page.getByTestId('page')).toHaveText(/^Page 1 of \d$/)
	const names = await column(page, 1).allInnerTexts()
	expect(names.length).toBeGreaterThan(0)
	expect(names.every((name) => name === 'Aino Aalto')).toBe(true)
	const found = await page.getByTestId('total').innerText()

	await page.getByRole('combobox', { name: 'Team' }).selectOption('Design')
	await expect(page.getByTestId('status')).toHaveText('Ready')
	await expect(page.getByTestId('total')).not.toHaveText(found)
	expect(new Set(await column(page, 2).allInnerTexts())).toEqual(new Set(['Design']))

	await page.getByRole('searchbox', { name: 'Search' }).fill('no such person')
	await expect(table.locator('tbody')).toHaveText('No person matches.')
	await expect(page.getByTestId('page')).toHaveText('Page 1 of 1')
})

test('while rows load, the table is busy and keeps its rows; a late answer does not win', async ({
	page,
}) => {
	const table = await open(page, 700)
	const before = await column(page, 1).allInnerTexts()
	await page.getByRole('button', { name: 'Next page' }).click()
	await expect(table).toHaveAttribute('aria-busy', 'true')
	await expect(table).toHaveAttribute('data-loading', '')
	// The rows of the old page stay in view until the answer comes.
	expect(await column(page, 1).allInnerTexts()).toEqual(before)
	await expect(table).not.toHaveAttribute('aria-busy', 'true')
	expect(await column(page, 1).allInnerTexts()).not.toEqual(before)

	// Two searches, the second before the first answer: only the second shows.
	const search = page.getByRole('searchbox', { name: 'Search' })
	await search.fill('Design')
	await search.fill('Väinö Virtanen')
	await expect(page.getByTestId('status')).toHaveText('Ready')
	await page.waitForTimeout(800)
	const names = await column(page, 1).allInnerTexts()
	expect(names.every((name) => name === 'Väinö Virtanen')).toBe(true)
})

test('the first load says so in the body', async ({ page }) => {
	await page.goto('/?page=server&delay=600')
	const table = page.getByRole('grid', { name: 'People' })
	await expect(table).toHaveAttribute('aria-busy', 'true')
	await expect(table.locator('tbody')).toHaveText('Loading rows.')
	// The row that says so is a row of the grid. Focus on it goes to the rows when they come.
	await table.locator('thead th').first().focus()
	await page.keyboard.press('ArrowDown')
	await expect(table.locator('tbody td')).toBeFocused()
	await expect(table.locator('tbody tr')).toHaveCount(25)
	await expect(table.locator('tbody tr').first().locator('td').first()).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(table.locator('tbody tr').nth(1).locator('td').first()).toBeFocused()
})

test('the CSV file and the Excel file hold the rows as the screen shows them', async ({ page }) => {
	// The files are caught in the page, where a browser test can read them.
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
	await table.getByRole('columnheader', { name: 'Score' }).getByRole('button').click()
	await expect(page.getByTestId('status')).toHaveText('Ready')

	const screen = await table
		.locator('tbody tr')
		.evaluateAll((rows) =>
			rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')),
		)
	expect(screen).toHaveLength(25)

	const csvDownload = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Export CSV' }).click()
	expect((await csvDownload).suggestedFilename()).toBe('people.csv')
	const csv = await page.evaluate(() =>
		(window as unknown as { exported: Blob[] }).exported[0]?.text(),
	)
	const quote = (text: string) => (text.includes(',') ? `"${text}"` : text)
	expect(csv?.split('\r\n')).toEqual([
		'Name,Team,Country,Score,Joined',
		...screen.map((cells) => cells.map(quote).join(',')),
		'',
	])

	const xlsxDownload = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Export Excel' }).click()
	expect((await xlsxDownload).suggestedFilename()).toBe('people.xlsx')
	const sheet = await page.evaluate(async () => {
		const blob = (window as unknown as { exported: Blob[] }).exported[1]
		if (!blob) return null
		const bytes = new Uint8Array(await blob.arrayBuffer())
		const view = new DataView(bytes.buffer)
		const end = bytes.length - 22
		let at = view.getUint32(end + 16, true)
		const methods: number[] = []
		for (let index = 0; index < view.getUint16(end + 10, true); index++) {
			const method = view.getUint16(at + 10, true)
			const packed = view.getUint32(at + 20, true)
			const nameLength = view.getUint16(at + 28, true)
			const local = view.getUint32(at + 42, true)
			const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
			methods.push(method)
			if (name === 'xl/worksheets/sheet1.xml') {
				const start = local + 30 + nameLength
				const body = bytes.subarray(start, start + packed)
				const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
				return { type: blob.type, methods, xml: await new Response(stream).text() }
			}
			at += 46 + nameLength
		}
		return null
	})
	expect(sheet?.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
	// The browser can deflate, so the sheet is deflated.
	expect(sheet?.methods.at(-1)).toBe(8)
	const xml = sheet?.xml ?? ''
	expect(xml.match(/<row /g)).toHaveLength(26)
	// The first row of the screen: its name is a text, its score a number, its day a date.
	const first = screen[0] ?? []
	expect(xml).toContain(
		`<c r="A2" t="inlineStr"><is><t xml:space="preserve">${first[0]}</t></is></c>`,
	)
	const score = /<c r="D2" s="\d+"><v>([^<]+)<\/v><\/c>/.exec(xml)?.[1]
	expect(Number(score).toFixed(2)).toBe(first[3])
	const day = Number(/<c r="E2" s="\d+"><v>([^<]+)<\/v><\/c>/.exec(xml)?.[1])
	const shown = new Date((day - 25569) * 86_400_000).toLocaleDateString('en-US', {
		dateStyle: 'medium',
		timeZone: 'UTC',
	})
	expect(shown).toBe(first[4])
})
