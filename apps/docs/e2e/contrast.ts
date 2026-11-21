import type { Locator, Page } from '@playwright/test'

/**
 * What is held against what:
 * - `text`: the text of an element against the fill behind it;
 * - `placeholder`: the placeholder of a field against the fill of the field;
 * - `border`: the line around a control against what is around the control;
 * - `outline`: a focus ring against the ground it is drawn on;
 * - `fill`: the fill of a control against what is around it.
 */
export type ContrastKind = 'text' | 'placeholder' | 'border' | 'outline' | 'fill'

type Contrast = {
	measure: (element: Element, kind: ContrastKind) => number
	pair: (front: string, back: string) => number
	pairOver: (front: string, element: Element) => number
}

declare global {
	interface Window {
		tableContrast: Contrast
	}
}

/**
 * Runs in the page. The colours of the page are `oklch` values and mixes of
 * them. A canvas paints them over each other as the browser does, and gives
 * the result as sRGB numbers, which the contrast formula of WCAG takes.
 */
function install() {
	type Rgb = [number, number, number]
	let context: CanvasRenderingContext2D | undefined

	function canvas(): CanvasRenderingContext2D {
		if (context) return context
		const element = document.createElement('canvas')
		element.width = 1
		element.height = 1
		const made = element.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' })
		if (!made) throw new Error('The page has no canvas.')
		context = made
		return made
	}

	/** The colour that shows after the colours are painted over white, from the back to the front. */
	function over(colours: readonly string[]): Rgb {
		const target = canvas()
		target.fillStyle = 'rgb(255 255 255)'
		target.fillRect(0, 0, 1, 1)
		for (const colour of colours) {
			target.fillStyle = colour
			target.fillRect(0, 0, 1, 1)
		}
		const [red = 0, green = 0, blue = 0] = target.getImageData(0, 0, 1, 1).data
		return [red, green, blue]
	}

	function luminance([red, green, blue]: Rgb): number {
		const linear = (value: number) => {
			const part = value / 255
			return part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4
		}
		return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
	}

	function ratio(a: Rgb, b: Rgb): number {
		const [first, second] = [luminance(a), luminance(b)]
		return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
	}

	/** The fills behind an element, from the page to the element itself. */
	function fills(element: Element | null): string[] {
		const found: string[] = []
		for (let current = element; current; current = current.parentElement) {
			const style = getComputedStyle(current)
			// A picture or an opacity has no one colour, and a ratio against it would be a guess.
			if (style.backgroundImage !== 'none' || Number(style.opacity) < 1) {
				throw new Error('The contrast check reads plain fills only.')
			}
			found.unshift(style.backgroundColor)
		}
		return found
	}

	window.tableContrast = {
		pair: (front, back) => ratio(over([back, front]), over([back])),
		pairOver: (front, element) => {
			const ground = fills(element)
			return ratio(over([...ground, front]), over(ground))
		},
		measure(element, kind) {
			const style = getComputedStyle(element)
			const own = fills(element)
			const around = fills(element.parentElement)
			if (kind === 'text') return ratio(over([...own, style.color]), over(own))
			if (kind === 'placeholder') {
				return ratio(over([...own, getComputedStyle(element, '::placeholder').color]), over(own))
			}
			if (kind === 'border') return ratio(over([...around, style.borderTopColor]), over(around))
			if (kind === 'outline') {
				if (style.outlineStyle === 'none' || Number.parseFloat(style.outlineWidth) < 2) return 0
				// A ring with an offset below zero is drawn inside its element, over its fill.
				const ground = Number.parseFloat(style.outlineOffset) < 0 ? own : around
				return ratio(over([...ground, style.outlineColor]), over(ground))
			}
			return ratio(over(own), over(around))
		},
	}
}

export const installContrast = (page: Page) => page.addInitScript(install)

/**
 * A colour is read at its end value: a hover or a focus can start a
 * transition, and a value on its way gives a ratio that no one sees for long.
 */
export const contrastOf = (locator: Locator, kind: ContrastKind) =>
	locator.evaluate(async (element, kind) => {
		const running = document
			.getAnimations()
			.filter((animation) => animation instanceof CSSTransition)
			.map((animation) => animation.finished.catch(() => undefined))
		await Promise.all(running)
		return window.tableContrast.measure(element, kind)
	}, kind)

/** One computed colour of an element, or of a part that it draws such as `::after`. */
export const colourOf = (locator: Locator, property: string, pseudo?: string) =>
	locator.evaluate(
		(element, [property, pseudo]) =>
			getComputedStyle(element, pseudo).getPropertyValue(property ?? 'color'),
		[property, pseudo] as const,
	)

/** The ratio of a colour painted over an element, against that element: its own fill over every fill behind it. */
export const contrastOver = (front: string, back: Locator) =>
	back.evaluate((element, front) => window.tableContrast.pairOver(front, element), front)

/** The ratio of two colours as written, the first painted over the second. */
export const contrastOfPair = (page: Page, front: string, back: string) =>
	page.evaluate(([front, back]) => window.tableContrast.pair(front, back), [front, back] as const)
