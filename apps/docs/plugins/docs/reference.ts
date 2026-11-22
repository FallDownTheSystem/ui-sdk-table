import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/**
 * The entries of the package that the reference reads, by the name an app
 * imports them with. A type of the reference is found in the first entry
 * that exports it.
 */
const ENTRIES: Record<string, string> = {
	'ui-sdk-table-vue': '../../../../packages/vue/src/index.ts',
	'ui-sdk-table-vue/formulas': '../../../../packages/vue/src/formulas.ts',
	'ui-sdk-table-vue/export': '../../../../packages/vue/src/export.ts',
}

/** The core entry: the Vue entry hides its `TableOptions`, whose callbacks hold the words of the events. */
const CORE = '../../../../packages/core/src/index.ts'

/** A marker of a reference list stands on a line of its own: `<Members of="TableProps" />`. */
export const MEMBERS = /^<Members of="([\w-]+)" \/>$/gm

export type Member = {
	/** The name as an app writes it: a prop, an event, a slot, a method or a key. */
	name: string
	optional: boolean
	/** The type as the source writes it. */
	type: string
	/** The comment of the member in the source, on one line. */
	doc: string
}

type Reader = { checker: ts.TypeChecker; exports: Map<string, ts.Symbol>; options?: ts.Symbol }

let reader: Reader | undefined

function read(): Reader {
	if (reader) return reader
	const files = Object.values(ENTRIES).map((path) => fileURLToPath(new URL(path, import.meta.url)))
	const core = fileURLToPath(new URL(CORE, import.meta.url))
	const program = ts.createProgram([...files, core], {
		strict: true,
		target: ts.ScriptTarget.ES2023,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		allowImportingTsExtensions: true,
		noEmit: true,
		skipLibCheck: true,
		lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
	})
	const checker = program.getTypeChecker()
	const exports = new Map<string, ts.Symbol>()
	for (const file of files) {
		const source = program.getSourceFile(file)
		const module = source && checker.getSymbolAtLocation(source)
		if (!module) throw new Error(`The reference cannot read ${file}.`)
		for (const symbol of checker.getExportsOfModule(module)) {
			if (exports.has(symbol.name)) continue
			exports.set(
				symbol.name,
				symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol,
			)
		}
	}
	const coreSource = program.getSourceFile(core)
	const coreModule = coreSource && checker.getSymbolAtLocation(coreSource)
	const options = coreModule
		? checker.getExportsOfModule(coreModule).find((symbol) => symbol.name === 'TableOptions')
		: undefined
	reader = {
		checker,
		exports,
		options:
			options && options.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(options) : options,
	}
	return reader
}

const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim()

function docOf(symbol: ts.Symbol, checker: ts.TypeChecker): string {
	return oneLine(ts.displayPartsToString(symbol.getDocumentationComment(checker)))
}

function docOfNode(node: ts.Node): string {
	const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc)
	const comment = docs.at(-1)?.comment
	return oneLine(typeof comment === 'string' ? comment : (ts.getTextOfJSDocComment(comment) ?? ''))
}

function typeText(symbol: ts.Symbol, checker: ts.TypeChecker, at: ts.Node): string {
	const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0]
	if (
		declaration &&
		(ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) &&
		declaration.type
	) {
		return oneLine(declaration.type.getText())
	}
	if (declaration && ts.isMethodSignature(declaration)) {
		const parameters = declaration.parameters.map((parameter) => parameter.getText()).join(', ')
		return oneLine(`(${parameters}) => ${declaration.type?.getText() ?? 'void'}`)
	}
	return checker.typeToString(
		checker.getTypeOfSymbolAtLocation(symbol, at),
		at,
		ts.TypeFormatFlags.NoTruncation,
	)
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The words of a member of the state contract that the source writes once:
 * `default<Key>` and the events of `<key>` say the same for every key.
 */
function contractDoc(name: string, has: (name: string) => boolean): string {
	const state = /^default([A-Z]\w*)$/.exec(name)?.[1]
	if (state) {
		const key = state.charAt(0).toLowerCase() + state.slice(1)
		if (has(key)) return `The \`${key}\` at first, when the table holds this state itself.`
	}
	const model = /^update:(\w+)$/.exec(name)?.[1]
	if (model)
		return `The new \`${model}\`, for \`v-model:${model}\`. It does not run when \`${model}Change\` cancels the change.`
	const change = /^(\w+)Change$/.exec(name)?.[1]
	if (change && has(change)) {
		return `Runs when \`${change}\` wants to change, with the new value and its details. \`details.reason\` says why, and \`details.cancel()\` keeps the old value.`
	}
	return ''
}

/** The members of an exported type, in the order of its source, with their types and comments. */
export function members(typeName: string): Member[] {
	const { checker, exports, options } = read()
	const symbol = exports.get(typeName)
	if (!symbol || !(symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface))) {
		const types = [...exports.values()]
			.filter((item) => item.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface))
			.map((item) => item.name)
			.toSorted()
		throw new Error(
			`The package exports no type "${typeName}". Its types are: ${types.join(', ')}.`,
		)
	}
	const at = symbol.declarations?.[0]
	if (!at) throw new Error(`The type "${typeName}" has no declaration.`)
	const type = checker.getDeclaredTypeOfSymbol(symbol)
	const properties = type.getProperties()
	const names = new Set(properties.map((property) => property.name))
	// The events of the Vue table carry no comment of their own: their words
	// are those of the callback of the core options (`sortChange` is `onSortChange`).
	const optionDocs = new Map(
		options
			? checker
					.getDeclaredTypeOfSymbol(options)
					.getProperties()
					.map((property) => [property.name, docOf(property, checker)])
			: [],
	)
	const fromOptions = (name: string) => optionDocs.get(`on${capital(name)}`) ?? ''
	const list: Member[] = []
	for (const info of checker.getIndexInfosOfType(type)) {
		const declaration = info.declaration
		const key = checker.typeToString(info.keyType)
		list.push({
			name: key.replace(/^`|`$/g, '').replace(/\$\{string\}/g, '{id}'),
			optional: true,
			type: declaration?.type
				? oneLine(declaration.type.getText())
				: checker.typeToString(info.type),
			doc: declaration ? docOfNode(declaration) : '',
		})
	}
	for (const property of properties) {
		const optional = !!(property.flags & ts.SymbolFlags.Optional)
		const doc =
			docOf(property, checker) ||
			fromOptions(property.name) ||
			contractDoc(property.name, (name) => names.has(name) || optionDocs.has(name))
		list.push({ name: property.name, optional, type: typeText(property, checker, at), doc })
	}
	return list
}

/** The comment of an exported type, function or value. */
export function exportDoc(name: string): string {
	const { checker, exports } = read()
	const symbol = exports.get(name)
	return symbol ? docOf(symbol, checker) : ''
}

/** The members of a type as a list in the format of a page: `- \`name?\` (\`type\`): words`. */
export function membersMarkdown(typeName: string): string {
	return members(typeName)
		.map((member) => {
			const type = member.type.includes('`') ? member.type : `\`${member.type}\``
			const words = member.doc ? `: ${member.doc}` : ''
			return `- \`${member.name}${member.optional ? '?' : ''}\` (${type})${words}`
		})
		.join('\n')
}

/** A page with each marker of a reference list replaced by the list. */
export function expandMembers(source: string): string {
	return source.replace(MEMBERS, (_, name: string) => membersMarkdown(name))
}
