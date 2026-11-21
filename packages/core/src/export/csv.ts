import type { ExportData } from './data'

export type CsvOptions = {
	/** The text between two cells. Defaults to a comma. */
	separator?: string
	/** The text between two rows. Defaults to `\r\n`, as RFC 4180 says. */
	lineEnd?: string
	/** Whether the first row holds the header texts. Defaults to true. */
	header?: boolean
	/**
	 * Whether the text starts with a byte order mark. Defaults to true: without
	 * it, Excel reads a UTF-8 file in the code page of the computer.
	 */
	bom?: boolean
	/**
	 * Whether a text that a spreadsheet would read as a formula gets a `'`
	 * before it. Defaults to true. A cell that a person typed can otherwise
	 * run a formula on the computer of the person who opens the file.
	 */
	escapeFormulas?: boolean
}

// A formatted number such as "-1,234.50" or "+5 %" starts with a sign and is no formula.
const NUMBER_TEXT = /^[+-]?[\d\s.,']+%?$/
const FORMULA_START = /^[=+\-@\t\r]/
// Intl puts a no-break space between number groups and before units. Most
// programs that read CSV do not take it for a space.
const NO_BREAK_SPACES = /[\u00A0\u202F]/g

/**
 * Writes the cells as CSV text. Each cell holds the text of the screen, so a
 * number has the format of its column.
 */
export function toCsv(data: ExportData, options: CsvOptions = {}): string {
	const separator = options.separator ?? ','
	const lineEnd = options.lineEnd ?? '\r\n'
	const escapeFormulas = options.escapeFormulas !== false
	const special = new RegExp(
		`["\\r\\n]|^\\s|\\s$|${separator.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}`,
	)

	const cell = (text: string, value?: unknown): string => {
		let clean = text.replace(NO_BREAK_SPACES, ' ')
		if (
			escapeFormulas &&
			typeof value !== 'number' &&
			FORMULA_START.test(clean) &&
			!NUMBER_TEXT.test(clean)
		) {
			clean = `'${clean}`
		}
		return special.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean
	}

	const lines: string[] = []
	if (options.header !== false) {
		lines.push(data.columns.map((column) => cell(column.header)).join(separator))
	}
	for (const row of data.rows) {
		lines.push(row.cells.map((item) => cell(item.text, item.value)).join(separator))
	}
	return (
		(options.bom === false ? '' : '\uFEFF') + lines.join(lineEnd) + (lines.length ? lineEnd : '')
	)
}
