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
    playbookId:  true,
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
  line:         number
  reason:       string
  accountName?: string
  instrument?:  string
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: ParseError[]
  format: string
}

export type ImportSummary = {
  imported: number
}

// ── Generic (mapped) CSV import ───────────────────────────────────────────────
// Canonical fields the user maps their CSV columns onto. `required` fields must
// be mapped before parsing; the rest are optional.
export const CANONICAL_IMPORT_FIELDS = [
  { key: "instrument", label: "Instrument",            required: true },
  { key: "side",       label: "Direction (long/short)", required: true },
  { key: "contracts",  label: "Contracts",             required: true },
  { key: "entryPrice", label: "Entry price",           required: true },
  { key: "exitPrice",  label: "Exit price",            required: true },
  { key: "entryTime",  label: "Entry time",            required: true },
  { key: "exitTime",   label: "Exit time",             required: true },
  { key: "pnl",        label: "Gross P&L",             required: true },
  { key: "commission", label: "Commission",            required: false },
  { key: "account",    label: "Account",               required: false },
  { key: "tradeId",    label: "Trade # / ID",          required: false },
  { key: "mae",        label: "MAE",                   required: false },
  { key: "mfe",        label: "MFE",                   required: false },
] as const

export type CanonicalField = (typeof CANONICAL_IMPORT_FIELDS)[number]["key"]

/** field → CSV header name. */
export type ColumnMapping = Partial<Record<CanonicalField, string>>

export type CsvInspection = {
  headers:    string[]
  sampleRows: string[][]
  delimiter:  string
}
