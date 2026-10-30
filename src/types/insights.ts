// ── AI Insights domain types ──────────────────────────────────────────────────
// Two halves:
//   1. InsightsInput — the compact, deterministic aggregation we build from
//      Trade[] and feed to Claude. Every number here is computed in code, never
//      by the model. Kept small and JSON-serializable (rounded numbers, no raw
//      trades) so the prompt stays cheap and the model can't invent figures.
//   2. Insight — the model's output, validated with Zod in the server action
//      (Phase 2). Defined here so the contract lives in one place.

import { z } from "zod"
import type { MistakeRow } from "./reports"

// ── Aggregation input (code → model) ──────────────────────────────────────────

/** Headline figures for the whole filtered set. */
export type InsightsOverview = {
  totalTrades:  number
  breakEvenTrades: number  // count in P&L, not as winners or losers
  netPnl:       number
  winRate:      number   // 0–1, wins / (wins + losses)
  profitFactor: number
  expectancy:   number   // net P&L per trade (BE included)
  maxDrawdown:  number   // peak-to-trough (negative)
  avgWin:       number
  avgLoss:      number   // negative or 0
}

/** Win rate and net P&L for one UTC hour-of-day (only hours with trades). */
export type HourBucket = {
  hour:    number   // 0–23, UTC
  trades:  number
  winRate: number   // 0–1
  netPnl:  number
}

export type DowSignal = {
  label:   string   // "Monday" … "Sunday"
  trades:  number
  winRate: number   // 0–1
  netPnl:  number
}

export type SessionKey = "RTH" | "ETH" | "overnight" | "unspecified"

export type SessionBucket = {
  session: SessionKey
  trades:  number
  winRate: number   // 0–1
  netPnl:  number
}

/** Win rate / avg net / avg R of a group of trades (nulls when undefined). */
export type TiltBucket = {
  trades:    number
  winRate:   number | null   // 0–1, wins / (wins + losses)
  avgNetPnl: number | null
  avgR:      number | null
}

/**
 * Tilt / revenge-trading signal — the same numbers as Reports → Tilt
 * (computeTiltReport): every trade is placed against what had happened that
 * day in that account when it was opened (last closed trade, losing streak).
 */
export type TiltSignal = {
  baseline:        TiltBucket
  byPreviousTrade: { firstOfDay: TiltBucket; afterWin: TiltBucket; afterLoss: TiltBucket; afterBreakEven: TiltBucket }
  afterLoss: {
    reentryWindowMinutes: number[]      // per-account window used for "fast"
    fastReentry:          TiltBucket    // opened within the window after closing a loss
    waitedLonger:         TiltBucket
    sizedUp:              TiltBucket    // more contracts than the loss
    sameOrSmallerSize:    TiltBucket
  }
  byLossStreakBefore:   Record<"0" | "1" | "2" | "3+", TiltBucket>
  byTradeNumberOfDay:   Record<"1" | "2" | "3" | "4+", TiltBucket>
  maxConsecutiveLosses: number
}

/** Break-even analysis — the same numbers as Reports → Break-even (computeBeReport). */
export type BreakEvenSignal = {
  trades:          number
  rate:            number          // BE / all trades, 0–1
  netPnl:          number
  commissions:     number          // paid on BE trades
  thresholdPoints: number          // |exit − entry| ≤ this → BE, unless overridden by hand
  markedByHand:    { asBreakEven: number; asNotBreakEven: number }
  ifThreshold:     { points: number; breakEvenTrades: number }[]
  mfe: {
    measured:      number          // BE trades with MFE and a risk basis
    avgR:          number | null
    reachedHalfR:  number
    reached1R:     number
    reached2R:     number
    givenBackAt1R: number          // $ the ones that reached +1R would have made closing at 1R, minus what they made
  }
  mae: {
    measured:      number
    avgR:          number | null
    nearStop:      number          // MAE ≥ 0.75R
    barelyAgainst: number          // MAE ≤ 0.25R
  }
  highestRateGroups: { dimension: string; label: string; trades: number; breakEvenTrades: number; rate: number }[]
}

