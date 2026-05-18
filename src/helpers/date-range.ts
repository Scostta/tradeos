import type { RangeKey } from "~/types/metrics"

export function resolveDateRange(range: RangeKey): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString()

  if (range === "today") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
    return { from, to }
  }

  if (range === "week") {
    const day = now.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
    return { from: monday.toISOString(), to }
  }

  if (range === "month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    return { from, to }
  }

  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString()
  return { from, to }
}
