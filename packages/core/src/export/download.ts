import { toCsv, type CsvOptions } from './csv'
import type { ExportData } from './data'
import { toXlsx, XLSX_TYPE, type XlsxOptions } from './xlsx'

/** Saves a text or bytes as a file on the computer of the person. It needs a browser. */
export function downloadFile(content: string | Uint8Array, filename: string, type: string): void {
	const url = URL.createObjectURL(new Blob([content as BlobPart], { type }))
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.hidden = true
	document.body.append(link)
	link.click()
	link.remove()
	// The browser starts the download after this task, so the address must live a moment longer.
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const named = (filename: string, extension: string) =>
	filename.toLowerCase().endsWith(extension) ? filename : filename + extension

/** Saves the cells as a CSV file. */
export function downloadCsv(data: ExportData, filename = 'export', options?: CsvOptions): void {
	downloadFile(toCsv(data, options), named(filename, '.csv'), 'text/csv;charset=utf-8')
}

/** Saves the cells as an Excel file. */
export async function downloadXlsx(
	data: ExportData,
	filename = 'export',
	options?: XlsxOptions,
): Promise<void> {
	downloadFile(await toXlsx(data, options), named(filename, '.xlsx'), XLSX_TYPE)
}
