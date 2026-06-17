// ── Timezone helpers ──────────────────────────────────────────────────────────
// Single source of truth for "which wall-clock day/hour/weekday an instant falls
// on" in a given IANA timezone, plus local day/week/month boundaries for date
// ranges. Every function defaults `timeZone` to "UTC" so callers that don't pass
// a zone keep the previous (UTC) behavior — the pure calculation tests rely on
// this. DST is handled by Intl; never compute offsets by hand.

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year:   "numeric",
      month:  "2-digit",
      day:    "2-digit",
      hour:   "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    formatterCache.set(timeZone, fmt)
  }
  return fmt
}

export type ZonedParts = {
  year:   number
  month:  number // 1–12
  day:    number // 1–31
  hour:   number // 0–23
  minute: number
  second: number
  weekday: number // 0=Sunday … 6=Saturday
}

/** Wall-clock parts of an ISO instant in the given timezone. */
export function zonedParts(iso: string, timeZone = "UTC"): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(new Date(iso))
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")

  const year   = get("year")
  const month  = get("month")
  const day    = get("day")
  const hour   = get("hour") % 24 // Intl can emit "24" at midnight in some envs
  const minute = get("minute")
  const second = get("second")
  // Weekday of a calendar date is timezone-independent once Y/M/D are known.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  return { year, month, day, hour, minute, second, weekday }
}

const pad = (n: number): string => String(n).padStart(2, "0")

/** "YYYY-MM-DD" of the instant in the given timezone — one trading day. */
export function zonedDateKey(iso: string, timeZone = "UTC"): string {
  const { year, month, day } = zonedParts(iso, timeZone)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Hour of day (0–23) of the instant in the given timezone. */
export function zonedHour(iso: string, timeZone = "UTC"): number {
  return zonedParts(iso, timeZone).hour
}

/** Day of week (0=Sunday … 6=Saturday) of the instant in the given timezone. */
export function zonedWeekday(iso: string, timeZone = "UTC"): number {
  return zonedParts(iso, timeZone).weekday
}

/** "YYYY-MM" of the instant in the given timezone. */
export function zonedYearMonthKey(iso: string, timeZone = "UTC"): string {
  const { year, month } = zonedParts(iso, timeZone)
  return `${year}-${pad(month)}`
}

/**
 * UTC instant for a wall-clock time in the given timezone. Resolves the zone
 * offset at that instant via Intl (DST-correct) with one refinement pass for
 * offset-transition edges.
 */
function wallTimeToUtc(
  year: number, month: number, day: number, hour: number, minute: number, timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute)
  const probe = zonedParts(new Date(target).toISOString(), timeZone)
  const asLocal = Date.UTC(probe.year, probe.month - 1, probe.day, probe.hour, probe.minute)
  const offset = asLocal - target
  return new Date(target - offset)
}

/** ISO of local midnight (start of day) for the day `now` falls in, in `timeZone`. */
export function zonedStartOfDay(now: Date, timeZone = "UTC"): string {
  const { year, month, day } = zonedParts(now.toISOString(), timeZone)
  return wallTimeToUtc(year, month, day, 0, 0, timeZone).toISOString()
}

/** ISO of local midnight on Monday of the week `now` falls in, in `timeZone`. */
export function zonedStartOfWeek(now: Date, timeZone = "UTC"): string {
  const { year, month, day, weekday } = zonedParts(now.toISOString(), timeZone)
  const diff = weekday === 0 ? -6 : 1 - weekday // Monday-based week
  const d = new Date(Date.UTC(year, month - 1, day + diff))
  return wallTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0, timeZone).toISOString()
}

/** ISO of local midnight on the 1st of the month `now` falls in, in `timeZone`. */
export function zonedStartOfMonth(now: Date, timeZone = "UTC"): string {
  const { year, month } = zonedParts(now.toISOString(), timeZone)
  return wallTimeToUtc(year, month, 1, 0, 0, timeZone).toISOString()
}

/** ISO of local midnight on Jan 1st of the year `now` falls in, in `timeZone`. */
export function zonedStartOfYear(now: Date, timeZone = "UTC"): string {
  const { year } = zonedParts(now.toISOString(), timeZone)
  return wallTimeToUtc(year, 1, 1, 0, 0, timeZone).toISOString()
}
