import { zonedStartOfDay, zonedStartOfWeek, zonedStartOfMonth, zonedStartOfYear } from "~/helpers/tz"
import type { RangeKey } from "~/types/metrics"

/**
 * Resolves a range key to an [from, to] ISO window. Boundaries (start of today /
 * week / month / year) are computed in the user's timezone so "this month" means
 * their local month. Defaults to UTC when no timezone is passed.
 */
export function resolveDateRange(range: RangeKey, timeZone = "UTC"): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString()

  if (range === "today") return { from: zonedStartOfDay(now, timeZone), to }
  if (range === "week")  return { from: zonedStartOfWeek(now, timeZone), to }
  if (range === "month") return { from: zonedStartOfMonth(now, timeZone), to }
  return { from: zonedStartOfYear(now, timeZone), to }
}
