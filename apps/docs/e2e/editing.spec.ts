import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function open(page: Page) {
	await page.goto('/?page=editing')
	const table = page.getByRole('grid', { name: 'People' })
	await expect(table).toBeVisible()
	return table
}

// Rows and columns as `aria-rowindex` and `aria-colindex` count them, from 1.
// Row 1 is the header row, rows 2 to 11 are the people, row 12 is the footer.
// The columns are id, name, team, score, joined, active.
const cell = (table: Locator, row: number, col: number) =>
	table.locator(`tr[aria-rowindex="${row}"] > [aria-colindex="${col}"]`)
const editor = (table: Locator) => table.locator('[data-slot="table-editor"]')
const selected = (table: Locator) => table.locator('[aria-selected="true"]')
const log = (page: Page) => page.getByTestId('log').locator('li')
const range = (page: Page) => page.getByTestId('range')
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

test('Enter opens the editor of a cell, Enter saves, and focus is back on the cell', async ({
	page,
}) => {
	const table = await open(page)
	const name = cell(table, 2, 2)
	await name.click()
	await expect(name).toBeFocused()
	await page.keyboard.press('Enter')
	const input = editor(table)
	await expect(input).toBeFocused()
	await expect(input).toHaveValue('Aino Aalto')
	await expect(input).toHaveAccessibleName('Edit Name')
	await expect(name).toHaveAttribute('data-editing', '')
	// The row keeps its height while the editor is open.
	const height = async (row: number) => (await cell(table, row, 1).boundingBox())?.height
	expect(await height(2)).toBe(await height(3))

	// The value is selected, so typing replaces it. Arrow keys move in the text, not in the grid.
	await page.keyboard.type('Anna Aalto')
	await page.keyboard.press('ArrowLeft')
	await page.keyboard.press('ArrowDown')
	await expect(input).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveCount(0)
	await expect(name).toHaveText('Anna Aalto')
	await expect(name).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: e1.name="Anna Aalto"')

	// The grid goes on from the cell.
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 3, 2)).toBeFocused()
})

test('F2, a character and a double press open the editor, and Escape puts the value back', async ({
	page,
}) => {
	const table = await open(page)
	const score = cell(table, 2, 4)
	await score.click()
	await page.keyboard.press('F2')
	await expect(editor(table)).toHaveValue('20')
	await page.keyboard.type('99')
	await page.keyboard.press('Escape')
	await expect(editor(table)).toHaveCount(0)
	await expect(score).toHaveText('20')
	await expect(score).toBeFocused()
	await expect(log(page)).toHaveCount(0)

	// The character that opens the editor is its first text.
	await page.keyboard.press('5')
	await expect(editor(table)).toHaveValue('5')
	await page.keyboard.type('6')
	await page.keyboard.press('Enter')
	await expect(score).toHaveText('56')
	// The total in the footer follows the rows of the owner.
	await expect(cell(table, 12, 4)).toHaveText('496')

	await cell(table, 3, 5).dblclick()
	await expect(editor(table)).toBeFocused()
	await expect(editor(table)).toHaveValue('2016-02-11')
	await page.keyboard.press('Escape')

	// A cell that cannot be edited stays as it is.
	const id = cell(table, 2, 1)
	await expect(id).toHaveAttribute('aria-readonly', 'true')
	await id.dblclick()
	await page.keyboard.press('Enter')
	await page.keyboard.press('x')
	await expect(editor(table)).toHaveCount(0)
	// The header row holds no values.
	await cell(table, 1, 3).click()
	await page.keyboard.press('F2')
	await expect(editor(table)).toHaveCount(0)
})

