import { createClient } from "~/utils/supabase/server"
import { mapJournalEntryFromDb } from "~/services/mappers/journal"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { buildCalendar } from "~/lib/calculations/journal-calendar"
import { limitsByAccount } from "~/lib/calculations/daily-limits"
import { addDaysIso, buildWeekRecap, weekStart } from "~/lib/calculations/week-recap"
import type { WeekRecap } from "~/lib/calculations/week-recap"
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

/**
 * Resumen de cada fila del calendario del mes (domingo → sábado, semanas
 * completas aunque crucen de mes), por domingo. Con `accountId`, solo los
 * trades de esa cuenta, como el calendario.
 */
export async function getWeekRecaps(
  year: number,
  month: number,
  accountId: string | null,
): Promise<ResultType<Record<string, WeekRecap>, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const timeZone = await getUserTimezone()
  const first = `${year}-${String(month).padStart(2, "0")}-01`
  const firstSunday = weekStart(first)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const weekCount = Math.ceil((new Date(`${first}T00:00:00Z`).getUTCDay() + daysInMonth) / 7)
  const starts = Array.from({ length: weekCount }, (_, i) => addDaysIso(firstSunday, 7 * i))
  const lastSaturday = addDaysIso(starts[starts.length - 1]!, 6)

  // Desde la semana anterior a la primera (para comparar) y un día de margen
  // a cada lado por la zona horaria.
  const tradesFrom = `${addDaysIso(firstSunday, -8)}T00:00:00Z`
  const tradesTo = `${addDaysIso(lastSaturday, 1)}T23:59:59Z`
  let tradesQuery = supabase.from("trades").select("*").eq("user_id", user.id)
    .gte("entry_time", tradesFrom).lte("entry_time", tradesTo)
  if (accountId) tradesQuery = tradesQuery.eq("account_id", accountId)

  const [tradesRes, entriesRes, playbooksRes, accountsRes] = await Promise.all([
    tradesQuery,
    supabase.from("daily_journal").select("*").eq("user_id", user.id).gte("date", firstSunday).lte("date", lastSaturday),
    supabase.from("playbooks").select("id, name").eq("user_id", user.id),
    supabase.from("accounts").select("id, risk_per_trade, max_trades_per_day, max_daily_loss, max_consecutive_losses").eq("user_id", user.id),
  ])
  const error = tradesRes.error ?? entriesRes.error ?? playbooksRes.error ?? accountsRes.error
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  const trades = (tradesRes.data ?? []).map(mapTradeFromDb)
  const entries = (entriesRes.data ?? []).map(mapJournalEntryFromDb)
  const playbookNames = new Map((playbooksRes.data ?? []).map(p => [p.id as string, p.name as string]))
  const accounts = (accountsRes.data ?? []).map(a => ({
    id:                   a.id as string,
    maxTradesPerDay:      (a.max_trades_per_day as number | null) ?? null,
    maxDailyLoss:         a.max_daily_loss != null ? Number(a.max_daily_loss) : null,
    maxConsecutiveLosses: (a.max_consecutive_losses as number | null) ?? null,
  }))
  const limits = limitsByAccount(accounts)
  const riskByAccount = new Map((accountsRes.data ?? []).map(a => [a.id as string, a.risk_per_trade != null ? Number(a.risk_per_trade) : null]))

  return createDataResult(Object.fromEntries(starts.map(from => [
    from,
    buildWeekRecap({ from, trades, entries, playbookNames, limits, riskByAccount, timeZone }),
  ])))
}
