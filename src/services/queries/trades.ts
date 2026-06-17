import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { resolveDateRange } from "~/helpers/date-range"
import { getUserTimezone } from "~/services/queries/profile"
import { createDataResult, createErrorResult } from "~/helpers/result"
import { PAGE_SIZE } from "~/types/trade-filters"
import type { ResultType } from "~/helpers/result"
import type { Trade } from "~/types/trade"
import type { TradeFilters, TradesPageData } from "~/types/trade-filters"

export async function getTradeById(
  id: string,
): Promise<ResultType<Trade, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  return createDataResult(mapTradeFromDb(data as Record<string, unknown>))
}

// Filter predicates shared by the page query and the net-total query. Returns a
// list of operations so the (deeply generic) Supabase builder type is never
// named — each op just receives and returns the same builder instance.
type FilterBuilderLike = {
  eq(column: string, value: string | number): FilterBuilderLike
  gt(column: string, value: number): FilterBuilderLike
  lt(column: string, value: number): FilterBuilderLike
  gte(column: string, value: string | number): FilterBuilderLike
  lte(column: string, value: string | number): FilterBuilderLike
  is(column: string, value: null): FilterBuilderLike
  not(column: string, operator: string, value: null): FilterBuilderLike
  contains(column: string, value: readonly string[]): FilterBuilderLike
}

function tradeFilterOps(
  filters: TradeFilters,
  dateRange: { from: string; to: string } | null,
): ((q: FilterBuilderLike) => FilterBuilderLike)[] {
  const ops: ((q: FilterBuilderLike) => FilterBuilderLike)[] = []

  if (filters.accountId)  ops.push(q => q.eq("account_id", filters.accountId!))
  if (filters.instrument) ops.push(q => q.eq("instrument", filters.instrument!))
  if (filters.direction)  ops.push(q => q.eq("direction", filters.direction!))
  if (filters.playbookId) ops.push(q => q.eq("playbook_id", filters.playbookId!))

  if (filters.outcome === "win")  ops.push(q => q.gt("net_pnl", 0))
  if (filters.outcome === "loss") ops.push(q => q.lt("net_pnl", 0))
  if (filters.outcome === "be")   ops.push(q => q.eq("net_pnl", 0))
  if (filters.pnlMin !== null)    ops.push(q => q.gte("net_pnl", filters.pnlMin!))
  if (filters.pnlMax !== null)    ops.push(q => q.lte("net_pnl", filters.pnlMax!))

  if (filters.mistake === "clean")    ops.push(q => q.is("mistakes", null))
  else if (filters.mistake === "any") ops.push(q => q.not("mistakes", "is", null))
  else if (filters.mistake)           ops.push(q => q.contains("mistakes", [filters.mistake!]))

  if (filters.tag) ops.push(q => q.contains("tags", [filters.tag!]))

  if (dateRange) ops.push(q => q.gte("entry_time", dateRange.from).lte("entry_time", dateRange.to))

  return ops
}

export async function getTradesPage(
  filters: TradeFilters,
): Promise<ResultType<TradesPageData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const offset = (filters.page - 1) * PAGE_SIZE

  const dateRange = filters.range !== "all" ? resolveDateRange(filters.range, await getUserTimezone()) : null
  const ops = tradeFilterOps(filters, dateRange)

  let pageQuery = supabase
    .from("trades")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("entry_time", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  for (const op of ops) pageQuery = op(pageQuery as unknown as FilterBuilderLike) as unknown as typeof pageQuery

  let netQuery = supabase.from("trades").select("net_pnl").eq("user_id", user.id)
  for (const op of ops) netQuery = op(netQuery as unknown as FilterBuilderLike) as unknown as typeof netQuery

  // Available instruments + tags reflect the account scope only (not the other
  // filters), so the dropdowns always show every option for the active account.
  let optionsQuery = supabase
    .from("trades")
    .select("instrument, tags")
    .eq("user_id", user.id)

  if (filters.accountId) optionsQuery = optionsQuery.eq("account_id", filters.accountId)

  const [pageResult, netResult, optionsResult] = await Promise.all([
    pageQuery,
    netQuery,
    optionsQuery,
  ])

  if (pageResult.error) {
    console.error(pageResult.error)
    return createErrorResult(pageResult.error.message)
  }
  if (netResult.error) {
    console.error(netResult.error)
    return createErrorResult(netResult.error.message)
  }
  if (optionsResult.error) {
    console.error(optionsResult.error)
    return createErrorResult(optionsResult.error.message)
  }

  const trades     = (pageResult.data ?? []).map(row => mapTradeFromDb(row as Record<string, unknown>))
  const totalCount = pageResult.count ?? 0
  const totalNet   = (netResult.data ?? []).reduce(
    (sum, r) => sum + (typeof r.net_pnl === "number" ? r.net_pnl : 0),
    0,
  )
  const pageCount  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const instrSet = new Set<string>()
  const tagSet   = new Set<string>()
  for (const row of optionsResult.data ?? []) {
    if (typeof row.instrument === "string") instrSet.add(row.instrument)
    if (Array.isArray(row.tags)) {
      for (const t of row.tags) if (typeof t === "string") tagSet.add(t)
    }
  }

  return createDataResult({
    trades,
    totalCount,
    totalNet,
    page:    filters.page,
    pageCount,
    instruments: Array.from(instrSet).sort(),
    tags:        Array.from(tagSet).sort(),
  })
}
