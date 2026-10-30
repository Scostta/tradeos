import { tradeRisk } from "./r-multiples"
import { zonedDateKey, zonedParts } from "~/helpers/tz"
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

// ── Pestaña Break-even de Reports ─────────────────────────────────────────────
// Todo sobre los trades del rango: dónde salen los BE (tasa por grupo), cuánto
// fueron en contra (MAE en R), cómo evolucionan y de dónde sale la etiqueta
// (umbral o corrección manual, y cuántos habría con otro umbral).

export type BeGroupRow = {
  key:    string
  label:  string | null      // null = sin playbook (el texto lo pone la UI)
  trades: number
  be:     number
  rate:   number             // be / trades
}

export type BeGroupKey = "hour" | "weekday" | "instrument" | "playbook" | "direction"

export type BeMaePoint = { id: string; maeR: number; mfeR: number }

export type BeMae = {
  measured:    number        // BE con MAE y riesgo
  avgMaeR:     number | null
  nearStop:    number        // MAE ≥ 0.75R: casi tocaron el stop
  neverAtRisk: number        // MAE ≤ 0.25R: apenas fueron en contra
  points:      BeMaePoint[]  // los que además tienen MFE (para la dispersión)
}

export type BePeriod = {
  key:       string          // YYYY-MM-DD del domingo, o YYYY-MM
  trades:    number
  be:        number
  rate:      number | null   // null si no hubo trades
  missed:    number          // devuelto a 1R por los BE del periodo
  cumMissed: number
}

export type BeSource = {
  threshold:   number
  auto:        number        // BE por el umbral
  forcedBe:    number        // marcados BE a mano
  forcedNotBe: number        // dentro del umbral pero marcados como no BE
  whatIf:      { points: number; be: number }[]  // BE con otro umbral (respeta las correcciones)
}

export type BeReport = {
  trades:     number
  stats:      BeStats
  rate:       number         // BE / trades
  netPnl:     number         // neto de los BE
  commission: number         // comisiones pagadas en los BE
  groups:     Record<BeGroupKey, BeGroupRow[]>
  mae:        BeMae
  evolution:  { unit: "week" | "month"; periods: BePeriod[] }
  source:     BeSource
}

export const BE_NEAR_STOP_R = 0.75
export const BE_NO_RISK_R   = 0.25
const WHAT_IF_POINTS  = [0.5, 1, 1.5, 2, 2.5, 3]
const WEEKLY_MAX_DAYS = 182          // rangos de hasta ~6 meses van por semanas
const EPS = 1e-9

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]   // lunes primero
const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const pad2 = (n: number): string => String(n).padStart(2, "0")
const ratio = (n: number, d: number): number => Math.round(n / d * 10_000) / 10_000

function groupRows(
  trades: Trade[],
  keyOf:  (t: Trade) => { key: string; label: string | null },
  order:  (a: BeGroupRow, b: BeGroupRow) => number,
): BeGroupRow[] {
  const map = new Map<string, BeGroupRow>()
  for (const t of trades) {
    const { key, label } = keyOf(t)
    const row = map.get(key) ?? { key, label, trades: 0, be: 0, rate: 0 }
    row.trades++
    if (t.breakEven) row.be++
    map.set(key, row)
  }
  return [...map.values()].map(r => ({ ...r, rate: ratio(r.be, r.trades) })).sort(order)
}

const byTradesDesc = (a: BeGroupRow, b: BeGroupRow): number => b.trades - a.trades || a.key.localeCompare(b.key)
const byKey        = (a: BeGroupRow, b: BeGroupRow): number => a.key.localeCompare(b.key)

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Semanas de domingo a sábado, como el calendario del Journal.
function sundayOf(date: string): string {
  return addDays(date, -new Date(`${date}T00:00:00Z`).getUTCDay())
}

