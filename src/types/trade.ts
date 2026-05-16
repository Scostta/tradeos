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
  entryTime:   z.string().datetime(),
  exitTime:    z.string().datetime(),
  pnl:         z.number(),
  commission:  z.number(),
  netPnl:      z.number(),
  mae:         z.number().nullable(),
  mfe:         z.number().nullable(),
  strategyId:  z.string().uuid().nullable(),
  session:     z.enum(["RTH", "ETH", "overnight"]).nullable(),
  notes:       z.string().nullable(),
  tags:        z.array(z.string()).nullable(),
  createdAt:   z.string().datetime(),
})

export type Trade = z.infer<typeof tradeSchema>
