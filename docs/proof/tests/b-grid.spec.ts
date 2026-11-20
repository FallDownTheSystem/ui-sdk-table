import { expect, test } from "@playwright/test"
import { active, open } from "./helpers"

test("b: one tab stop, arrows, Home/End, Ctrl+Home/End, PageUp/PageDown", async ({ page }) => {
  const warnings = await open(page)
  const grid = page.getByTestId("grid")
  expect(await grid.locator('[tabindex="0"]').count()).toBe(1)
  expect(await grid.getAttribute("role")).toBe("grid")
  expect(await grid.getAttribute("aria-rowcount")).toBe("201")

  await page.getByTestId("before-grid").focus()
  await page.keyboard.press("Tab")
  expect(await active(page)).toMatchObject({ row: 1, col: 1, tag: "TH" })

  await page.keyboard.press("ArrowDown")
  expect(await active(page)).toMatchObject({ row: 2, col: 1, tag: "TD" })
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  expect(await active(page)).toMatchObject({ row: 2, col: 3 })
  await page.keyboard.press("End")
  expect(await active(page)).toMatchObject({ row: 2, col: 8 })
  await page.keyboard.press("Home")
  expect(await active(page)).toMatchObject({ row: 2, col: 1 })
  await page.keyboard.press("Control+End")
  expect(await active(page)).toMatchObject({ row: 201, col: 8 })
  await page.keyboard.press("Control+Home")
  expect(await active(page)).toMatchObject({ row: 1, col: 1 })
  await page.keyboard.press("PageDown")
  expect(await active(page)).toMatchObject({ row: 6, col: 1 })
  await page.keyboard.press("PageDown")
  expect(await active(page)).toMatchObject({ row: 11, col: 1 })
  await page.keyboard.press("PageUp")
  expect(await active(page)).toMatchObject({ row: 6, col: 1 })
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  expect(await active(page)).toMatchObject({ row: 1, col: 1 })
  await page.keyboard.press("ArrowLeft")
  expect(await active(page)).toMatchObject({ row: 1, col: 1 })

  expect(await grid.locator('[tabindex="0"]').count()).toBe(1)
  expect(warnings).toEqual([])
})

test("b: Tab leaves the grid, Shift+Tab returns to the last active cell", async ({ page }) => {
  await open(page)
  await page.getByTestId("before-grid").focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  expect(await active(page)).toMatchObject({ row: 3, col: 2 })
  await page.keyboard.press("Tab")
  const tag = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))
  expect(tag).toBe("after-grid")
  await page.keyboard.press("Shift+Tab")
  expect(await active(page)).toMatchObject({ row: 3, col: 2 })
})

test("b: clicking a cell makes it the active cell", async ({ page }) => {
  await open(page)
  await page.getByTestId("grid").locator('td[id="5:6"]').click()
  expect(await active(page)).toMatchObject({ row: 6, col: 7 })
  expect(await page.getByTestId("grid").locator('td[id="5:6"]').getAttribute("tabindex")).toBe("0")
})

test("b: a button inside a cell", async ({ page }) => {
  await open(page)
  const button = page.getByTestId("cell-button")
  const findings: Record<string, unknown> = {}

  // Pointer: does the click reach the button, and where does focus end?
  await button.click()
  findings.clicksAfterClick = await page.getByTestId("grid-clicks").textContent()
  findings.focusAfterClick = await active(page)

  // Keyboard: arrive on the cell, press Enter.
  await page.getByTestId("grid").locator('td[id="3:2"]').click()
  await page.keyboard.press("ArrowRight")
  findings.cellReached = await active(page)
  await page.keyboard.press("Enter")
  findings.clicksAfterEnterOnCell = await page.getByTestId("grid-clicks").textContent()

  // Focus inside the cell: do the arrows still move through the grid?
  await button.focus()
  await page.keyboard.press("ArrowRight")
  findings.afterArrowFromButton = await active(page)

  test.info().annotations.push({ type: "button-in-cell", description: JSON.stringify(findings) })
  console.log(JSON.stringify(findings))
  expect(findings.clicksAfterClick).toBe("1")
  expect(findings.cellReached).toMatchObject({ row: 4, col: 4, tag: "TD" })
})
