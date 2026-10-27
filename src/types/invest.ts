import { z } from "zod"

// Módulo Invest (INVEST_SPEC.md). Las reglas del screener (§1.1–§1.3) viven
// solo en el job de Python (scripts/screener/screener/rules.py); aquí solo se
// leen sus resultados. Los límites de §1.4 (posiciones, sector, ticker
// repetido) sí se validan en openInvestPosition.

export const THESIS_MIN_LENGTH = 200
export const FALSIFIER_MIN_LENGTH = 30
export const MIN_FALSIFIERS = 2
export const HORIZON_MONTHS = 36

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestamp = z.string().datetime({ offset: true })

// Vocabulario de fail_reasons que escribe el job, en su orden de evaluación.
export const failReasonSchema = z.enum([
  "no_data",
  "market_cap",
  "months_listed",
  "revenue_growth",
  "fcf_margin",
  "gross_margin",
  "net_debt_ebitda",
  "roic",
  "sma10m",
  "momentum_12_1",
  "rel_strength_6m",
])
export type FailReason = z.infer<typeof failReasonSchema>

export const screenRunSchema = z.object({
  id:           z.string().uuid(),
  runDate:      isoDate,          // cierre mensual evaluado (último día hábil del mes)
  executedAt:   timestamp,
  universeSize: z.number().int(),
  passedCount:  z.number().int(),
  benchmark:    z.string(),
  jobVersion:   z.string(),
})
export type ScreenRun = z.infer<typeof screenRunSchema>

export const screenResultSchema = z.object({
  id:                z.string().uuid(),
  runId:             z.string().uuid(),
  ticker:            z.string(),
  name:              z.string().nullable(),
  exchange:          z.string().nullable(),
  sector:            z.string().nullable(),
  currency:          z.string().nullable(),   // divisa de price (GBp = peniques)
  marketCap:         z.number().nullable(),   // USD
  revenueGrowthYoy:  z.number().nullable(),
  fcfMargin:         z.number().nullable(),
  grossMargin:       z.number().nullable(),
  grossMarginPrev:   z.number().nullable(),
  netDebtEbitda:     z.number().nullable(),
  roic:              z.number().nullable(),
  price:             z.number().nullable(),   // adj close mensual, divisa de cotización
  sma10m:            z.number().nullable(),
  momentum121:       z.number().nullable(),
  relStrength6m:     z.number().nullable(),
  monthsListed:      z.number().int().nullable(),
  passesFundamental: z.boolean(),
  passesTechnical:   z.boolean(),
  passes:            z.boolean(),
  failReasons:       z.array(failReasonSchema),
})
export type ScreenResult = z.infer<typeof screenResultSchema>

export const investSettingsSchema = z.object({
  userId:              z.string().uuid(),
  totalPortfolioValue: z.number(),           // EUR, núcleo + satélite
  satellitePct:        z.number(),
  maxPositions:        z.number().int(),
  positionPct:         z.number(),
  benchmarkTicker:     z.string(),
  startedAt:           isoDate,
  updatedAt:           timestamp.nullable(),
})
export type InvestSettings = z.infer<typeof investSettingsSchema>

export const exitReasonSchema = z.enum(["sma_exit", "falsifier", "manual"])
export type ExitReason = z.infer<typeof exitReasonSchema>

export const investPositionSchema = z.object({
  id:         z.string().uuid(),
  userId:     z.string().uuid(),
  ticker:     z.string(),
  runId:      z.string().uuid(),
  openedAt:   isoDate,
  entryPrice: z.number(),                    // divisa de cotización
  shares:     z.number(),
  feesOpen:   z.number(),                    // EUR
  thesis:     z.string(),
  falsifiers: z.array(z.string()),
  closedAt:   isoDate.nullable(),
  exitPrice:  z.number().nullable(),
  feesClose:  z.number(),
  exitReason: exitReasonSchema.nullable(),
  exitNote:   z.string().nullable(),
  createdAt:  timestamp,
})
export type InvestPosition = z.infer<typeof investPositionSchema>

// Posición + datos de su fila en el run que la aprobó (run_id + ticker).
export type InvestPositionWithMeta = InvestPosition & {
  name:     string | null
  sector:   string | null
  currency: string | null
}

export const positionSignalSchema = z.enum(["hold", "sell"])
export type PositionSignal = z.infer<typeof positionSignalSchema>

export const positionCheckSchema = z.object({
  positionId: z.string().uuid(),
  runId:      z.string().uuid(),
  price:      z.number(),
  sma10m:     z.number(),
  signal:     positionSignalSchema,
})
export type PositionCheck = z.infer<typeof positionCheckSchema>

export const investPriceSchema = z.object({
  ticker:    z.string(),
  monthEnd:  isoDate,
  adjClose:  z.number(),
})
export type InvestPrice = z.infer<typeof investPriceSchema>

// ── Inputs de server actions ─────────────────────────────────────────────────

export const saveInvestSettingsInputSchema = z.object({
  totalPortfolioValue: z.number().positive(),
  benchmarkTicker:     z.string().trim().min(1).max(20),
  startedAt:           isoDate,
})
export type SaveInvestSettingsInput = z.infer<typeof saveInvestSettingsInputSchema>

export const openInvestPositionInputSchema = z.object({
  ticker:     z.string().trim().min(1),
  openedAt:   isoDate,
  entryPrice: z.number().positive(),
  shares:     z.number().positive(),
  feesOpen:   z.number().nonnegative(),
  thesis:     z.string().trim().min(THESIS_MIN_LENGTH),
  falsifiers: z.array(z.string().trim().min(FALSIFIER_MIN_LENGTH)).min(MIN_FALSIFIERS),
})
export type OpenInvestPositionInput = z.infer<typeof openInvestPositionInputSchema>

export const closeInvestPositionInputSchema = z
  .object({
    positionId: z.string().uuid(),
    closedAt:   isoDate,
    exitPrice:  z.number().positive(),
    feesClose:  z.number().nonnegative(),
    exitReason: exitReasonSchema,
    exitNote:   z.string().trim().nullable(),
  })
  .refine(
    v => v.exitReason === "sma_exit" || (v.exitNote != null && v.exitNote.length > 0),
    { message: "EXIT_NOTE_REQUIRED", path: ["exitNote"] },
  )
export type CloseInvestPositionInput = z.infer<typeof closeInvestPositionInputSchema>

export const markRunReviewedInputSchema = z.object({
  runId: z.string().uuid(),
})
export type MarkRunReviewedInput = z.infer<typeof markRunReviewedInputSchema>
