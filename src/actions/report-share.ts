"use server"

import { z } from "zod"
import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { getReportsData } from "~/services/queries/reports"
import { buildReportSnapshot } from "~/services/mappers/report-share"
import { createShareInputSchema } from "~/types/report-share"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { TradesRange } from "~/types/trade-filters"

const RANGE_LABELS: Record<TradesRange, string> = {
  today: "Today",
  week:  "This week",
  month: "This month",
  ytd:   "Year to date",
  all:   "All time",
}

/**
 * Creates a public, read-only share of the current report summary. Freezes a
 * curated snapshot (KPIs + equity + aggregated breakdowns) — never raw trades —
 * behind a random token. Returns the token; the client builds the absolute URL.
 */
export async function createReportShare(
  input: unknown,
): Promise<ResultType<{ token: string; title: string }, string>> {
  const parsed = createShareInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { accountId, range } = parsed.data

  let accountLabel = "All accounts"
  if (accountId) {
    const { data: account } = await supabase
      .from("accounts").select("name").eq("id", accountId).eq("user_id", user.id).single()
    if (!account) return createErrorResult("ACCOUNT_NOT_FOUND")
    accountLabel = account.name as string
  }

  const reports = await getReportsData(accountId, range)
  if (!reports.success) return createErrorResult(reports.error)
  if (!reports.data.hasTrades) return createErrorResult("NO_DATA")

  const rangeLabel = RANGE_LABELS[range]
  const snapshot   = buildReportSnapshot(reports.data, accountLabel, rangeLabel)
  const title      = `${accountLabel} · ${rangeLabel}`
  const token      = randomBytes(18).toString("base64url")

  const { error } = await supabase.from("report_shares").insert({
    user_id:    user.id,
    token,
    account_id: accountId,
    range,
    title,
    snapshot,
  })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/reports")
  return createDataResult({ token, title })
}

const revokeInputSchema = z.object({ id: z.string().uuid() })

export async function revokeReportShare(input: unknown): Promise<ResultType<{ id: string }, string>> {
  const parsed = revokeInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase
    .from("report_shares")
    .update({ revoked: true })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/reports")
  return createDataResult({ id: parsed.data.id })
}
