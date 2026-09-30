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

// Clave natural de un trade del CSV: la misma que dedupe en BD
// (account_id, trade_number), pero con el nombre de cuenta sin resolver.
export const exclusionKeySchema = z.object({
  tradeNumber: z.number().int(),
  accountName: z.string().min(1),
})

export const importTradesInputSchema = z
  .object({
    rows:      z.array(parsedRowSchema).default([]),
    // Trades que el usuario descarto en el preview: se guardan en
    // import_exclusions y se borran de trades si ya estaban importados.
    exclude:   z.array(exclusionKeySchema).default([]),
    // Trades antes excluidos que el usuario vuelve a querer: se borra su
    // exclusion y entran por `rows` como cualquier otro.
    unexclude: z.array(exclusionKeySchema).default([]),
  })
  .refine((v) => v.rows.length > 0 || v.exclude.length > 0, {
    message: "Nothing to import or exclude",
  })

export type ParsedRow = z.infer<typeof parsedRowSchema>

export type ExclusionKey = z.infer<typeof exclusionKeySchema>

export type DuplicateKey = ExclusionKey

/**
 * new     → no esta en BD, se importa
 * dup     → ya existe en trades
 * skipped → esta en import_exclusions: se excluyo en un import anterior
 */
export type RowStatus = "new" | "dup" | "skipped"

/** Resultado de cruzar las filas del CSV con lo que ya hay en BD. */
export type ImportKeyCheck = {
  duplicates: DuplicateKey[]
  excluded:   DuplicateKey[]
}

/** `excluded` = estado del checkbox en el preview, editable por el usuario. */
export type PreviewRow = ParsedRow & { status: RowStatus; excluded: boolean }

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
  /** Trades marcados como excluidos (no vuelven en futuros imports). */
  excluded: number
  /** Trades excluidos que ya estaban en BD y se han borrado. */
  deleted:  number
  /** Exclusiones levantadas: vuelven a importarse. */
  restored: number
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
