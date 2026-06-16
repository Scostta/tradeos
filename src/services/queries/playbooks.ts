import { createClient } from "~/utils/supabase/server"
import { mapPlaybookFromDb } from "~/services/mappers/playbooks"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { computePlaybookStats } from "~/lib/calculations/playbook-stats"
import { computeRStats } from "~/lib/calculations/r-multiples"
import { computeDashboardMetrics, equityCurve } from "~/lib/calculations/metrics"
import { buildBreakdown, bySymbol } from "~/lib/calculations/reports"
import { computeAdherence } from "~/lib/calculations/playbook-adherence"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { PlaybookWithStats, PlaybookDetail } from "~/types/playbook"

export async function getPlaybooksWithStats(): Promise<ResultType<PlaybookWithStats[], string>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const [playbooksResult, tradesResult, accountsResult] = await Promise.all([
    supabase
      .from("playbooks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .not("playbook_id", "is", null),
    supabase
      .from("accounts")
      .select("id, risk_per_trade")
      .eq("user_id", user.id),
  ])

  if (playbooksResult.error) {
    console.error(playbooksResult.error)
    return createErrorResult(playbooksResult.error.message)
  }

  if (tradesResult.error) {
    console.error(tradesResult.error)
    return createErrorResult(tradesResult.error.message)
  }

  if (accountsResult.error) {
    console.error(accountsResult.error)
    return createErrorResult(accountsResult.error.message)
  }

  const playbooks = (playbooksResult.data ?? []).map(mapPlaybookFromDb)
  const trades     = (tradesResult.data ?? []).map(mapTradeFromDb)
  const riskByAccount = new Map<string, number | null>(
    (accountsResult.data ?? []).map(a => [a.id, a.risk_per_trade])
  )

  return createDataResult(computePlaybookStats(playbooks, trades, riskByAccount))
}

export async function getPlaybookDetail(
  id: string,
): Promise<ResultType<PlaybookDetail, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: playbookRow, error: playbookError } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (playbookError || !playbookRow) return createErrorResult("NOT_FOUND")

  const [tradesResult, accountsResult] = await Promise.all([
    supabase.from("trades").select("*").eq("user_id", user.id).eq("playbook_id", id),
    supabase.from("accounts").select("id, risk_per_trade").eq("user_id", user.id),
  ])

  if (tradesResult.error) {
    console.error(tradesResult.error)
    return createErrorResult(tradesResult.error.message)
  }
  if (accountsResult.error) {
    console.error(accountsResult.error)
    return createErrorResult(accountsResult.error.message)
  }

  const playbookBase = mapPlaybookFromDb(playbookRow)
  const trades = (tradesResult.data ?? []).map(mapTradeFromDb)
  const riskByAccount = new Map<string, number | null>(
    (accountsResult.data ?? []).map(a => [a.id, a.risk_per_trade])
  )

  const rules = parsePlaybookRules(playbookBase.rules)

  return createDataResult({
    playbook:     computePlaybookStats([playbookBase], trades, riskByAccount)[0]!,
    metrics:      computeDashboardMetrics(trades),
    rStats:       computeRStats(trades, riskByAccount),
    equityCurve:  equityCurve(trades),
    byInstrument: buildBreakdown(trades, bySymbol).rows,
    adherence:    computeAdherence(rules, trades, riskByAccount),
  })
}
