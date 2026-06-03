import { z } from "zod"
import { rangeKeySchema } from "~/types/metrics"
import type { Trade } from "~/types/trade"

export const PAGE_SIZE = 14 as const

export const tradesRangeSchema = z.union([rangeKeySchema, z.literal("all")])
export type TradesRange = z.infer<typeof tradesRangeSchema>

export type TradeFilters = {
  accountId:  string | null
  instrument: string | null
  direction:  "long" | "short" | null
  strategyId: string | null
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

  return {
    accountId:  params["account"]  ?? null,
    instrument: params["instrument"] ?? null,
    direction,
    strategyId: params["strategy"] ?? null,
    range,
    page,
  }
}
