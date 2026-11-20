import { expect, type Page } from "@playwright/test"

export async function open(page: Page) {
  const warnings: string[] = []
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error") warnings.push(m.text())
  })
  page.on("pageerror", (e) => warnings.push(`pageerror: ${e.message}`))
  await page.goto("/")
  await expect(page.locator("[data-testid=virtual-grid]")).toBeVisible()
  return warnings
}

export type Active = { row: number; col: number; tag: string; text: string } | null

export function active(page: Page): Promise<Active> {
  return page.evaluate(() => {
    const el = document.activeElement
    const cell = el?.closest("[aria-colindex]")
    const row = cell?.closest("[aria-rowindex]")
    if (!el || !cell || !row) return null
    return {
      row: Number(row.getAttribute("aria-rowindex")),
      col: Number(cell.getAttribute("aria-colindex")),
      tag: el.tagName,
      text: (el.textContent ?? "").trim(),
    }
  })
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + Math.sign(to.x - from.x) * 6, from.y, { steps: 2 })
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

export async function center(page: Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
