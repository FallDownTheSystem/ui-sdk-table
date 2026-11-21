import type { FilterState, PageState, SortRule } from 'ui-sdk-table-vue'
import { createPeople, type Person } from '../benchmark/data'

export type PeopleQuery = {
	sort: readonly SortRule[]
	filter: FilterState
	page: PageState
}

export type PeopleAnswer = { rows: Person[]; total: number }

const people = createPeople(10_000)

function matches(person: Person, search: string): boolean {
	const text = `${person.name} ${person.team} ${person.country}`.toLowerCase()
	return text.includes(search)
}

function compare(a: Person, b: Person, rules: readonly SortRule[]): number {
	for (const rule of rules) {
		const left = a[rule.id as keyof Person]
		const right = b[rule.id as keyof Person]
		const order =
			typeof left === 'number' && typeof right === 'number'
				? left - right
				: String(left).localeCompare(String(right), 'fi')
		if (order !== 0) return rule.desc ? -order : order
	}
	return 0
}

/**
 * A stand-in for a server: it holds 10,000 people and answers a query with
 * one page of them after a delay, as a real request does. It does the search,
 * the sort and the pages itself; the table only shows the answer.
 */
export function requestPeople(query: PeopleQuery, delay: number): Promise<PeopleAnswer> {
	const search = (query.filter.search ?? '').trim().toLowerCase()
	const team = query.filter.columns?.team
	let found = people
	if (search) found = found.filter((person) => matches(person, search))
	if (typeof team === 'string' && team) found = found.filter((person) => person.team === team)
	if (query.sort.length) found = [...found].sort((a, b) => compare(a, b, query.sort))
	const start = (query.page.page - 1) * query.page.pageSize
	const answer = { rows: found.slice(start, start + query.page.pageSize), total: found.length }
	return new Promise((resolve) => setTimeout(() => resolve(answer), delay))
}
