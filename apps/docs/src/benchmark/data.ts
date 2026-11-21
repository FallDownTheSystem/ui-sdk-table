export type Person = {
	id: string
	name: string
	team: string
	country: string
	score: number
	joined: string
}

const FIRST = ['Ada', 'Ben', 'Cleo', 'Dan', 'Eve', 'Finn', 'Gus', 'Ivy', 'Jack', 'Lily']
const LAST = ['Adams', 'Brooks', 'Carter', 'Drake', 'Ellis', 'Fisher', 'Grant', 'Hayes']
const TEAMS = ['Billing', 'Design', 'Growth', 'Platform', 'Support']
const COUNTRIES = ['Finland', 'Sweden', 'Norway', 'Denmark', 'Estonia']

// A small seeded generator, so each run and each browser measures the same rows.
function seeded(seed: number) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
}

function pick<T>(list: readonly T[], random: () => number): T {
	return list[Math.floor(random() * list.length)] as T
}

export function createPeople(count: number): Person[] {
	const random = seeded(42)
	const people: Person[] = []
	for (let index = 0; index < count; index++) {
		const day = 1 + Math.floor(random() * 28)
		const month = 1 + Math.floor(random() * 12)
		people.push({
			id: `p${index}`,
			name: `${pick(FIRST, random)} ${pick(LAST, random)}`,
			team: pick(TEAMS, random),
			country: pick(COUNTRIES, random),
			score: Math.round(random() * 10000) / 100,
			joined: `20${10 + Math.floor(random() * 16)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
		})
	}
	return people
}
