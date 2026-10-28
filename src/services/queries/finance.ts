import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import {
  mapFinanceAccountFromDb,
  mapFinanceCategoryFromDb,
  mapFinanceRuleFromDb,
  mapFinanceSettingsFromDb,
  mapFinanceSubscriptionFromDb,
  mapFinanceTransactionFromDb,
} from "~/services/mappers/finance"
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceRule,
  FinanceSettings,
  FinanceSubscription,
  FinanceTransaction,
} from "~/types/finance"
import { monthOf, monthPeriod } from "~/lib/finance/dates"
import type { MonthKey } from "~/lib/finance/dates"
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

const READ_PAGE = 1000   // max-rows por defecto de PostgREST

/**
 * Movimientos del usuario, del más reciente al más antiguo. `month` usa el día
 * de inicio de mes de los ajustes; sin `month`, todos. `uncategorizedOnly` es
 * la cola (§5.2): sin categoría, sin excluir y que no sean partes de un split.
 */
export async function getTransactions(opts: {
  month?:             MonthKey
  startDay?:          number
  uncategorizedOnly?: boolean
}): Promise<ResultType<FinanceTransaction[], string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const out: FinanceTransaction[] = []
  for (let from = 0; ; from += READ_PAGE) {
    let q = supabase.from("finance_transactions").select("*").eq("user_id", user.id)
    if (opts.month) {
      const period = monthPeriod(opts.month, opts.startDay ?? 1)
      q = q.gte("booked_at", period.from).lt("booked_at", period.to)
    }
    if (opts.uncategorizedOnly) q = q.is("category_id", null).is("parent_id", null).eq("excluded", false)
    const { data, error } = await q
      .order("booked_at", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + READ_PAGE - 1)
    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    out.push(...(data ?? []).map(mapFinanceTransactionFromDb))
    if (!data || data.length < READ_PAGE) break
  }
  return createDataResult(out)
}

export type TransactionsIndex = {
  months:        { month: MonthKey; count: number }[]   // con datos, del más reciente al más antiguo
  uncategorized: number
  lastBookedAt:  string | null                           // "Imported through <fecha>"
}

/** Meses con movimientos y tamaño de la cola, sin traer los movimientos enteros. */
export const getTransactionsIndex = cache(async (startDay = 1): Promise<ResultType<TransactionsIndex, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const counts = new Map<MonthKey, number>()
  let uncategorized = 0
  let lastBookedAt: string | null = null
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("booked_at, category_id, parent_id, excluded")
      .eq("user_id", user.id)
      .order("booked_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + READ_PAGE - 1)
    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    for (const r of data ?? []) {
      const month = monthOf(r.booked_at as string, startDay)
      if (r.parent_id == null) counts.set(month, (counts.get(month) ?? 0) + 1)   // las partes de un split no suman
      if (r.category_id == null && r.parent_id == null && !r.excluded) uncategorized++
      if (lastBookedAt == null || (r.booked_at as string) > lastBookedAt) lastBookedAt = r.booked_at as string
    }
    if (!data || data.length < READ_PAGE) break
  }
  return createDataResult({
    months: [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, count]) => ({ month, count })),
    uncategorized,
    lastBookedAt,
  })
})

export const getSubscriptions = cache(async (): Promise<ResultType<FinanceSubscription[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("next_expected", { ascending: true, nullsFirst: false })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(mapFinanceSubscriptionFromDb))
})
