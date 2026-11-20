import { expect, test, type Page } from "@playwright/test"
import { active, center, open } from "./helpers"

const cell = (id: string) => `[data-testid=range-grid] [id="${id}"]`
const bounds = async (page: Page) => JSON.parse((await page.getByTestId("range-bounds").textContent()) ?? "null")
const selectedIds = (page: Page) =>
  page.locator('[data-testid=range-grid] [aria-selected="true"]').evaluateAll((els) => els.map((el) => el.id))

test("d: click-drag paints a rectangle", async ({ page }) => {
  const warnings = await open(page)
  const from = await center(page, cell("2:1"))
  const to = await center(page, cell("4:3"))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 15 })
  await page.mouse.up()
  expect(await bounds(page)).toEqual({ top: 2, left: 1, bottom: 4, right: 3 })
  const ids = await selectedIds(page)
  expect(ids.sort()).toEqual(["2:1", "2:2", "2:3", "3:1", "3:2", "3:3", "4:1", "4:2", "4:3"])
  expect(await active(page)).toMatchObject({ row: 3, col: 2 })
  expect(await page.locator(cell("2:1")).getAttribute("data-range-edge")).toBe("top left")
  expect(warnings).toEqual([])
})

test("d: shift+arrows grow the range from the active cell, plain arrow clears it", async ({ page }) => {
  await open(page)
  await page.locator(cell("5:2")).click()
  await page.keyboard.press("Shift+ArrowDown")
  await page.keyboard.press("Shift+ArrowDown")
  await page.keyboard.press("Shift+ArrowRight")
  expect(await bounds(page)).toEqual({ top: 5, left: 2, bottom: 7, right: 3 })
  expect((await selectedIds(page)).length).toBe(6)
  const focus = await active(page)
  expect(focus).toMatchObject({ row: 6, col: 3 })

  await page.keyboard.press("ArrowDown")
  expect((await selectedIds(page)).length).toBe(0)
})

test("d: shift+click extends; Escape clears; Ctrl+A selects all (header row included)", async ({ page }) => {
  await open(page)
  await page.locator(cell("3:0")).click()
  await page.locator(cell("6:4")).click({ modifiers: ["Shift"] })
  expect(await bounds(page)).toEqual({ top: 3, left: 0, bottom: 6, right: 4 })
  await page.keyboard.press("Escape")
  expect((await selectedIds(page)).length).toBe(0)
  await page.keyboard.press("Control+a")
  const all = await bounds(page)
  test.info().annotations.push({ type: "select-all", description: JSON.stringify(all) })
  expect(all).toEqual({ top: 0, left: 0, bottom: 200, right: 7 })
  expect(await page.locator(cell("0:0")).getAttribute("aria-selected")).toBe("true")
})
