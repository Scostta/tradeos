// ── AI Insights query ─────────────────────────────────────────────────────────
// Read path: builds the deterministic InsightsInput from the trader's full
// history (scoped to the active account or all accounts) and compares its hash
// against the stored row. NEVER calls Claude — generation is the action's job.
// This keeps page renders free of API cost; the UI only sees cached insights
// plus a `stale` flag when the data changed since they were generated.

import { createHash } from "node:crypto"
import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { mapPlaybookFromDb } from "~/services/mappers/playbooks"
import { buildInsightsInput } from "~/lib/calculations/insights-input"
import { getProfile } from "~/services/queries/profile"
import { computeRStats } from "~/lib/calculations/r-multiples"
import { computePortfolioAdherence } from "~/lib/calculations/playbook-adherence"
import { computeBeReport } from "~/lib/calculations/be-analysis"
import { computeTiltReport } from "~/lib/calculations/tilt"
import { limitBreaches, limitsByAccount } from "~/lib/calculations/daily-limits"
import { makeByPlaybookName } from "~/lib/calculations/reports"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { createDataResult, createErrorResult } from "~/helpers/result"
import { insightSchema, MIN_TRADES_FOR_INSIGHTS } from "~/types/insights"
import { z } from "zod"
import type { ParsedRules } from "~/helpers/playbook-rules"
import type { ResultType } from "~/helpers/result"
import type { InsightsInput, InsightsView } from "~/types/insights"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type LoadedInsightsInput = { input: InsightsInput; hash: string; tradesCount: number }

const storedInsightsSchema = z.array(insightSchema)

/** Stable hash of the aggregation — buildInsightsInput already emits keys in a fixed order. */
function hashInput(input: InsightsInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

/**
 * Fetches the trader's full history for the scope and builds the InsightsInput
 * plus its hash. Shared by the read query and the generate action so both agree
 * on exactly what gets analyzed. Returns the count for the min-trades gate.
 */
export async function loadInsightsInput(
  supabase:  SupabaseServerClient,
  userId:    string,
  accountId: string | null,
): Promise<ResultType<LoadedInsightsInput, string>> {
  let tradesQuery = supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("entry_time", { ascending: true })
  if (accountId) tradesQuery = tradesQuery.eq("account_id", accountId)

  const [tradesRes, playbooksRes, accountsRes] = await Promise.all([
    tradesQuery,
    supabase.from("playbooks").select("*").eq("user_id", userId),
    supabase.from("accounts")
      .select("id, risk_per_trade, max_trades_per_day, max_daily_loss, max_consecutive_losses, revenge_minutes")
      .eq("user_id", userId),
  ])

  if (tradesRes.error)    { console.error(tradesRes.error);    return createErrorResult(tradesRes.error.message) }
  if (playbooksRes.error) { console.error(playbooksRes.error); return createErrorResult(playbooksRes.error.message) }
  if (accountsRes.error)  { console.error(accountsRes.error);  return createErrorResult(accountsRes.error.message) }

  const trades    = (tradesRes.data ?? []).map(r => mapTradeFromDb(r as Record<string, unknown>))
  const playbooks = (playbooksRes.data ?? []).map(r => mapPlaybookFromDb(r as Record<string, unknown>))
  const riskByAccount = new Map<string, number | null>(
    (accountsRes.data ?? []).map(a => [a.id as string, (a.risk_per_trade as number | null) ?? null]),
  )
  const rulesById = new Map<string, ParsedRules>(playbooks.map(p => [p.id, parsePlaybookRules(p.rules)]))
  const accountLimits = (accountsRes.data ?? []).map(a => ({
    id:                   a.id as string,
    maxTradesPerDay:      (a.max_trades_per_day as number | null) ?? null,
    maxDailyLoss:         a.max_daily_loss != null ? Number(a.max_daily_loss) : null,
    maxConsecutiveLosses: (a.max_consecutive_losses as number | null) ?? null,
    revengeMinutes:       (a.revenge_minutes as number | null) ?? null,
  }))
  const limits = limitsByAccount(accountLimits)

  const profile  = await getProfile()
  const timeZone = profile.success ? profile.data.timezone : "UTC"
  const thresholdPoints = profile.success ? profile.data.beThresholdPoints : 1.5

  // Mismos cálculos que Reports → Tilt / Break-even y que /review: la IA ve las cifras de la app.
  const input = buildInsightsInput(trades, {
    rStats:    computeRStats(trades, riskByAccount),
    adherence: computePortfolioAdherence(rulesById, trades, riskByAccount),
    tilt:      computeTiltReport({
      trades, riskByAccount, timeZone,
      revengeMinutes: new Map(accountLimits.map(a => [a.id, a.revengeMinutes])),
    }),
    beReport:  computeBeReport({
      trades, riskByAccount, timeZone, thresholdPoints,
      playbookName: makeByPlaybookName(playbooks),
    }),
    breaches:  limits.size > 0 ? limitBreaches(trades, limits, timeZone) : null,
    timeZone,
  })

  return createDataResult({ input, hash: hashInput(input), tradesCount: trades.length })
}

/**
 * Cached insights for a scope, with a `stale` flag when the underlying data has
 * changed since generation. Drives the dashboard card and /insights page.
 */
export const getInsightsView = cache(async function getInsightsView(
  accountId: string | null,
): Promise<ResultType<InsightsView, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const loaded = await loadInsightsInput(supabase, user.id, accountId)
  if (!loaded.success) return loaded
  const { hash, tradesCount } = loaded.data

  if (tradesCount < MIN_TRADES_FOR_INSIGHTS) {
    return createDataResult<InsightsView>({
      status: "insufficient", tradesCount, insights: [], model: null, generatedAt: null, stale: false,
    })
  }

  const row = supabase.from("ai_insights").select("*").eq("user_id", user.id)
  const { data, error } = await (accountId == null
    ? row.is("account_id", null)
    : row.eq("account_id", accountId)
  ).maybeSingle()

  if (error) { console.error(error); return createErrorResult(error.message) }

  if (!data) {
    return createDataResult<InsightsView>({
      status: "empty", tradesCount, insights: [], model: null, generatedAt: null, stale: false,
    })
  }

  const parsed = storedInsightsSchema.safeParse(data.insights)
  return createDataResult<InsightsView>({
    status:      "ready",
    tradesCount,
    insights:    parsed.success ? parsed.data : [],
    model:       (data.model as string | null) ?? null,
    generatedAt: (data.generated_at as string | null) ?? null,
    stale:       (data.input_hash as string) !== hash,
  })
})
