export type Column = { id: string; label: string; width: number }

export const columns: Column[] = [
  { id: "id", label: "ID", width: 70 },
  { id: "name", label: "Name", width: 140 },
  { id: "email", label: "Email", width: 200 },
  { id: "city", label: "City", width: 120 },
  { id: "amount", label: "Amount", width: 100 },
  { id: "date", label: "Date", width: 110 },
  { id: "status", label: "Status", width: 100 },
  { id: "note", label: "Note", width: 180 },
]

const names = ["Ada", "Linus", "Grace", "Alan", "Barbara", "Ken", "Margaret", "Dennis"]
const cities = ["Helsinki", "Oslo", "Tampere", "Turku", "Espoo", "Bergen"]
const statuses = ["open", "paid", "late", "void"]
const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor".split(" ")

export type Row = Record<string, string> & { id: string }

export function makeRows(count: number): Row[] {
  const rows: Row[] = []
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length] ?? "x"
    const noteLength = 1 + ((i * 7) % 23)
    rows.push({
      id: String(i + 1),
      name: `${name} ${i + 1}`,
      email: `${name.toLowerCase()}${i + 1}@example.com`,
      city: cities[i % cities.length] ?? "",
      amount: ((i * 37) % 1000).toFixed(2),
      date: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
      status: statuses[i % statuses.length] ?? "",
      note: Array.from({ length: noteLength }, (_, k) => words[(i + k) % words.length]).join(" "),
    })
  }
  return rows
}
