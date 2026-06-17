"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { createServerClient } from "~/utils/supabase/service"
import { createTradeSchema, updateTradeSchema } from "~/types/trade"
import { parseTradeFilters } from "~/types/trade-filters"
import { tradeFilterOps } from "~/services/queries/trades"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { getUserTimezone } from "~/services/queries/profile"
import { resolveDateRange } from "~/helpers/date-range"
import { zonedParts } from "~/helpers/tz"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { FilterBuilderLike } from "~/services/queries/trades"
import type { ResultType } from "~/helpers/result"

const ATTACHMENTS_BUCKET = "trade-attachments"

const round2 = (n: number): number => Math.round(n * 100) / 100

export async function createTrade(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = createTradeSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const t = parsed.data

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", t.accountId)
    .eq("user_id", user.id)
    .single()
  if (!account) return createErrorResult("ACCOUNT_NOT_FOUND")

  const { data: row, error } = await supabase
    .from("trades")
    .insert({
      user_id:      user.id,
      account_id:   t.accountId,
      trade_number: null,
      source:       "manual",
      instrument:   t.instrument.trim(),
      direction:    t.direction,
      contracts:    t.contracts,
      entry_price:  t.entryPrice,
      exit_price:   t.exitPrice,
      entry_time:   t.entryTime,
      exit_time:    t.exitTime,
      pnl:          t.pnl,
      commission:   t.commission,
      net_pnl:      round2(t.pnl - t.commission),
      playbook_id:  t.playbookId,
      session:      t.session,
      notes:        t.notes,
      stop_price:   t.stopPrice,
    })
    .select("id")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/trades")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  return createDataResult({ id: row.id })
}

export async function updateTrade(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateTradeSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const t = parsed.data

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", t.accountId)
    .eq("user_id", user.id)
    .single()
  if (!account) return createErrorResult("ACCOUNT_NOT_FOUND")

  // Only the form fields are updated; mae/mfe/tags are preserved.
  const { error } = await supabase
    .from("trades")
    .update({
      account_id:  t.accountId,
      instrument:  t.instrument.trim(),
      direction:   t.direction,
      contracts:   t.contracts,
      entry_price: t.entryPrice,
      exit_price:  t.exitPrice,
      entry_time:  t.entryTime,
      exit_time:   t.exitTime,
      pnl:         t.pnl,
      commission:  t.commission,
      net_pnl:     round2(t.pnl - t.commission),
      playbook_id: t.playbookId,
      session:     t.session,
      notes:       t.notes,
      stop_price:  t.stopPrice,
    })
    .eq("id", t.id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/trades")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  revalidatePath(`/trades/${t.id}`)
  return createDataResult({ id: t.id })
}

// ── CSV export ────────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  "Entry", "Exit", "Account", "Instrument", "Direction", "Contracts",
  "Entry Price", "Exit Price", "Stop", "Gross P&L", "Commission", "Net P&L",
  "MAE", "MFE", "Session", "Playbook", "Tags", "Mistakes", "Notes",
] as const

/** Quotes a CSV cell when it contains a comma, quote or newline. */
function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** "YYYY-MM-DD HH:MM:SS" in the user's timezone — readable in Excel/Sheets. */
function localStamp(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}

/**
 * Exports every trade matching the current filters (not just the page) as CSV.
 * Reuses the same filter predicates as the trades table so what you see is what
 * you export. Returns the CSV text + a suggested filename; the client downloads it.
 */
