import { z } from "zod"

export const tradeSchema = z.object({
  id:          z.string().uuid(),
  userId:      z.string().uuid(),
  accountId:   z.string().uuid(),
  tradeNumber: z.number().int().nullable(),
  instrument:  z.string(),
  direction:   z.enum(["long", "short"]),
  contracts:   z.number().int().positive(),
  entryPrice:  z.number(),
  exitPrice:   z.number(),
  entryTime:   z.string().datetime({ offset: true }),
  exitTime:    z.string().datetime({ offset: true }),
  pnl:         z.number(),
  commission:  z.number(),
  netPnl:      z.number(),
  mae:         z.number().nullable(),
  mfe:         z.number().nullable(),
  stopPrice:   z.number().nullable(),
  playbookId:  z.string().uuid().nullable(),
  session:     z.enum(["RTH", "ETH", "overnight"]).nullable(),
  notes:       z.string().nullable(),
  tags:        z.array(z.string()).nullable(),
  followedRules: z.array(z.string()).nullable(),  // playbook rules confirmed for this trade
  mistakes:    z.array(z.string()).nullable(),    // tagged execution mistakes
  createdAt:   z.string().datetime({ offset: true }),
})

export type Trade = z.infer<typeof tradeSchema>

// ── Manual create / edit ──────────────────────────────────────────────────────
// User-editable fields only. net_pnl is derived server-side (pnl - commission);
// mae/mfe/stop_price/tags are import- or sidebar-managed and left untouched here.
const tradeFormFields = tradeSchema.pick({
  accountId:  true,
  instrument: true,
  direction:  true,
  contracts:  true,
  entryPrice: true,
  exitPrice:  true,
  entryTime:  true,
  exitTime:   true,
  pnl:        true,
  commission: true,
  session:    true,
  playbookId: true,
  notes:      true,
  stopPrice:  true,
})

const exitAfterEntry = (v: { entryTime: string; exitTime: string }): boolean =>
  new Date(v.exitTime).getTime() > new Date(v.entryTime).getTime()
const exitAfterEntryError = { message: "EXIT_BEFORE_ENTRY", path: ["exitTime"] }

export const createTradeSchema = tradeFormFields.refine(exitAfterEntry, exitAfterEntryError)
export const updateTradeSchema = tradeFormFields
  .extend({ id: z.string().uuid() })
  .refine(exitAfterEntry, exitAfterEntryError)

export type CreateTradeInput = z.infer<typeof createTradeSchema>
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>
