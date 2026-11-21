import type { StandardSchemaV1 } from 'ui-sdk-table-vue'

export { createPeople, type Person } from '../benchmark/data'

/**
 * A schema of the Standard Schema kind, written by hand: the test answers
 * with the reason of a refusal, or with nothing. A schema of Zod, Valibot or
 * ArkType has the same shape and goes in the same place. The test can answer
 * with a promise, for a check that only a server can do.
 */
export function check(
	test: (value: unknown) => string | undefined | Promise<string | undefined>,
): StandardSchemaV1 {
	const answer = (value: unknown, message: string | undefined) =>
		message === undefined ? { value } : { issues: [{ message }] }
	return {
		'~standard': {
			version: 1,
			vendor: 'sink',
			validate: (value) => {
				const message = test(value)
				return message instanceof Promise
					? message.then((text) => answer(value, text))
					: answer(value, message)
			},
		},
	}
}

export type Order = {
	id: string
	customer: string
	city: string
	status: 'Paid' | 'Open' | 'Late'
	items: number
	total: number
	placed: string
}

const CUSTOMERS = [
	'Aalto Works',
	'Birch & Co',
	'Cobalt Lab',
	'Dune Supply',
	'Ember Foods',
	'Fjord Tools',
	'Granite Bank',
	'Harbor Cafe',
	'Iris Optics',
	'Juniper Inn',
	'Kelp Studio',
	'Lumen Press',
	'Moss Garden',
	'Nimbus Air',
	'Onyx Motors',
	'Pine Bakery',
]
const CITIES = ['Helsinki', 'Oslo', 'Stockholm', 'Tallinn']
const STATUSES = ['Paid', 'Open', 'Paid', 'Late', 'Paid', 'Open'] as const

// The same rows at every load, so a browser test can name a cell.
export function createOrders(count: number): Order[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `o${index + 1}`,
		customer: CUSTOMERS[index % CUSTOMERS.length] ?? 'Aalto Works',
		city: CITIES[(index * 3 + (index >> 2)) % CITIES.length] ?? 'Helsinki',
		status: STATUSES[index % STATUSES.length] ?? 'Paid',
		items: 1 + ((index * 3) % 7),
		total: 120 + ((index * 733) % 1900) + (index % 4) * 0.5,
		placed: `2026-${String(1 + ((index * 5) % 11)).padStart(2, '0')}-${String(1 + ((index * 7) % 27)).padStart(2, '0')}`,
	}))
}

export const orders = createOrders(14)

export type Product = {
	id: string
	name: string
	category: 'Coffee' | 'Tea' | 'Bakery'
	price: number
	stock: number
}

export const products: Product[] = [
	{ id: 'p1', name: 'Espresso beans', category: 'Coffee', price: 12.5, stock: 42 },
	{ id: 'p2', name: 'Filter roast', category: 'Coffee', price: 10.9, stock: 18 },
	{ id: 'p3', name: 'Decaf roast', category: 'Coffee', price: 11.4, stock: 7 },
	{ id: 'p4', name: 'Earl Grey', category: 'Tea', price: 6.2, stock: 64 },
	{ id: 'p5', name: 'Sencha', category: 'Tea', price: 8.8, stock: 23 },
	{ id: 'p6', name: 'Rooibos', category: 'Tea', price: 5.6, stock: 0 },
	{ id: 'p7', name: 'Cinnamon bun', category: 'Bakery', price: 3.4, stock: 30 },
	{ id: 'p8', name: 'Rye bread', category: 'Bakery', price: 4.9, stock: 12 },
	{ id: 'p9', name: 'Oat cookie', category: 'Bakery', price: 2.2, stock: 55 },
]

const plurals = new Intl.PluralRules('en')

/** `count(1, 'person', 'people')` gives "1 person". */
export const count = (value: number, one: string, many: string) =>
	`${value} ${plurals.select(value) === 'one' ? one : many}`

export const euro = { showUnit: true, currency: 'EUR' } as const
