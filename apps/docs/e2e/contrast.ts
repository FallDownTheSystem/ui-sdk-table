import type { Locator, Page } from '@playwright/test'

export type ContrastKind = 'text' | 'placeholder' | 'border' | 'outline' | 'fill' | 'before'

type Contrast = { measure: (element: Element, kind: ContrastKind) => number }

declare global {
	interface Window {
		tableContrast: Contrast
	}
}

/**
 * Runs in the page. The colours of the page are `oklch` values, some with an
 * alpha. A canvas paints them over each other as the browser does, and gives
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

	/** The colour that shows after the layers are painted over white, from the back to the front. */
	function paint(layers: readonly string[]): Rgb {
		const target = canvas()
		target.globalAlpha = 1
		target.fillStyle = 'white'
		target.fillRect(0, 0, 1, 1)
		for (const layer of layers) {
			target.fillStyle = layer
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
		const layers: string[] = []
		for (let current = element; current; current = current.parentElement) {
			layers.unshift(getComputedStyle(current).backgroundColor)
		}
		return layers
	}

	window.tableContrast = {
		measure(element, kind) {
			const style = getComputedStyle(element)
			const own = fills(element)
			const around = fills(element.parentElement)
			if (kind === 'text') return ratio(paint([...own, style.color]), paint(own))
			if (kind === 'placeholder') {
				return ratio(paint([...own, getComputedStyle(element, '::placeholder').color]), paint(own))
			}
			// A mark that an element draws in front of its text, such as a dot.
			if (kind === 'before') {
				return ratio(
					paint([...own, getComputedStyle(element, '::before').backgroundColor]),
					paint(own),
				)
			}
			// The line around a control, against what is around the control.
			if (kind === 'border') return ratio(paint([...around, style.borderTopColor]), paint(around))
			// A focus ring sits outside its control, or inside a cell of the table.
			if (kind === 'outline') {
				if (style.outlineStyle === 'none' || Number.parseFloat(style.outlineWidth) < 2) return 0
				const behind = Number.parseFloat(style.outlineOffset) < 0 ? own : around
				return ratio(paint([...behind, style.outlineColor]), paint(behind))
			}
			// The fill of a control, such as a checked checkbox, against what is around it.
			return ratio(paint(own), paint(around))
		},
	}
}

export const installContrast = (page: Page) => page.addInitScript(install)

/**
 * A colour is read at its end value: a hover or a focus starts a transition,
 * and a value on its way there would give a ratio that no one sees for long.
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
