// Formato de importes y fechas de Money. Importes siempre en mono (DESIGN.md).

const MINUS = "−"

/** "€1,234.56"; con sign: "+€15.00" / "−€16.91". */
export function fmtEur(n: number | null, opts?: { sign?: boolean; decimals?: number }): string {
  if (n == null) return "—"
  const decimals = opts?.decimals ?? 2
  const s = Math.abs(n).toLocaleString("en-US", {
    style: "currency", currency: "EUR", minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
  const shown = Number(n.toFixed(decimals))
  if (shown < 0) return MINUS + s
  return opts?.sign && shown > 0 ? `+${s}` : s
}

/** "Oct 27" (y el año si no es el actual). */
export function fmtDay(iso: string, opts?: { year?: boolean }): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const year = opts?.year ?? d.getUTCFullYear() !== new Date().getUTCFullYear()
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: year ? "numeric" : undefined, timeZone: "UTC" })
}

/** Contraparte normalizada → nombre para mostrar: "mercadona tarifa" → "Mercadona Tarifa", "netflix.com" → "Netflix.com". */
export function displayName(counterparty: string | null, fallback = "—"): string {
  if (!counterparty) return fallback
  return counterparty.replace(/(^|[\s&])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** "Feb 2027" a partir de "2027-02". */
export function fmtMonth(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}
