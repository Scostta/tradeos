"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { createPlaybookInputSchema, updatePlaybookInputSchema } from "~/types/playbook"
import { mapPlaybookFromDb } from "~/services/mappers/playbooks"
import type { Playbook } from "~/types/playbook"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function createPlaybook(
  input: unknown,
): Promise<ResultType<Playbook, string>> {
  const parsed = createPlaybookInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { name, description, rules } = parsed.data

  const { data, error } = await supabase
    .from("playbooks")
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

  revalidatePath("/playbooks")
  revalidatePath("/reports")
  return createDataResult(mapPlaybookFromDb(data))
}

export async function updatePlaybook(
  input: unknown,
): Promise<ResultType<Playbook, string>> {
  const parsed = updatePlaybookInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, name, description, rules } = parsed.data

  const { data, error } = await supabase
    .from("playbooks")
    .update({ name, description, rules })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/playbooks")
  revalidatePath(`/playbooks/${id}`)
  revalidatePath("/reports")
  return createDataResult(mapPlaybookFromDb(data))
}

const setPlaybookActiveInputSchema = z.object({
  id:     z.string().uuid(),
  active: z.boolean(),
})

export async function setPlaybookActive(
  input: unknown,
): Promise<ResultType<{ id: string; active: boolean }, string>> {
  const parsed = setPlaybookActiveInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, active } = parsed.data

  const { error } = await supabase
    .from("playbooks")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/playbooks")
  revalidatePath(`/playbooks/${id}`)
  revalidatePath("/reports")
  return createDataResult({ id, active })
}
