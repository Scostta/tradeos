import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { envServer } from "~/env/server"
import { createDataResult, createErrorResult } from "~/helpers/result"
import { insightsResponseSchema } from "~/types/insights"
import type { ResultType } from "~/helpers/result"
import type { Insight, InsightsInput } from "~/types/insights"

// JSON schema for structured outputs. Mirrors insightSchema in types/insights.ts.
// Structured outputs require additionalProperties:false and every property listed
// in `required` (nullable fields use a "null"-inclusive type union).
const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "recommendation", "severity", "category", "metric"],
        properties: {
          title:          { type: "string" },
          detail:         { type: "string" },
          recommendation: { type: "string" },
          severity:       { type: "string", enum: ["critical", "warning", "info", "positive"] },
          category:       { type: "string", enum: ["timing", "discipline", "risk", "strategy"] },
          metric:         { type: ["string", "null"] },
        },
      },
    },
  },
}

const SYSTEM_PROMPT = `You are a trading-performance analyst specialized in futures (NQ/ES) and prop-firm accounts. You receive a JSON object with metrics that have ALREADY been computed from a trader's history.

Your job: produce between 3 and 6 actionable insights, in ENGLISH, each ALWAYS anchored to a specific number from the JSON.

Strict rules:
- NEVER invent or recompute figures. Use only the numbers in the JSON. If a number isn't there, don't make a claim about it.
- Every insight must cite the figure that backs it in the "metric" field (e.g. "14h win rate: 38% vs 61% baseline").
- Prioritize high-impact behavioral patterns: tilt/revenge trading ("streaks" field: performance after a loss vs baseline), overtrading ("volume" field: high- vs low-volume days), weak time-of-day windows ("byHour" field), playbook discipline ("adherence" field: following vs breaking rules) and risk management ("rMultiples" field).
- "severity": "critical" when it clearly destroys P&L; "warning" for a pattern to fix; "info" for neutral context; "positive" for a strength to keep.
- "category": "timing" (hour/day/session), "discipline" (rules, tilt, overtrading), "risk" (R-multiples, drawdown) or "strategy" (what works).
- "recommendation": one concrete, brief action — not generic advice.
- Don't repeat the same pattern across insights. Order from highest to lowest impact.
- If the data is thin or contradictory, return fewer insights rather than inventing.`

/**
 * Calls Claude with the pre-computed aggregation and returns validated insights.
 * Never throws — Anthropic and parsing errors come back as createErrorResult.
 * Returns "AI_NOT_CONFIGURED" when no API key is set (UI shows a setup notice).
 */
export async function generateInsightsFromInput(
  input: InsightsInput,
): Promise<ResultType<Insight[], string>> {
  if (!envServer.ANTHROPIC_API_KEY) return createErrorResult("AI_NOT_CONFIGURED")

  const client = new Anthropic({ apiKey: envServer.ANTHROPIC_API_KEY })

  try {
    const response = await client.messages.create({
      model:      envServer.ANTHROPIC_MODEL,
      max_tokens: 4000,
      thinking:   { type: "adaptive" },
      system:     SYSTEM_PROMPT,
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages:   [{ role: "user", content: JSON.stringify(input) }],
    })

    if (response.stop_reason === "refusal") return createErrorResult("AI_REFUSED")

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")

    if (!text.trim()) return createErrorResult("AI_EMPTY_RESPONSE")

    const parsed = insightsResponseSchema.safeParse(JSON.parse(text))
    if (!parsed.success) return createErrorResult("AI_INVALID_RESPONSE")

    return createDataResult(parsed.data.insights)
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message)
      return createErrorResult(`AI_API_ERROR`)
    }
    console.error(error)
    return createErrorResult("AI_UNKNOWN_ERROR")
  }
}
