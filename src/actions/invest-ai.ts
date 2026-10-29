"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { APP_URLS } from "~/constants/app-urls"
import { draftThesis } from "~/lib/invest/ai/thesis"
import type { ThesisDraft } from "~/lib/invest/ai/thesis"
import { inputHash } from "~/lib/ai/claude-json"
import type { AiError } from "~/lib/ai/claude-json"
import { commentRun, picksContentSchema } from "~/lib/invest/ai/picks"
import type { PicksContent } from "~/lib/invest/ai/picks"
import { picksInput } from "~/lib/invest/ai/picks-input"
import { reviewContentSchema, reviewPosition } from "~/lib/invest/ai/review"
import type { ReviewContent } from "~/lib/invest/ai/review"
import { reviewInput } from "~/lib/invest/ai/review-input"
import {
  getFundamentalsHistory,
  getInvestAiNote,
  getInvestSettings,
  getInvestTicker,
  getLatestRun,
  getPositionChecks,
  getPositions,
  getScreenResult,
  getScreenResults,
  getThesisDrafts,
} from "~/services/queries/invest"
import { aiNoteInputSchema, draftThesisInputSchema } from "~/types/invest"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { InvestActionError } from "./invest"

// IA de Invest (INVEST_SPEC §4.8). Solo ayuda a escribir y a revisar: nunca
// abre ni cierra posiciones ni cambia el resultado del screener.

export type InvestAiError = InvestActionError | AiError

type Supabase = Awaited<ReturnType<typeof createClient>>

async function saveNote(supabase: Supabase, row: {
  user_id: string; kind: "picks" | "review"; run_id: string; position_id: string | null; input_hash: string; content: unknown; model: string
}): Promise<string> {
  const createdAt = new Date().toISOString()
  const { error } = await supabase.from("invest_ai_notes").upsert({ ...row, created_at: createdAt }, { onConflict: "user_id,kind,run_id,position_id" })
  if (error) console.error(error)
  return createdAt
}

/** Borrador de las cuatro Thesis prompts para un ticker (no se guarda aquí: lo autoguarda el formulario). */
export async function draftThesisWithAi(input: unknown): Promise<ResultType<{ answers: ThesisDraft }, InvestAiError>> {
  const parsed = draftThesisInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const ticker = parsed.data.ticker

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const [infoRes, fundamentalsRes, runRes, draftsRes] = await Promise.all([
    getInvestTicker(ticker), getFundamentalsHistory(ticker), getLatestRun(), getThesisDrafts(),
  ])
  if (!infoRes.success || !fundamentalsRes.success || !runRes.success || !draftsRes.success) return createErrorResult("UNKNOWN")
  const resultRes = runRes.data ? await getScreenResult(runRes.data.id, ticker) : null
  const result = resultRes?.success ? resultRes.data : null
  if (!infoRes.data && !result) return createErrorResult("NOT_IN_RUN")

  const info = infoRes.data
  const ai = await draftThesis({
    ticker,
    company: info && {
      name: info.name, exchange: info.exchange, sector: info.sector, industry: info.industry,
      quoteCurrency: info.currency, financialCurrency: info.financialCurrency, businessSummary: info.summary,
    },
    screener: result && {
      runDate: runRes.data?.runDate, passes: result.passes, failReasons: result.failReasons,
      marketCapUsd: result.marketCap, revenueGrowthYoy: result.revenueGrowthYoy, fcfMargin: result.fcfMargin,
      grossMargin: result.grossMargin, grossMarginPrevYear: result.grossMarginPrev, netDebtEbitda: result.netDebtEbitda,
      roic: result.roic, price: result.price, sma10Months: result.sma10m, momentum12_1: result.momentum121,
      relStrength6mVsBenchmark: result.relStrength6m, monthsListed: result.monthsListed,
    },
    fundamentals: fundamentalsRes.data.map(y => ({
      fiscalYear: y.fiscalYear, revenue: y.revenue, grossMargin: y.grossMargin, fcf: y.fcf, roic: y.roic, netDebtEbitda: y.netDebtEbitda,
    })),
    existingAnswers: draftsRes.data[ticker] ?? null,
  })
  if (!ai.success) return createErrorResult(ai.error)
  return createDataResult({ answers: ai.data.data })
}

