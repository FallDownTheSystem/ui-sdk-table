import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, query = '') {
	await page.goto(`/?page=groups${query}`)
	const table = page.getByRole('treegrid', { name: 'People in groups' })
	await expect(table).toBeVisible()
	return table
}

const header = (table: Locator, id: string) => table.locator(`thead th[data-column="${id}"]`)
const groupRows = (table: Locator) => table.locator('tbody tr[data-kind="group"]')
const dataRows = (table: Locator) => table.locator('tbody tr[data-kind="row"]')
const cellOf = (row: Locator, id: string) => row.locator(`td[data-column="${id}"]`)
const foot = (table: Locator, id: string) => table.locator(`tfoot td[data-column="${id}"]`)
const number = async (cell: Locator) => Number((await cell.innerText()).replace(/[^0-9.-]/g, ''))
const headers = (table: Locator) =>
	table
		.locator('thead th')
		.evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-column')))

async function span(cell: Locator) {
	const box = await cell.boundingBox()
	if (!box) throw new Error('The cell is not on the page.')
	return { left: Math.round(box.x), right: Math.round(box.x + box.width) }
}

/** Whether each total of the first group row is under its header and over its footer total. */
async function expectTotalsUnderHeaders(table: Locator) {
	const row = groupRows(table).first()
	for (const id of ['score', 'bonus']) {
		const head = await span(header(table, id))
		expect(await span(cellOf(row, id)), `the group total of ${id}`).toEqual(head)
		expect(await span(foot(table, id)), `the footer total of ${id}`).toEqual(head)
	}
}

test('a group row shows each total under its header, and the totals add up', async ({ page }) => {
	const table = await open(page)
	const first = groupRows(table).first()
	await expect(groupRows(table)).toHaveCount(5)

	// The label covers the columns before the first total: pick, name, team and country.
	const label = first.locator('td').first()
	await expect(label).toHaveAttribute('data-kind', 'group-label')
	await expect(label).toHaveAttribute('colspan', '4')
	await expect(first.locator('td')).toHaveCount(4)
	await expect(cellOf(first, 'score')).toHaveAttribute('data-kind', 'group-total')
	await expect(cellOf(first, 'score')).toHaveAttribute('aria-colindex', '5')
	await expect(cellOf(first, 'joined')).toHaveAttribute('data-kind', 'group-blank')
	await expect(cellOf(first, 'joined')).toHaveText('')
	await expect(cellOf(first, 'bonus')).toHaveAttribute('aria-colindex', '7')
	await expectTotalsUnderHeaders(table)

	// The total of a group is the sum of its rows, and the footer is the sum of the groups.
	await first.getByRole('button').click()
	await expect(first).toHaveAttribute('aria-expanded', 'true')
	const count = Number(/\((\d+)\)/.exec(await label.innerText())?.[1])
	await expect(dataRows(table)).toHaveCount(count)
	let sum = 0
	for (const row of await dataRows(table).all()) sum += await number(cellOf(row, 'score'))
	expect(await number(cellOf(first, 'score'))).toBeCloseTo(sum, 2)
	let all = 0
	for (const row of await groupRows(table).all()) all += await number(cellOf(row, 'score'))
	expect(await number(foot(table, 'score'))).toBeCloseTo(all, 2)
	// The slot of a total cell and the slot of the footer show the same kind of text.
	await expect(cellOf(first, 'bonus')).toHaveText(/^avg \d+$/)
	await expect(foot(table, 'bonus')).toHaveText(/^avg \d+$/)

	// Without the option, a group row is one cell as wide as the table.
	await page.getByRole('checkbox', { name: 'Totals under their columns' }).uncheck()
	await expect(first.locator('td')).toHaveCount(1)
	await expect(first.locator('td')).toHaveAttribute('colspan', '7')
})

