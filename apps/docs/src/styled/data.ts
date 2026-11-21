/**
 * The rows of the styled page. A small seeded generator makes the names and
 * the numbers, so each run and each browser shows the same rows.
 */

export function seeded(seed: number) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
}

type Random = () => number

const pick = <T>(list: readonly T[], random: Random): T =>
	list[Math.floor(random() * list.length)] as T
const between = (random: Random, min: number, max: number) =>
	min + Math.floor(random() * (max - min + 1))

const FIRST = [
	'Aino',
	'Eero',
	'Helmi',
	'Ilmari',
	'Kerttu',
	'Lauri',
	'Maija',
	'Onni',
	'Saara',
	'Väinö',
	'Astrid',
	'Bjørn',
	'Freja',
	'Gustav',
	'Ingrid',
	'Jonas',
	'Linnea',
	'Magnus',
	'Nora',
	'Oskar',
	'Alice',
	'Bruno',
	'Clara',
	'Diego',
	'Elena',
	'Felix',
	'Greta',
	'Hugo',
	'Irene',
	'Jules',
]
const LAST = [
	'Aalto',
	'Heikkinen',
	'Järvinen',
	'Korhonen',
	'Laine',
	'Mäkinen',
	'Nieminen',
	'Virtanen',
	'Andersson',
	'Berg',
	'Dahl',
	'Eriksen',
	'Hansen',
	'Lindqvist',
	'Nilsson',
	'Smith',
	'Moreau',
	'Rossi',
	'Schmidt',
	'Novak',
]
const COMPANIES = [
	'Aurora Energy',
	'Birch & Pine',
	'Cobalt Systems',
	'Dune Logistics',
	'Ember Labs',
	'Fjord Analytics',
	'Granite Works',
	'Harbor Freight Co',
	'Iris Health',
	'Juniper Foods',
	'Kelp Robotics',
	'Lumen Studio',
	'Moss Outdoor',
	'Nimbus Cloud',
	'Opal Finance',
]
const TITLES = [
	'Head of operations',
	'Finance lead',
	'Product manager',
	'Engineering manager',
	'Procurement lead',
	'Chief of staff',
	'Data analyst',
]
const COUNTRIES = [
	{ name: 'Finland', code: 'FI' },
	{ name: 'Sweden', code: 'SE' },
	{ name: 'Norway', code: 'NO' },
	{ name: 'Denmark', code: 'DK' },
	{ name: 'Estonia', code: 'EE' },
	{ name: 'Germany', code: 'DE' },
	{ name: 'France', code: 'FR' },
	{ name: 'Spain', code: 'ES' },
] as const
const ROLES = ['Admin', 'Editor', 'Viewer'] as const
const STATUSES = ['Active', 'Invited', 'Suspended'] as const
export const PLANS = ['Free', 'Starter', 'Growth', 'Enterprise'] as const
const TAGS = ['beta', 'priority', 'partner', 'at risk', 'reference']
const NOTES = [
	'Asked for a yearly invoice.',
	'Wants single sign-on before the renewal. The security review is booked for next month, and legal has the contract.',
	'No open questions.',
	'Moved to the new billing address in spring.',
	'Pilot with two teams. A wider rollout depends on the export to their data warehouse.',
]

const DAY = 86_400_000
/** The day that every date of the page is counted from, so the rows do not change from day to day. */
const BASE = Date.UTC(2026, 0, 15, 9, 30)

export type Role = (typeof ROLES)[number]

export type Person = { id: number; name: string; role: Role; age: number; joined: Date }

export const people: Person[] = [
	{ id: 1, name: 'Aino Korhonen', role: 'Admin', age: 34, joined: new Date('2021-03-14') },
	{ id: 2, name: 'Eero Laine', role: 'Editor', age: 28, joined: new Date('2022-07-01') },
	{ id: 3, name: 'Helmi Virtanen', role: 'Viewer', age: 45, joined: new Date('2019-11-23') },
	{ id: 4, name: 'Lauri Mäkinen', role: 'Editor', age: 39, joined: new Date('2023-01-09') },
	{ id: 5, name: 'Saara Nieminen', role: 'Viewer', age: 31, joined: new Date('2024-05-30') },
]

