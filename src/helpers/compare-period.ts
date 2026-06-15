import { z } from "zod"

// ── Compare period resolution ─────────────────────────────────────────────────
// The Compare tab pits two date ranges against each other. Unlike the page-level
// range selector (today/week/month/ytd/all — all anchored to "now"), comparison
// needs *previous* periods too (last week vs this week, etc.), so it has its own
// closed-period key set and resolver.
//
// Boundaries are half-open [from, to): `from` inclusive, `to` exclusive. The query
// layer applies `.gte(from).lt(to)`. Current periods use `to = now`; past periods
// use `to = start of the current period`. `all` has `from = null` (no lower bound).

export const comparePeriodKeySchema = z.enum([
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "this-quarter",
  "last-quarter",
  "this-year",
  "last-year",
  "all",
])

export type ComparePeriodKey = z.infer<typeof comparePeriodKeySchema>

export type ComparePeriodWindow = {
  from:  string | null // ISO, inclusive lower bound (null = no lower bound)
  to:    string        // ISO, exclusive upper bound
  label: string        // human period name ("This month")
  sub:   string        // specifics ("Jun 2025", "Q2 2025", "9–15 Jun")
}

export const COMPARE_PERIOD_OPTIONS: { id: ComparePeriodKey; label: string }[] = [
  { id: "this-week",     label: "This week"     },
  { id: "last-week",     label: "Last week"     },
  { id: "this-month",    label: "This month"    },
  { id: "last-month",    label: "Last month"    },
  { id: "this-quarter",  label: "This quarter"  },
  { id: "last-quarter",  label: "Last quarter"  },
  { id: "this-year",     label: "This year"     },
  { id: "last-year",     label: "Last year"     },
  { id: "all",           label: "All time"      },
]

const LABEL_BY_KEY = new Map<ComparePeriodKey, string>(
  COMPARE_PERIOD_OPTIONS.map(o => [o.id, o.label]),
)

// ── Date helpers (all UTC) ────────────────────────────────────────────────────

/** Midnight-UTC Date for the Monday of the week containing `ref`. */
function startOfWeekUTC(ref: Date): Date {
  const day  = ref.getUTCDay()           // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day  // shift back to Monday
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + diff))
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" })
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

function quarterLabel(d: Date): string {
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
}

/** Sub-label for a half-open week range; `endExclusive` points at the day after. */
function weekSub(from: Date, endExclusive: Date): string {
  const lastDay = new Date(endExclusive.getTime() - 86_400_000) // last included day
  return `${fmtDay(from)} – ${fmtDay(lastDay)}`
}

/**
 * Resolves a ComparePeriodKey into a concrete [from, to) window plus display
 * labels. `to` is exclusive. Evaluated relative to the current instant.
 */
export function resolveComparePeriod(key: ComparePeriodKey): ComparePeriodWindow {
  const now   = new Date()
  const nowIso = now.toISOString()
  const label = LABEL_BY_KEY.get(key) ?? ""
  const Y = now.getUTCFullYear()
  const M = now.getUTCMonth()

  switch (key) {
    case "this-week": {
      const from = startOfWeekUTC(now)
      return { from: from.toISOString(), to: nowIso, label, sub: weekSub(from, now) }
    }
    case "last-week": {
      const thisWeek = startOfWeekUTC(now)
      const from = new Date(thisWeek.getTime() - 7 * 86_400_000)
      return { from: from.toISOString(), to: thisWeek.toISOString(), label, sub: weekSub(from, thisWeek) }
    }
    case "this-month": {
      const from = new Date(Date.UTC(Y, M, 1))
      return { from: from.toISOString(), to: nowIso, label, sub: fmtMonth(from) }
    }
    case "last-month": {
      const from = new Date(Date.UTC(Y, M - 1, 1))
      const to   = new Date(Date.UTC(Y, M, 1))
      return { from: from.toISOString(), to: to.toISOString(), label, sub: fmtMonth(from) }
    }
    case "this-quarter": {
      const from = new Date(Date.UTC(Y, Math.floor(M / 3) * 3, 1))
      return { from: from.toISOString(), to: nowIso, label, sub: quarterLabel(from) }
    }
    case "last-quarter": {
      const qStart = Math.floor(M / 3) * 3
      const from   = new Date(Date.UTC(Y, qStart - 3, 1))
      const to     = new Date(Date.UTC(Y, qStart, 1))
      return { from: from.toISOString(), to: to.toISOString(), label, sub: quarterLabel(from) }
    }
    case "this-year": {
      const from = new Date(Date.UTC(Y, 0, 1))
      return { from: from.toISOString(), to: nowIso, label, sub: String(Y) }
    }
    case "last-year": {
      const from = new Date(Date.UTC(Y - 1, 0, 1))
      const to   = new Date(Date.UTC(Y, 0, 1))
      return { from: from.toISOString(), to: to.toISOString(), label, sub: String(Y - 1) }
    }
    case "all":
    default:
      return { from: null, to: nowIso, label, sub: "All dates" }
  }
}