/**
 * Comentario de los tickers que pasan el run vigente (§4.8). Se rehace la
 * entrada en el servidor; si su hash coincide con la guardada y no se pide
 * refresh, se devuelve la guardada sin llamar a la API.
 */
export async function generateRunPicks(
  input: unknown,
): Promise<ResultType<{ content: PicksContent; createdAt: string }, InvestAiError>> {
  const parsed = aiNoteInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const [runRes, settingsRes, positionsRes] = await Promise.all([getLatestRun(), getInvestSettings(), getPositions()])
  if (!runRes.success || !settingsRes.success || !positionsRes.success) return createErrorResult("UNKNOWN")
  const run = runRes.data
  if (!run || run.id !== parsed.data.runId) return createErrorResult("NOT_IN_RUN")
  if (!settingsRes.data) return createErrorResult("NO_SETTINGS")
  const passersRes = await getScreenResults(run.id, { passesOnly: true })
  if (!passersRes.success) return createErrorResult("UNKNOWN")
  if (passersRes.data.length === 0) return createErrorResult("NOT_IN_RUN")

  const aiInput = picksInput(run, passersRes.data, positionsRes.data, settingsRes.data)
  const hash = await inputHash(aiInput)
  const stored = await getInvestAiNote("picks", run.id, null)
  if (!parsed.data.refresh && stored.success && stored.data && stored.data.inputHash === hash) {
    const content = picksContentSchema.safeParse(stored.data.content)
    if (content.success) return createDataResult({ content: content.data, createdAt: stored.data.createdAt })
  }

  const ai = await commentRun(aiInput)
  if (!ai.success) return createErrorResult(ai.error)
  const createdAt = await saveNote(supabase, {
    user_id: user.id, kind: "picks", run_id: run.id, position_id: null, input_hash: hash, content: ai.data.data, model: ai.data.model,
  })
  revalidatePath(APP_URLS.INVEST)
  return createDataResult({ content: ai.data.data, createdAt })
}

/**
 * Revisión de los falsadores de una posición abierta con los datos del run
 * vigente (§4.8). Misma caché por hash que el comentario del run.
 */
export async function generatePositionReview(
  input: unknown,
): Promise<ResultType<{ content: ReviewContent; createdAt: string }, InvestAiError>> {
  const parsed = aiNoteInputSchema.safeParse(input)
  if (!parsed.success || !parsed.data.positionId) return createErrorResult("INVALID_INPUT")
  const positionId = parsed.data.positionId

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const [runRes, positionsRes, checksRes] = await Promise.all([getLatestRun(), getPositions(), getPositionChecks(positionId)])
  if (!runRes.success || !positionsRes.success || !checksRes.success) return createErrorResult("UNKNOWN")
  const run = runRes.data
  if (!run || run.id !== parsed.data.runId) return createErrorResult("NOT_IN_RUN")
  const position = positionsRes.data.find(p => p.id === positionId)
  if (!position) return createErrorResult("POSITION_NOT_FOUND")
  if (position.closedAt != null) return createErrorResult("NOT_OPEN")

  const [resultRes, fundamentalsRes] = await Promise.all([getScreenResult(run.id, position.ticker), getFundamentalsHistory(position.ticker)])
  if (!resultRes.success || !fundamentalsRes.success) return createErrorResult("UNKNOWN")

  const aiInput = reviewInput({ run, position, result: resultRes.data, checks: checksRes.data, fundamentals: fundamentalsRes.data })
  const hash = await inputHash(aiInput)
  const stored = await getInvestAiNote("review", run.id, positionId)
  if (!parsed.data.refresh && stored.success && stored.data && stored.data.inputHash === hash) {
    const content = reviewContentSchema.safeParse(stored.data.content)
    if (content.success) return createDataResult({ content: content.data, createdAt: stored.data.createdAt })
  }

  const ai = await reviewPosition(aiInput)
  if (!ai.success) return createErrorResult(ai.error)
  const createdAt = await saveNote(supabase, {
    user_id: user.id, kind: "review", run_id: run.id, position_id: positionId, input_hash: hash, content: ai.data.data, model: ai.data.model,
  })
  revalidatePath(APP_URLS.INVEST, "layout")
  return createDataResult({ content: ai.data.data, createdAt })
}