test('a value that the schema refuses keeps the editor open, with the reason', async ({ page }) => {
	const table = await open(page)
	const score = cell(table, 3, 4)
	await score.click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('250')
	await page.keyboard.press('Enter')
	const input = editor(table)
	await expect(input).toBeFocused()
	await expect(input).toHaveAttribute('aria-invalid', 'true')
	const reason = table.locator('[data-slot="table-edit-error"]')
	await expect(reason).toHaveText('The score must be a whole number from 0 to 100.')
	await expect(reason).toBeVisible()
	expect(await input.getAttribute('aria-errormessage')).toBe(await reason.getAttribute('id'))
	// A screen reader hears the reason at once.
	await expect(page.locator('[aria-live="assertive"]')).toContainText(
		'The score must be a whole number from 0 to 100.',
	)
	await expect(log(page)).toHaveCount(0)

	// Tab does not leave a refused value, and a press on another cell does not either.
	await page.keyboard.press('Tab')
	await expect(input).toBeFocused()
	await cell(table, 6, 2).click()
	await expect(input).toBeFocused()
	await expect(input).toHaveValue('250')

	// A text that is no number has its own reason, which goes when the text changes.
	await input.fill('many')
	await page.keyboard.press('Enter')
	await expect(reason).toHaveText('"many" is not a number.')
	await input.fill('4')
	await expect(reason).toHaveCount(0)
	await expect(input).not.toHaveAttribute('aria-invalid', 'true')
	await page.keyboard.type('0')
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveCount(0)
	await expect(score).toHaveText('40')
	await expect(score).toBeFocused()

	// The owner of the rows can refuse an edit too.
	await page.getByRole('checkbox', { name: 'Refuse every edit' }).check()
	await score.click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('41')
	await page.keyboard.press('Enter')
	await expect(reason).toHaveText('The change was not saved.')
	await page.keyboard.press('Escape')
	await expect(score).toHaveText('40')
	await expect(score).toBeFocused()
})

test('Tab saves and goes to the next cell, and focus that leaves the editor saves', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, 2).click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('Anna Aalto')
	await page.keyboard.press('Tab')
	await expect(log(page).first()).toHaveText('tab-key: e1.name="Anna Aalto"')
	await expect(cell(table, 2, 3)).toBeFocused()
	await expect(editor(table)).toHaveCount(0)

	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('Enter')
	await page.keyboard.type('21')
	await page.keyboard.press('Shift+Tab')
	await expect(log(page).first()).toHaveText('tab-key: e1.score=21')
	await expect(cell(table, 2, 3)).toBeFocused()

	// Without an editor, Tab leaves the table: it is one stop in the tab order.
	await page.keyboard.press('Tab')
	await expect(page.getByRole('button', { name: 'Clear the list' })).toBeFocused()

	await cell(table, 4, 2).dblclick()
	await page.keyboard.type('Hilla Laine')
	await page.getByRole('heading', { name: 'Last edits' }).click()
	await expect(editor(table)).toHaveCount(0)
	await expect(cell(table, 4, 2)).toHaveText('Hilla Laine')
	await expect(log(page).first()).toHaveText('focus-out: e3.name="Hilla Laine"')
	// Focus stays where the person put it.
	await expect(table.locator(':focus')).toHaveCount(0)

	// A press on another cell saves the open editor and makes that cell active.
	await cell(table, 5, 2).dblclick()
	await page.keyboard.type('Ilmari Aalto')
	await cell(table, 7, 4).click()
	await expect(cell(table, 5, 2)).toHaveText('Ilmari Aalto')
	await expect(editor(table)).toHaveCount(0)
	await expect(cell(table, 7, 4)).toBeFocused()
})

test('a column can have its own editor, which saves through the same check', async ({ page }) => {
	const table = await open(page)
	const team = cell(table, 2, 3)
	await team.click()
	await page.keyboard.press('Enter')
	const list = team.getByRole('combobox', { name: 'Edit Team' })
	await expect(list).toBeFocused()
	await expect(list).toHaveValue('Billing')
	await expect(editor(table)).toHaveCount(0)

	await list.selectOption('Nowhere')
	await expect(team.locator('.cell-error')).toHaveText(
		'The team must be one of: Billing, Design, Growth, Platform, Support.',
	)
	await expect(log(page)).toHaveCount(0)
	await team.getByRole('combobox').selectOption('Growth')
	await expect(team.getByRole('combobox')).toHaveCount(0)
	await expect(team).toHaveText('Growth')
	await expect(team).toBeFocused()
	await expect(log(page).first()).toHaveText('imperative: e1.team="Growth"')

	await page.keyboard.press('F2')
	await expect(team.getByRole('combobox')).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(team.getByRole('combobox')).toHaveCount(0)
	await expect(team).toBeFocused()
})

