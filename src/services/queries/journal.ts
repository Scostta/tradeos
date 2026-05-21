import { createClient } from "~/utils/supabase/server"
import { mapJournalEntryFromDb } from "~/services/mappers/journal"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { buildCalendar } from "~/lib/calculations/journal-calendar"
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

  const mm         = String(month).padStart(2, "0")
  const startDate  = `${year}-${mm}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const endDate    = `${year}-${mm}-${String(lastDayNum).padStart(2, "0")}`

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
    .gte("entry_time", `${startDate}T00:00:00Z`)
    .lte("entry_time", `${endDate}T23:59:59Z`)

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

  const { weeks, monthNet } = buildCalendar(year, month, entries, trades)

  return createDataResult({ weeks, monthNet })
}
