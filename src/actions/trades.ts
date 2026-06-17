"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { createServerClient } from "~/utils/supabase/service"
import { createTradeSchema, updateTradeSchema } from "~/types/trade"
import { createDataResult, createErrorResult } from "~/helpers/result"
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
