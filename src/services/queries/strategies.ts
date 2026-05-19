import { createClient } from "~/utils/supabase/server"
import { mapStrategyFromDb } from "~/services/mappers/strategies"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { computeStrategyStats } from "~/lib/calculations/strategy-stats"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { StrategyWithStats } from "~/types/strategy"

export async function getStrategiesWithStats(): Promise<ResultType<StrategyWithStats[], string>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const [strategiesResult, tradesResult] = await Promise.all([
    supabase
      .from("strategies")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .not("strategy_id", "is", null),
  ])

  if (strategiesResult.error) {
    console.error(strategiesResult.error)
    return createErrorResult(strategiesResult.error.message)
  }

  if (tradesResult.error) {
    console.error(tradesResult.error)
    return createErrorResult(tradesResult.error.message)
  }

  const strategies = (strategiesResult.data ?? []).map(mapStrategyFromDb)
  const trades     = (tradesResult.data ?? []).map(mapTradeFromDb)

  return createDataResult(computeStrategyStats(strategies, trades))
}
