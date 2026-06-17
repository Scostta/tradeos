import { createClient } from "~/utils/supabase/server"
import { mapJournalEntryFromDb } from "~/services/mappers/journal"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { buildCalendar } from "~/lib/calculations/journal-calendar"
import { getUserTimezone } from "~/services/queries/profile"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { JournalDay } from "~/types/journal"

export interface JournalData {
  weeks:    (JournalDay | null)[][]
  monthNet: number
}

export async function getJournalData(
  year: number,
  month: number,
  accountId: string | null,
): Promise<ResultType<JournalData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const timeZone   = await getUserTimezone()
  const mm         = String(month).padStart(2, "0")
  const startDate  = `${year}-${mm}-01`
  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const endDate    = `${year}-${mm}-${String(lastDayNum).padStart(2, "0")}`

  // Widen the trade fetch by a day on each side: a trade just outside the UTC
  // month edge can still fall inside this month in the user's local TZ. The
  // calendar only places trades on local days within the grid, so extras are inert.
  const tradesFrom = new Date(`${startDate}T00:00:00Z`).getTime() - 86_400_000
  const tradesTo   = new Date(`${endDate}T23:59:59Z`).getTime() + 86_400_000

  const journalQuery = supabase
    .from("daily_journal")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)

  let tradesQuery = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .gte("entry_time", new Date(tradesFrom).toISOString())
    .lte("entry_time", new Date(tradesTo).toISOString())

  if (accountId) {
    tradesQuery = tradesQuery.eq("account_id", accountId)
  }

  const [journalResult, tradesResult] = await Promise.all([journalQuery, tradesQuery])

  if (journalResult.error) {
    console.error(journalResult.error)
    return createErrorResult(journalResult.error.message)
  }
  if (tradesResult.error) {
    console.error(tradesResult.error)
    return createErrorResult(tradesResult.error.message)
  }

  const entries = (journalResult.data ?? []).map(mapJournalEntryFromDb)
  const trades  = (tradesResult.data ?? []).map(mapTradeFromDb)

  const { weeks, monthNet } = buildCalendar(year, month, entries, trades, timeZone)

  return createDataResult({ weeks, monthNet })
}
