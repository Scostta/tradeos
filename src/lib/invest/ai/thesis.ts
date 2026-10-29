import "server-only"

import { z } from "zod"
import { claudeJson } from "~/lib/ai/claude-json"
import type { AiError } from "~/lib/ai/claude-json"
import type { ResultType } from "~/helpers/result"

// INVEST_SPEC §4.8: borrador de las cuatro Thesis prompts a partir de la ficha,
// los fundamentales y el resultado del screener. Ayuda a escribir; no decide.

export const thesisDraftSchema = z.object({
  growth:  z.string(),
  stopper: z.string(),
  loser:   z.string(),
  signal:  z.string(),
})
export type ThesisDraft = z.infer<typeof thesisDraftSchema>

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["growth", "stopper", "loser", "signal"],
  properties: {
    growth:  { type: "string" },
    stopper: { type: "string" },
    loser:   { type: "string" },
    signal:  { type: "string" },
  },
}

const SYSTEM = `You help an individual investor draft an investment thesis for ONE stock that already passed a fixed, rule-based screener (revenue growth > 10%, positive FCF margin, stable gross margin, low leverage, ROIC > 10%, price above its 10-month average, positive 12-1 momentum and 6-month relative strength). The investor decides; you only draft text they will edit.

You receive JSON with the company card (name, sector, industry, business summary), the screener result (ratios and pass/fail), up to 4 fiscal years of fundamentals (revenue, gross margin, FCF, ROIC, net debt/EBITDA) and any answers the investor already wrote.

Answer the four prompts:
- growth: "Where does the growth come from?" — the concrete drivers, tied to the figures (e.g. revenue growth, margin trend).
- stopper: "What would stop it?" — written as a FALSIFIER: a specific, observable condition that would prove the thesis wrong, with a number or a clear event (e.g. "Revenue growth below 8% YoY for two consecutive quarters").
- loser: "Who loses if this company wins?" — competitors or incumbents being displaced, and why.
- signal: "What data in the next two quarters would confirm or refute it?" — also a measurable FALSIFIER with a threshold and a time frame.

Rules:
- Use only the figures in the JSON plus general, well-known facts about the business model. Do not invent recent news, guidance, earnings dates or numbers that are not in the JSON. If something is uncertain, say what to check.
- Each answer 2–4 sentences; "stopper" and "signal" at least 30 characters and measurable.
- Write in the same language as the investor's existing answers if any are non-empty; otherwise in English.
- No buy/sell recommendation, no price targets.`

export async function draftThesis(input: unknown): Promise<ResultType<{ data: ThesisDraft; model: string }, AiError>> {
  return claudeJson({ system: SYSTEM, input, jsonSchema: JSON_SCHEMA, zod: thesisDraftSchema, effort: "medium" })
}
