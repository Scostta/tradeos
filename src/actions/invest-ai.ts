"use server"

import { createClient } from "~/utils/supabase/server"
import { draftThesis } from "~/lib/invest/ai/thesis"
import type { ThesisDraft } from "~/lib/invest/ai/thesis"
import type { AiError } from "~/lib/ai/claude-json"
import {
  getFundamentalsHistory,
  getInvestTicker,
  getLatestRun,
  getScreenResult,
  getThesisDrafts,
} from "~/services/queries/invest"
import { draftThesisInputSchema } from "~/types/invest"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { InvestActionError } from "./invest"

// IA de Invest (INVEST_SPEC §4.8). Solo ayuda a escribir y a revisar: nunca
// abre ni cierra posiciones ni cambia el resultado del screener.

export type InvestAiError = InvestActionError | AiError

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
