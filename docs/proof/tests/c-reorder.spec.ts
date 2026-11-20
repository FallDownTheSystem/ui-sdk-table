import { expect, test, type Page } from "@playwright/test"
import { center, open } from "./helpers"

const headerOrder = (page: Page) =>
  page.locator("[data-proof=reorder] thead th").evaluateAll((els) => els.map((el) => el.getAttribute("data-col")))
const bodyOrder = (page: Page, row = 0) =>
  page
    .locator("[data-proof=reorder] tbody tr")
    .nth(row)
    .locator("td")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-col")))
const committed = async (page: Page) => ((await page.getByTestId("reorder-committed").textContent()) ?? "").split(",")

const initial = ["id", "name", "email", "city", "amount", "date", "status", "note"]

test("c: dragging a header cell reorders the columns, body follows", async ({ page }) => {
  const warnings = await open(page)
  const from = await center(page, "[data-proof=reorder] th[data-col=id]")
  const to = await center(page, "[data-proof=reorder] th[data-col=city]")
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 10, from.y, { steps: 3 })
  await page.mouse.move(to.x + 10, to.y, { steps: 20 })
  // Mid-drag the draft order already shows in header and body.
  const midHeader = await headerOrder(page)
  const midBody = await bodyOrder(page, 199)
  await page.mouse.up()
  expect(midHeader).not.toEqual(initial)
  expect(midBody).toEqual(midHeader)
  const order = await committed(page)
  expect(order).toEqual(["name", "email", "city", "id", "amount", "date", "status", "note"])
  expect(await headerOrder(page)).toEqual(order)
  expect(await bodyOrder(page, 0)).toEqual(order)
  expect(await bodyOrder(page, 199)).toEqual(order)
  expect(warnings).toEqual([])
})

test("c: keyboard pick up, move, drop; Escape cancels", async ({ page }) => {
  await open(page)
  await page.locator("[data-proof=reorder] th[data-col=id]").focus()
  await page.keyboard.press("ArrowRight")
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-col"))).toBe("name")
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Space")
  const order = await committed(page)
  expect(order).toEqual(["id", "email", "city", "name", "amount", "date", "status", "note"])
  expect(await bodyOrder(page, 5)).toEqual(order)
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-col"))).toBe("name")

  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  expect((await headerOrder(page)).at(-1)).toBe("name")
  await page.keyboard.press("Escape")
  expect(await headerOrder(page)).toEqual(order)
  expect(await committed(page)).toEqual(order)
})
