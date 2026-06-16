import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { mapAccountFromDb } from "~/services/mappers/accounts"
import { computeGoalsProgress } from "~/lib/calculations/goals"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { Goals, GoalSet, GoalScope } from "~/types/goals"
import type { Trade } from "~/types/trade"

function mapGoals(row: Record<string, unknown> | null | undefined): Goals {
  return {
    monthlyPnlTarget: (row?.["monthly_pnl_target"] as number | null) ?? null,
    winRateTarget:    (row?.["win_rate_target"] as number | null) ?? null,
    maxDrawdownLimit: (row?.["max_drawdown_limit"] as number | null) ?? null,
    minTradingDays:   (row?.["min_trading_days"] as number | null) ?? null,
  }
}

function monthInfo(): { start: string; label: string } {
  const now = new Date()
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
    label: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
  }
}

type LoadedGoals = {
  goalByAccount: Map<string | null, Record<string, unknown>>
  accounts:      ReturnType<typeof mapAccountFromDb>[]
  tradesByAccount: Map<string, Trade[]>
  allTrades:     Trade[]
  monthLabel:    string
}

async function load(): Promise<ResultType<LoadedGoals, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { start, label } = monthInfo()

  const [goalsRes, accountsRes, tradesRes] = await Promise.all([
    supabase.from("user_goals").select("*").eq("user_id", user.id),
    supabase.from("accounts").select("*").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: true }),
    supabase.from("trades").select("*").eq("user_id", user.id).gte("entry_time", start),
  ])

  if (goalsRes.error)    { console.error(goalsRes.error);    return createErrorResult(goalsRes.error.message) }
  if (accountsRes.error) { console.error(accountsRes.error); return createErrorResult(accountsRes.error.message) }
  if (tradesRes.error)   { console.error(tradesRes.error);   return createErrorResult(tradesRes.error.message) }

  const goalByAccount = new Map<string | null, Record<string, unknown>>()
  for (const g of goalsRes.data ?? []) goalByAccount.set((g.account_id as string | null) ?? null, g)

  const allTrades = (tradesRes.data ?? []).map(r => mapTradeFromDb(r as Record<string, unknown>))
  const tradesByAccount = new Map<string, Trade[]>()
  for (const t of allTrades) {
    const list = tradesByAccount.get(t.accountId) ?? []
    list.push(t)
    tradesByAccount.set(t.accountId, list)
  }

  return createDataResult({
    goalByAccount,
    accounts: (accountsRes.data ?? []).map(mapAccountFromDb),
    tradesByAccount,
    allTrades,
    monthLabel: label,
  })
}

function buildSet(scope: GoalScope, goalRow: Record<string, unknown> | undefined, trades: Trade[], monthLabel: string): GoalSet {
  const goals = mapGoals(goalRow)
  return { scope, goals, progress: computeGoalsProgress(goals, trades, monthLabel) }
}

/** All goal scopes (Global + every active account) with current-month progress. */
export async function getGoalsOverview(): Promise<ResultType<{ sets: GoalSet[] }, string>> {
  const loaded = await load()
  if (!loaded.success) return loaded
  const { goalByAccount, accounts, tradesByAccount, allTrades, monthLabel } = loaded.data

  const sets: GoalSet[] = [
    buildSet({ accountId: null, label: "Global", color: null }, goalByAccount.get(null), allTrades, monthLabel),
    ...accounts.map(a =>
      buildSet({ accountId: a.id, label: a.name, color: a.color }, goalByAccount.get(a.id), tradesByAccount.get(a.id) ?? [], monthLabel)
    ),
  ]
  return createDataResult({ sets })
}

/** Goal set for the dashboard: the active account's (if it has goals) else global. */
export async function getDashboardGoals(accountId: string | null): Promise<ResultType<{ set: GoalSet }, string>> {
  const loaded = await load()
  if (!loaded.success) return loaded
  const { goalByAccount, accounts, tradesByAccount, allTrades, monthLabel } = loaded.data

  const account = accountId ? accounts.find(a => a.id === accountId) : undefined
  if (account && goalByAccount.has(account.id)) {
    return createDataResult({
      set: buildSet({ accountId: account.id, label: account.name, color: account.color }, goalByAccount.get(account.id), tradesByAccount.get(account.id) ?? [], monthLabel),
    })
  }
  return createDataResult({
    set: buildSet({ accountId: null, label: "Global", color: null }, goalByAccount.get(null), allTrades, monthLabel),
  })
}