export async function exportTradesCsv(
  params: unknown,
): Promise<ResultType<{ csv: string; filename: string }, string>> {
  const filters = parseTradeFilters(
    (params && typeof params === "object" ? params : {}) as Record<string, string | undefined>,
  )

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const timeZone  = await getUserTimezone()
  const dateRange = filters.range !== "all" ? resolveDateRange(filters.range, timeZone) : null

  let query = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_time", { ascending: true })
  for (const op of tradeFilterOps(filters, dateRange)) {
    query = op(query as unknown as FilterBuilderLike) as unknown as typeof query
  }

  const [tradesRes, accountsRes, playbooksRes] = await Promise.all([
    query,
    supabase.from("accounts").select("id, name").eq("user_id", user.id),
    supabase.from("playbooks").select("id, name").eq("user_id", user.id),
  ])

  if (tradesRes.error)    { console.error(tradesRes.error);    return createErrorResult(tradesRes.error.message) }
  if (accountsRes.error)  { console.error(accountsRes.error);  return createErrorResult(accountsRes.error.message) }
  if (playbooksRes.error) { console.error(playbooksRes.error); return createErrorResult(playbooksRes.error.message) }

  const accountName  = new Map((accountsRes.data ?? []).map(a => [a.id as string, a.name as string]))
  const playbookName = new Map((playbooksRes.data ?? []).map(p => [p.id as string, p.name as string]))

  const trades = (tradesRes.data ?? []).map(r => mapTradeFromDb(r as Record<string, unknown>))

  const rows = trades.map(t => [
    localStamp(t.entryTime, timeZone),
    localStamp(t.exitTime, timeZone),
    accountName.get(t.accountId) ?? "",
    t.instrument,
    t.direction,
    t.contracts,
    t.entryPrice,
    t.exitPrice,
    t.stopPrice ?? "",
    t.pnl,
    t.commission,
    t.netPnl,
    t.mae ?? "",
    t.mfe ?? "",
    t.session ?? "",
    t.playbookId ? (playbookName.get(t.playbookId) ?? "") : "",
    (t.tags ?? []).join("; "),
    (t.mistakes ?? []).join("; "),
    t.notes ?? "",
  ])

  const csv = [
    CSV_COLUMNS.join(","),
    ...rows.map(r => r.map(csvCell).join(",")),
  ].join("\r\n")

  const stamp = new Date().toISOString().slice(0, 10)
  return createDataResult({ csv, filename: `trades-${stamp}.csv` })
}

const updateNotesSchema = z.object({
  id:    z.string().uuid(),
  notes: z.string().max(5000).nullable(),
})

export async function updateTradeNotes(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateNotesSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, notes } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ notes })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(`/trades/${id}`)
  return createDataResult({ id })
}

const updatePlaybookSchema = z.object({
  id:         z.string().uuid(),
  playbookId: z.string().uuid().nullable(),
})

export async function updateTradePlaybook(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updatePlaybookSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, playbookId } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ playbook_id: playbookId })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(`/trades/${id}`)
  return createDataResult({ id })
}

const updateTagsSchema = z.object({
  id:   z.string().uuid(),
  tags: z.array(z.string().max(40)).max(20).nullable(),
})

export async function updateTradeTags(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateTagsSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, tags } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ tags })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(`/trades/${id}`)
  return createDataResult({ id })
}

const updateMistakesSchema = z.object({
  id:       z.string().uuid(),
  mistakes: z.array(z.string().trim().min(1).max(60)).max(20).nullable(),
})

export async function updateTradeMistakes(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateMistakesSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, mistakes } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ mistakes })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(`/trades/${id}`)
  revalidatePath("/reports")
  return createDataResult({ id })
}

const updateFollowedRulesSchema = z.object({
  id:            z.string().uuid(),
  followedRules: z.array(z.string().max(200)).max(50).nullable(),
})

export async function updateTradeFollowedRules(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateFollowedRulesSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, followedRules } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ followed_rules: followedRules })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(`/trades/${id}`)
  revalidatePath("/playbooks")
  return createDataResult({ id })
}

const deleteTradeSchema = z.object({
  id: z.string().uuid(),
})

export async function deleteTrade(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = deleteTradeSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id } = parsed.data

  // Collect attachment storage paths before deleting the trade: the DB rows
  // cascade away, but the Storage objects would otherwise be orphaned.
  const { data: attachments } = await supabase
    .from("trade_attachments")
    .select("storage_path")
    .eq("trade_id", id)
    .eq("user_id", user.id)

  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  const paths = (attachments ?? []).map((a) => a.storage_path)
  if (paths.length > 0) {
    // Non-fatal: the trade is already gone; a failed cleanup just leaves files.
    const { error: storageError } = await createServerClient()
      .storage.from(ATTACHMENTS_BUCKET)
      .remove(paths)
    if (storageError) console.error(storageError)
  }

  revalidatePath("/trades")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  return createDataResult({ id })
}

const updateStopPriceSchema = z.object({
  id:        z.string().uuid(),
  stopPrice: z.number().positive().nullable(),
})

export async function updateTradeStopPrice(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateStopPriceSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, stopPrice } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ stop_price: stopPrice })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(`/trades/${id}`)
  return createDataResult({ id })
}
