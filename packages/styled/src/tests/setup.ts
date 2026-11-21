// jsdom has no layout and no popover API. The popups of UI SDK call these
// when they open, so a test gives each one a version that does nothing. A
// test that runs in Node has no elements, and needs none of it.
if (typeof Element !== 'undefined') {
	const element = Element.prototype as unknown as Record<string, unknown>

	element.getAnimations ??= () => []
	element.scrollIntoView ??= () => {}
	element.showPopover ??= () => {}
	element.hidePopover ??= () => {}
}
