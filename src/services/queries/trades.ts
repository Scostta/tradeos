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

export async function getTradesPage(
  filters: TradeFilters,
): Promise<ResultType<TradesPageData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const offset = (filters.page - 1) * PAGE_SIZE

  const dateRange = filters.range !== "all" ? resolveDateRange(filters.range, await getUserTimezone()) : null

  let pageQuery = supabase
    .from("trades")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("entry_time", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (filters.accountId)  pageQuery = pageQuery.eq("account_id", filters.accountId)
  if (filters.instrument) pageQuery = pageQuery.eq("instrument", filters.instrument)
  if (filters.direction)  pageQuery = pageQuery.eq("direction", filters.direction)
  if (filters.playbookId) pageQuery = pageQuery.eq("playbook_id", filters.playbookId)
  if (dateRange)          pageQuery = pageQuery.gte("entry_time", dateRange.from).lte("entry_time", dateRange.to)

  let netQuery = supabase
    .from("trades")
    .select("net_pnl")
    .eq("user_id", user.id)

  if (filters.accountId)  netQuery = netQuery.eq("account_id", filters.accountId)
  if (filters.instrument) netQuery = netQuery.eq("instrument", filters.instrument)
  if (filters.direction)  netQuery = netQuery.eq("direction", filters.direction)
  if (filters.playbookId) netQuery = netQuery.eq("playbook_id", filters.playbookId)
  if (dateRange)          netQuery = netQuery.gte("entry_time", dateRange.from).lte("entry_time", dateRange.to)

  let instrQuery = supabase
    .from("trades")
    .select("instrument")
    .eq("user_id", user.id)

  if (filters.accountId) instrQuery = instrQuery.eq("account_id", filters.accountId)

  const [pageResult, netResult, instrResult] = await Promise.all([
    pageQuery,
    netQuery,
    instrQuery,
  ])

  if (pageResult.error) {
    console.error(pageResult.error)
    return createErrorResult(pageResult.error.message)
  }
  if (netResult.error) {
    console.error(netResult.error)
    return createErrorResult(netResult.error.message)
  }
  if (instrResult.error) {
    console.error(instrResult.error)
    return createErrorResult(instrResult.error.message)
  }

  const trades     = (pageResult.data ?? []).map(row => mapTradeFromDb(row as Record<string, unknown>))
  const totalCount = pageResult.count ?? 0
  const totalNet   = (netResult.data ?? []).reduce(
    (sum, r) => sum + (typeof r.net_pnl === "number" ? r.net_pnl : 0),
    0,
  )
  const pageCount  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const instrSet = new Set<string>()
  for (const row of instrResult.data ?? []) {
    if (typeof row.instrument === "string") instrSet.add(row.instrument)
  }
  const instruments = Array.from(instrSet).sort()

  return createDataResult({
    trades,
    totalCount,
    totalNet,
    page:    filters.page,
    pageCount,
    instruments,
  })
}
