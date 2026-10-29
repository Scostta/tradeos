import "server-only"

import { z } from "zod"
import { claudeJson } from "~/lib/ai/claude-json"
import type { AiError } from "~/lib/ai/claude-json"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { PicksInput } from "./picks-input"

// INVEST_SPEC §4.8: comentario de los tickers que pasan un run. Solo puede
// nombrar tickers de la lista (el esquema lo fuerza y se vuelve a comprobar).

export const picksContentSchema = z.object({
  overview:   z.string(),
  highlights: z.array(z.object({
    ticker: z.string(),
    why:    z.string(),
    metric: z.string(),
    risk:   z.string(),
  })).max(6),
})
export type PicksContent = z.infer<typeof picksContentSchema>

const SYSTEM = `You comment on the monthly output of a fixed, rule-based stock screener used in a 36-month forward test. Every ticker you receive ALREADY passed all the rules (fundamental and technical). The investor will pick at most a few of them by hand; you help them look.

Rules:
- Mention ONLY tickers from "passers". Never suggest any other stock, ETF or asset.
- Highlight 3 to 5 tickers that stand out on the figures given (e.g. growth with expanding gross margin and high ROIC, strong FCF with low leverage, strong relative strength), each with:
  - why: 1–2 sentences, tied to the figures.
  - metric: the exact figures that back it, short and readable. Ratios arrive as decimals: write them as percentages (0.18 → "18%", priceVsSma10m 0.535 → "53% above SMA10"); netDebtEbitda as "0.4x" (negative = net cash).
  - risk: one concrete thing that could go wrong or to check (stretched price vs. 10-month average, margin dip, sector concentration…).
- Respect the portfolio constraints in "rules" and "openPositions": if a sector already has 2 open positions, don't highlight more from it (or say it's blocked). Prefer diversification across sectors.
- "overview": 1–2 sentences about the run as a whole (sector mix, what dominates).
- Use only the numbers in the JSON. No price targets, no news, no buy/sell instruction: this is a reading aid, the investor decides.
- Write in ENGLISH.`

export async function commentRun(input: PicksInput): Promise<ResultType<{ data: PicksContent; model: string }, AiError>> {
  const tickers = input.passers.map(p => p.ticker)
  const jsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["overview", "highlights"],
    properties: {
      overview:   { type: "string" },
      highlights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ticker", "why", "metric", "risk"],
          properties: {
            ticker: { type: "string", enum: tickers },
            why:    { type: "string" },
            metric: { type: "string" },
            risk:   { type: "string" },
          },
        },
      },
    },
  }
  const res = await claudeJson({ system: SYSTEM, input, jsonSchema, zod: picksContentSchema, effort: "medium" })
  if (!res.success) return createErrorResult(res.error)
  const allowed = new Set(tickers)
  const highlights = res.data.data.highlights.filter(h => allowed.has(h.ticker))
  return createDataResult({ data: { ...res.data.data, highlights }, model: res.data.model })
}