export function makePeople(count: number, seed = 7): Person[] {
	const random = seeded(seed)
	return Array.from({ length: count }, (_, index) => ({
		id: index + 1,
		name: `${pick(FIRST, random)} ${pick(LAST, random)}`,
		role: pick(ROLES, random),
		age: between(random, 21, 64),
		joined: new Date(BASE - between(random, 30, 2400) * DAY),
	}))
}

export const paginationPeople = makePeople(23)

export type Member = { id: number; name: string; email: string; role: Role; joined: Date }

export function makeMembers(count: number): Member[] {
	const random = seeded(2026)
	return Array.from({ length: count }, (_, index) => {
		const first = pick(FIRST, random)
		const last = pick(LAST, random)
		return {
			id: index + 1,
			name: `${first} ${last}`,
			email: `${first}.${last}@example.com`.toLowerCase(),
			role: pick(ROLES, random),
			joined: new Date(BASE - between(random, 30, 2400) * DAY),
		}
	})
}

export type TreeRow = {
	id: number
	name: string
	type: 'team' | 'person'
	count: number
	children?: TreeRow[]
}

export const orgData: TreeRow[] = [
	{
		id: 1,
		name: 'Engineering',
		type: 'team',
		count: 2,
		children: [
			{ id: 11, name: 'Aino Korhonen', type: 'person', count: 12 },
			{ id: 12, name: 'Eero Laine', type: 'person', count: 7 },
		],
	},
	{
		id: 2,
		name: 'Design',
		type: 'team',
		count: 2,
		children: [
			{ id: 21, name: 'Helmi Virtanen', type: 'person', count: 9 },
			{ id: 22, name: 'Lauri Mäkinen', type: 'person', count: 4 },
		],
	},
]

export type Product = {
	id: number
	name: string
	sku: string
	price: number
	description: string
	stock: number
}

export const products: Product[] = [
	{
		id: 1,
		name: 'Trail backpack',
		sku: 'BP-2041',
		price: 129.9,
		description: 'A 28 litre pack with a rain cover and a padded sleeve for a 15 inch laptop.',
		stock: 42,
	},
	{
		id: 2,
		name: 'Steel bottle',
		sku: 'SB-0750',
		price: 24.5,
		description: 'Keeps a drink cold for a day. The cap has a loop for a carabiner.',
		stock: 310,
	},
	{
		id: 3,
		name: 'Head torch',
		sku: 'HT-0300',
		price: 59,
		description: '300 lumen, three modes, charges over USB-C in two hours.',
		stock: 0,
	},
]

export type Task = {
	id: number
	title: string
	priority: 'High' | 'Medium' | 'Low'
	status: 'To do' | 'In progress' | 'Done'
}

export const tasks: Task[] = [
	{ id: 1, title: 'Move billing to the new provider', priority: 'High', status: 'In progress' },
	{ id: 2, title: 'Write the onboarding guide', priority: 'Medium', status: 'To do' },
	{ id: 3, title: 'Fix the export of large reports', priority: 'High', status: 'To do' },
	{ id: 4, title: 'Archive old projects', priority: 'Low', status: 'Done' },
	{ id: 5, title: 'Review access roles', priority: 'Medium', status: 'Done' },
	{ id: 6, title: 'Rename the staging cluster', priority: 'Low', status: 'In progress' },
]

export type Order = {
	id: number
	category: string
	region: string
	product: string
	units: number
	price: number
	revenue: number
	isReturn: boolean
}

const order = (
	id: number,
	category: string,
	product: string,
	region: string,
	units: number,
	price: number,
	isReturn = false,
): Order => ({ id, category, product, region, units, price, revenue: units * price, isReturn })

