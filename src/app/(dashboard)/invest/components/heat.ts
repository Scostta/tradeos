import type { CSSProperties } from "react"

// Mapa de calor de Screen: cuanto más fuerte la cifra, más intenso el fondo
// (acento lima). `warn` usa ámbar: precio muy estirado sobre la SMA 10.
export function heatStyle(ratio: number | null, warn = false): CSSProperties | undefined {
  if (ratio == null || !Number.isFinite(ratio)) return undefined
  const a = 0.05 + Math.max(0, Math.min(1, ratio)) * 0.35
  return { background: warn ? `rgba(245, 158, 11, ${a.toFixed(2)})` : `rgba(163, 230, 53, ${a.toFixed(2)})` }
}

/** Colores de sector para el reparto de Screen (estables por nombre). */
const SECTOR_COLORS = ["#3b82f6", "#a3e635", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#eab308", "#64748b"]

export function sectorColor(sector: string | null, order: string[]): string {
  const i = sector ? order.indexOf(sector) : -1
  return i >= 0 ? SECTOR_COLORS[i % SECTOR_COLORS.length]! : "#64748b"
}
