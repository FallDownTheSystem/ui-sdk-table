import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const LIBRARY = /^ui-sdk-table-(?:vue|core)(?:\/export)?$/

// Attributes of the `Table` element that are not options of the table.
const PLAIN = /^(?:class|style|id|ref|key|dir|lang|role|tabindex|aria-.*|data-.*|v-(?!model:).*)$/

const SLOT_NAMES = [
	'group-total',
	'group',
	'detail',
	'empty',
	'loading',
	'cell',
	'editor',
	'header',
	'foot',
]
// The slots of one column, by the name of the slot for every column.
const SLOT_PREFIXES: [prefix: string, name: string][] = [
	['group-total-', 'group-total'],
	['col-', 'col'],
	['header-', 'header'],
	['foot-', 'foot'],
	['edit-', 'edit'],
]

const camel = (name: string) => name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())

/** `SortTwoColumns` gives `sort-two-columns`, the id of the tile in that file. */
export const tileId = (file: string) =>
	file
		.replace(/\.vue$/, '')
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()

function slotName(name: string): string {
	if (SLOT_NAMES.includes(name)) return name
	return SLOT_PREFIXES.find(([prefix]) => name.startsWith(prefix))?.[1] ?? name
}

function imported(source: string, names: Set<string>) {
	const lists = [
		...source.matchAll(/import\s*\{([^{}]*)\}\s*from\s*'([^']+)'/g),
		...source.matchAll(/\{([^{}]*)\}\s*=\s*await import\('([^']+)'\)/g),
	]
	for (const [, list = '', from = ''] of lists) {
		if (!LIBRARY.test(from)) continue
		for (const part of list.split(',')) {
			const name = part.trim().split(/\s+as\s+|\s*:\s*/)[0] ?? ''
			if (name && !name.startsWith('type ') && name !== 'Table') names.add(name)
		}
	}
}

function controllerCalls(source: string, names: Set<string>) {
	// An action that an agent runs is named as a text: `act('sortBy', ...)`, or `action: 'sortBy'`.
	for (const [, action = ''] of source.matchAll(/\b(?:act\(|action:\s*)'(\w+)'/g)) names.add(action)
	for (const [, controller = ''] of source.matchAll(/(\w+)\s*=\s*createTableController\b/g)) {
		const calls = new RegExp(`\\b${controller}\\.(\\w+)\\(`, 'g')
		for (const [, method = ''] of source.matchAll(calls)) names.add(method)
	}
}

/** The end of an opening tag that starts at `from`, past the `>` characters inside its attribute values. */
function tagEnd(source: string, from: number): number {
	let quote = ''
	for (let index = from; index < source.length; index++) {
		const char = source[index]
		if (quote) {
			if (char === quote) quote = ''
		} else if (char === '"' || char === "'") quote = char
		else if (char === '>') return index
	}
	return source.length
}

function tableElement(source: string, names: Set<string>) {
	for (const { index: start = 0 } of source.matchAll(/<Table\s/g)) {
		const end = tagEnd(source, start)
		const attributes = source.slice(start + '<Table'.length, end)
		for (const [, name = ''] of attributes.matchAll(/([@:#]?[\w:.-]+)(?:=(?:"[^"]*"|'[^']*'))?/g)) {
			if (name.startsWith('v-model:')) names.add(camel(name.slice('v-model:'.length)))
			else if (name.startsWith('@update:')) names.add(camel(name.slice('@update:'.length)))
			else if (name.startsWith('@')) {
				const event = camel(name.slice(1).split('.')[0] ?? '')
				names.add(`on${event.charAt(0).toUpperCase()}${event.slice(1)}`)
			} else {
				const plain = name.replace(/^:/, '')
				if (!PLAIN.test(plain)) names.add(camel(plain))
			}
		}
		const close = source.indexOf('</Table>', end)
		const content = close === -1 ? '' : source.slice(end, close)
		for (const [, slot = ''] of content.matchAll(/<template\s+(?:#|v-slot:)([\w-]+)/g)) {
			names.add(`slot.${slotName(slot)}`)
		}
	}
}

type Frame = 'columns' | 'column' | 'other'

/** The keys of the column objects in each list that is typed as `ColumnDef<...>[]`. */
function columnKeys(source: string, names: Set<string>) {
	for (const match of source.matchAll(/ColumnDef<[^>]*>\[\]\s*=\s*\[/g)) {
		const stack: Frame[] = ['columns']
		let key = ''
		// Whether the next word can be the key of an object: after `{` or `,`.
		let atKey = false
		for (let index = match.index + match[0].length; index < source.length && stack.length;) {
			const char = source[index] ?? ''
			const top = stack.at(-1)
			if (char === "'" || char === '"' || char === '`') {
				index = source.indexOf(char, index + 1) + 1 || source.length
				atKey = false
			} else if (source.startsWith('//', index)) {
				index = source.indexOf('\n', index) + 1 || source.length
			} else if (char === '{') {
				stack.push(top === 'columns' ? 'column' : 'other')
				atKey = true
				index++
			} else if (char === '[') {
				stack.push(top === 'column' && key === 'columns' ? 'columns' : 'other')
				index++
			} else if (char === '(') {
				stack.push('other')
				index++
			} else if (char === '}' || char === ']' || char === ')') {
				stack.pop()
				atKey = false
				index++
			} else if (char === ',') {
				atKey = true
				index++
			} else if (/\s/.test(char)) {
				index++
			} else {
				const word = /^[A-Za-z_$][\w$]*/.exec(source.slice(index, index + 40))?.[0]
				if (word && atKey && top === 'column' && /^\s*:/.test(source.slice(index + word.length))) {
					key = word
					names.add(`column.${word}`)
				}
				atKey = false
				index += word?.length ?? 1
			}
		}
	}
}

/**
 * The names of the table library that the source of one tile uses: its
 * imports, the options, models, events and slots of its `Table` element, the
 * methods that it calls on a controller, and the options of its columns.
 * The names are read as written; a test holds them against the library.
 */
export function usesOf(source: string): string[] {
	const names = new Set<string>()
	imported(source, names)
	controllerCalls(source, names)
	tableElement(source, names)
	columnKeys(source, names)
	return [...names].sort()
}

const VIRTUAL = 'virtual:sink-uses'
const RESOLVED = `\0${VIRTUAL}`

/**
 * `virtual:sink-uses`: the names that each tile of the sink page uses, by the
 * id of the tile. They are read from the tile files when the page is built,
 * so the tags of a tile cannot differ from its code.
 */
export function sinkUses(tilesDirectory: string): Plugin {
	return {
		name: 'sink-uses',
		resolveId: (id) => (id === VIRTUAL ? RESOLVED : undefined),
		load(id) {
			if (id !== RESOLVED) return undefined
			const uses: Record<string, string[]> = {}
			for (const group of readdirSync(tilesDirectory, { withFileTypes: true })) {
				if (!group.isDirectory()) continue
				for (const file of readdirSync(join(tilesDirectory, group.name))) {
					if (!file.endsWith('.vue')) continue
					const path = join(tilesDirectory, group.name, file)
					this.addWatchFile(path)
					uses[tileId(file)] = usesOf(readFileSync(path, 'utf8'))
				}
			}
			return `export const uses = ${JSON.stringify(uses)}`
		},
	}
}
