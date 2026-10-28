// Color de cada objetivo activo según su puesto en la prioridad (artboard 05:
// P1 lima, P2 azul…). Mismo color en la barra de reparto y en su tarjeta.

const STYLES = [
  { color: "var(--color-accent)", badge: "bg-accent/10 text-accent" },
  { color: "var(--color-long)", badge: "bg-long/10 text-long" },
  { color: "var(--color-short)", badge: "bg-short/10 text-short" },
  { color: "var(--color-profit)", badge: "bg-profit/10 text-profit" },
]
const REST = { color: "var(--color-text-dim)", badge: "bg-surface-2 text-text-dim" }

export function goalStyle(rank: number): { color: string; badge: string } {
  return STYLES[rank] ?? REST
}

/** "2027-02" → último día de ese mes, que es lo que se guarda como fecha límite. */
export function monthToDeadline(month: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [y, m] = month.split("-").map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** Importe escrito por el usuario ("1.500", "1500,50") → número; null si no es válido. */
export function parseAmount(s: string): number | null {
  const clean = s.trim().replace(/\s/g, "")
  if (!clean) return null
  // "1.500" y "1,500" son miles; "1500,50" y "1500.50", decimales.
  const normalized = /^\d{1,3}([.,]\d{3})+$/.test(clean) ? clean.replace(/[.,]/g, "") : clean.replace(",", ".")
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}