/** Trades opened after hitting a personal daily limit (Accounts → Limits). */
export type LimitsSignal = {
  tradesWithBreach: number
  byType: { maxTrades: number; maxDailyLoss: number; lossStreak: number; fastReentryAfterLoss: number; sizedUpAfterLoss: number }
}

/**
 * Overtrading signal. Splits trading days at the median trades-per-day and
 * compares average daily net P&L on busy days vs quiet days.
 */
export type VolumeSignal = {
  medianTradesPerDay: number
  highVolumeDays:     { days: number; avgDailyNetPnl: number; avgTradesPerDay: number }
  lowVolumeDays:      { days: number; avgDailyNetPnl: number; avgTradesPerDay: number }
}

/** Setup-adherence summary (followed the playbook vs broke it). */
export type AdherenceSignal = {
  tracked:         number
  followedWinRate: number   // 0–1
  followedNetPnl:  number
  brokeWinRate:    number   // 0–1
  brokeNetPnl:     number
}

/** R-multiple summary (only when trades carry a risk basis). */
export type RSignal = {
  expectancy: number   // mean R per trade
  winRate:    number   // 0–1
  sqn:        number
  bestR:      number
  worstR:     number
  coverage:   { withR: number; total: number }
}

/** The complete payload handed to Claude. */
export type InsightsInput = {
  overview:    InsightsOverview
  byHour:      HourBucket[]
  byDayOfWeek: DowSignal[]
  bySession:   SessionBucket[]
  topMistakes: MistakeRow[]
  rMultiples:  RSignal | null
  adherence:   AdherenceSignal | null
  tilt:        TiltSignal
  breakEven:   BreakEvenSignal | null   // null when there are no BE trades
  limits:      LimitsSignal | null      // null when no account has daily limits
  volume:      VolumeSignal
}

/** Below this many closed trades, insights are not statistically meaningful. */
export const MIN_TRADES_FOR_INSIGHTS = 25

// ── Insight output (model → app) ──────────────────────────────────────────────

export const insightSeveritySchema = z.enum(["critical", "warning", "info", "positive"])
export type InsightSeverity = z.infer<typeof insightSeveritySchema>

export const insightCategorySchema = z.enum(["timing", "discipline", "risk", "strategy"])
export type InsightCategory = z.infer<typeof insightCategorySchema>

export const insightSchema = z.object({
  title:          z.string(),
  detail:         z.string(),
  recommendation: z.string(),
  severity:       insightSeveritySchema,
  category:       insightCategorySchema,
  // The specific figure from InsightsInput that backs this insight, so the UI
  // can show it and the model is anchored to real data. Null when general.
  metric:         z.string().nullable(),
})
export type Insight = z.infer<typeof insightSchema>

export const insightsResponseSchema = z.object({
  insights: z.array(insightSchema),
})
export type InsightsResponse = z.infer<typeof insightsResponseSchema>

// ── Server action / query shapes ──────────────────────────────────────────────

/** Input for the generateInsights action. accountId null = all accounts. */
export const generateInsightsInputSchema = z.object({
  accountId: z.string().uuid().nullable(),
  refresh:   z.boolean().optional(),
})
export type GenerateInsightsInput = z.infer<typeof generateInsightsInputSchema>

/**
 * What the read query returns for a scope. `status` drives the UI:
 *   - "insufficient" — fewer than MIN_TRADES_FOR_INSIGHTS closed trades
 *   - "empty"        — enough trades but nothing generated yet (show CTA)
 *   - "ready"        — cached insights present
 * `stale` is true when the data changed since these insights were generated.
 */
export type InsightsView = {
  status:      "insufficient" | "empty" | "ready"
  tradesCount: number
  insights:    Insight[]
  model:       string | null
  generatedAt: string | null
  stale:       boolean
}
