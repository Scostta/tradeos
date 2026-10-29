import "server-only"

import { z } from "zod"
import { claudeJson } from "~/lib/ai/claude-json"
import type { AiError } from "~/lib/ai/claude-json"
import type { ResultType } from "~/helpers/result"

// MONEY_SPEC §5.8: 3–5 observaciones sobre el mes a partir de las cifras que
// ya calcula el Overview. La IA no recalcula nada.

export const summaryContentSchema = z.object({
  observations: z.array(z.object({
    title:  z.string(),
    detail: z.string(),
    metric: z.string(),
    tone:   z.enum(["positive", "info", "warning", "critical"]),
  })).min(1).max(6),
})
export type SummaryContent = z.infer<typeof summaryContentSchema>

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["observations"],
  properties: {
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "metric", "tone"],
        properties: {
          title:  { type: "string" },
          detail: { type: "string" },
          metric: { type: "string" },
          tone:   { type: "string", enum: ["positive", "info", "warning", "critical"] },
        },
      },
    },
  },
}

const SYSTEM = `You review one month of a person's personal finances (amounts in EUR) and write 3 to 5 short observations in ENGLISH.

You receive JSON with figures ALREADY computed by the app: income, fixed and variable spending, real savings (income − fixed − variable), savings rate, per-category spending vs. the previous month and the 3-month average, pace vs. the previous month on the same days, subscriptions, uncategorized counts, the last months' flow and savings goals. If "isCurrentMonth" is true the month is still running: say "so far" and use the projection, don't treat partial totals as final.

Rules:
- NEVER invent or recompute figures. Every observation must cite in "metric" the exact number(s) from the JSON that back it (e.g. "Eating out €143 vs €45 avg").
- Prioritize what the person can act on: categories clearly above their average, a savings rate that is falling or negative, subscriptions that look unused, a pace well above last month, uncategorized movements that distort the figures.
- Include one "positive" observation when something genuinely went well.
- If uncategorized outflows are significant, say the figures are provisional until they are categorized.
- "detail": one or two plain sentences; "title": under 8 words. No generic advice ("spend less"), no investment advice.
- tone: "critical" when it clearly hurts savings, "warning" for something to watch, "info" for context, "positive" for a strength.
- If the data is thin (first month, few movements), return fewer observations rather than inventing.`

export async function summarizeMonth(input: unknown): Promise<ResultType<{ data: SummaryContent; model: string }, AiError>> {
  return claudeJson({ system: SYSTEM, input, jsonSchema: JSON_SCHEMA, zod: summaryContentSchema, effort: "medium" })
}
