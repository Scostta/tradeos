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
  startedAt:           isoDate.nullable(),   // lo fija la primera posición real (§1.6)
  paperMode:           z.boolean(),          // true hasta "Start real test"
  updatedAt:           timestamp.nullable(),
})
export type InvestSettings = z.infer<typeof investSettingsSchema>

export const exitReasonSchema = z.enum(["sma_exit", "falsifier", "manual"])
export type ExitReason = z.infer<typeof exitReasonSchema>

// Estado manual de cada falsador (§4.3): "ok" = sin novedad, "review" = revisar.
export const falsifierStatusSchema = z.enum(["ok", "review"])
export type FalsifierStatus = z.infer<typeof falsifierStatusSchema>

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
  falsifierStatus: z.array(falsifierStatusSchema),  // alineado con falsifiers; lo que falta es "ok"
  closedAt:   isoDate.nullable(),
  exitPrice:  z.number().nullable(),
  feesClose:  z.number(),
  exitReason: exitReasonSchema.nullable(),
  exitNote:   z.string().nullable(),
  paper:      z.boolean(),                   // posición de papel (§1.6)
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
  close:     z.number().nullable(),   // sin ajustar por dividendos (§5.1)
})
export type InvestPrice = z.infer<typeof investPriceSchema>

// ── Inputs de server actions ─────────────────────────────────────────────────

export const saveInvestSettingsInputSchema = z.object({
  totalPortfolioValue: z.number().positive(),
  benchmarkTicker:     z.string().trim().min(1).max(20),
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

export const setFalsifierStatusInputSchema = z.object({
  positionId: z.string().uuid(),
  index:      z.number().int().nonnegative(),
  status:     falsifierStatusSchema,
})
export type SetFalsifierStatusInput = z.infer<typeof setFalsifierStatusInputSchema>

export const markRunReviewedInputSchema = z.object({
  runId: z.string().uuid(),
})
export type MarkRunReviewedInput = z.infer<typeof markRunReviewedInputSchema>

// ── Página de detalle /invest/[ticker] (§4.7) ────────────────────────────────

export const investTickerSchema = z.object({
  ticker:            z.string(),
  name:              z.string().nullable(),
  exchange:          z.string().nullable(),
  currency:          z.string().nullable(),
  financialCurrency: z.string().nullable(),
  sector:            z.string().nullable(),
  industry:          z.string().nullable(),
  summary:           z.string().nullable(),
  updatedAt:         timestamp,
})
export type InvestTicker = z.infer<typeof investTickerSchema>

export const fundamentalsYearSchema = z.object({
  ticker:        z.string(),
  fiscalYear:    z.number().int(),
  revenue:       z.number().nullable(),   // financial_currency
  grossMargin:   z.number().nullable(),
  fcf:           z.number().nullable(),   // financial_currency
  roic:          z.number().nullable(),
  netDebtEbitda: z.number().nullable(),
})
export type FundamentalsYear = z.infer<typeof fundamentalsYearSchema>

// Las cuatro preguntas fijas del bloque "Thesis prompts", en orden.
export const THESIS_PROMPT_KEYS = ["growth", "stopper", "loser", "signal"] as const
export type ThesisPromptKey = (typeof THESIS_PROMPT_KEYS)[number]

export const thesisAnswersSchema = z.object({
  growth:  z.string().max(5000).default(""),
  stopper: z.string().max(5000).default(""),
  loser:   z.string().max(5000).default(""),
  signal:  z.string().max(5000).default(""),
})
export type ThesisAnswers = z.infer<typeof thesisAnswersSchema>

export const saveThesisDraftInputSchema = z.object({
  ticker:  z.string().trim().min(1).max(20),
  answers: thesisAnswersSchema,
})
export type SaveThesisDraftInput = z.infer<typeof saveThesisDraftInputSchema>