test('a UI SDK switch in a cell: Enter goes in, its keys are its own, Escape comes back', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Row selection' }).check()
	const active = cell(table, 3, 6)
	const control = active.getByRole('switch')
	await expect(control).toHaveAttribute('aria-checked', 'true')
	// A press on the switch works it, and focus is on the switch.
	await control.click()
	await expect(control).toHaveAttribute('aria-checked', 'false')
	await expect(control).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(active).toBeFocused()

	await page.keyboard.press('Enter')
	await expect(control).toBeFocused()
	await page.keyboard.press('Space')
	await expect(control).toHaveAttribute('aria-checked', 'true')
	// Space was for the switch: the row is not selected.
	await expect(table.locator('tr[aria-rowindex="3"]')).toHaveAttribute('aria-selected', 'false')
	await page.keyboard.press('ArrowDown')
	await expect(control).toBeFocused()
	await page.keyboard.press('F2')
	await expect(active).toBeFocused()
	// On the cell, the keys are the keys of the grid again.
	await page.keyboard.press('Space')
	await expect(table.locator('tr[aria-rowindex="3"]')).toHaveAttribute('aria-selected', 'true')
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 4, 6)).toBeFocused()

	// The switch is not a stop of its own in the tab order, in either direction.
	await page.keyboard.press('Tab')
	await expect(page.getByRole('button', { name: 'Clear the list' })).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(cell(table, 4, 6)).toBeFocused()
	// After the keys, the switch has the tab index that its own component gave it.
	await expect(control).toHaveAttribute('tabindex', '0')
})

test('Shift with an arrow key selects cells, and never a header or a footer cell', async ({
	page,
}) => {
	const table = await open(page)
	await expect(table).toHaveAttribute('aria-multiselectable', 'true')
	await cell(table, 2, 2).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowRight')
	await expect(range(page)).toHaveText('{"anchor":{"row":1,"col":1},"end":{"row":3,"col":2}}')
	await expect(selected(table)).toHaveCount(6)
	await expect(cell(table, 2, 2)).toHaveAttribute('data-range-edge', 'top left')
	await expect(cell(table, 4, 3)).toHaveAttribute('data-range-edge', 'right bottom')
	// Focus stays on the cell where the range started.
	await expect(cell(table, 2, 2)).toBeFocused()

	// Up, past the first row of the people: the range stops there.
	for (let press = 0; press < 5; press++) await page.keyboard.press('Shift+ArrowUp')
	await expect(range(page)).toHaveText('{"anchor":{"row":1,"col":1},"end":{"row":1,"col":2}}')
	await expect(table.locator('thead [aria-selected]')).toHaveCount(0)

	// Every cell is every cell of the people.
	await page.keyboard.press('Control+a')
	await expect(selected(table)).toHaveCount(60)
	await expect(table.locator('thead [data-selected], tfoot [data-selected]')).toHaveCount(0)
	await expect(range(page)).toHaveText('{"anchor":{"row":1,"col":0},"end":{"row":10,"col":5}}')

	await page.keyboard.press('Escape')
	await expect(range(page)).toHaveText('none')
	await expect(selected(table)).toHaveCount(0)

	// An arrow key without Shift drops the range and moves on.
	await page.keyboard.press('Shift+End')
	await expect(selected(table)).toHaveCount(5)
	await page.keyboard.press('ArrowDown')
	await expect(range(page)).toHaveText('none')
	await expect(cell(table, 3, 2)).toBeFocused()

	// From a header cell, there is no range to start.
	await cell(table, 1, 2).click()
	await page.keyboard.press('Shift+ArrowRight')
	await expect(range(page)).toHaveText('none')
	await expect(cell(table, 1, 3)).toBeFocused()
})

