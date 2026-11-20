import { expect, test, type Page } from "@playwright/test"
import { active, open } from "./helpers"

const scroller = (page: Page) => page.getByTestId("virtual-scroller")
const renderedRows = (page: Page) => page.locator("[data-testid=virtual-grid] tbody tr.vrow").count()
const rowIndexes = (page: Page) =>
  page
    .locator("[data-testid=virtual-grid] tbody tr.vrow")
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("aria-rowindex"))))

async function scrollTo(page: Page, top: number) {
  await scroller(page).evaluate((el, t) => {
    el.scrollTop = t
  }, top)
  await page.waitForTimeout(150)
}

// Whether the focused cell sits inside the scroller below the sticky header.
const focusedVisible = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    const sc = document.querySelector("[data-testid=virtual-scroller]") as HTMLElement
    const head = sc.querySelector("thead th") as HTMLElement
    if (!el || !sc.contains(el)) return false
    const r = el.getBoundingClientRect()
    const s = sc.getBoundingClientRect()
    const h = head.getBoundingClientRect()
    return el.tagName === "TH" ? r.top >= s.top - 1 : r.top >= h.bottom - 1 && r.bottom <= s.bottom + 1
  })

const bandCovered = (page: Page) =>
  page.evaluate(() => {
    const sc = document.querySelector("[data-testid=virtual-scroller]") as HTMLElement
    const head = sc.querySelector("thead th") as HTMLElement
    const from = head.getBoundingClientRect().bottom
    const to = sc.getBoundingClientRect().top + sc.clientHeight
    const rows = ([...sc.querySelectorAll("tbody tr.vrow")] as HTMLElement[]).map((r) => r.getBoundingClientRect())
    return rows.some((r) => r.top <= from + 1 && r.bottom > from) && rows.some((r) => r.top < to && r.bottom >= to - 1)
  })

const stickyHeaderAtTop = (page: Page) =>
  page.evaluate(() => {
    const sc = document.querySelector("[data-testid=virtual-scroller]") as HTMLElement
    const th = sc.querySelector("thead th") as HTMLElement
    return Math.abs(th.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientTop) <= 1
  })

test("e: fixed height, 10k rows render a small window with correct aria", async ({ page }) => {
  const warnings = await open(page)
  await scroller(page).scrollIntoViewIfNeeded()
  expect(await page.getByTestId("virtual-grid").getAttribute("aria-rowcount")).toBe("10001")
  const count = await renderedRows(page)
  expect(count).toBeGreaterThan(5)
  expect(count).toBeLessThan(40)
  expect((await rowIndexes(page))[0]).toBe(2)

  await scrollTo(page, 120_000)
  const mid = await rowIndexes(page)
  expect(mid.length).toBeLessThan(40)
  // Row at the top edge of the viewport should be about scrollTop / 24.
  const firstVisible = await page.evaluate(() => {
    const sc = document.querySelector("[data-testid=virtual-scroller]") as HTMLElement
    const head = sc.querySelector("thead th") as HTMLElement
    const y = head.getBoundingClientRect().bottom + 2
    const rows = [...sc.querySelectorAll("tbody tr.vrow")] as HTMLElement[]
    const hit = rows.find((r) => r.getBoundingClientRect().top <= y && r.getBoundingClientRect().bottom > y)
    return Number(hit?.getAttribute("aria-rowindex"))
  })
  expect(Math.abs(firstVisible - (120_000 / 24 + 2))).toBeLessThanOrEqual(2)
  expect(await stickyHeaderAtTop(page)).toBe(true)

  await scrollTo(page, 10_000_000)
  const end = await rowIndexes(page)
  expect(end.at(-1)).toBe(10001)
  const bottomSpacer = await page.getByTestId("spacer-bottom").evaluate((el) => el.getBoundingClientRect().height)
  expect(bottomSpacer).toBeLessThanOrEqual(1)
  expect(await stickyHeaderAtTop(page)).toBe(true)
  expect(warnings).toEqual([])
})

