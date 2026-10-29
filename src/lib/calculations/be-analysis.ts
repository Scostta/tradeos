import { tradeRisk } from "./r-multiples"
import type { Trade } from "~/types/trade"

// ¿Cuánto llegaron a ir a favor los trades break-even? MFE (USD, del add-on)
// en R = MFE / riesgo inicial (stop del trade o risk_per_trade de la cuenta,
// como el resto de R). Un BE que tocó +1R y volvió es beneficio devuelto.

export const BE_LEVELS = [0.5, 1, 2] as const

export type BeLevel = (typeof BE_LEVELS)[number]

export type BeTradeRow = {
  id:         string
  entryTime:  string
  instrument: string
  mfe:        number
  mfeR:       number
  netPnl:     number
  risk:       number
}

export type BeStats = {
  total:    number                       // trades BE
  measured: number                       // con MFE y riesgo (los que entran en R)
  reached:  { level: BeLevel; count: number }[]
  avgMfeR:  number | null
  // Si los que tocaron +1R se hubieran cerrado ahí: 1R de cada uno menos lo que dieron.
  missedAt1R: number
  rows:     BeTradeRow[]                 // medidos, de mayor a menor MFE en R
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function computeBeStats(trades: Trade[], fallbackByAccount: Map<string, number | null> = new Map()): BeStats {
  const be = trades.filter(t => t.breakEven)
  const rows: BeTradeRow[] = []
  for (const t of be) {
    const risk = tradeRisk(t, fallbackByAccount.get(t.accountId) ?? null)
    if (risk == null || t.mfe == null) continue
    rows.push({
      id: t.id, entryTime: t.entryTime, instrument: t.instrument,
      mfe: t.mfe, mfeR: round2(t.mfe / risk), netPnl: t.netPnl, risk: round2(risk),
    })
  }
  rows.sort((a, b) => b.mfeR - a.mfeR)

  const at1R = rows.filter(r => r.mfeR >= 1)
  return {
    total:    be.length,
    measured: rows.length,
    reached:  BE_LEVELS.map(level => ({ level, count: rows.filter(r => r.mfeR >= level).length })),
    avgMfeR:  rows.length ? round2(rows.reduce((s, r) => s + r.mfeR, 0) / rows.length) : null,
    missedAt1R: round2(at1R.reduce((s, r) => s + r.risk - r.netPnl, 0)),
    rows,
  }
}
