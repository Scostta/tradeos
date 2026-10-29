import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import {
  mapFinanceAccountFromDb,
  mapFinanceCategoryFromDb,
  mapFinanceGoalFromDb,
  mapFinanceRuleFromDb,
  mapFinanceSettingsFromDb,
  mapFinanceSubscriptionFromDb,
  mapFinanceTransactionFromDb,
} from "~/services/mappers/finance"
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceGoal,
  FinanceRule,
  FinanceSettings,
  FinanceSubscription,
  FinanceTransaction,
} from "~/types/finance"
import { summaryContentSchema } from "~/lib/finance/ai/summary"
import type { SummaryContent } from "~/lib/finance/ai/summary"
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

/** Fecha del último movimiento importado (no cuenta el efectivo manual): pie del sidebar. */
export const getImportedThrough = cache(async (): Promise<ResultType<string | null, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_transactions")
    .select("booked_at")
    .eq("user_id", user.id)
    .eq("source", "import")
    .order("booked_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data?.booked_at as string | undefined) ?? null)
})

/** Resumen del mes con IA guardado (§5.8); null si aún no se ha generado. */
export const getMoneySummary = cache(async (month: MonthKey): Promise<ResultType<StoredMoneySummary | null, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_ai_summaries").select("content, input_hash, created_at").eq("user_id", user.id).eq("month", month).maybeSingle()
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  if (!data) return createDataResult(null)
  const content = summaryContentSchema.safeParse(data.content)
  if (!content.success) return createDataResult(null)
  return createDataResult({ content: content.data, inputHash: data.input_hash as string, createdAt: data.created_at as string })
})

export type StoredMoneySummary = { content: SummaryContent; inputHash: string; createdAt: string }

/** Presupuestos de un mes (§5.9): categoryId → importe. */
export const getBudgets = cache(async (month: MonthKey): Promise<ResultType<Record<string, number>, string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_budgets").select("category_id, amount").eq("user_id", user.id).eq("month", month)
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(Object.fromEntries((data ?? []).map(r => [r.category_id as string, Number(r.amount)])))
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

export const getGoals = cache(async (): Promise<ResultType<FinanceGoal[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("finance_goals")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult((data ?? []).map(mapFinanceGoalFromDb))
})

/**
 * Categorías de gasto ordenadas por uso en los últimos 90 días (las más
 * usadas primero): chips del alta de efectivo (§5.7 M2).
 */
export const getExpenseCategoryUsage = cache(async (today: string): Promise<ResultType<string[], string>> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("finance_transactions")
    .select("category_id")
    .eq("user_id", user.id)
    .lt("amount", 0)
    .not("category_id", "is", null)
    .gte("booked_at", since)
    .range(0, 4999)
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const id = row.category_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return createDataResult([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id))
})
