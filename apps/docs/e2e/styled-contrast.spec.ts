import { expect, test, type Locator } from '@playwright/test'
import { contrastOf, installContrast, type ContrastKind } from './contrast'

// WCAG AA: 4.5 to 1 for text, 3 to 1 for the line around a control, for a
// focus ring and for a mark that carries meaning.
const TEXT = 4.5
const PART = 3

const dataRows = (table: Locator) => table.locator('tbody tr[data-slot="table-row"]')

for (const theme of ['light', 'dark'] as const) {
	test(`contrast, ${theme} theme: texts, lines of controls and focus rings reach WCAG AA`, async ({
		page,
	}) => {
		await installContrast(page)
		// A colour is measured at its end value, not on its way there.
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await page.goto(`/?page=styled${theme === 'dark' ? '&theme=dark' : ''}`)
		await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^$/)

		const measured: { name: string; ratio: number; limit: number }[] = []
		async function check(name: string, locator: Locator, kind: ContrastKind, limit: number) {
			await expect(locator, name).toBeVisible()
			const ratio = Math.round((await contrastOf(locator, kind)) * 100) / 100
			measured.push({ name, ratio, limit })
			expect
				.soft(ratio, `${name} (${theme}): ${ratio} to 1, needs ${limit} to 1`)
				.toBeGreaterThanOrEqual(limit)
		}
		/** Moves focus away and back with keys, so the ring of `:focus-visible` shows. */
		async function ring(name: string, locator: Locator, away = 'Shift+Tab', back = 'Tab') {
			await locator.focus()
			await page.keyboard.press(away)
			await page.keyboard.press(back)
			await expect(locator, name).toBeFocused()
			await check(`focus ring, ${name}`, locator, 'outline', PART)
		}
		const section = async (id: string) => {
			const found = page.locator(`#${id}`)
			await found.scrollIntoViewIfNeeded()
			return found
		}

		const found = await section('customer-directory')
		const table = found.getByRole('grid', { name: 'Customers' })
		await expect(dataRows(table)).toHaveCount(10)
		const row = dataRows(table).nth(1)
		const search = found.getByRole('textbox', { name: 'Search, Customers' })
		const filters = found.locator('[data-slot="popover-trigger"]')
		const sizes = found.getByRole('combobox', { name: 'Rows per page, Customers' })
		const pages = found.getByRole('navigation', { name: 'Pages, Customers' })
		const sorter = table.getByRole('columnheader', { name: 'Customer' }).getByRole('button')

		// The table.
		await check('header cell with a sort button', sorter, 'text', TEXT)
		await check('sort mark of a header', sorter.locator('svg'), 'text', PART)
		await check('header cell', page.locator('#basic thead th').first(), 'text', TEXT)
		await check('body cell', row.locator('td').nth(3), 'text', TEXT)
		await check('second line of a body cell', row.locator('td').nth(2).locator('a'), 'text', TEXT)
		await check('row checkbox, line', row.getByRole('checkbox'), 'border', PART)
		await check('expand button, mark', row.getByRole('button'), 'text', PART)

		await row.hover()
		await check('body cell, hovered row', row.locator('td').nth(3), 'text', TEXT)
		await check('second line, hovered row', row.locator('td').nth(2).locator('a'), 'text', TEXT)

		await row.getByRole('checkbox').click()
		await page.mouse.move(0, 0)
		await expect(row).toHaveAttribute('data-selected', '')
		await check('body cell, selected row', row.locator('td').nth(3), 'text', TEXT)
		await check('second line, selected row', row.locator('td').nth(2).locator('a'), 'text', TEXT)
		await check('checked checkbox on a selected row, fill', row.getByRole('checkbox'), 'fill', PART)
		await check('checked checkbox, mark', row.getByRole('checkbox'), 'text', PART)
		await check('expand button on a selected row, mark', row.getByRole('button'), 'text', PART)
		await check(
			'header checkbox, mixed, fill',
			table.getByRole('checkbox', { name: 'Select all rows' }),
			'fill',
			PART,
		)

		// The toolbar.
		await check('placeholder of the search', search, 'placeholder', TEXT)
		await check('search field, line', search, 'border', PART)
		await search.fill('e')
		await check('text of the search', search, 'text', TEXT)
		await check(
			'clear button of the search, mark',
			found.getByRole('button', { name: 'Clear search' }),
			'text',
			PART,
		)
		await search.fill('')
		await check('outline button', filters, 'text', TEXT)
		await check('outline button, line', filters, 'border', PART)
		await filters.hover()
		await check('outline button, hovered', filters, 'text', TEXT)
		await sorter.hover()
		await check('ghost button, hovered', sorter, 'text', TEXT)
		await check(
			'toolbar button of the caller',
			found.getByRole('button', { name: /^Email \d+ selected$/ }),
			'text',
			TEXT,
		)

		// The pages.
		await check('page text', found.locator('[data-slot="data-table-page"]'), 'text', TEXT)
		await check('row count', found.locator('[data-slot="data-table-rows"]'), 'text', TEXT)
		await check('selected count', found.locator('[data-slot="data-table-selected"]'), 'text', TEXT)
		await check('page size list', sizes, 'text', TEXT)
		await check('page size list, line', sizes, 'border', PART)
		await check('page link', pages.getByRole('button', { name: 'Page 2' }), 'text', TEXT)
		await check('page link, line', pages.getByRole('button', { name: 'Page 2' }), 'border', PART)
		await check('current page', pages.getByRole('button', { name: 'Page 1' }), 'text', TEXT)
		await check('current page, fill', pages.getByRole('button', { name: 'Page 1' }), 'fill', PART)
		await check('next page, mark', pages.getByRole('button', { name: 'Next page' }), 'text', PART)
		await check('next page, line', pages.getByRole('button', { name: 'Next page' }), 'border', PART)
		await pages.getByRole('button', { name: 'Page 2' }).hover()
		await check('page link, hovered', pages.getByRole('button', { name: 'Page 2' }), 'text', TEXT)

		// Focus rings.
		await ring('search field', search)
		await ring('outline button', filters)
		await ring('page size list', sizes)
		await ring('page link', pages.getByRole('button', { name: 'Page 2' }))
		await ring('current page', pages.getByRole('button', { name: 'Page 1' }))
		await ring('cell of a selected row', row.locator('td').nth(3), 'ArrowRight', 'ArrowLeft')
		await ring(
			'cell of a row',
			dataRows(table).nth(2).locator('td').nth(3),
			'ArrowRight',
			'ArrowLeft',
		)
		await ring(
			'header cell',
			table.getByRole('columnheader', { name: 'Company' }),
			'ArrowRight',
			'ArrowLeft',
		)
		await row.locator('td').first().focus()
		await page.keyboard.press('Enter')
		await expect(row.getByRole('checkbox')).toBeFocused()
		await check('focus ring, checkbox', row.getByRole('checkbox'), 'outline', PART)
		await page.keyboard.press('Escape')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('Enter')
		await expect(row.getByRole('button')).toBeFocused()
		await check('focus ring, expand button', row.getByRole('button'), 'outline', PART)
		await page.keyboard.press('Escape')
		await table.getByRole('columnheader', { name: 'Customer' }).focus()
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('ArrowLeft')
		await page.keyboard.press('F2')
		await expect(sorter).toBeFocused()
		await check('focus ring, sort button', sorter, 'outline', PART)
		await page.keyboard.press('Escape')

		// The filter popover.
		await filters.click()
		const popover = page.getByRole('dialog', { name: 'Column filters' })
		await check('popover title', popover.locator('[data-slot="popover-title"]'), 'text', TEXT)
		await check(
			'name of a filter',
			popover.locator('[data-slot="data-table-filter"] > span').first(),
			'text',
			TEXT,
		)
		const company = popover.getByRole('textbox', { name: 'Filter Company' })
		const country = popover.getByRole('combobox', { name: 'Values of Country' })
		const lowest = popover.getByRole('spinbutton', { name: 'Lowest MRR' })
		await check('placeholder in the popover', company, 'placeholder', TEXT)
		await check('placeholder of a number field', lowest, 'placeholder', TEXT)
		await check('field in the popover, line', company, 'border', PART)
		await check('placeholder of a list', country, 'text', TEXT)
		await check('list in the popover, line', country, 'border', PART)
		await check('date field', popover.getByLabel('Contract ends from'), 'text', TEXT)
		await company.fill('a')
		await check('text of a field in the popover', company, 'text', TEXT)
		await check(
			'ghost button in the popover',
			popover.getByRole('button', { name: 'Clear all filters' }),
			'text',
			TEXT,
		)
		await check(
			'reset button, mark',
			popover.getByRole('button', { name: 'Reset filter of Company' }),
			'text',
			PART,
		)
		await ring('field in the popover', company)
		await ring('list in the popover', country)
		await country.click()
		const options = page.getByRole('listbox', { name: 'Values of Country' }).getByRole('option')
		await check('list item', options.nth(2), 'text', TEXT)
		await options.nth(2).hover()
		await check('list item, highlighted', options.nth(2), 'text', TEXT)
		await options.nth(2).click()
		await check('check mark of a list item', options.nth(2).locator('svg'), 'text', PART)
		await page.keyboard.press('Escape')
		await check('chosen value of a list', country, 'text', TEXT)
		await popover.getByRole('button', { name: 'Clear all filters' }).click()
		await page.keyboard.press('Escape')
		await expect(popover).toBeHidden()

		// The menus.
		await found.getByRole('button', { name: 'Columns' }).click()
		const items = page.getByRole('menu', { name: 'Columns' }).getByRole('menuitemcheckbox')
		await check('menu item', items.nth(3), 'text', TEXT)
		await items.nth(3).hover()
		await check('menu item, highlighted', items.nth(3), 'text', TEXT)
		await page.keyboard.press('ArrowDown')
		await check('menu item, highlighted by a key', page.locator(':focus'), 'text', TEXT)
		await page.keyboard.press('Escape')
		await found.getByRole('button', { name: 'Export' }).click()
		await check(
			'item of the export menu',
			page.getByRole('menuitem', { name: 'Export CSV' }),
			'text',
			TEXT,
		)
		await page.keyboard.press('Escape')

		// Group rows, totals, the empty state, links and marks.
		const grouped = (await section('grouping-aggregations')).getByRole('treegrid', {
			name: 'Orders by category',
		})
		await check('group row', grouped.getByRole('button', { name: 'Hardware (4)' }), 'text', TEXT)
		await check('name of a total in a group row', grouped.locator('dt').first(), 'text', TEXT)
		await check('total in a group row', grouped.locator('dd').first(), 'text', TEXT)
		await check('footer cell', grouped.locator('tfoot td').last(), 'text', TEXT)
		const tasks = (await section('selection-grouping')).getByRole('treegrid', {
			name: 'Selectable tasks',
		})
		await check(
			'checkbox of a group row, line',
			tasks.getByRole('checkbox', { name: 'Select group High' }),
			'border',
			PART,
		)
		const empty = await section('empty-loading')
		await check('empty state', empty.locator('[data-slot="data-table-empty"] span'), 'text', TEXT)
		const formats = (await section('format-types')).getByRole('grid', { name: 'Formats' })
		await check('link in a cell', formats.getByRole('link').first(), 'text', TEXT)
		await check('true mark of a boolean cell', formats.locator('tbody svg').first(), 'text', PART)
		await check('false mark of a boolean cell', formats.locator('tbody svg').last(), 'text', PART)
		const detail = await section('expansion-custom')
		await detail.getByRole('button', { name: 'Expand row Trail backpack' }).click()
		await check('detail row', detail.getByText('A 28 litre pack'), 'text', TEXT)

		// The texts of the demos that carry a state colour.
		await check('demo: label in a detail row', detail.getByText('Description'), 'text', TEXT)
		const change = (await section('cell-styling')).locator('tbody td:last-child')
		await check('demo: destructive text in a cell', change.nth(1), 'text', TEXT)
		await check('demo: quiet text in a cell', change.nth(3), 'text', TEXT)
		const stock = dataRows((await section('row-styling')).getByRole('grid'))
		await check('demo: text on a warning row', stock.nth(1).locator('td').first(), 'text', TEXT)
		await check('demo: text on a destructive row', stock.nth(2).locator('td').first(), 'text', TEXT)
		await check(
			'demo: text of a badge',
			page.locator('#custom-slots [data-slot="badge"]').first(),
			'text',
			TEXT,
		)

		// A customer at risk: a row with a tint, and a cell with a state colour, also while selected.
		await section('customer-directory')
		const marked = 'td[class*="before:bg-destructive"]'
		const risky = dataRows(table)
			.filter({ has: page.locator(marked) })
			.first()
		await check('demo: text of a marked cell on a tinted row', risky.locator(marked), 'text', TEXT)
		await check('demo: dot of a marked cell on a tinted row', risky.locator(marked), 'before', PART)
		await check('demo: text on a tinted row', risky.locator('td').nth(3), 'text', TEXT)
		await risky.hover()
		await check('demo: dot of a marked cell, hovered row', risky.locator(marked), 'before', PART)
		await risky.getByRole('checkbox').click()
		await page.mouse.move(0, 0)
		await check('demo: text of a marked cell, selected row', risky.locator(marked), 'text', TEXT)
		await check('demo: dot of a marked cell, selected row', risky.locator(marked), 'before', PART)
		const quiet = dataRows(table).filter({ hasText: 'Not active' }).first()
		await check(
			'demo: row of a customer that is not active',
			quiet.locator('td').nth(3),
			'text',
			TEXT,
		)

		// The pairs nearest to their limit, for the one who reads the run.
		const closest = (limit: number) =>
			measured
				.filter((entry) => entry.limit === limit)
				.toSorted((a, b) => a.ratio - b.ratio)
				.slice(0, 6)
				.map((entry) => `${entry.name} ${entry.ratio}`)
				.join('; ')
		console.log(
			`contrast ${theme}: ${measured.length} pairs. Lowest of 4.5: ${closest(TEXT)}. Lowest of 3: ${closest(PART)}.`,
		)
	})
}
