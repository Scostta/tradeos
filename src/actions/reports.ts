"use server"

import { z } from "zod"
import { createClient } from "~/utils/supabase/server"
import { buildComparePeriod } from "~/services/queries/reports"
import { getUserTimezone } from "~/services/queries/profile"
import { comparePeriodKeySchema } from "~/helpers/compare-period"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { CompareData } from "~/types/reports"

const compareInputSchema = z.object({
  accountId: z.string().uuid().nullable(),
  keyA:      comparePeriodKeySchema,
  keyB:      comparePeriodKeySchema,
})

/**
 * Recomputes the Compare tab for two user-selected periods. Called from the
 * client when either period dropdown changes; the initial pair (this month vs
 * last month) is computed server-side in getReportsData.
 */
export async function compareReportsPeriods(
  input: unknown,
): Promise<ResultType<CompareData, string>> {
  const parsed = compareInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { accountId, keyA, keyB } = parsed.data
  const timeZone = await getUserTimezone()
  const [a, b] = await Promise.all([
    buildComparePeriod(supabase, user.id, accountId, keyA, timeZone),
    buildComparePeriod(supabase, user.id, accountId, keyB, timeZone),
  ])
  if (!a.success) return createErrorResult(a.error)
  if (!b.success) return createErrorResult(b.error)

  return createDataResult({ a: a.data, b: b.data })
}
