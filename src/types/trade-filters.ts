import { z } from "zod"
import { rangeKeySchema } from "~/types/metrics"
import type { Trade } from "~/types/trade"

export const PAGE_SIZE = 14 as const

export const tradesRangeSchema = z.union([rangeKeySchema, z.literal("all")])
export type TradesRange = z.infer<typeof tradesRangeSchema>

export const tradeOutcomeSchema = z.enum(["win", "loss", "be"])
export type TradeOutcome = z.infer<typeof tradeOutcomeSchema>

// "clean" = no mistakes tagged, "any" = at least one, otherwise a specific preset.
export const mistakeFilterReserved = ["clean", "any"] as const

export type TradeFilters = {
  accountId:  string | null
  instrument: string | null
  direction:  "long" | "short" | null
  playbookId: string | null
  outcome:    TradeOutcome | null
  mistake:    string | null   // "clean" | "any" | a specific mistake preset
  tag:        string | null
  pnlMin:     number | null
  pnlMax:     number | null
  range:      TradesRange
  page:       number
}

export type TradesPageData = {
  trades:      Trade[]
  totalCount:  number
  totalNet:    number
  page:        number
  pageCount:   number
  instruments: string[]
  tags:        string[]
}

function parseNum(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function parseStr(raw: string | undefined): string | null {
  const v = raw?.trim()
  return v ? v : null
}

export function parseTradeFilters(
  params: Record<string, string | undefined>,
): TradeFilters {
  const rawPage = parseInt(params["page"] ?? "1", 10)
  const page    = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const rawRange     = params["range"] ?? "all"
  const rangeResult  = tradesRangeSchema.safeParse(rawRange)
  const range: TradesRange = rangeResult.success ? rangeResult.data : "all"

  const rawDir    = params["direction"]
  const direction = rawDir === "long" || rawDir === "short" ? rawDir : null

  const outcome = tradeOutcomeSchema.safeParse(params["outcome"])

  return {
    accountId:  params["account"]    ?? null,
    instrument: params["instrument"] ?? null,
    direction,
    playbookId: params["playbook"]   ?? null,
    outcome:    outcome.success ? outcome.data : null,
    mistake:    parseStr(params["mistake"]),
    tag:        parseStr(params["tag"]),
    pnlMin:     parseNum(params["pnlMin"]),
    pnlMax:     parseNum(params["pnlMax"]),
    range,
    page,
  }
}