test('the totals stay under their headers with pinned columns, in right-to-left text, after a move and in the row window', async ({
	page,
}) => {
	const table = await open(page)
	const scroller = page.getByTestId('scroller')
	const first = groupRows(table).first()
	const label = first.locator('td').first()

	await page.getByRole('button', { name: 'Pin name to the start' }).click()
	await page.getByRole('button', { name: 'Pin bonus to the end' }).click()
	await page.getByRole('checkbox', { name: 'Narrow frame' }).check()
	// The label is the pinned part of the row: the column that leads and the name.
	await expect(label).toHaveAttribute('colspan', '2')
	await expect(label).toHaveAttribute('data-pinned', 'start')
	await expect(cellOf(first, 'bonus')).toHaveAttribute('data-pinned', 'end')
	await expect(cellOf(first, 'team')).toHaveAttribute('data-kind', 'group-blank')
	const before = await span(label)
	await scroller.evaluate((el) => (el.scrollLeft = 150))
	expect(await span(label)).toEqual(before)
	expect((await span(label)).right).toBe((await span(header(table, 'name'))).right)
	await expectTotalsUnderHeaders(table)
	// The total of the score scrolled with its column, and the label covers what went under it.
	expect((await span(cellOf(first, 'team'))).left).toBeLessThan(before.right)
	expect(
		await label.evaluate((cell) => {
			const box = cell.getBoundingClientRect()
			return cell.contains(document.elementFromPoint(box.right - 4, box.y + box.height / 2))
		}),
	).toBe(true)

	await page.getByRole('checkbox', { name: 'Right to left' }).check()
	await scroller.evaluate((el) => (el.scrollLeft = -150))
	const frame = await span(scroller)
	// The start is the right edge now.
	expect((await span(label)).right).toBe(frame.right - 1)
	expect((await span(cellOf(first, 'bonus'))).left).toBe(frame.left + 1)
	await expectTotalsUnderHeaders(table)
	await page.getByRole('checkbox', { name: 'Right to left' }).uncheck()
	await page.getByRole('checkbox', { name: 'Narrow frame' }).uncheck()
	await page.getByRole('button', { name: 'Pin name to the start' }).click()
	await page.getByRole('button', { name: 'Pin bonus to the end' }).click()
	await expect(label).toHaveAttribute('colspan', '4')

	// A column with a total that comes first is under the label, and the label says its total.
	await page.getByRole('button', { name: 'Move score first' }).click()
	expect(await headers(table)).toEqual([
		'pick',
		'score',
		'name',
		'team',
		'country',
		'joined',
		'bonus',
	])
	// The label goes on to the next total: over the name, the team, the country and the day.
	await expect(label).toHaveAttribute('colspan', '6')
	await expect(label.locator('.covered-total')).toHaveText(/^Score [\d,.]+$/)
	await expect(first.locator('td')).toHaveCount(2)
	expect((await span(cellOf(first, 'bonus'))).left).toBe((await span(header(table, 'bonus'))).left)

	// A hidden column takes its place out of the label.
	await page.getByRole('button', { name: 'Hide team' }).click()
	await expect(label).toHaveAttribute('colspan', '5')

	await page.reload()
	await page.getByRole('checkbox', { name: 'Row window' }).check()
	await page.getByRole('button', { name: 'Open all groups' }).click()
	await expect(table).toHaveAttribute('data-row-window', '')
	await expectTotalsUnderHeaders(table)
	await scroller.evaluate((el) => (el.scrollTop = 900))
	await expect(groupRows(table).first()).toBeVisible()
	await expectTotalsUnderHeaders(table)
	// The header and the footer stay in view, and the totals of the footer are still under the headers.
	const box = await scroller.boundingBox()
	const top = await header(table, 'score').boundingBox()
	const bottom = await foot(table, 'score').boundingBox()
	expect(Math.round(top?.y ?? 0)).toBe(Math.round(box?.y ?? 0) + 1)
	expect(Math.round((bottom?.y ?? 0) + (bottom?.height ?? 0))).toBe(
		Math.round((box?.y ?? 0) + (box?.height ?? 0)) - 1,
	)
})

