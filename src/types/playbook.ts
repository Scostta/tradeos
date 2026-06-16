import { z } from "zod"

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
