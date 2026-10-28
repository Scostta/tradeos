import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import {
  mapFinanceAccountFromDb,
  mapFinanceCategoryFromDb,
  mapFinanceRuleFromDb,
  mapFinanceSettingsFromDb,
} from "~/services/mappers/finance"
import type { FinanceAccount, FinanceCategory, FinanceRule, FinanceSettings } from "~/types/finance"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

// Lecturas de Money para Server Components (MONEY_SPEC.md §2). Todas filtran
// por el usuario de la sesión además de la RLS.

/** null si el usuario aún no ha dado de alta Money (§5.1: formulario de alta). */
export const getFinanceSettings = cache(async (): Promise<ResultType<FinanceSettings | null, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase.from("finance_settings").select("*").eq("user_id", user.id).maybeSingle()
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(data ? mapFinanceSettingsFromDb(data) : null)
})

export const getFinanceAccounts = cache(async (): Promise<ResultType<FinanceAccount[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(mapFinanceAccountFromDb))
})

export const getFinanceCategories = cache(async (): Promise<ResultType<FinanceCategory[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("sort", { ascending: true })
    .order("name", { ascending: true })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(mapFinanceCategoryFromDb))
})

export const getFinanceRules = cache(async (): Promise<ResultType<FinanceRule[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_category_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: false })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(mapFinanceRuleFromDb))
})