test('the arrow keys cross the cells of a group row, Enter opens the group and Space selects its rows', async ({
	page,
}) => {
	const table = await open(page)
	const first = groupRows(table).first()
	const label = first.locator('td').first()
	const selected = page.getByTestId('selected')
	const count = Number(/\((\d+)\)/.exec(await label.innerText())?.[1])

	await header(table, 'pick').focus()
	await page.keyboard.press('ArrowDown')
	await expect(label).toBeFocused()
	await page.keyboard.press('ArrowRight')
	await expect(cellOf(first, 'score')).toBeFocused()
	await page.keyboard.press('ArrowRight')
	await expect(cellOf(first, 'joined')).toBeFocused()
	await page.keyboard.press('End')
	await expect(cellOf(first, 'bonus')).toBeFocused()

	// Space on a cell of a group row is the choice of the rows of the group.
	await page.keyboard.press('Space')
	await expect(selected).toHaveText(`${count} selected`)
	await expect(cellOf(first, 'bonus')).toBeFocused()
	await page.keyboard.press('Space')
	await expect(selected).toHaveText('0 selected')
	await page.keyboard.press('Home')
	await expect(label).toBeFocused()
	await page.keyboard.press('Space')
	await expect(selected).toHaveText(`${count} selected`)

	// Enter is the button of the group, from every cell of its row.
	await page.keyboard.press('Enter')
	await expect(first).toHaveAttribute('aria-expanded', 'true')
	await expect(label).toBeFocused()
	await expect(table.locator('tbody tr[aria-selected="true"]')).toHaveCount(count)
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('ArrowDown')
	await expect(cellOf(dataRows(table).first(), 'score')).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(cellOf(first, 'score')).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(first).toHaveAttribute('aria-expanded', 'false')
	await expect(cellOf(first, 'score')).toBeFocused()

	// From the label, F2 goes to its button and Escape comes back.
	await page.keyboard.press('Home')
	await page.keyboard.press('F2')
	await expect(first.getByRole('button')).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(label).toBeFocused()
	// The table is one stop in the tab order.
	await expect(table.locator('[data-slot="table-cell"][tabindex="0"]')).toHaveCount(1)
})

test('a column that leads the table stays first, and sticks with the first column pinned to the start', async ({
	page,
}) => {
	const table = await open(page)
	const scroller = page.getByTestId('scroller')
	await page.getByRole('button', { name: 'Open all groups' }).click()
	const row = dataRows(table).first()
	const pick = cellOf(row, 'pick')
	const name = cellOf(row, 'name')
	await page.getByRole('checkbox', { name: 'Narrow frame' }).check()

	// Nothing is pinned: the column scrolls with the others.
	await expect(pick).not.toHaveAttribute('data-pinned')
	const before = await span(pick)
	await scroller.evaluate((el) => (el.scrollLeft = 100))
	expect((await span(pick)).left).toBe(before.left - 100)
	await scroller.evaluate((el) => (el.scrollLeft = 0))

	await page.getByRole('button', { name: 'Pin name to the start' }).click()
	await expect(pick).toHaveAttribute('data-pinned', 'start')
	await expect(header(table, 'pick')).toHaveAttribute('data-pinned', 'start')
	await scroller.evaluate((el) => (el.scrollLeft = 100))
	expect(await span(pick)).toEqual(before)
	// The pinned column comes right after it, and only that one has the edge line.
	expect((await span(name)).left).toBe(before.right)
	await expect(name).toHaveAttribute('data-pinned-edge', '')
	await expect(pick).not.toHaveAttribute('data-pinned-edge')

	// A move of another column to the first place leaves it first: with a pin, and without one.
	await page.getByRole('button', { name: 'Move score first' }).click()
	expect((await headers(table)).slice(0, 3)).toEqual(['pick', 'name', 'score'])
	await page.getByRole('button', { name: 'Pin name to the start' }).click()
	await expect(pick).not.toHaveAttribute('data-pinned')
	await page.getByRole('button', { name: 'Move score first' }).click()
	expect((await headers(table)).slice(0, 3)).toEqual(['pick', 'score', 'name'])
})

test('attributes of the caller reach a row, and never take the place of what the table sets', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('button', { name: 'Open all groups' }).click()
	const low = table.locator('tbody tr.low').first()
	await expect(low).toBeVisible()
	// The function of the page also asked for `aria-selected`, `data-kind` and `index`.
	await expect(low).toHaveAttribute('aria-selected', 'false')
	await expect(low).toHaveAttribute('data-kind', 'row')
	await expect(low).not.toHaveAttribute('index')
	const index = Number(await low.getAttribute('aria-rowindex'))
	expect(index).toBeGreaterThan(2)
	const before = low.locator('xpath=preceding-sibling::tr[1]')
	await expect(before).toHaveAttribute('aria-rowindex', String(index - 1))
	// The row is selected when the person selects it, and not before.
	await low.getByRole('checkbox').check()
	await expect(low).toHaveAttribute('aria-selected', 'true')
	await expect(low).toHaveClass(/low/)
})

