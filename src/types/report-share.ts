// ── Public report share — frozen snapshot types ──────────────────────────────
// A share stores a curated, point-in-time summary of a report (KPIs + equity +
// aggregated breakdowns). NO individual trades or notes — the public page only
// ever sees this shape. The jsonb column is validated with reportSnapshotSchema
// on read (defensive: it comes from the DB, not a trusted source).

import { z } from "zod"
import { tradesRangeSchema } from "~/types/trade-filters"

const breakdownRowSchema = z.object({
  label:   z.string(),
  trades:  z.number(),
  winRate: z.number(),  // 0–1
  pnl:     z.number(),
})
export type ShareBreakdownRow = z.infer<typeof breakdownRowSchema>

export const reportSnapshotSchema = z.object({
  version:      z.literal(1),
  accountLabel: z.string(),
  rangeLabel:   z.string(),
  generatedAt:  z.string(),
  kpis: z.object({
    netPnl:         z.number(),
    winRate:        z.number(),  // 0–1
    profitFactor:   z.number(),
    totalTrades:    z.number(),
    tradingDays:    z.number(),
    avgDailyNetPnl: z.number(),
    expectancy:     z.number(),
    maxDrawdown:    z.number(),
    avgHoldTimeMs:  z.number(),
  }),
  equity:       z.array(z.number()),
  byDayOfWeek:  z.array(breakdownRowSchema),
  byInstrument: z.array(breakdownRowSchema),
})
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>

export const createShareInputSchema = z.object({
  accountId: z.string().uuid().nullable(),
  range:     tradesRangeSchema,
})
export type CreateShareInput = z.infer<typeof createShareInputSchema>

/** One share in the owner's management list. */
export type ReportShareSummary = {
  id:        string
  token:     string
  title:     string
  createdAt: string
}

/** What the public page renders. */
export type PublicShare = {
  title:     string
  createdAt: string
  snapshot:  ReportSnapshot
}
