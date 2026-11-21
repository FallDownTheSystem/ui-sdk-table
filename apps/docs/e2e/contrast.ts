import type { Locator, Page } from '@playwright/test'

export type ContrastKind =
	| 'text'
	| 'placeholder'
	| 'border'
	| 'border-inside'
	| 'outline'
	| 'fill'
	| 'before'

type Contrast = { measure: (element: Element, kind: ContrastKind) => number }

declare global {
	interface Window {
		tableContrast: Contrast
	}
}

/**
 * Runs in the page. The colours of the page are `oklch` values, some with an
 * alpha, and some elements have an opacity. A canvas paints them over each
 * other as the browser does, and gives the result as sRGB numbers, which the
 * contrast formula of WCAG takes.
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

	/** One element: what it paints behind its content, and how much of itself it shows. */
	type Layer = { colours: readonly string[]; opacity: number }

	/** The colour that shows after the colours are painted over a base, from the back to the front. */
	function over(base: Rgb, colours: readonly string[]): Rgb {
		const target = canvas()
		target.globalAlpha = 1
		target.fillStyle = `rgb(${base[0]} ${base[1]} ${base[2]})`
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

	/**
	 * The colour of a background image that is one colour from its start to
	 * its end: the tint of a row on a cell that is opaque. Another image has
	 * no one colour, and a ratio against it would be a guess.
	 */
	function tint(image: string): string[] {
		if (image === 'none') return []
		const found = /^linear-gradient\((.+) 100%, rgba\(0, 0, 0, 0\) 100%\)$/.exec(image)
		if (!found?.[1]) throw new Error(`The contrast check cannot read the background "${image}".`)
		return [found[1]]
	}

	/** The elements behind an element, from the page to the element itself. */
	function layers(element: Element | null): Layer[] {
		const found: Layer[] = []
		for (let current = element; current; current = current.parentElement) {
			const style = getComputedStyle(current)
			found.unshift({
				colours: [style.backgroundColor, ...tint(style.backgroundImage)],
				opacity: Number(style.opacity),
			})
		}
		return found
	}

	/**
	 * The colour that a person sees: the layers over white, with `front`
	 * painted last, inside the innermost element. An element with an opacity
	 * shows itself and all that is in it in part, over what is behind it.
	 */
	function shown(chain: readonly Layer[], front: readonly string[] = []): Rgb {
		function from(index: number, base: Rgb): Rgb {
			const layer = chain[index]
			if (!layer) return over(base, front)
			const inner = from(index + 1, over(base, layer.colours))
			if (layer.opacity >= 1) return inner
			const mix = (behind: number, own: number) =>
				Math.round(behind * (1 - layer.opacity) + own * layer.opacity)
			return [mix(base[0], inner[0]), mix(base[1], inner[1]), mix(base[2], inner[2])]
		}
		return from(0, [255, 255, 255])
	}

	window.tableContrast = {
		measure(element, kind) {
			const style = getComputedStyle(element)
			const own = layers(element)
			const around = layers(element.parentElement)
			// A line or a ring of the element over what is around it: the element
			// paints it, so it fades with the element, and the fill of the element is not behind it.
			const edge = [...around, { colours: [], opacity: Number(style.opacity) }]
			if (kind === 'text') return ratio(shown(own, [style.color]), shown(own))
			if (kind === 'placeholder') {
				return ratio(shown(own, [getComputedStyle(element, '::placeholder').color]), shown(own))
			}
			// A mark that an element draws in front of its text, such as a dot.
			if (kind === 'before') {
				return ratio(
					shown(own, [getComputedStyle(element, '::before').backgroundColor]),
					shown(own),
				)
			}
			// The line around a control, against what is around the control.
			if (kind === 'border') return ratio(shown(edge, [style.borderTopColor]), shown(around))
			// The same line against the fill of the control itself, on its other side.
			if (kind === 'border-inside') return ratio(shown(own, [style.borderTopColor]), shown(own))
			// A focus ring sits outside its control, or inside a cell of the table.
			if (kind === 'outline') {
				if (style.outlineStyle === 'none' || Number.parseFloat(style.outlineWidth) < 2) return 0
				return Number.parseFloat(style.outlineOffset) < 0
					? ratio(shown(own, [style.outlineColor]), shown(own))
					: ratio(shown(edge, [style.outlineColor]), shown(around))
			}
			// The fill of a control, such as a checked checkbox, against what is around it.
			return ratio(shown(own), shown(around))
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
