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
