import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import {
  mapFundamentalsYearFromDb,
  mapInvestPositionFromDb,
  mapInvestTickerFromDb,
  mapThesisAnswersFromDb,
  mapInvestPriceFromDb,
  mapInvestSettingsFromDb,
  mapPositionCheckFromDb,
  mapScreenResultFromDb,
  mapScreenRunFromDb,
} from "~/services/mappers/invest"
import type {
  FundamentalsYear,
  InvestPositionWithMeta,
  InvestTicker,
  ThesisAnswers,
  InvestPrice,
  InvestSettings,
  PositionCheck,
  ScreenResult,
  ScreenRun,
} from "~/types/invest"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

const FETCH_CHUNK = 1000   // max-rows por defecto de PostgREST en Supabase

export const getLatestRun = cache(async (): Promise<ResultType<ScreenRun | null, string>> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invest_screen_runs")
    .select("*")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(data ? mapScreenRunFromDb(data) : null)
})

export async function getScreenResults(
  runId: string,
  { passesOnly = false }: { passesOnly?: boolean } = {},
): Promise<ResultType<ScreenResult[], string>> {
  const supabase = await createClient()
  const rows: ScreenResult[] = []
  for (let from = 0; ; from += FETCH_CHUNK) {
    let q = supabase.from("invest_screen_results").select("*").eq("run_id", runId)
    if (passesOnly) q = q.eq("passes", true)
    const { data, error } = await q.order("ticker", { ascending: true }).range(from, from + FETCH_CHUNK - 1)
    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    rows.push(...(data ?? []).map(mapScreenResultFromDb))
    if ((data ?? []).length < FETCH_CHUNK) break
  }
  return createDataResult(rows)
}

export async function getScreenResult(
  runId: string,
  ticker: string,
): Promise<ResultType<ScreenResult | null, string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invest_screen_results")
    .select("*")
    .eq("run_id", runId)
    .eq("ticker", ticker.trim().toUpperCase())
    .maybeSingle()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(data ? mapScreenResultFromDb(data) : null)
}

export const getInvestSettings = cache(async (): Promise<ResultType<InvestSettings | null, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("invest_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(data ? mapInvestSettingsFromDb(data) : null)
})

/**
 * Posiciones del usuario (abiertas y cerradas) con nombre, sector y divisa de
 * su fila en el run que las aprobó (run_id + ticker).
 */
export const getPositions = cache(async (): Promise<ResultType<InvestPositionWithMeta[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("invest_positions")
    .select("*")
    .eq("user_id", user.id)
    .order("opened_at", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  const positions = (data ?? []).map(mapInvestPositionFromDb)
  if (positions.length === 0) return createDataResult([])

  const { data: metaRows, error: metaError } = await supabase
    .from("invest_screen_results")
    .select("run_id, ticker, name, sector, currency")
    .in("run_id", [...new Set(positions.map(p => p.runId))])
    .in("ticker", [...new Set(positions.map(p => p.ticker))])

  if (metaError) {
    console.error(metaError)
    return createErrorResult(metaError.message)
  }
  const meta = new Map(
    (metaRows ?? []).map(r => [`${r.run_id}|${r.ticker}`, r] as const),
  )
  return createDataResult(
    positions.map(p => {
      const m = meta.get(`${p.runId}|${p.ticker}`)
      return {
        ...p,
        name:     (m?.name as string | null) ?? null,
        sector:   (m?.sector as string | null) ?? null,
        currency: (m?.currency as string | null) ?? null,
      }
    }),
  )
})

/** Cierres mensuales de `tickers` desde `from` (YYYY-MM-DD), en orden. */
export async function getPricesFor(
  tickers: string[],
  from: string,
): Promise<ResultType<InvestPrice[], string>> {
  if (tickers.length === 0) return createDataResult([])
  const supabase = await createClient()
  const rows: InvestPrice[] = []
  for (let offset = 0; ; offset += FETCH_CHUNK) {
    const { data, error } = await supabase
      .from("invest_prices")
      .select("*")
      .in("ticker", [...new Set(tickers)])
      .gte("month_end", from)
      .order("ticker", { ascending: true })
      .order("month_end", { ascending: true })
      .range(offset, offset + FETCH_CHUNK - 1)
    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    rows.push(...(data ?? []).map(mapInvestPriceFromDb))
    if ((data ?? []).length < FETCH_CHUNK) break
  }
  return createDataResult(rows)
}

export type LatestCheck = PositionCheck & { runDate: string }

/** Último check (§2.6) de cada posición, por run_date. */
export async function getLatestChecks(
  positionIds: string[],
): Promise<ResultType<Record<string, LatestCheck>, string>> {
  if (positionIds.length === 0) return createDataResult({})
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invest_position_checks")
    .select("position_id, run_id, price, sma10m, signal, invest_screen_runs(run_date)")
    .in("position_id", positionIds)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  const latest: Record<string, LatestCheck> = {}
  for (const row of data ?? []) {
    const run = row.invest_screen_runs as unknown as { run_date: string } | null
    if (!run) continue
    const check = { ...mapPositionCheckFromDb(row), runDate: run.run_date }
    const current = latest[check.positionId]
    if (!current || current.runDate < check.runDate) latest[check.positionId] = check
  }
  return createDataResult(latest)
}

/** Runs con run_date >= from (YYYY-MM-DD), para el % de meses revisados (§4.6). */
export async function getRunsSince(from: string): Promise<ResultType<{ id: string; runDate: string }[], string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invest_screen_runs")
    .select("id, run_date")
    .gte("run_date", from)
    .order("run_date", { ascending: true })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(r => ({ id: r.id as string, runDate: r.run_date as string })))
}

/** Ids de los runs que el usuario revisó (invest_reviews). */
export async function getReviewedRunIds(): Promise<ResultType<Set<string>, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase.from("invest_reviews").select("run_id").eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(new Set((data ?? []).map(r => r.run_id as string)))
}

// ── Página de detalle /invest/[ticker] (§4.7) ────────────────────────────────

export async function getInvestTicker(ticker: string): Promise<ResultType<InvestTicker | null, string>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("invest_tickers").select("*").eq("ticker", ticker).maybeSingle()
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(data ? mapInvestTickerFromDb(data) : null)
}

/** Últimos años fiscales guardados del ticker, del más reciente al más antiguo. */
export async function getFundamentalsHistory(ticker: string): Promise<ResultType<FundamentalsYear[], string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invest_fundamentals_history")
    .select("*")
    .eq("ticker", ticker)
    .order("fiscal_year", { ascending: false })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(mapFundamentalsYearFromDb))
}

/** Borradores de "Thesis prompts" del usuario, por ticker. */
export const getThesisDrafts = cache(async (): Promise<ResultType<Record<string, ThesisAnswers>, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase.from("invest_thesis_drafts").select("ticker, answers").eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(
    Object.fromEntries((data ?? []).map(r => [r.ticker as string, mapThesisAnswersFromDb(r.answers)])),
  )
})
