import { createClient } from "~/utils/supabase/server"
import { mapAccountFromDb } from "~/services/mappers/accounts"
import { computePropFirmStatus } from "~/lib/calculations/prop-firm"
import { getUserTimezone } from "~/services/queries/profile"
import type { Account } from "~/types/account"
import type { AccountWithPropStatus, PropFirmConfig, PropFirmTrade } from "~/types/prop-firm"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

function propConfig(a: Account): PropFirmConfig {
  return {
    initialBalance: a.initialBalance,
    drawdownType:   a.drawdownType,
    drawdownAmount: a.drawdownAmount,
    drawdownLockAt: a.drawdownLockAt,
    dailyLossLimit: a.dailyLossLimit,
    profitTarget:   a.profitTarget,
    minTradingDays: a.minTradingDays,
  }
}

export async function getAccounts(): Promise<ResultType<Account[], string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  return createDataResult((data ?? []).map(mapAccountFromDb))
}

export async function getAccountsWithStats(): Promise<ResultType<AccountWithPropStatus[], string>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const [accountsResult, tradesResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trades")
      .select("account_id, net_pnl, exit_time")
      .eq("user_id", user.id),
  ])

  if (accountsResult.error) {
    console.error(accountsResult.error)
    return createErrorResult(accountsResult.error.message)
  }

  if (tradesResult.error) {
    console.error(tradesResult.error)
    return createErrorResult(tradesResult.error.message)
  }

  const timeZone = await getUserTimezone()
  const statsMap  = new Map<string, { tradeCount: number; netPnl: number }>()
  const tradesMap = new Map<string, PropFirmTrade[]>()
  for (const trade of tradesResult.data ?? []) {
    const existing = statsMap.get(trade.account_id) ?? { tradeCount: 0, netPnl: 0 }
    statsMap.set(trade.account_id, {
      tradeCount: existing.tradeCount + 1,
      netPnl:     existing.netPnl + (trade.net_pnl ?? 0),
    })
    const list = tradesMap.get(trade.account_id) ?? []
    list.push({ netPnl: trade.net_pnl ?? 0, exitTime: trade.exit_time })
    tradesMap.set(trade.account_id, list)
  }

  const accounts: AccountWithPropStatus[] = (accountsResult.data ?? []).map((row) => {
    const account = mapAccountFromDb(row)
    const stats   = statsMap.get(row.id) ?? { tradeCount: 0, netPnl: 0 }
    const propStatus = computePropFirmStatus(propConfig(account), tradesMap.get(row.id) ?? [], new Date(), timeZone)
    return { ...account, ...stats, propStatus }
  })

  return createDataResult(accounts)
}

/**
 * Full prop-firm status for a single account over its entire trade history
 * (drawdown is lifetime, not date-range scoped). Used by the dashboard.
 */
export async function getPropFirmStatus(
  accountId: string,
): Promise<ResultType<{ account: Account; status: ReturnType<typeof computePropFirmStatus> }, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single()

  if (accountError || !accountRow) return createErrorResult("ACCOUNT_NOT_FOUND")

  const { data: trades, error: tradesError } = await supabase
    .from("trades")
    .select("net_pnl, exit_time")
    .eq("user_id", user.id)
    .eq("account_id", accountId)

  if (tradesError) {
    console.error(tradesError)
    return createErrorResult(tradesError.message)
  }

  const account = mapAccountFromDb(accountRow)
  const propTrades: PropFirmTrade[] = (trades ?? []).map((t) => ({
    netPnl: t.net_pnl ?? 0, exitTime: t.exit_time,
  }))
  const status = computePropFirmStatus(propConfig(account), propTrades, new Date(), await getUserTimezone())

  return createDataResult({ account, status })
}
