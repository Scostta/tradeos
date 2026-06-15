"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

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

const updateStrategySchema = z.object({
  id:         z.string().uuid(),
  strategyId: z.string().uuid().nullable(),
})

export async function updateTradeStrategy(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = updateStrategySchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, strategyId } = parsed.data
  const { error } = await supabase
    .from("trades")
    .update({ strategy_id: strategyId })
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
