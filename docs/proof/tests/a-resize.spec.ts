import { expect, test } from "@playwright/test"
import { center, drag, open } from "./helpers"

const sel = (id: string) => `[data-proof=resize] [data-handle=${id}]`
const colWidth = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`[data-proof=resize] th[data-col=${id}]`).evaluate((el) => el.getBoundingClientRect().width)
const committed = async (page: import("@playwright/test").Page) =>
  JSON.parse((await page.getByTestId("resize-committed").textContent()) ?? "{}") as Record<string, number>

test("a: pointer drag on a header edge resizes the column", async ({ page }) => {
  const warnings = await open(page)
  const start = await center(page, sel("name"))
  await drag(page, start, { x: start.x + 60, y: start.y })
  expect((await committed(page)).name).toBe(200)
  expect(Math.abs((await colWidth(page, "name")) - 200)).toBeLessThanOrEqual(1)
  expect(await page.locator(sel("name")).getAttribute("aria-valuenow")).toBe("200")
  expect(warnings).toEqual([])
})

test("a: min and max width clamp the drag", async ({ page }) => {
  await open(page)
  const id = await center(page, sel("id"))
  await drag(page, id, { x: id.x - 100, y: id.y })
  expect((await committed(page)).id).toBe(60)
  const email = await center(page, sel("email"))
  await drag(page, email, { x: email.x + 400, y: email.y })
  expect((await committed(page)).email).toBe(400)
  expect(Math.abs((await colWidth(page, "email")) - 400)).toBeLessThanOrEqual(1)
})

test("a: the column follows the pointer during the drag, before release", async ({ page }) => {
  await open(page)
  const start = await center(page, sel("city"))
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 40, start.y, { steps: 10 })
  await page.waitForTimeout(50)
  const during = await colWidth(page, "city")
  expect(Math.abs(during - 160)).toBeLessThanOrEqual(1)
  expect((await committed(page)).city).toBe(120)
  await page.mouse.up()
  expect((await committed(page)).city).toBe(160)
})

test("a: Escape during a drag restores the width", async ({ page }) => {
  await open(page)
  const start = await center(page, sel("city"))
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 40, start.y, { steps: 10 })
  await page.keyboard.press("Escape")
  await page.mouse.up()
  expect((await committed(page)).city).toBe(120)
  expect(Math.abs((await colWidth(page, "city")) - 120)).toBeLessThanOrEqual(1)
})

test("a: keyboard resize with arrows, Shift for a large step", async ({ page }) => {
  await open(page)
  await page.locator(sel("amount")).focus()
  await page.keyboard.press("ArrowRight")
  expect((await committed(page)).amount).toBe(101)
  await page.keyboard.press("Shift+ArrowRight")
  expect((await committed(page)).amount).toBe(111)
  await page.keyboard.press("ArrowLeft")
  expect((await committed(page)).amount).toBe(110)
  expect(Math.abs((await colWidth(page, "amount")) - 110)).toBeLessThanOrEqual(1)
})

test("a: in right-to-left, dragging the inline-end edge outward widens the column", async ({ page }) => {
  await open(page)
  await page.locator("[data-proof=resize]").evaluate((el) => el.setAttribute("dir", "rtl"))
  const start = await center(page, sel("name"))
  // In RTL the inline-end edge is on the left, so outward is leftward.
  await drag(page, start, { x: start.x - 60, y: start.y })
  const w = (await committed(page)).name
  test.info().annotations.push({ type: "rtl-width", description: String(w) })
  expect(w).toBe(200)
})
