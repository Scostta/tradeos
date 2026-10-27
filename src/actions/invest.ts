"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { APP_URLS } from "~/constants/app-urls"
import { getLatestRun, getPositions, getScreenResult } from "~/services/queries/invest"
import { isCurrentMonthRun, openBlockers } from "~/lib/calculations/invest-run"
import type { OpenBlocker } from "~/lib/calculations/invest-run"
import {
  closeInvestPositionInputSchema,
  openInvestPositionInputSchema,
  saveInvestSettingsInputSchema,
} from "~/types/invest"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export type InvestActionError =
  | OpenBlocker
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "NO_SETTINGS"
  | "NOT_IN_RUN"
  | "INVALID_DATE"
  | "INVALID_CLOSE_DATE"
  | "POSITION_NOT_FOUND"
  | "NOT_OPEN"
  | "UNKNOWN"

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function saveInvestSettings(input: unknown): Promise<ResultType<{ ok: true }, InvestActionError>> {
  const parsed = saveInvestSettingsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  // satellite_pct, max_positions y position_pct no se tocan desde la UI (§4.5):
  // en el insert quedan sus defaults y el upsert no los incluye.
  const { error } = await supabase.from("invest_settings").upsert(
    {
      user_id:               user.id,
      total_portfolio_value: parsed.data.totalPortfolioValue,
      benchmark_ticker:      parsed.data.benchmarkTicker.toUpperCase(),
      started_at:            parsed.data.startedAt,
      updated_at:            new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.INVEST)
  return createDataResult({ ok: true })
}

/**
 * §4.4: además de Zod, todo lo de §1.4 se comprueba aquí en servidor: run del
 * mes en curso, ticker aprobado en ese run, máximo de posiciones, ticker no
 * abierto y máximo 2 abiertas por sector. El botón solo lo refleja.
 */
export async function openInvestPosition(input: unknown): Promise<ResultType<{ id: string }, InvestActionError>> {
  const parsed = openInvestPositionInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const data = { ...parsed.data, ticker: parsed.data.ticker.toUpperCase() }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: settingsRow, error: settingsError } = await supabase
    .from("invest_settings").select("max_positions").eq("user_id", user.id).maybeSingle()
  if (settingsError) {
    console.error(settingsError)
    return createErrorResult("UNKNOWN")
  }
  if (!settingsRow) return createErrorResult("NO_SETTINGS")

  const runResult = await getLatestRun()
  if (!runResult.success) return createErrorResult("UNKNOWN")
  const run = runResult.data
  const today = todayUtc()
  if (!run || !isCurrentMonthRun(run.runDate, today)) return createErrorResult("NO_CURRENT_RUN")

  // Se decide con este run: la apertura es posterior a su cierre y no futura.
  if (data.openedAt <= run.runDate || data.openedAt > today) return createErrorResult("INVALID_DATE")

  const [candidateResult, positionsResult] = await Promise.all([
    getScreenResult(run.id, data.ticker),
    getPositions(),
  ])
  if (!candidateResult.success || !positionsResult.success) return createErrorResult("UNKNOWN")
  const candidate = candidateResult.data
  if (!candidate) return createErrorResult("NOT_IN_RUN")

  const blockers = openBlockers({
    isCurrentRun:  true,
    candidate,
    openPositions: positionsResult.data.filter(p => p.closedAt == null),
    maxPositions:  settingsRow.max_positions as number,
  })
  if (blockers.length > 0) return createErrorResult(blockers[0])

  const { data: inserted, error } = await supabase
    .from("invest_positions")
    .insert({
      user_id:     user.id,
      ticker:      data.ticker,
      run_id:      run.id,
      opened_at:   data.openedAt,
      entry_price: data.entryPrice,
      shares:      data.shares,
      fees_open:   data.feesOpen,
      thesis:      data.thesis,
      falsifiers:  data.falsifiers,
    })
    .select("id")
    .single()

  if (error) {
    // invest_positions_one_open_per_ticker: otra apertura simultánea del mismo ticker.
    if (error.code === "23505") return createErrorResult("ALREADY_OPEN")
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.INVEST)
  revalidatePath(APP_URLS.INVEST_POSITIONS)
  return createDataResult({ id: inserted.id as string })
}

/**
 * §4.3: cierra una posición abierta del usuario. La nota es obligatoria en
 * falsifier (qué falsador saltó) y manual (motivo); lo exige el schema.
 */
export async function closeInvestPosition(input: unknown): Promise<ResultType<{ ok: true }, InvestActionError>> {
  const parsed = closeInvestPositionInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const data = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: position, error: readError } = await supabase
    .from("invest_positions")
    .select("id, opened_at, closed_at")
    .eq("id", data.positionId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (readError) {
    console.error(readError)
    return createErrorResult("UNKNOWN")
  }
  if (!position) return createErrorResult("POSITION_NOT_FOUND")
  if (position.closed_at != null) return createErrorResult("NOT_OPEN")
  if (data.closedAt < (position.opened_at as string) || data.closedAt > todayUtc()) {
    return createErrorResult("INVALID_CLOSE_DATE")
  }

  const { data: updated, error } = await supabase
    .from("invest_positions")
    .update({
      closed_at:   data.closedAt,
      exit_price:  data.exitPrice,
      fees_close:  data.feesClose,
      exit_reason: data.exitReason,
      exit_note:   data.exitNote || null,
    })
    .eq("id", data.positionId)
    .eq("user_id", user.id)
    .is("closed_at", null)   // otra pestaña pudo cerrarla entre la lectura y aquí
    .select("id")

  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }
  if (!updated || updated.length === 0) return createErrorResult("NOT_OPEN")

  revalidatePath(APP_URLS.INVEST_POSITIONS)
  revalidatePath(APP_URLS.INVEST)
  return createDataResult({ ok: true })
}