export const orders: Order[] = [
	order(1, 'Hardware', 'Laptop stand', 'North', 12, 49),
	order(2, 'Hardware', 'Dock', 'South', 5, 189, true),
	order(3, 'Hardware', 'Keyboard', 'North', 20, 89),
	order(4, 'Hardware', 'Monitor arm', 'West', 8, 119),
	order(5, 'Software', 'Team plan', 'North', 30, 12),
	order(6, 'Software', 'Analytics add-on', 'South', 14, 25, true),
	order(7, 'Software', 'Storage pack', 'West', 22, 8),
	order(8, 'Services', 'Onboarding', 'North', 3, 450),
	order(9, 'Services', 'Training day', 'South', 2, 900, true),
	order(10, 'Services', 'Audit', 'West', 1, 1500),
]

export type FooterOrder = {
	id: number
	product: string
	category: string
	quantity: number
	unitPrice: number
	revenue: number
}

export const footerOrders: FooterOrder[] = orders.map((row) => ({
	id: row.id,
	product: row.product,
	category: row.category,
	quantity: row.units,
	unitPrice: row.price,
	revenue: row.revenue,
}))

export const footerStickyOrders: FooterOrder[] = Array.from({ length: 4 }, () => footerOrders)
	.flat()
	.map((row, index) => ({ ...row, id: index + 1 }))

export type Sales = { id: number; region: string; q1: number; q2: number; q3: number; q4: number }

export const salesData: Sales[] = [
	{ id: 1, region: 'North', q1: 120_000, q2: 135_500, q3: 128_200, q4: 160_900 },
	{ id: 2, region: 'South', q1: 86_400, q2: 91_000, q3: 99_750, q4: 104_300 },
	{ id: 3, region: 'West', q1: 64_900, q2: 70_200, q3: 68_000, q4: 81_600 },
]

export type FormatRow = {
	id: number
	label: string
	amount: number
	price: number
	progress: number
	created: Date
	updated: Date
	active: boolean
	homepage: string
	contact: string
}

export const formatRows: FormatRow[] = [
	{
		id: 1,
		label: 'First',
		amount: 1234567.891,
		price: 1999.5,
		progress: 0.425,
		created: new Date('2025-03-14T08:05:00Z'),
		updated: new Date(Date.now() - 3 * 3_600_000),
		active: true,
		homepage: 'https://example.com',
		contact: 'first@example.com',
	},
	{
		id: 2,
		label: 'Second',
		amount: -42.5,
		price: 0.99,
		progress: 1,
		created: new Date('2024-12-31T23:30:00Z'),
		updated: new Date(Date.now() - 9 * DAY),
		active: false,
		homepage: 'https://example.org/docs',
		contact: 'second@example.org',
	},
]

export type LocalRow = {
	id: number
	amount: number
	price: number
	share: number
	date: Date
	updated: Date
}

export const localizationRows: LocalRow[] = [
	{
		id: 1,
		amount: 1234567.891,
		price: 1999.5,
		share: 0.4256,
		date: new Date('2025-03-14T08:05:00Z'),
		updated: new Date(Date.now() - 2 * 3_600_000),
	},
	{
		id: 2,
		amount: 0.5,
		price: 12,
		share: 0.07,
		date: new Date('2024-12-31T23:30:00Z'),
		updated: new Date(Date.now() - 3 * DAY),
	},
	{
		id: 3,
		amount: -9876.5,
		price: 250000,
		share: 1,
		date: new Date('2026-07-04T12:00:00Z'),
		updated: new Date(Date.now() - 40 * DAY),
	},
]

export type Issue = {
	id: number
	title: string
	status: 'open' | 'in_review' | 'closed'
	assignee: string
}

export const issues: Issue[] = [
	{ id: 1, title: 'Search misses names with umlauts', status: 'open', assignee: 'Aino' },
	{ id: 2, title: 'Totals round twice', status: 'in_review', assignee: 'Eero' },
	{ id: 3, title: 'Header jumps on scroll', status: 'closed', assignee: 'Helmi' },
]

