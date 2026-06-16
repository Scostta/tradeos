import { z } from "zod"

export const goalsSchema = z.object({
  monthlyPnlTarget: z.number().nullable(),
  winRateTarget:    z.number().nullable(),   // 0..1
  maxDrawdownLimit: z.number().nullable(),   // positive (max allowed drawdown)
  minTradingDays:   z.number().int().nullable(),
})

export type Goals = z.infer<typeof goalsSchema>

export const updateGoalsInputSchema = z.object({
  monthlyPnlTarget: z.number().nonnegative().nullable(),
  winRateTarget:    z.number().min(0).max(1).nullable(),
  maxDrawdownLimit: z.number().nonnegative().nullable(),
  minTradingDays:   z.number().int().nonnegative().nullable(),
})

export type UpdateGoalsInput = z.infer<typeof updateGoalsInputSchema>

// ── Progress (current calendar month) ─────────────────────────────────────────
export type GoalProgress = {
  target:  number
  current: number
  pct:     number    // 0..1 clamped
  met:     boolean
}

// Drawdown is a "stay under" limit, not a "reach" target.
export type DrawdownProgress = {
  limit:    number
  current:  number   // current month max drawdown (positive)
  pct:      number   // current / limit (clamped)
  breached: boolean
}

export type GoalsProgress = {
  hasAnyGoal:  boolean
  monthLabel:  string
  pnl:         GoalProgress | null
  winRate:     GoalProgress | null
  drawdown:    DrawdownProgress | null
  tradingDays: GoalProgress | null
}
