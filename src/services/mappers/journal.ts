import { journalEntrySchema } from "~/types/journal"
import type { JournalEntry } from "~/types/journal"

export function mapJournalEntryFromDb(row: Record<string, unknown>): JournalEntry {
  return journalEntrySchema.parse({
    id:              row["id"],
    userId:          row["user_id"],
    date:            row["date"],
    preMarketNotes:  row["pre_market_notes"],
    postMarketNotes: row["post_market_notes"],
    mood:            row["mood"],
    followedPlan:    row["followed_plan"],
    createdAt:       row["created_at"],
  })
}
