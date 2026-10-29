"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { APP_URLS } from "~/constants/app-urls"
import { getLatestRun, getPositions, getScreenResult } from "~/services/queries/invest"
import { isCurrentMonthRun, openBlockers, positionsForLimits, startedAtAfterOpen } from "~/lib/calculations/invest-run"
import type { OpenBlocker } from "~/lib/calculations/invest-run"
import {
  closeInvestPositionInputSchema,
  setFalsifierStatusInputSchema,
  markRunReviewedInputSchema,
  openInvestPositionInputSchema,
  saveInvestSettingsInputSchema,
  saveThesisDraftInputSchema,
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

  // satellite_pct, max_positions y position_pct no se tocan desde la UI (§4.5),
  // ni started_at, que fija openInvestPosition con la primera posición (§1.6):
  // en el insert quedan sus defaults y el upsert no los incluye.
  const { error } = await supabase.from("invest_settings").upsert(
    {
      user_id:               user.id,
      total_portfolio_value: parsed.data.totalPortfolioValue,
      benchmark_ticker:      parsed.data.benchmarkTicker.toUpperCase(),
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
    .from("invest_settings").select("max_positions, paper_mode, started_at").eq("user_id", user.id).maybeSingle()
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

  // §1.6: en modo papel se abren posiciones de papel. Los límites se cuentan
  // solo entre las del modo actual (las de papel no cuentan en modo real).
  const paper = settingsRow.paper_mode as boolean
  const blockers = openBlockers({
    isCurrentRun:  true,
    candidate,
    openPositions: positionsForLimits(positionsResult.data, paper),
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
      paper,
    })
    .select("id")
    .single()

  if (error) {
    // invest_positions_one_open_per_ticker: otra apertura simultánea del mismo ticker (y modo).
    if (error.code === "23505") return createErrorResult("ALREADY_OPEN")
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  // §1.6: el test de 36 meses arranca con la primera posición con dinero real.
  const currentStart = (settingsRow.started_at as string | null) ?? null
  const startedAt = startedAtAfterOpen(currentStart, paper, data.openedAt)
  if (startedAt !== currentStart) {
    const { error: startError } = await supabase
      .from("invest_settings")
      .update({ started_at: startedAt, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("started_at", null)
    if (startError) console.error(startError)
  }

  revalidatePath(APP_URLS.INVEST)
  revalidatePath(APP_URLS.INVEST_POSITIONS)
  revalidatePath(APP_URLS.INVEST_PERFORMANCE)
  // Detalles de ticker y de posición (/invest/[ticker], /invest/positions/[ticker]).
  revalidatePath(APP_URLS.INVEST, "layout")
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
  // Detalles de ticker y de posición (/invest/[ticker], /invest/positions/[ticker]).
  revalidatePath(APP_URLS.INVEST, "layout")
  return createDataResult({ ok: true })
}

/**
 * §4.3: marca a mano un falsador como "sin novedad" o "revisar". Solo en
 * posiciones abiertas; no decide nada (la salida es la de §1.4).
 */
export async function setFalsifierStatus(input: unknown): Promise<ResultType<{ ok: true }, InvestActionError>> {
  const parsed = setFalsifierStatusInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const { positionId, index, status } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: position, error: readError } = await supabase
    .from("invest_positions")
    .select("falsifiers, falsifier_status, closed_at")
    .eq("id", positionId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (readError) {
    console.error(readError)
    return createErrorResult("UNKNOWN")
  }
  if (!position) return createErrorResult("POSITION_NOT_FOUND")
  if (position.closed_at != null) return createErrorResult("NOT_OPEN")
  const falsifiers = position.falsifiers as string[]
  if (index >= falsifiers.length) return createErrorResult("INVALID_INPUT")

  const current = Array.isArray(position.falsifier_status) ? (position.falsifier_status as string[]) : []
  const next = falsifiers.map((_, i) => (i === index ? status : current[i] === "review" ? "review" : "ok"))

  const { error } = await supabase
    .from("invest_positions")
    .update({ falsifier_status: next })
    .eq("id", positionId)
    .eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.INVEST_POSITION(positionId))
  return createDataResult({ ok: true })
}

/**
 * §4.6: registra que el usuario revisó el run vigente (visita a Screen). Solo
 * cuenta el run del mes en curso; repetir la visita no cambia nada.
 */
export async function markRunReviewed(input: unknown): Promise<ResultType<{ ok: true }, InvestActionError>> {
  const parsed = markRunReviewedInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const runResult = await getLatestRun()
  if (!runResult.success) return createErrorResult("UNKNOWN")
  const run = runResult.data
  if (!run || run.id !== parsed.data.runId || !isCurrentMonthRun(run.runDate, todayUtc())) {
    return createErrorResult("NO_CURRENT_RUN")
  }

  const { data: inserted, error } = await supabase
    .from("invest_reviews")
    .upsert({ user_id: user.id, run_id: run.id }, { onConflict: "user_id,run_id", ignoreDuplicates: true })
    .select("run_id")
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }
  // Primera visita al run: el aviso "New" del sidebar (layout) desaparece.
  if ((inserted ?? []).length > 0) revalidatePath("/", "layout")
  return createDataResult({ ok: true })
}

/**
 * §1.6: sale del modo papel. Desde aquí el modal abre posiciones reales y la
 * primera fija started_at. No hay vuelta atrás desde la UI.
 */
export async function startRealTest(): Promise<ResultType<{ ok: true }, InvestActionError>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase
    .from("invest_settings")
    .update({ paper_mode: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.INVEST)
  revalidatePath(APP_URLS.INVEST_POSITIONS)
  revalidatePath(APP_URLS.INVEST_PERFORMANCE)
  // Detalles de ticker y de posición (/invest/[ticker], /invest/positions/[ticker]).
  revalidatePath(APP_URLS.INVEST, "layout")
  return createDataResult({ ok: true })
}

/** §4.7: autoguardado de las respuestas de "Thesis prompts" (una fila por usuario y ticker). */
export async function saveThesisDraft(input: unknown): Promise<ResultType<{ savedAt: string }, InvestActionError>> {
  const parsed = saveThesisDraftInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const savedAt = new Date().toISOString()
  const { error } = await supabase.from("invest_thesis_drafts").upsert(
    {
      user_id:    user.id,
      ticker:     parsed.data.ticker.toUpperCase(),
      answers:    parsed.data.answers,
      updated_at: savedAt,
    },
    { onConflict: "user_id,ticker" },
  )
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }
  // Sin revalidatePath: es un autoguardado; Screen lo lee en su próxima carga.
  return createDataResult({ savedAt })
}
