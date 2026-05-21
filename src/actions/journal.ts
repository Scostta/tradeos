"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { upsertJournalInputSchema } from "~/types/journal"
import { mapJournalEntryFromDb } from "~/services/mappers/journal"
import type { JournalEntry } from "~/types/journal"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function upsertJournalEntry(
  input: unknown
): Promise<ResultType<JournalEntry, string>> {
  const parsed = upsertJournalInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { date, preMarketNotes, postMarketNotes, mood, followedPlan } = parsed.data

  const { data, error } = await supabase
    .from("daily_journal")
    .upsert(
      {
        user_id:           user.id,
        date,
        pre_market_notes:  preMarketNotes,
        post_market_notes: postMarketNotes,
        mood,
        followed_plan:     followedPlan,
      },
      { onConflict: "user_id,date" }
    )
    .select("*")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/journal")
  return createDataResult(mapJournalEntryFromDb(data))
}
