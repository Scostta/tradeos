export function formatCurrency(n: number, opts?: { sign?: boolean; decimals?: number }): string {
  const { sign = true, decimals = 2 } = opts ?? {}
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const prefix = sign && n > 0 ? "+$" : n < 0 ? "−$" : "$"
  return prefix + abs
}

export function formatPct(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + "%"
}

export function formatDateTime(iso: string): string {
  const dt = new Date(iso)
  const parts = dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" })
  const t = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  return parts + " · " + t
}

export function formatDate(iso: string): string {
  const dt = new Date(iso)
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" })
}

/** Compact currency: $1.2k, −$500, $1.2M. Used in chart tick labels and heatmap cells. */
export function formatCompactCurrency(v: number): string {
  const a = Math.abs(v)
  let s: string
  if (a >= 1_000_000) {
    s = (a / 1_000_000).toFixed(a >= 100_000_000 ? 0 : 1) + "M"
  } else if (a >= 1_000) {
    s = (a / 1_000).toFixed(a >= 100_000 ? 0 : 1) + "k"
  } else {
    s = Math.round(a).toString()
  }
  return (v < 0 ? "−$" : "$") + s
}

/**
 * Format a pre-computed millisecond duration as "Xh Ym". E.g. 5400000 → "1h 30m".
 * For formatting the diff between two ISO strings use `formatDuration` in `~/helpers/duration`.
 */
export function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