test('a drag paints a range that ends at the first row under the header', async ({ page }) => {
	const table = await open(page)
	const at = async (row: number, col: number) => {
		const box = await cell(table, row, col).boundingBox()
		if (!box) throw new Error('The cell is not in the page.')
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
	}
	const from = await at(4, 2)
	const to = await at(6, 4)
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
	await page.mouse.move(to.x, to.y, { steps: 4 })
	await expect(selected(table)).toHaveCount(9)
	await expect(page.getByTestId('commits')).toHaveText('0')
	await page.mouse.up()
	await expect(range(page)).toHaveText('{"anchor":{"row":3,"col":1},"end":{"row":5,"col":3}}')
	await expect(page.getByTestId('commits')).toHaveText('1')
	await expect(cell(table, 4, 2)).toBeFocused()
	// The drag selected cells, and no text of the page.
	expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')

	// Up into the header: the range ends in the first row of the people.
	const head = await at(1, 3)
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(head.x, head.y, { steps: 6 })
	await page.mouse.up()
	await expect(range(page)).toHaveText('{"anchor":{"row":3,"col":1},"end":{"row":1,"col":2}}')
	await expect(table.locator('thead [data-selected]')).toHaveCount(0)
	await expect(page.getByTestId('commits')).toHaveText('2')

	// Shift with a press stretches the range from the active cell.
	await cell(table, 8, 5).click({ modifiers: ['Shift'] })
	await expect(range(page)).toHaveText('{"anchor":{"row":3,"col":1},"end":{"row":7,"col":4}}')
	await expect(cell(table, 4, 2)).toBeFocused()
	// A press without Shift drops it.
	await cell(table, 8, 5).click()
	await expect(range(page)).toHaveText('none')
})

test('Ctrl+C copies the selected cells as text, and Ctrl+V pastes through the checks', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 2, 2).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Control+c')
	expect(await clipboard(page)).toBe('Aino Aalto\tBilling\t20\nEero Heikkinen\tDesign\t37')

	// Four rows down, the same block.
	for (let press = 0; press < 4; press++) await page.keyboard.press('ArrowDown')
	await expect(cell(table, 6, 2)).toBeFocused()
	await page.keyboard.press('Control+v')
	await expect(cell(table, 6, 2)).toHaveText('Aino Aalto')
	await expect(cell(table, 6, 3)).toHaveText('Billing')
	await expect(cell(table, 6, 4)).toHaveText('20')
	await expect(cell(table, 7, 2)).toHaveText('Eero Heikkinen')
	await expect(cell(table, 7, 4)).toHaveText('37')
	// One report for the whole paste, with the cells that changed.
	await expect(log(page)).toHaveCount(1)
	await expect(log(page).first()).toHaveText(
		'paste: e5.name="Aino Aalto" e5.team="Billing" e5.score=20 e6.name="Eero Heikkinen" e6.team="Design" e6.score=37',
	)
	// The cells of the paste are the range now.
	await expect(range(page)).toHaveText('{"anchor":{"row":5,"col":1},"end":{"row":6,"col":3}}')
	await expect(cell(table, 6, 2)).toBeFocused()

	// One value fills every selected cell.
	await cell(table, 9, 4).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+ArrowDown')
	await page.evaluate(() => navigator.clipboard.writeText('7'))
	await page.keyboard.press('Control+v')
	for (const row of [9, 10, 11]) await expect(cell(table, row, 4)).toHaveText('7')

	// One refused value stops the paste: no cell changes, and the reason is said.
	await page.evaluate(() => navigator.clipboard.writeText('8\n800\n9'))
	await page.keyboard.press('Control+v')
	await expect(page.locator('[aria-live="assertive"]')).toContainText(
		'Nothing was pasted. Score refuses "800": The score must be a whole number from 0 to 100.',
	)
	for (const row of [9, 10, 11]) await expect(cell(table, row, 4)).toHaveText('7')
	await expect(log(page)).toHaveCount(2)

	// A copy with no range takes the active cell. Inside an editor, copy and paste are for its text.
	await cell(table, 3, 2).click()
	await page.keyboard.press('Control+c')
	expect(await clipboard(page)).toBe('Eero Heikkinen')
	await cell(table, 4, 2).click()
	await page.keyboard.press('Enter')
	await page.keyboard.press('Control+a')
	await page.keyboard.press('Control+v')
	await expect(editor(table)).toHaveValue('Eero Heikkinen')
	await page.keyboard.press('Escape')
	await expect(cell(table, 4, 2)).toHaveText('Helmi Järvinen')
})

