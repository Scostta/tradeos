// Formato de los valores del screener (todo en mono, DESIGN.md).

const DASH = "—"

export function fmtPct(n: number | null, opts?: { decimals?: number; sign?: boolean }): string {
  if (n == null) return DASH
  const { decimals = 1, sign = false } = opts ?? {}
  const s = (Math.abs(n) * 100).toFixed(decimals) + "%"
  // Signo según el valor mostrado: −0.0003 se ve "0.0%", no "−0.0%".
  const shown = Number((n * 100).toFixed(decimals))
  if (shown < 0) return "−" + s
  return sign && shown > 0 ? "+" + s : s
}

export function fmtMultiple(n: number | null): string {
  if (n == null) return DASH
  return (Number(n.toFixed(2)) < 0 ? "−" : "") + Math.abs(n).toFixed(2) + "x"
}

/** Precio en su divisa de cotización (GBp = peniques). */
export function fmtPrice(n: number | null, currency: string | null): string {
  if (n == null) return DASH
  const value = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${value} ${currency}` : value
}

export function fmtMarketCap(n: number | null): string {
  if (n == null) return DASH
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  return `$${Math.round(n / 1e6)}M`
}

export function fmtInt(n: number | null): string {
  return n == null ? DASH : String(n)
}

/** Fecha YYYY-MM-DD (sin hora) → "Sep 30, 2026". */
export function fmtDay(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
  })
}

export function signColor(n: number | null): string {
  if (n == null || n === 0) return "text-text-dim"
  return n > 0 ? "text-profit" : "text-loss"
}