function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`
}

/** ¿Sería BE con este umbral? Misma regla que el trigger trades_break_even. */
export function isBeAt(t: Trade, points: number): boolean {
  return t.beOverride ?? Math.abs(t.exitPrice - t.entryPrice) <= points + EPS
}

export function computeBeReport(args: {
  trades:          Trade[]
  riskByAccount?:  Map<string, number | null>
  playbookName?:   (t: Trade) => string | null
  thresholdPoints: number
  timeZone?:       string
}): BeReport {
  const { trades, thresholdPoints } = args
  const riskByAccount = args.riskByAccount ?? new Map<string, number | null>()
  const playbookName  = args.playbookName ?? ((): string | null => null)
  const timeZone      = args.timeZone ?? "UTC"

  const stats  = computeBeStats(trades, riskByAccount)
  const be     = trades.filter(t => t.breakEven)
  const riskOf = (t: Trade): number | null => tradeRisk(t, riskByAccount.get(t.accountId) ?? null)

  // ── Dónde salen ──
  const groups: Record<BeGroupKey, BeGroupRow[]> = {
    hour: groupRows(trades, t => {
      const h = pad2(zonedParts(t.entryTime, timeZone).hour)
      return { key: h, label: `${h}:00` }
    }, byKey),
    weekday: groupRows(trades, t => {
      const d = zonedParts(t.entryTime, timeZone).weekday
      return { key: String(WEEKDAY_ORDER.indexOf(d)), label: WEEKDAY_LABEL[d] ?? "?" }
    }, byKey),
    instrument: groupRows(trades, t => ({ key: t.instrument, label: t.instrument }), byTradesDesc),
    playbook: groupRows(trades, t => {
      const name = playbookName(t)
      return { key: name ?? "", label: name }
    }, byTradesDesc),
    direction: groupRows(trades, t => ({ key: t.direction, label: t.direction }), byKey),
  }

  // ── MAE en R ──
  const maeRows: { id: string; maeR: number; mfeR: number | null }[] = []
  for (const t of be) {
    const risk = riskOf(t)
    if (risk == null || t.mae == null) continue
    maeRows.push({
      id:   t.id,
      maeR: round2(Math.abs(t.mae) / risk),
      mfeR: t.mfe == null ? null : round2(t.mfe / risk),
    })
  }
  const mae: BeMae = {
    measured:    maeRows.length,
    avgMaeR:     maeRows.length ? round2(maeRows.reduce((s, r) => s + r.maeR, 0) / maeRows.length) : null,
    nearStop:    maeRows.filter(r => r.maeR >= BE_NEAR_STOP_R).length,
    neverAtRisk: maeRows.filter(r => r.maeR <= BE_NO_RISK_R).length,
    points:      maeRows.flatMap(r => r.mfeR == null ? [] : [{ id: r.id, maeR: r.maeR, mfeR: r.mfeR }]),
  }

  // ── Evolución ──
  const days  = trades.map(t => zonedDateKey(t.entryTime, timeZone)).sort()
  const first = days[0]
  const last  = days[days.length - 1]
  const spanDays = first && last
    ? (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000
    : 0
  const unit: "week" | "month" = spanDays <= WEEKLY_MAX_DAYS ? "week" : "month"
  const periodOf = (day: string): string => unit === "week" ? sundayOf(day) : day.slice(0, 7)
  const next     = (key: string): string => unit === "week" ? addDays(key, 7) : nextMonth(key)

  const missedById = new Map(stats.rows.filter(r => r.mfeR >= 1).map(r => [r.id, r.risk - r.netPnl]))
  const byPeriod = new Map<string, { trades: number; be: number; missed: number }>()
  for (const t of trades) {
    const key = periodOf(zonedDateKey(t.entryTime, timeZone))
    const p = byPeriod.get(key) ?? { trades: 0, be: 0, missed: 0 }
    p.trades++
    if (t.breakEven) p.be++
    p.missed += missedById.get(t.id) ?? 0
    byPeriod.set(key, p)
  }

  const periods: BePeriod[] = []
  if (first && last) {
    let cum = 0
    for (let k = periodOf(first); k <= periodOf(last); k = next(k)) {
      const p = byPeriod.get(k) ?? { trades: 0, be: 0, missed: 0 }
      cum += p.missed
      periods.push({
        key: k, trades: p.trades, be: p.be,
        rate:      p.trades ? ratio(p.be, p.trades) : null,
        missed:    round2(p.missed),
        cumMissed: round2(cum),
      })
    }
  }

  // ── Origen de la etiqueta ──
  const within = (t: Trade): boolean => Math.abs(t.exitPrice - t.entryPrice) <= thresholdPoints + EPS
  const points = [...new Set([...WHAT_IF_POINTS, thresholdPoints])].sort((a, b) => a - b)
  const source: BeSource = {
    threshold:   thresholdPoints,
    auto:        be.filter(t => t.beOverride == null).length,
    forcedBe:    be.filter(t => t.beOverride === true).length,
    forcedNotBe: trades.filter(t => t.beOverride === false && within(t)).length,
    whatIf:      points.map(p => ({ points: p, be: trades.filter(t => isBeAt(t, p)).length })),
  }

  return {
    trades:     trades.length,
    stats,
    rate:       trades.length ? ratio(be.length, trades.length) : 0,
    netPnl:     round2(be.reduce((s, t) => s + t.netPnl, 0)),
    commission: round2(be.reduce((s, t) => s + t.commission, 0)),
    groups,
    mae,
    evolution:  { unit, periods },
    source,
  }
}
