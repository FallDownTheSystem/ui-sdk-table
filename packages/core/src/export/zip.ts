export type ZipFile = {
	/** The path of the file in the archive. */
	name: string
	/** The bytes of the file. */
	data: Uint8Array
}

let table: Uint32Array | undefined

function crc32(data: Uint8Array): number {
	if (!table) {
		table = new Uint32Array(256)
		for (let n = 0; n < 256; n++) {
			let c = n
			for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
			table[n] = c >>> 0
		}
	}
	let crc = 0xffffffff
	for (let index = 0; index < data.length; index++) {
		crc = (table[(crc ^ (data[index] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8)
	}
	return (crc ^ 0xffffffff) >>> 0
}

async function deflate(data: Uint8Array): Promise<Uint8Array | undefined> {
	if (typeof CompressionStream === 'undefined') return undefined
	try {
		const stream = new Blob([data as BlobPart])
			.stream()
			.pipeThrough(new CompressionStream('deflate-raw'))
		return new Uint8Array(await new Response(stream).arrayBuffer())
	} catch {
		// An environment that has the class and not the format still gets a valid file.
		return undefined
	}
}

// A fixed moment, 1980-01-01 00:00, so the same cells give the same bytes.
const DOS_TIME = 0
const DOS_DATE = 0x0021

/**
 * Packs files into a ZIP archive. The files are deflated where the
 * environment can do that, and stored as they are elsewhere; a reader takes
 * both. File names must be ASCII.
 */
export async function zip(files: readonly ZipFile[], compress = true): Promise<Uint8Array> {
	const encoder = new TextEncoder()
	const entries = await Promise.all(
		files.map(async (file) => {
			const packed = compress ? await deflate(file.data) : undefined
			// A file that grows when it is deflated is stored.
			const body = packed && packed.length < file.data.length ? packed : file.data
			return {
				name: encoder.encode(file.name),
				body,
				method: body === file.data ? 0 : 8,
				crc: crc32(file.data),
				size: file.data.length,
			}
		}),
	)

	const local = entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.body.length, 0)
	const central = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0)
	const bytes = new Uint8Array(local + central + 22)
	const view = new DataView(bytes.buffer)
	let at = 0
	const offsets: number[] = []

	for (const entry of entries) {
		offsets.push(at)
		view.setUint32(at, 0x04034b50, true)
		view.setUint16(at + 4, 20, true)
		view.setUint16(at + 6, 0, true)
		view.setUint16(at + 8, entry.method, true)
		view.setUint16(at + 10, DOS_TIME, true)
		view.setUint16(at + 12, DOS_DATE, true)
		view.setUint32(at + 14, entry.crc, true)
		view.setUint32(at + 18, entry.body.length, true)
		view.setUint32(at + 22, entry.size, true)
		view.setUint16(at + 26, entry.name.length, true)
		view.setUint16(at + 28, 0, true)
		bytes.set(entry.name, at + 30)
		bytes.set(entry.body, at + 30 + entry.name.length)
		at += 30 + entry.name.length + entry.body.length
	}

	const start = at
	entries.forEach((entry, index) => {
		view.setUint32(at, 0x02014b50, true)
		view.setUint16(at + 4, 20, true)
		view.setUint16(at + 6, 20, true)
		view.setUint16(at + 8, 0, true)
		view.setUint16(at + 10, entry.method, true)
		view.setUint16(at + 12, DOS_TIME, true)
		view.setUint16(at + 14, DOS_DATE, true)
		view.setUint32(at + 16, entry.crc, true)
		view.setUint32(at + 20, entry.body.length, true)
		view.setUint32(at + 24, entry.size, true)
		view.setUint16(at + 28, entry.name.length, true)
		// Extra field, comment, disk number, internal attributes: none. External attributes: none.
		view.setUint32(at + 42, offsets[index] ?? 0, true)
		bytes.set(entry.name, at + 46)
		at += 46 + entry.name.length
	})

	view.setUint32(at, 0x06054b50, true)
	view.setUint16(at + 8, entries.length, true)
	view.setUint16(at + 10, entries.length, true)
	view.setUint32(at + 12, at - start, true)
	view.setUint32(at + 16, start, true)
	return bytes
}
