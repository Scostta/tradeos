import { createClient } from "~/utils/supabase/server"
import { mapJournalEntryFromDb } from "~/services/mappers/journal"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { getUserTimezone } from "~/services/queries/profile"
import { zonedDateKey } from "~/helpers/tz"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { JournalEntry } from "~/types/journal"
import type { Trade } from "~/types/trade"

// Repaso de sesión (/review): días con trades sin revisar y los trades de un
// día con su entrada del Journal. Un trade está revisado cuando tiene playbook
// y su checklist registrado (followed_rules no null; [] = ninguna regla).

const LOOKBACK_DAYS = 120
const DAY_MS = 86_400_000

export type ReviewDay = { date: string; pending: number; total: number }

export type ReviewData = {
  days:     ReviewDay[]          // días con pendientes (y el seleccionado), del más reciente al más antiguo
  date:     string | null        // día seleccionado (YYYY-MM-DD, zona del usuario)
  trades:   Trade[]              // trades de ese día, por hora de entrada
  journal:  JournalEntry | null
  pending:  number               // pendientes en total
}

export function isReviewed(t: { playbookId: string | null; followedRules: string[] | null }): boolean {
  return t.playbookId != null && t.followedRules != null
}

export async function getReviewData(requested: string | null): Promise<ResultType<ReviewData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")
  const timeZone = await getUserTimezone()

  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString()
  const { data: index, error } = await supabase
    .from("trades")
    .select("entry_time, playbook_id, followed_rules")
    .eq("user_id", user.id)
    .gte("entry_time", since)
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  const byDay = new Map<string, ReviewDay>()
  for (const t of index ?? []) {
    const date = zonedDateKey(t.entry_time as string, timeZone)
    const day = byDay.get(date) ?? { date, pending: 0, total: 0 }
    day.total++
    if (!isReviewed({ playbookId: (t.playbook_id as string | null) ?? null, followedRules: (t.followed_rules as string[] | null) ?? null })) day.pending++
    byDay.set(date, day)
  }
  const all = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date))
  const pendingDays = all.filter(d => d.pending > 0)
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? requested
    : pendingDays[0]?.date ?? all[0]?.date ?? null
  const days = date && !pendingDays.some(d => d.date === date)
    ? [...pendingDays, byDay.get(date) ?? { date, pending: 0, total: 0 }].sort((a, b) => b.date.localeCompare(a.date))
    : pendingDays
  const pending = pendingDays.reduce((a, d) => a + d.pending, 0)
  if (!date) return createDataResult({ days, date: null, trades: [], journal: null, pending })

  // El día local puede empezar el día UTC anterior: se amplía y se filtra aquí.
  const from = new Date(new Date(`${date}T00:00:00Z`).getTime() - DAY_MS).toISOString()
  const to = new Date(new Date(`${date}T23:59:59Z`).getTime() + DAY_MS).toISOString()
  const [tradesRes, journalRes] = await Promise.all([
    supabase.from("trades").select("*").eq("user_id", user.id).gte("entry_time", from).lte("entry_time", to)
      .order("entry_time", { ascending: true }),
    supabase.from("daily_journal").select("*").eq("user_id", user.id).eq("date", date).maybeSingle(),
  ])
  if (tradesRes.error || journalRes.error) {
    console.error(tradesRes.error ?? journalRes.error)
    return createErrorResult((tradesRes.error ?? journalRes.error)!.message)
  }
  const trades = (tradesRes.data ?? []).map(mapTradeFromDb).filter(t => zonedDateKey(t.entryTime, timeZone) === date)
  return createDataResult({
    days, date, trades, pending,
    journal: journalRes.data ? mapJournalEntryFromDb(journalRes.data) : null,
  })
}
