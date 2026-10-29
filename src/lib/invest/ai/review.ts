import "server-only"

import { z } from "zod"
import { claudeJson } from "~/lib/ai/claude-json"
import type { AiError } from "~/lib/ai/claude-json"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { ReviewInput } from "./review-input"

// INVEST_SPEC §4.8: revisión de los falsadores de una posición con los datos
// del último run. Solo opina: el estado del falsador lo marca el usuario y la
// salida mecánica sigue siendo sma_exit.

export const reviewContentSchema = z.object({
  summary:    z.string(),
  falsifiers: z.array(z.object({
    index:    z.number().int(),
    verdict:  z.enum(["likely", "not_yet", "unclear"]),
    evidence: z.string(),
    note:     z.string(),
  })),
})
export type ReviewContent = z.infer<typeof reviewContentSchema>

const SYSTEM = `You review an open stock position against the investor's own falsifiers (conditions they wrote at entry that would prove the thesis wrong). You receive the thesis, the falsifiers, the latest monthly screener figures for the stock, the monthly checks (price vs. 10-month SMA, hold/sell signal) and up to 4 fiscal years of fundamentals.

For EACH falsifier (by index) return:
- verdict: "likely" if the data in the JSON shows the condition is met or clearly being met; "not_yet" if the data shows it is not met; "unclear" if the JSON does not contain the data needed to judge it (e.g. quarterly figures, news, guidance). Prefer "unclear" over guessing.
- evidence: the exact figures from the JSON you used (ratios are decimals: write them as percentages), or what data is missing.
- note: one short sentence on what to check next.

"summary": 1–2 sentences on the position overall, mentioning the mechanical exit if the latest check signal is "sell" or the price is below the 10-month SMA (the system exits on that, not you).

Rules: use only the JSON; never invent quarterly results, news or prices; no buy/sell recommendation — the investor decides and marks each falsifier. Write in the same language as the falsifiers.`

export async function reviewPosition(input: ReviewInput): Promise<ResultType<{ data: ReviewContent; model: string }, AiError>> {
  const indexes = input.position.falsifiers.map(f => f.index)
  const jsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "falsifiers"],
    properties: {
      summary:    { type: "string" },
      falsifiers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "verdict", "evidence", "note"],
          properties: {
            index:    { type: "integer", enum: indexes },
            verdict:  { type: "string", enum: ["likely", "not_yet", "unclear"] },
            evidence: { type: "string" },
            note:     { type: "string" },
          },
        },
      },
    },
  }
  const res = await claudeJson({ system: SYSTEM, input, jsonSchema, zod: reviewContentSchema, effort: "medium" })
  if (!res.success) return createErrorResult(res.error)
  // Uno por falsador, en orden; los que falten quedan como "unclear".
  const byIndex = new Map(res.data.data.falsifiers.map(f => [f.index, f]))
  const falsifiers = indexes.map(i => byIndex.get(i) ?? { index: i, verdict: "unclear" as const, evidence: "—", note: "" })
  return createDataResult({ data: { summary: res.data.data.summary, falsifiers }, model: res.data.model })
}