test('the choices of a filter follow the search and the other filters, and never the filter itself', async ({
	page,
}) => {
	await open(page)
	const team = page.getByTestId('facet-team')
	const country = page.getByTestId('facet-country')
	const score = page.getByTestId('facet-score')
	const joined = page.getByTestId('facet-joined')
	const found = page.getByTestId('found')
	const labels = async (group: Locator) =>
		(await group.locator('label').allInnerTexts()).map((text) => text.trim())
	const counts = async (group: Locator) =>
		(await labels(group)).map((text) => Number(/\((\d+)\)/.exec(text)?.[1]))
	const sum = (list: number[]) => list.reduce((total, value) => total + value, 0)

	const teams = await labels(team)
	expect(teams).toHaveLength(5)
	expect(sum(await counts(team))).toBe(60)
	expect(sum(await counts(country))).toBe(60)
	const allScores = await score.getByLabel('From').getAttribute('placeholder')
	// The step of the field is the step of the format: two digits.
	await expect(score.getByLabel('From')).toHaveAttribute('step', '0.01')

	await team.getByRole('checkbox', { name: /^Design/ }).check()
	await expect(found).toHaveText('12 people')
	// The filter on the team took none of its own choices, and no count of them.
	expect(await labels(team)).toEqual(teams)
	// The countries count the 12 people of Design now.
	expect(sum(await counts(country))).toBe(12)
	expect(await score.getByLabel('From').getAttribute('placeholder')).not.toBe(allScores)
	const firstDay = await joined.getByLabel('First day').getAttribute('min')
	expect(firstDay).toMatch(/^\d{4}-\d{2}-\d{2}$/)

	// A second filter counts for the team, and not for itself.
	const estonia = (await labels(country)).find((text) => text.startsWith('Estonia'))
	const inEstonia = Number(/\((\d+)\)/.exec(estonia ?? '')?.[1])
	await country.getByRole('checkbox', { name: /^Estonia/ }).check()
	await expect(found).toHaveText(`${inEstonia} people`)
	expect(sum(await counts(country))).toBe(12)
	expect(sum(await counts(team))).toBeLessThan(60)
	await expect(team.getByRole('checkbox', { name: /^Design/ })).toBeChecked()
	expect((await labels(team)).find((text) => text.startsWith('Design'))).toBe(
		`Design (${inEstonia})`,
	)

	// A range of numbers and a range of days filter the rows, and the lists follow.
	await score.getByLabel('From').fill('60')
	await score.getByLabel('From').press('Tab')
	const high = Number((await found.innerText()).split(' ')[0])
	expect(high).toBeLessThan(inEstonia)
	expect((await labels(team)).find((text) => text.startsWith('Design'))).toBe(`Design (${high})`)
	// The range itself still shows the ends of all its rows.
	expect(Number(await score.getByLabel('From').getAttribute('min'))).toBeLessThan(60)

	// A chosen value that no row holds any more stays in its list, with no row.
	await page.getByRole('searchbox', { name: 'Search' }).fill('zzz')
	await expect(found).toHaveText('0 people')
	expect(await labels(team)).toEqual(['Design (0)'])
	await expect(team.getByRole('checkbox', { name: /^Design/ })).toBeChecked()

	await page.getByRole('button', { name: 'Clear all filters' }).click()
	await expect(found).toHaveText('60 people')
	expect(await labels(team)).toEqual(teams)
	await expect(team.getByRole('checkbox', { name: /^Design/ })).not.toBeChecked()
})

