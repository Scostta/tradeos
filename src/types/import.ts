import { z } from "zod"
import { tradeSchema } from "./trade"

// ParsedRow = Trade sin campos de BD + accountName (se resuelve a accountId en el import)
// tradeNumber es required aquí (siempre viene del CSV), nullable solo en BD
export const parsedRowSchema = tradeSchema
  .pick({
    instrument:  true,
    direction:   true,
    contracts:   true,
    entryPrice:  true,
    exitPrice:   true,
    entryTime:   true,
    exitTime:    true,
    pnl:         true,
    commission:  true,
    netPnl:      true,
    mae:         true,
    mfe:         true,
    strategyId:  true,
    session:     true,
    notes:       true,
    tags:        true,
  })
  .extend({
    tradeNumber: z.number().int().positive(),
    accountName: z.string().min(1),
  })

export const importTradesInputSchema = z.object({
  rows: z.array(parsedRowSchema).min(1),
})

export type ParsedRow = z.infer<typeof parsedRowSchema>

export type DuplicateKey = {
  tradeNumber: number
  accountName: string
}

export type RowStatus = "new" | "dup"

export type PreviewRow = ParsedRow & { status: RowStatus }

export type ParseError = {
  line: number
  reason: string
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: ParseError[]
  format: string
}

export type ImportSummary = {
  imported: number
}
