"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { createStrategyInputSchema, updateStrategyInputSchema } from "~/types/strategy"
import { mapStrategyFromDb } from "~/services/mappers/strategies"
import type { Strategy } from "~/types/strategy"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function createStrategy(
  input: unknown,
): Promise<ResultType<Strategy, string>> {
  const parsed = createStrategyInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { name, description, rules } = parsed.data

  const { data, error } = await supabase
    .from("strategies")
    .insert({
      user_id:     user.id,
      name,
      description,
      rules,
    })
    .select("*")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/strategies")
  return createDataResult(mapStrategyFromDb(data))
}

export async function updateStrategy(
  input: unknown,
): Promise<ResultType<Strategy, string>> {
  const parsed = updateStrategyInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, name, description, rules } = parsed.data

  const { data, error } = await supabase
    .from("strategies")
    .update({ name, description, rules })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/strategies")
  return createDataResult(mapStrategyFromDb(data))
}

const setStrategyActiveInputSchema = z.object({
  id:     z.string().uuid(),
  active: z.boolean(),
})

export async function setStrategyActive(
  input: unknown,
): Promise<ResultType<{ id: string; active: boolean }, string>> {
  const parsed = setStrategyActiveInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, active } = parsed.data

  const { error } = await supabase
    .from("strategies")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/strategies")
  return createDataResult({ id, active })
}