test('the search field shows each letter at once, and the table filters once after the pause', async ({
	page,
}) => {
	const table = await open(page, '&debounce=500')
	const field = page.getByRole('searchbox', { name: 'Search' })
	const state = page.getByTestId('search-state')
	const changes = page.getByTestId('filter-changes')
	const found = page.getByTestId('found')

	// How often the text of the status region changes: each change is said to a screen reader.
	await found.evaluate((region) => {
		const page = window as unknown as { said: number }
		page.said = 0
		new MutationObserver(() => page.said++).observe(region, {
			characterData: true,
			childList: true,
			subtree: true,
		})
	})
	const said = () => page.evaluate(() => (window as unknown as { said: number }).said)

	await field.pressSequentially('saara', { delay: 20 })
	await expect(field).toHaveValue('saara')
	await expect(state).toHaveText('Waiting')
	await expect(changes).toHaveText('0 filter changes')
	await expect(found).toHaveText('60 people')
	// After the pause: one change of the filter for the five letters.
	await expect(state).toHaveText('Ready')
	await expect(changes).toHaveText('1 filter changes')
	await expect(found).not.toHaveText('60 people')
	await expect(field).toHaveValue('saara')
	await expect(field).toBeFocused()
	// One announcement for the five letters, after the pause.
	expect(await said()).toBe(1)
	await page.getByRole('button', { name: 'Open all groups' }).click()
	for (const name of await dataRows(table).locator('td[data-column="name"]').allInnerTexts()) {
		expect(name).toContain('Jack')
	}

	// Escape empties the field and the search at once, and the text that waited never filters.
	await field.focus()
	await field.pressSequentially(' la', { delay: 20 })
	await expect(state).toHaveText('Waiting')
	await page.keyboard.press('Escape')
	await expect(field).toHaveValue('')
	await expect(state).toHaveText('Ready')
	await expect(found).toHaveText('60 people')
	await expect(changes).toHaveText('2 filter changes')
	await expect(field).toBeFocused()
	await page.waitForTimeout(700)
	await expect(changes).toHaveText('2 filter changes')

	// Enter does not wait for the pause.
	await field.pressSequentially('eero', { delay: 20 })
	await page.keyboard.press('Enter')
	await expect(state).toHaveText('Ready')
	await expect(changes).toHaveText('3 filter changes')
	await page.waitForTimeout(700)
	await expect(changes).toHaveText('3 filter changes')

	// "Clear all filters" wins over a text that waits.
	await field.pressSequentially(' k', { delay: 20 })
	await expect(state).toHaveText('Waiting')
	await page.getByRole('button', { name: 'Clear all filters' }).click()
	await expect(field).toHaveValue('')
	await expect(state).toHaveText('Ready')
	await expect(found).toHaveText('60 people')
	await page.waitForTimeout(700)
	await expect(changes).toHaveText('4 filter changes')
	await expect(field).toHaveValue('')

	// The clear button acts at once too.
	await field.pressSequentially('onni', { delay: 20 })
	await page.getByRole('button', { name: 'Clear the search' }).click()
	await expect(field).toHaveValue('')
	await expect(state).toHaveText('Ready')
	await page.waitForTimeout(700)
	await expect(changes).toHaveText('4 filter changes')
})

test('a press on a header sorts in the mode of the table, with each modifier key and from the keyboard', async ({
	page,
}) => {
	const table = await open(page)
	const sort = page.getByTestId('sort')
	const mode = page.getByRole('combobox', { name: 'Sort with several columns' })
	const button = (id: string) => header(table, id).getByRole('button')

	// `modifier`: a press replaces the sort, and Shift, Control or Command adds a column.
	await expect(mode).toHaveValue('modifier')
	await button('name').click()
	await expect(sort).toHaveText('name asc')
	await button('team').click({ modifiers: ['Shift'] })
	await expect(sort).toHaveText('name asc, team asc')
	await button('country').click({ modifiers: ['Control'] })
	await expect(sort).toHaveText('name asc, team asc, country asc')
	await button('team').click({ modifiers: ['Meta'] })
	await expect(sort).toHaveText('name asc, team desc, country asc')
	await expect(header(table, 'team')).toHaveAttribute('aria-sort', 'descending')
	await button('score').click()
	await expect(sort).toHaveText('score asc')

	// `none`: one column at a time, whatever key is held.
	await mode.selectOption('none')
	await button('name').click({ modifiers: ['Shift'] })
	await expect(sort).toHaveText('name asc')
	await button('team').click({ modifiers: ['Control'] })
	await expect(sort).toHaveText('team asc')
	await button('country').click({ modifiers: ['Meta'] })
	await expect(sort).toHaveText('country asc')

	// `always`: each press adds its column.
	await mode.selectOption('always')
	await button('name').click()
	await button('score').click()
	await expect(sort).toHaveText('country asc, name asc, score asc')
	await button('country').click()
	await button('country').click()
	await expect(sort).toHaveText('name asc, score asc')

	// The keyboard follows the same rules: Enter on a header, alone or with a key.
	await mode.selectOption('modifier')
	await header(table, 'team').focus()
	await page.keyboard.press('Enter')
	await expect(sort).toHaveText('team asc')
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('Shift+Enter')
	await expect(sort).toHaveText('team asc, country asc')
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('Control+Enter')
	await expect(sort).toHaveText('team asc, country asc, score asc')
	await page.keyboard.press('Meta+Enter')
	await expect(sort).toHaveText('team asc, country asc, score desc')
	await expect(header(table, 'score')).toBeFocused()
	await mode.selectOption('none')
	await header(table, 'name').focus()
	await page.keyboard.press('Shift+Enter')
	await expect(sort).toHaveText('name asc')
	await mode.selectOption('always')
	await header(table, 'name').focus()
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('Enter')
	await expect(sort).toHaveText('name asc, team asc')

	// A table that keeps its sort: the third press turns the order back.
	await mode.selectOption('none')
	await page.getByRole('checkbox', { name: 'Always sorted' }).check()
	await button('score').click()
	await button('score').click()
	await expect(sort).toHaveText('score desc')
	await button('score').click()
	await expect(sort).toHaveText('score asc')
	await header(table, 'score').focus()
	await page.keyboard.press('Enter')
	await page.keyboard.press('Enter')
	await expect(sort).toHaveText('score asc')
	await page.getByRole('checkbox', { name: 'Always sorted' }).uncheck()
	await button('score').click()
	await button('score').click()
	await expect(sort).toHaveText('no sort')
})

