import { byAccountDay, dayContext, isFastAfterLoss, isSizeUpAfterLoss } from "./daily-limits"
import type { TradeContext } from "./daily-limits"
import { isLoss, isWin, tradeOutcome } from "./outcome"
import { tradeRisk } from "./r-multiples"
import type { Trade } from "~/types/trade"

// ¿Cómo opera el trader según lo que acaba de pasar? Todo por cuenta y día,
// con el mismo contexto que los límites diarios (dayContext): resultado del
// trade anterior, racha de pérdidas, minutos desde la última salida, subir
// contratos tras una pérdida y número de trade del día. Solo cifras.

export const DEFAULT_REVENGE_MINUTES = 5

export type TiltStats = {
  trades:  number
  wins:    number
  losses:  number
  be:      number
  winRate: number | null      // W / (W + L); null si no hay ninguno
  netPnl:  number
  avgNet:  number | null
  avgR:    number | null      // solo trades con riesgo conocido
}

export type TiltRow = { key: string; stats: TiltStats }

export type GapBucket = "lt2" | "2to5" | "5to15" | "15to60" | "gt60"

export type TiltReport = {
  all:         TiltStats
  previous:    TiltRow[]          // first | win | loss | be
  streak:      TiltRow[]          // 0 | 1 | 2 | 3+
  gap:         { key: GapBucket; afterLoss: TiltStats; other: TiltStats }[]
  afterLoss: {
    fast:      TiltStats          // entró antes del plazo de su cuenta (marca revenge)
    slow:      TiltStats          // el resto de trades tras una pérdida
    sizeUp:    TiltStats          // más contratos que la pérdida (marca sizeUp)
    sameSize:  TiltStats
  }
  windows:     number[]           // plazos distintos usados (minutos), para el texto
  tradeNumber: TiltRow[]          // 1 | 2 | 3 | 4+
}

const GAP_BUCKETS: { key: GapBucket; max: number }[] = [
  { key: "lt2",    max: 2 },
  { key: "2to5",   max: 5 },
  { key: "5to15",  max: 15 },
  { key: "15to60", max: 60 },
  { key: "gt60",   max: Infinity },
]

const round2 = (n: number): number => Math.round(n * 100) / 100

export function tiltStats(trades: Trade[], riskByAccount: Map<string, number | null> = new Map()): TiltStats {
  const wins   = trades.filter(isWin).length
  const losses = trades.filter(isLoss).length
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0)
  const rs = trades.flatMap(t => {
    const risk = tradeRisk(t, riskByAccount.get(t.accountId) ?? null)
    return risk == null ? [] : [t.netPnl / risk]
  })
  return {
    trades: trades.length,
    wins, losses,
    be:      trades.length - wins - losses,
    winRate: wins + losses ? round2(wins / (wins + losses) * 100) / 100 : null,
    netPnl:  round2(netPnl),
    avgNet:  trades.length ? round2(netPnl / trades.length) : null,
    avgR:    rs.length ? round2(rs.reduce((s, r) => s + r, 0) / rs.length) : null,
  }
}

function rows(groups: Map<string, Trade[]>, keys: string[], risk: Map<string, number | null>): TiltRow[] {
  return keys.map(key => ({ key, stats: tiltStats(groups.get(key) ?? [], risk) }))
}

function push(map: Map<string, Trade[]>, key: string, t: Trade): void {
  map.set(key, [...(map.get(key) ?? []), t])
}

export function computeTiltReport(args: {
  trades:          Trade[]
  riskByAccount?:  Map<string, number | null>
  revengeMinutes?: Map<string, number | null>   // plazo por cuenta; sin dato → 5, null → 5 en el análisis
  timeZone?:       string
}): TiltReport {
  const { trades } = args
  const risk     = args.riskByAccount ?? new Map<string, number | null>()
  const windowOf = (accountId: string): number => args.revengeMinutes?.get(accountId) ?? DEFAULT_REVENGE_MINUTES

  const contexts: { trade: Trade; ctx: TradeContext }[] = []
  for (const ts of byAccountDay(trades, args.timeZone).values()) contexts.push(...dayContext(ts))

  const previous = new Map<string, Trade[]>()
  const streak   = new Map<string, Trade[]>()
  const number   = new Map<string, Trade[]>()
  const gapLoss  = new Map<string, Trade[]>()
  const gapOther = new Map<string, Trade[]>()
  const fast: Trade[] = [], slow: Trade[] = [], sizeUp: Trade[] = [], sameSize: Trade[] = []

  for (const { trade: t, ctx } of contexts) {
    push(previous, ctx.previous ? tradeOutcome(ctx.previous) : "first", t)
    push(streak, ctx.streak >= 3 ? "3+" : String(ctx.streak), t)
    push(number, ctx.index >= 3 ? "4+" : String(ctx.index + 1), t)

    if (ctx.previous == null || ctx.gapMin == null) continue
    const afterLoss = isLoss(ctx.previous)
    const bucket = GAP_BUCKETS.find(b => ctx.gapMin! < b.max)!.key
    push(afterLoss ? gapLoss : gapOther, bucket, t)

    if (!afterLoss) continue
    ;(isFastAfterLoss(ctx, windowOf(t.accountId)) ? fast : slow).push(t)
    ;(isSizeUpAfterLoss(t, ctx) ? sizeUp : sameSize).push(t)
  }

  return {
    all:      tiltStats(trades, risk),
    previous: rows(previous, ["first", "win", "loss", "be"], risk),
    streak:   rows(streak, ["0", "1", "2", "3+"], risk),
    gap: GAP_BUCKETS.map(({ key }) => ({
      key,
      afterLoss: tiltStats(gapLoss.get(key) ?? [], risk),
      other:     tiltStats(gapOther.get(key) ?? [], risk),
    })),
    afterLoss: {
      fast:     tiltStats(fast, risk),
      slow:     tiltStats(slow, risk),
      sizeUp:   tiltStats(sizeUp, risk),
      sameSize: tiltStats(sameSize, risk),
    },
    windows:     [...new Set(trades.map(t => windowOf(t.accountId)))].sort((a, b) => a - b),
    tradeNumber: rows(number, ["1", "2", "3", "4+"], risk),
  }
}
