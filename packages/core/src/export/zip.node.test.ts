// @vitest-environment node
import { expect, test } from 'vite-plus/test'
import { toXlsx } from './xlsx'
import { zip } from './zip'

// jsdom has no stream of a Blob, so there the archive stores its files as
// they are. This file runs where a browser's compression exists.

async function inflate(bytes: Uint8Array): Promise<string> {
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'))
	return new Response(stream).text()
}

/** The first file of an archive: its method, its sizes and its bytes. */
function firstFile(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const packed = view.getUint32(18, true)
	const start = 30 + view.getUint16(26, true) + view.getUint16(28, true)
	return {
		method: view.getUint16(8, true),
		crc: view.getUint32(14, true),
		packed,
		size: view.getUint32(22, true),
		data: bytes.subarray(start, start + packed),
	}
}

test('a file of the archive is deflated, with the check sum and the length of its content', async () => {
	const text = 'The same line, many times. '.repeat(400)
	const bytes = await zip([{ name: 'a.txt', data: new TextEncoder().encode(text) }])
	const file = firstFile(bytes)
	expect(file.method).toBe(8)
	expect(file.size).toBe(text.length)
	expect(file.packed).toBeLessThan(text.length / 10)
	expect(await inflate(file.data)).toBe(text)
	const stored = firstFile(
		await zip([{ name: 'a.txt', data: new TextEncoder().encode(text) }], false),
	)
	expect(stored.method).toBe(0)
	expect(stored.crc).toBe(file.crc)
	// The same content gives the same bytes at each run.
	expect(await zip([{ name: 'a.txt', data: new TextEncoder().encode(text) }])).toEqual(bytes)
})

test('an Excel file is smaller with compression, and its first part reads the same', async () => {
	const column = { id: 'name', header: 'Name' }
	const data = {
		columns: [{ id: 'name', header: 'Name', column }],
		rows: Array.from({ length: 300 }, (_, index) => ({
			kind: 'row' as const,
			level: 0,
			cells: [{ value: `Person ${index}`, text: `Person ${index}` }],
		})),
		locale: 'en-US',
	}
	const packed = await toXlsx(data)
	const stored = await toXlsx(data, { compress: false })
	expect(packed.length).toBeLessThan(stored.length / 2)
	const first = firstFile(packed)
	expect(first.method).toBe(8)
	expect(await inflate(first.data)).toBe(new TextDecoder().decode(firstFile(stored).data))
})
