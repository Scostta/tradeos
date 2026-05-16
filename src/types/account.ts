import { z } from "zod"

export const accountTypeSchema = z.enum(["real", "funded", "demo", "paper"])

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
})

export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>
