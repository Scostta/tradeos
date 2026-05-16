import { createClient } from "~/utils/supabase/server"
import { mapAccountFromDb } from "~/services/mappers/accounts"
import type { AccountWithStats } from "~/types/account"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function getAccountsWithStats(): Promise<ResultType<AccountWithStats[], string>> {
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
      .select("account_id, net_pnl")
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

  const statsMap = new Map<string, { tradeCount: number; netPnl: number }>()
  for (const trade of tradesResult.data ?? []) {
    const existing = statsMap.get(trade.account_id) ?? { tradeCount: 0, netPnl: 0 }
    statsMap.set(trade.account_id, {
      tradeCount: existing.tradeCount + 1,
      netPnl:     existing.netPnl + (trade.net_pnl ?? 0),
    })
  }

  const accounts: AccountWithStats[] = (accountsResult.data ?? []).map((row) => {
    const stats = statsMap.get(row.id) ?? { tradeCount: 0, netPnl: 0 }
    return { ...mapAccountFromDb(row), ...stats }
  })

  return createDataResult(accounts)
}
