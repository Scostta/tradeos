import { z } from "zod"

export const journalEntrySchema = z.object({
  id:              z.string().uuid(),
  userId:          z.string().uuid(),
  date:            z.string(),
  preMarketNotes:  z.string().nullable(),
  postMarketNotes: z.string().nullable(),
  mood:            z.number().int().min(1).max(5).nullable(),
  followedPlan:    z.boolean().nullable(),
  createdAt:       z.string().datetime({ offset: true }),
})

export type JournalEntry = z.infer<typeof journalEntrySchema>

export interface JournalTrade {
  id:         string
  accountId:  string
  instrument: string
  direction:  "long" | "short"
  contracts:  number
  netPnl:     number
  entryTime:  string
}

export interface JournalDay {
  date:       string
  day:        number
  isWeekend:  boolean
  entry:      JournalEntry | null
  trades:     JournalTrade[]
  net:        number
  tradeCount: number
  winRate:    number
}

export const upsertJournalInputSchema = z.object({
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preMarketNotes:  z.string().nullable(),
  postMarketNotes: z.string().nullable(),
  mood:            z.number().int().min(1).max(5).nullable(),
  followedPlan:    z.boolean().nullable(),
})

export type UpsertJournalInput = z.infer<typeof upsertJournalInputSchema>
