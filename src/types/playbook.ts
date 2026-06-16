import { z } from "zod"
import type { DashboardMetrics, EquityPoint } from "./metrics"
import type { RStats, ReportRow } from "./reports"

export const playbookSchema = z.object({
  id:          z.string().uuid(),
  userId:      z.string().uuid(),
  name:        z.string(),
  description: z.string().nullable(),
  rules:       z.string().nullable(),
  active:      z.boolean(),
  createdAt:   z.string().datetime({ offset: true }),
})

export type Playbook = z.infer<typeof playbookSchema>

export type PlaybookWithStats = Playbook & {
  tradeCount:   number
  winRate:      number
  netPnl:       number
  equityCurve:  number[]   // cumulative net P&L sorted by entry_time
  profitFactor: number     // gross win / |gross loss|
  avgWin:       number
  avgLoss:      number      // ≤ 0
  expectancyR:  number      // mean R-multiple per trade (0 if no R coverage)
  rCoverage:    { withR: number; total: number }
}

export const createPlaybookInputSchema = z.object({
  name:        z.string().trim().min(1, "NAME_REQUIRED").max(80, "NAME_TOO_LONG"),
  description: z.string().trim().max(500).nullable(),
  rules:       z.string().trim().max(2000).nullable(),
})

export type CreatePlaybookInput = z.infer<typeof createPlaybookInputSchema>

export const updatePlaybookInputSchema = createPlaybookInputSchema.extend({
  id: z.string().uuid(),
})

export type UpdatePlaybookInput = z.infer<typeof updatePlaybookInputSchema>

// Setup adherence: how following (or breaking) the playbook's rules affects results.
export type AdherenceGroup = {
  count:       number
  winRate:     number
  netPnl:      number
  expectancyR: number
  rCoverage:   { withR: number; total: number }
}

export type PlaybookAdherence = {
  totalRules: number
  tracked:    number   // trades with a followed-rules record
  followed:   AdherenceGroup   // every rule checked
  broke:      AdherenceGroup   // tracked but missing ≥1 rule
}

// Full per-playbook detail (route /playbooks/[id]).
export type PlaybookDetail = {
  playbook:     PlaybookWithStats
  metrics:      DashboardMetrics
  rStats:       RStats
  equityCurve:  EquityPoint[]
  byInstrument: ReportRow[]
  adherence:    PlaybookAdherence | null
}
