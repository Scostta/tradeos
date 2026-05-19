import { z } from "zod"

export const strategySchema = z.object({
  id:          z.string().uuid(),
  userId:      z.string().uuid(),
  name:        z.string(),
  description: z.string().nullable(),
  rules:       z.string().nullable(),
  active:      z.boolean(),
  createdAt:   z.string().datetime({ offset: true }),
})

export type Strategy = z.infer<typeof strategySchema>

export type StrategyWithStats = Strategy & {
  tradeCount:   number
  winRate:      number
  netPnl:       number
  equityCurve:  number[]   // cumulative net P&L sorted by entry_time
}

export const createStrategyInputSchema = z.object({
  name:        z.string().trim().min(1, "NAME_REQUIRED").max(80, "NAME_TOO_LONG"),
  description: z.string().trim().max(500).nullable(),
  rules:       z.string().trim().max(2000).nullable(),
})

export type CreateStrategyInput = z.infer<typeof createStrategyInputSchema>

export const updateStrategyInputSchema = createStrategyInputSchema.extend({
  id: z.string().uuid(),
})

export type UpdateStrategyInput = z.infer<typeof updateStrategyInputSchema>
