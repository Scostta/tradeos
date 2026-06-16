import { z } from "zod"

export const accountTypeSchema = z.enum(["real", "funded", "demo", "paper"])

// ── Prop-firm enums ───────────────────────────────────────────────────────────
export const propPhaseSchema    = z.enum(["evaluation", "funded", "payout"])
export const drawdownTypeSchema = z.enum(["trailing_intraday", "trailing_eod", "static"])
export type PropPhase    = z.infer<typeof propPhaseSchema>
export type DrawdownType = z.infer<typeof drawdownTypeSchema>

export const accountSchema = z.object({
  id:             z.string().uuid(),
  userId:         z.string().uuid(),
  name:           z.string(),
  broker:         z.string().nullable(),
  accountType:    accountTypeSchema,
  currency:       z.string(),
  initialBalance: z.number().nullable(),
  active:         z.boolean(),
  color:          z.string(),
  notes:          z.string().nullable(),
  // Prop-firm rules (all nullable; null = not tracked for that rule)
  propPhase:      propPhaseSchema.nullable(),
  drawdownType:   drawdownTypeSchema.nullable(),
  drawdownAmount: z.number().nullable(),
  drawdownLockAt: z.number().nullable(),
  dailyLossLimit: z.number().nullable(),
  profitTarget:   z.number().nullable(),
  minTradingDays: z.number().int().nullable(),
  riskPerTrade:   z.number().nullable(),   // $ risked per trade — R fallback when no stop
  createdAt:      z.string().datetime({ offset: true }),
})

export type AccountType = z.infer<typeof accountTypeSchema>
export type Account = z.infer<typeof accountSchema>

export type AccountWithStats = Account & {
  tradeCount: number
  netPnl:     number
}

export const updateAccountInputSchema = z.object({
  id:             z.string().uuid(),
  broker:         z.string().nullable(),
  accountType:    accountTypeSchema,
  initialBalance: z.number().nonnegative().nullable(),
  color:          z.string().regex(/^#[0-9a-fA-F]{6}$/, "INVALID_COLOR"),
  notes:          z.string().nullable(),
  propPhase:      propPhaseSchema.nullable(),
  drawdownType:   drawdownTypeSchema.nullable(),
  drawdownAmount: z.number().nonnegative().nullable(),
  drawdownLockAt: z.number().nonnegative().nullable(),
  dailyLossLimit: z.number().nonnegative().nullable(),
  profitTarget:   z.number().nonnegative().nullable(),
  minTradingDays: z.number().int().nonnegative().nullable(),
  riskPerTrade:   z.number().nonnegative().nullable(),
})

export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>