export type InventoryRow = { id: number; sku: string; name: string; stock: number; change: number }

export const inventory: InventoryRow[] = [
	{ id: 1, sku: 'BP-2041', name: 'Trail backpack', stock: 42, change: 12 },
	{ id: 2, sku: 'SB-0750', name: 'Steel bottle', stock: 7, change: -18 },
	{ id: 3, sku: 'HT-0300', name: 'Head torch', stock: 0, change: -4 },
	{ id: 4, sku: 'TN-0200', name: 'Two person tent', stock: 16, change: 0 },
]

export type Invoice = {
	number: string
	issued: Date
	due: Date
	amount: number
	status: 'paid' | 'open' | 'overdue'
}

export type Customer = {
	id: string
	firstName: string
	lastName: string
	title: string
	company: string
	email: string
	phone: string
	website: string
	country: string
	countryCode: string
	mrr: number
	lifetimeValue: number
	openInvoices: number
	churnRisk: number
	npsScore: number
	contractEnds: Date
	lastSeen: Date
	plan: (typeof PLANS)[number]
	active: boolean
	tags: string[]
	invoices: Invoice[]
}

export function makeCustomers(count: number, seed = 2026): Customer[] {
	const random = seeded(seed)
	return Array.from({ length: count }, (_, index) => {
		const firstName = pick(FIRST, random)
		const lastName = pick(LAST, random)
		const company = pick(COMPANIES, random)
		const country = pick(COUNTRIES, random)
		const mrr = between(random, 2, 240) * 25
		const domain = `${company.toLowerCase().replace(/[^a-z]+/g, '')}.example`
		const invoices: Invoice[] = Array.from({ length: between(random, 0, 4) }, (_, place) => {
			const issued = BASE - between(random, 5, 200) * DAY
			return {
				number: `INV-${String(1000 + index * 5 + place)}`,
				issued: new Date(issued),
				due: new Date(issued + 30 * DAY),
				amount: mrr * between(random, 1, 3),
				status: pick(['paid', 'paid', 'open', 'overdue'] as const, random),
			}
		})
		return {
			id: `c${String(index + 1).padStart(4, '0')}`,
			firstName,
			lastName,
			title: pick(TITLES, random),
			company,
			email: `${firstName}.${lastName}@${domain}`.toLowerCase(),
			phone: `+358${between(random, 400000000, 509999999)}`,
			website: `https://${domain}`,
			country: country.name,
			countryCode: country.code,
			mrr,
			lifetimeValue: mrr * between(random, 6, 48),
			openInvoices: invoices.filter((invoice) => invoice.status !== 'paid').length,
			churnRisk: Math.round(random() * 100) / 100,
			npsScore: between(random, -20, 90),
			contractEnds: new Date(BASE + between(random, -60, 720) * DAY),
			lastSeen: new Date(Date.now() - between(random, 1, 2000) * 3_600_000),
			plan: pick(PLANS, random),
			active: random() > 0.2,
			tags: TAGS.filter(() => random() > 0.75),
			invoices,
		}
	})
}

export type BigRow = {
	id: number
	name: string
	email: string
	role: Role
	country: string
	joined: Date
	score: number
	status: (typeof STATUSES)[number]
	notes: string
}

export function makeBigRows(count: number): BigRow[] {
	const random = seeded(42)
	const rows: BigRow[] = []
	for (let index = 0; index < count; index++) {
		const first = pick(FIRST, random)
		const last = pick(LAST, random)
		rows.push({
			id: index + 1,
			name: `${first} ${last}`,
			email: `${first}.${last}${index}@example.com`.toLowerCase(),
			role: pick(ROLES, random),
			country: pick(COUNTRIES, random).name,
			joined: new Date(BASE - between(random, 1, 3000) * DAY),
			score: between(random, 0, 1000),
			status: pick(STATUSES, random),
			notes: pick(NOTES, random),
		})
	}
	return rows
}