test('code outside the table edits a cell and selects cells', async ({ page }) => {
	const table = await open(page)
	await page.getByRole('button', { name: 'Give row e2 the score 99' }).click()
	await expect(cell(table, 3, 4)).toHaveText('99')
	await expect(log(page).first()).toHaveText('imperative: e2.score=99')

	await page.getByRole('button', { name: 'Select 3 by 3 cells' }).click()
	await expect(selected(table)).toHaveCount(9)
	// A sort brings other rows to the places of the range, so the range goes.
	await table.getByRole('button', { name: 'Score' }).click()
	await expect(range(page)).toHaveText('none')
	await page.getByRole('button', { name: 'Select 3 by 3 cells' }).click()
	await page.getByRole('button', { name: 'Clear the cells' }).click()
	await expect(selected(table)).toHaveCount(0)
})

test('a check that takes time: the editor waits, Escape takes the edit back, and focus elsewhere stays', async ({
	page,
}) => {
	const table = await open(page)
	await page.getByRole('checkbox', { name: 'Check names on a slow server' }).check()
	const name = cell(table, 2, 2)
	await name.click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('Anna Aalto')
	await page.keyboard.press('Enter')
	const input = editor(table)
	await expect(input).toHaveAttribute('aria-busy', 'true')
	await expect(name).toHaveAttribute('data-checking', '')
	// The text cannot change while it is checked, so the value that is saved is the value on screen.
	await page.keyboard.type('xyz')
	await page.keyboard.press('Enter')
	await expect(input).toHaveValue('Anna Aalto')
	await expect(input).toBeFocused()
	await expect(editor(table)).toHaveCount(0)
	await expect(name).toHaveText('Anna Aalto')
	await expect(name).toBeFocused()
	await expect(log(page)).toHaveText(['enter-key: e1.name="Anna Aalto"'])

	// Escape while the check runs: the answer comes to nobody.
	await page.keyboard.press('Enter')
	await page.keyboard.type('Aune Aalto')
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveAttribute('aria-busy', 'true')
	await page.keyboard.press('Escape')
	await expect(editor(table)).toHaveCount(0)
	await expect(name).toBeFocused()
	await page.waitForTimeout(900)
	await expect(name).toHaveText('Anna Aalto')
	await expect(log(page)).toHaveCount(1)

	// A name that the server refuses: the reason shows, and the text can change again.
	await page.keyboard.press('Enter')
	await page.keyboard.type('Eero Heikkinen')
	await page.keyboard.press('Enter')
	const reason = table.locator('[data-slot="table-edit-error"]')
	await expect(reason).toHaveText('Another person has the name Eero Heikkinen.')
	await expect(editor(table)).toBeFocused()
	await expect(editor(table)).not.toHaveAttribute('readonly', '')
	await page.keyboard.press('Escape')

	// The person goes to another field while the check runs. Focus is theirs.
	await page.keyboard.press('Enter')
	await page.keyboard.type('Aili Aalto')
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveAttribute('aria-busy', 'true')
	const box = page.getByRole('checkbox', { name: 'Row selection' })
	await box.focus()
	await expect(name).toHaveText('Aili Aalto')
	await expect(editor(table)).toHaveCount(0)
	await expect(box).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: e1.name="Aili Aalto"')
})

test('Tab goes to the next cell also when the save moves the row', async ({ page }) => {
	const table = await open(page)
	await cell(table, 1, 4).click()
	// The lowest score is first. Its row goes to the end with the highest score.
	const first = await cell(table, 2, 1).innerText()
	await cell(table, 2, 4).click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('100')
	await page.keyboard.press('Tab')
	await expect(cell(table, 11, 1)).toHaveText(first)
	await expect(cell(table, 11, 4)).toHaveText('100')
	await expect(cell(table, 11, 5)).toBeFocused()
	await expect(editor(table)).toHaveCount(0)

	// Back to the start with Shift+Tab: the cell before, in the row where it is now.
	await page.keyboard.press('ArrowLeft')
	await page.keyboard.press('Enter')
	await page.keyboard.type('0')
	await page.keyboard.press('Shift+Tab')
	await expect(cell(table, 2, 1)).toHaveText(first)
	await expect(cell(table, 2, 3)).toBeFocused()
	// The grid goes on from there.
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 3, 3)).toBeFocused()
})