test('all columns hide at once and come back, and a nested group names the groups above it', async ({
	page,
}) => {
	const table = await open(page)
	const all = ['pick', 'name', 'team', 'country', 'score', 'joined', 'bonus']
	await header(table, 'name').focus()
	await page.getByRole('button', { name: 'Hide all columns' }).click()
	// The column that leads stays, and the first column in view with it: a table needs one.
	expect(await headers(table)).toEqual(['pick', 'name'])
	await expect(groupRows(table).first().locator('td')).toHaveAttribute('colspan', '2')
	await page.getByRole('button', { name: 'Reset the columns' }).click()
	expect(await headers(table)).toEqual(all)
	await page.getByRole('button', { name: 'Hide team' }).click()
	expect(await headers(table)).toEqual(all.filter((id) => id !== 'team'))
	await page.getByRole('button', { name: 'Reset the columns' }).click()
	expect(await headers(table)).toEqual(all)

	await page.getByRole('combobox', { name: 'Groups' }).selectOption('nested')
	await page.getByRole('button', { name: 'Open all groups' }).click()
	const inner = table.locator('tbody tr[data-kind="group"][aria-level="2"]').first()
	const outer = table.locator('tbody tr[data-kind="group"][aria-level="1"]').first()
	const country = (await outer.getByRole('button').innerText()).trim().replace(/ \(\d+\)$/, '')
	await expect(inner.getByRole('button')).toHaveText(
		new RegExp(`^${country} / \\w+ \\(\\d+\\)\\s*$`),
	)
	// The total of the inner group is under its header too, and is the sum of its rows.
	expect(await span(cellOf(inner, 'score'))).toEqual(await span(header(table, 'score')))
	const count = Number(/\((\d+)\)\s*$/.exec(await inner.getByRole('button').innerText())?.[1])
	let sum = 0
	const rows = inner.locator(`xpath=following-sibling::tr[position() <= ${count}]`)
	for (const row of await rows.all()) sum += await number(cellOf(row, 'score'))
	expect(await number(cellOf(inner, 'score'))).toBeCloseTo(sum, 2)
})

test('focus that leaves the page right after a change stays where the person put it', async ({
	page,
}) => {
	const table = await open(page)
	const held = await table.evaluate(async (root) => {
		const cell = root.querySelector<HTMLElement>('thead th:nth-child(3)')
		if (!cell) throw new Error('The table has no third header cell.')
		// Focus arrives at a new cell: the table notes it, and looks at the focus again on the next frame.
		cell.focus()
		// Before that frame, the person leaves with Tab from the last stop of the page, and focus is on the page itself.
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
		cell.blur()
		await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
		return document.activeElement === document.body ? 'the page' : 'the table'
	})
	// The table gives focus back to a cell only when its own change took the focus away.
	expect(held).toBe('the page')
})
