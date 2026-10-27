import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import {
  mapInvestPositionFromDb,
  mapInvestPriceFromDb,
  mapInvestSettingsFromDb,
  mapScreenResultFromDb,
  mapScreenRunFromDb,
} from "~/services/mappers/invest"
import type {
  InvestPositionWithMeta,
  InvestPrice,
  InvestSettings,
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