test("e: grid focus across the virtual window (fixed height)", async ({ page }) => {
  await open(page)
  await scroller(page).scrollIntoViewIfNeeded()
  await page.locator('[data-testid=virtual-grid] [id="1:0"]').click()
  expect(await active(page)).toMatchObject({ row: 2, col: 1 })

  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown")
  expect(await active(page)).toMatchObject({ row: 32, col: 1 })
  expect(await focusedVisible(page)).toBe(true)

  await page.keyboard.press("PageDown")
  await page.keyboard.press("PageDown")
  expect(await active(page)).toMatchObject({ row: 52, col: 1 })
  expect(await focusedVisible(page)).toBe(true)

  await page.keyboard.press("Control+End")
  await page.waitForTimeout(100)
  expect(await active(page)).toMatchObject({ row: 10001, col: 8 })
  expect(await focusedVisible(page)).toBe(true)

  await page.keyboard.press("Control+Home")
  await page.waitForTimeout(100)
  expect(await active(page)).toMatchObject({ row: 1, col: 1, tag: "TH" })

  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowUp")
  expect(await active(page)).toMatchObject({ row: 1, col: 1 })
})

test("e: focused row scrolled out of the window, with keep()", async ({ page }) => {
  await open(page)
  await scroller(page).scrollIntoViewIfNeeded()
  await page.locator('[data-testid=virtual-grid] [id="3:2"]').click()
  await scrollTo(page, 100_000)
  expect(await active(page)).toMatchObject({ row: 4, col: 3 })
  // The kept row is rendered out of place: it sits right after the top spacer.
  const indexes = await rowIndexes(page)
  test.info().annotations.push({ type: "kept-window", description: JSON.stringify(indexes.slice(0, 4)) })
  expect(indexes[0]).toBe(4)
  expect(await bandCovered(page)).toBe(true)
  await page.keyboard.press("ArrowDown")
  await page.waitForTimeout(100)
  expect(await active(page)).toMatchObject({ row: 5, col: 3 })
  expect(await focusedVisible(page)).toBe(true)
})

test("e: focused row scrolled out of the window, without keep()", async ({ page }) => {
  await open(page)
  await page.getByTestId("keep").uncheck()
  await scroller(page).scrollIntoViewIfNeeded()
  await page.locator('[data-testid=virtual-grid] [id="3:2"]').click()
  await scrollTo(page, 100_000)
  const lost = await page.evaluate(() => document.activeElement?.tagName)
  test.info().annotations.push({ type: "focus-after-scroll-away", description: String(lost) })
  expect(lost).toBe("BODY")
  // Known breakage: the only tab stop lived on the unrendered cell, so the grid has none.
  const tabStops = await page.locator('[data-testid=virtual-grid] [tabindex="0"]').count()
  test.info().annotations.push({ type: "tab-stops-while-active-unrendered", description: String(tabStops) })
  expect(tabStops).toBe(0)
})

test("e: variable row height", async ({ page }) => {
  await open(page)
  await page.getByTestId("variable").check()
  await scroller(page).scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const heights = await page
    .locator("[data-testid=virtual-grid] tbody tr.vrow")
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
  expect(new Set(heights).size).toBeGreaterThan(1)

  // Measured heights differ from the estimate, so one jump to the end can land short.
  let jumps = 0
  let end: number[] = []
  while (jumps < 6) {
    jumps++
    await scrollTo(page, 10_000_000)
    end = await rowIndexes(page)
    if (end.at(-1) === 10001) break
  }
  test.info().annotations.push({ type: "jumps-to-reach-end", description: String(jumps) })
  console.log("jumps to reach end:", jumps)
  expect(end.at(-1)).toBe(10001)
  const gap = await page.evaluate(() => {
    const sc = document.querySelector("[data-testid=virtual-scroller]") as HTMLElement
    return sc.scrollHeight - sc.scrollTop - sc.clientHeight
  })
  test.info().annotations.push({ type: "scroll-left-after-end-rendered", description: String(gap) })
  const bottomSpacer = await page.getByTestId("spacer-bottom").evaluate((el) => el.getBoundingClientRect().height)
  expect(bottomSpacer).toBeLessThanOrEqual(1)

  await scrollTo(page, 0)
  await page.locator('[data-testid=virtual-grid] [id="1:0"]').click()
  await page.keyboard.press("Control+End")
  await page.waitForTimeout(300)
  expect(await active(page)).toMatchObject({ row: 10001, col: 8 })
  expect(await focusedVisible(page)).toBe(true)

  await page.keyboard.press("Control+Home")
  await page.keyboard.press("ArrowDown")
  for (let i = 0; i < 40; i++) await page.keyboard.press("PageDown")
  await page.waitForTimeout(200)
  expect(await active(page)).toMatchObject({ row: 402, col: 1 })
  expect(await focusedVisible(page)).toBe(true)

  // Jump far ahead: rendered rows must cover the whole visible band, no blank gap.
  for (const top of [200_000, 50_000, 350_000]) {
    await scrollTo(page, top)
    const covered = await bandCovered(page)
    expect(covered).toBe(true)
  }
})
