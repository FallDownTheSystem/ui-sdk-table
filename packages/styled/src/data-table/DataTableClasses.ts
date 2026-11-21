/**
 * The looks of the controls, as Tailwind classes with the token names of the
 * app. One place holds them, because a trigger of a menu, a page link and a
 * plain button are different parts that look the same.
 *
 * The line around a control is `foreground/50`, not `input`: the `input`
 * token has a contrast of about 1.3 to 1 against the page, and the line is
 * what shows where a field or a checkbox is, so it needs 3 to 1.
 */

const focus =
	'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring'

const button =
	'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'

const variants = {
	outline:
		'border border-foreground/50 bg-background text-foreground hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50',
	ghost:
		'border border-transparent text-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
} as const

const sizes = {
	default: 'h-9 px-3',
	sm: 'h-8 px-2.5',
	icon: 'size-9',
	'icon-sm': 'size-8',
	'icon-xs': 'size-6',
} as const

export type DataTableButtonVariant = keyof typeof variants
export type DataTableButtonSize = keyof typeof sizes

/** The classes of a button, for a `Button` and for every part that is one: a trigger, a page link. */
export function buttonClass(
	variant: DataTableButtonVariant = 'outline',
	size: DataTableButtonSize = 'default',
): string {
	return `${button} ${focus} ${variants[variant]} ${sizes[size]}`
}

export const inputClass =
	'h-9 w-full min-w-0 rounded-md border border-foreground/50 bg-transparent px-3 py-1 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:bg-input/30'

export const selectTriggerClass =
	'flex w-fit cursor-pointer items-center justify-between gap-1.5 rounded-md border border-foreground/50 bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap text-foreground shadow-xs transition-[color,box-shadow] outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'

/** A popup opens and closes with a short fade from the point of its trigger. */
const popup =
	'z-50 origin-(--transform-origin) bg-popover text-popover-foreground shadow-md transition-[opacity,scale] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none'

export const listContentClass = `${popup} max-h-(--available-height) min-w-36 overflow-x-hidden overflow-y-auto rounded-md border border-border p-1 outline-hidden`

export const listItemClass =
	'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'

/** The place of the check mark of a list item, at its end. */
export const listIndicatorClass = 'absolute right-2 flex size-4 items-center justify-center'

export const popoverContentClass = `${popup} flex max-h-(--available-height) w-105 max-w-(--available-width) flex-col gap-4 overflow-y-auto rounded-md p-4 text-sm ring-1 ring-foreground/10 outline-hidden`

export const checkboxClass =
	'peer inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-foreground/50 text-primary-foreground shadow-xs transition-shadow outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 data-indeterminate:border-primary data-indeterminate:bg-primary [&_svg]:size-3'

/** A grey bar that stands in for content on its way. */
export const skeletonClass = 'h-4 animate-pulse rounded-md bg-foreground/10'
