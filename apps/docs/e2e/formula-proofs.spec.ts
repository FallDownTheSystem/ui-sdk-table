import { expect, test, type Page } from '@playwright/test'

// Proofs of what a browser does, for the formulas. The unit proofs are in
// `packages/core/src/proofs/` and `packages/vue/src/proofs/`. The tests of
// this file also run in Firefox and WebKit with `PROOF_BROWSERS=1` (see
// `playwright.config.ts`); without it, Chromium only.

// The sheet page has the row of letters (grid row 1) and the header row (2): row 3 is the first row of parts.

async function facts(page: Page) {
	await page.goto('/?page=formula-proofs')
	const text = await page.getByTestId('facts').textContent()
	return JSON.parse(text ?? '{}') as {
		week: Record<string, string>
	}
}

// Intl puts a thin or a plain space around the dash of a range; a person reads both the same.
const spaces = (text: string | undefined) => text?.replace(/[\s\u2009\u202f\u00a0]+/g, ' ')

test('P5: the text of a week is one range of days', async ({ page }) => {
	const { week } = await facts(page)
	expect(spaces(week['en-US'])).toBe('Nov 16 – 22, 2026')
	expect(spaces(week['en-US across a year'])).toBe('Dec 29, 2025 – Jan 4, 2026')
	expect(spaces(week['fi-FI'])).toBe('16.–22.11.2026')
	expect(spaces(week['fi-FI across a year'])).toBe('29.12.2025–4.1.2026')
})

test('P9: `=` opens the editor of a sheet cell on a keyboard where it is Shift+0', async ({
	page,
	browserName,
}) => {
	test.skip(browserName !== 'chromium', 'The key of another layout is sent through Chromium')
	await page.goto('/?page=sheet')
	const cell = page.locator('[data-slot="table"] tr[aria-rowindex="3"] > [aria-colindex="2"]')
	await cell.click()
	// What a Finnish keyboard sends for Shift+0: the key `=` on the code of the digit 0.
	const session = await page.context().newCDPSession(page)
	const key = { key: '=', code: 'Digit0', windowsVirtualKeyCode: 48, modifiers: 8 }
	await session.send('Input.dispatchKeyEvent', { type: 'keyDown', text: '=', ...key })
	await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
	const editor = cell.locator('[data-slot="table-editor"]')
	await expect(editor).toBeFocused()
	await expect(editor).toHaveValue('=')
	await page.keyboard.type('B2*C2')
	await expect(editor).toHaveValue('=B2*C2')
	await page.keyboard.press('Escape')
	await expect(editor).toHaveCount(0)
})

test('P9: a key of a composition does not open the editor of a sheet cell', async ({ page }) => {
	await page.goto('/?page=sheet')
	const cell = page.locator('[data-slot="table"] tr[aria-rowindex="3"] > [aria-colindex="2"]')
	await cell.click()
	const opened = await cell.evaluate((el) => {
		el.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: '=',
				bubbles: true,
				cancelable: true,
				isComposing: true,
			}),
		)
		el.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Process',
				bubbles: true,
				cancelable: true,
				keyCode: 229,
			}),
		)
		return !!el.querySelector('[data-slot="table-editor"]')
	})
	await page.waitForTimeout(50)
	expect(opened).toBe(false)
	await expect(cell.locator('[data-slot="table-editor"]')).toHaveCount(0)
})