test('Tab at the end of a row goes to the next row, and at the last cell it stays', async ({
	page,
}) => {
	const table = await open(page)
	// Joined is the last column with an editor. Active has a switch and no editor.
	await cell(table, 2, 5).click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('2020-02-02')
	await page.keyboard.press('Tab')
	await expect(log(page).first()).toHaveText('tab-key: e1.joined="2020-02-02"')
	await expect(cell(table, 2, 6)).toBeFocused()

	await cell(table, 3, 2).click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('Eero Aalto')
	await page.keyboard.press('Shift+Tab')
	await expect(cell(table, 3, 1)).toBeFocused()

	// The first and the last cell of the people have no neighbour on one side.
	await cell(table, 11, 5).click()
	await page.keyboard.press('ArrowRight')
	await expect(cell(table, 11, 6)).toBeFocused()
	await cell(table, 11, 5).click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('2021-01-01')
	await page.keyboard.press('Tab')
	await expect(cell(table, 11, 6)).toBeFocused()
	await expect(editor(table)).toHaveCount(0)
})

test('an editor of a column closes when the person presses another cell, and the keys work', async ({
	page,
}) => {
	const table = await open(page)
	const team = cell(table, 2, 3)
	await team.click()
	await page.keyboard.press('Enter')
	await expect(team.getByRole('combobox')).toBeFocused()
	await cell(table, 4, 2).click()
	await expect(table.getByRole('combobox')).toHaveCount(0)
	await expect(team).toHaveText('Billing')
	await expect(cell(table, 4, 2)).toBeFocused()
	await expect(log(page)).toHaveCount(0)
	await page.keyboard.press('Enter')
	await expect(editor(table)).toBeFocused()
	await page.keyboard.press('Escape')

	// The same with a key: the list is open, and the person presses a cell and types.
	await team.dblclick()
	await expect(team.getByRole('combobox')).toBeFocused()
	await cell(table, 5, 4).click()
	await page.keyboard.type('7')
	await expect(editor(table)).toHaveValue('7')
	await expect(table.getByRole('combobox')).toHaveCount(0)
})

test('a refused value keeps the active cell and paints no range when another cell is pressed', async ({
	page,
}) => {
	const table = await open(page)
	const score = cell(table, 3, 4)
	await score.click()
	await page.keyboard.press('Enter')
	await page.keyboard.type('250')
	await page.keyboard.press('Enter')
	await expect(editor(table)).toHaveAttribute('aria-invalid', 'true')

	const from = await cell(table, 6, 2).boundingBox()
	const to = await cell(table, 8, 3).boundingBox()
	if (!from || !to) throw new Error('The cells have no box.')
	await page.mouse.move(from.x + 10, from.y + 10)
	await page.mouse.down()
	await page.mouse.move(to.x + 10, to.y + 10, { steps: 4 })
	await page.mouse.up()
	await expect(editor(table)).toBeFocused()
	await expect(editor(table)).toHaveValue('250')
	await expect(score).toHaveAttribute('tabindex', '0')
	await expect(cell(table, 6, 2)).toHaveAttribute('tabindex', '-1')
	await expect(range(page)).toHaveText('none')
	await expect(selected(table)).toHaveCount(0)

	await page.keyboard.press('Escape')
	await expect(score).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(cell(table, 4, 4)).toBeFocused()
})

