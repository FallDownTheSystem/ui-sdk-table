/**
 * The groups of the docs and the pages in them, in the order of the
 * sidebar, of Previous and Next and of the generated files. A page `id` is
 * the file `pages/<id>.md`. The pages of a group with `inline` stand whole
 * in `llms.txt`; every other page has one line there.
 */
export const groups: readonly { title: string; inline?: boolean; pages: readonly string[] }[] = [
	{ title: 'Get started', inline: true, pages: ['introduction', 'installation', 'first-table'] },
]