test('Shift+Space and Control+Space take rows and columns of the range, and rows of the table when rows can be selected', async ({
	page,
}) => {
	const table = await open(page)
	await cell(table, 3, 3).click()
	await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Shift+Space')
	await expect(range(page)).toHaveText('{"anchor":{"row":2,"col":0},"end":{"row":3,"col":5}}')
	await expect(selected(table)).toHaveCount(12)
	await page.keyboard.press('Escape')
	await page.keyboard.press('Control+Space')
	await expect(range(page)).toHaveText('{"anchor":{"row":1,"col":2},"end":{"row":10,"col":2}}')
	await expect(selected(table)).toHaveCount(10)
	await expect(cell(table, 3, 3)).toBeFocused()
	await page.keyboard.press('Escape')

	// With row selection, Space is for the row, and a cell outside a range says nothing.
	await page.getByRole('checkbox', { name: 'Row selection' }).check()
	await cell(table, 3, 3).click()
	await page.keyboard.press('Space')
	const row = table.locator('tr[aria-rowindex="3"]')
	await expect(row).toHaveAttribute('aria-selected', 'true')
	await expect(range(page)).toHaveText('none')
	await expect(table.locator('td[aria-selected]')).toHaveCount(0)
	await page.keyboard.press('Shift+ArrowRight')
	await expect(table.locator('td[aria-selected="true"]')).toHaveCount(2)
	await expect(table.locator('td[aria-selected="false"]')).toHaveCount(0)
	await expect(row).toHaveAttribute('aria-selected', 'true')
})

test('the keys of a sheet do nothing in a table', async ({ page }) => {
	const table = await open(page)
	await expect(table).not.toHaveAttribute('data-sheet')
	await page.evaluate(() => navigator.clipboard.writeText('kept'))
	const name = cell(table, 2, 2)
	await name.click()
	await page.keyboard.press('Shift+ArrowDown')
	await expect(selected(table)).toHaveCount(2)
	// The range holds two rows, so a sheet would fill it down, and make it bold and italic.
	const keys = ['Delete', 'Backspace', 'Control+z', 'Control+y', 'Control+Shift+z']
	for (const key of [...keys, 'Control+d', 'Control+b', 'Control+i']) {
		await page.keyboard.press(key)
	}
	// No part and no attribute of a sheet is in the page.
	await expect(table.locator('[data-slot="table-fill-handle"]')).toHaveCount(0)
	await expect(table.locator('[role="rowheader"]')).toHaveCount(0)
	await expect(
		table.locator(
			'[data-bold], [data-italic], [data-align], [data-color], [data-fill], [data-fill-target], [data-row-header], [data-corner], tr[data-kind="letters"], th[data-kind="letter"]',
		),
	).toHaveCount(0)
	// No row of letters: the header row is the first row of the grid.
	await expect(table.locator('thead tr').first()).toHaveAttribute('aria-rowindex', '1')
	await expect(table.locator('thead tr').first()).not.toHaveAttribute('data-kind')
	// A cut without the sheet option is the browser's, and a cell holds no text to cut.
	await page.keyboard.press('Control+x')
	expect(await clipboard(page)).toBe('kept')
	await expect(name).toHaveText('Aino Aalto')
	await expect(cell(table, 3, 2)).toHaveText('Eero Heikkinen')
	await expect(selected(table)).toHaveCount(2)
	await expect(log(page)).toHaveCount(0)
	await expect(editor(table)).toHaveCount(0)

	// Tab leaves the table, also with a range.
	await page.keyboard.press('Tab')
	await expect(page.getByRole('button', { name: 'Clear the list' })).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(name).toBeFocused()

	// An arrow in an editor that a character opened moves the caret, and Enter leaves focus on the cell.
	const score = cell(table, 2, 4)
	await score.click()
	await page.keyboard.type('5')
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowLeft')
	await expect(editor(table)).toBeFocused()
	await page.keyboard.type('4')
	await page.keyboard.press('Enter')
	await expect(score).toHaveText('45')
	await expect(score).toBeFocused()
	await expect(log(page).first()).toHaveText('enter-key: e1.score=45')

	// A block is pasted once, and never repeats over a range.
	await page.evaluate(() => navigator.clipboard.writeText('1\n2'))
	await score.click()
	for (let step = 0; step < 3; step++) await page.keyboard.press('Shift+ArrowDown')
	await page.keyboard.press('Control+v')
	await expect(cell(table, 3, 4)).toHaveText('2')
	await expect(cell(table, 4, 4)).toHaveText('54')
	await expect(selected(table)).toHaveCount(2)
})
