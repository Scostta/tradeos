import "server-only"

import { z } from "zod"
import { claudeJson } from "~/lib/ai/claude-json"
import type { AiError } from "~/lib/ai/claude-json"
import type { ResultType } from "~/helpers/result"
import { createDataResult, createErrorResult } from "~/helpers/result"

// MONEY_SPEC §5.8: sugerencias de categoría para la cola. Solo propone; lo
// escribe categorizeTransaction cuando el usuario acepta.

export type CategorizeTx = { id: string; counterparty: string | null; concept: string; amount: number; date: string }
export type CategorizeCategory = { id: string; name: string; kind: string; isFixed: boolean }
export type CategorizeRule = { pattern: string; amount: number | null; category: string }

export type CategorySuggestion = {
  transactionId: string
  categoryId:    string | null
  confidence:    "high" | "medium" | "low"
  rulePattern:   string | null
  reason:        string
}

const SYSTEM = `You categorize personal bank transactions from a Spanish bank (imagin / CaixaBank) into the user's own categories.

You receive JSON with:
- "categories": the user's categories (id, name, kind, isFixed). kind "expense"/"income" count in the savings rate; "transfer" never counts (moving money between own accounts); "savings" leaves the account but counts as saving (e.g. contributions to an index fund or broker).
- "rules": rules the user already created (concept pattern, optional exact amount, category name). They show how this user thinks; follow the same criteria.
- "transactions": uncategorized movements (ref, counterparty = normalized concept, raw concept, signed amount in EUR where negative = money out, date).

For each transaction return:
- categoryId: one of the given ids, or null when you cannot tell with reasonable confidence. Never invent ids.
- confidence: "high" only when the merchant/concept is unambiguous (a supermarket, a known subscription, a payroll); "medium" for a plausible guess; "low" when it is mostly a guess.
- rulePattern: a short lowercase substring of the counterparty that would also catch future charges from the same merchant (e.g. "mercadona"), or null if the concept is too generic (transfers to people, Bizum to individuals, generic card payments).
- reason: under 12 words, in English.

Positive amounts are income or refunds: never put them in an expense category unless it is clearly a refund of that kind of expense. Spanish concepts: "nomina" = payroll, "reint.cajero" = ATM withdrawal, "bizum enviado/recibido" = peer-to-peer payment, "recibo" = direct debit, "compra tarj." = card purchase.`

const zodResponse = z.object({
  suggestions: z.array(z.object({
    ref:         z.string(),
    categoryId:  z.string().nullable(),
    confidence:  z.enum(["high", "medium", "low"]),
    rulePattern: z.string().nullable(),
    reason:      z.string(),
  })),
})

export async function suggestCategories(args: {
  transactions: CategorizeTx[]
  categories:   CategorizeCategory[]
  rules:        CategorizeRule[]
}): Promise<ResultType<{ suggestions: CategorySuggestion[]; model: string }, AiError>> {
  const ids = args.categories.map(c => c.id)
  const refs = args.transactions.map((_, i) => `t${i + 1}`)
  const jsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ref", "categoryId", "confidence", "rulePattern", "reason"],
          properties: {
            ref:         { type: "string", enum: refs },
            categoryId:  { anyOf: [{ type: "string", enum: ids }, { type: "null" }] },
            confidence:  { type: "string", enum: ["high", "medium", "low"] },
            rulePattern: { type: ["string", "null"] },
            reason:      { type: "string" },
          },
        },
      },
    },
  }

  const result = await claudeJson({
    system: SYSTEM,
    input: {
      categories:   args.categories,
      rules:        args.rules,
      transactions: args.transactions.map((t, i) => ({
        ref: refs[i], counterparty: t.counterparty, concept: t.concept, amount: t.amount, date: t.date,
      })),
    },
    jsonSchema,
    zod:    zodResponse,
    effort: "low",
  })
  if (!result.success) return createErrorResult(result.error)

  const byRef = new Map(args.transactions.map((t, i) => [refs[i]!, t]))
  const known = new Set(ids)
  const suggestions = result.data.data.suggestions.flatMap(s => {
    const tx = byRef.get(s.ref)
    if (!tx) return []
    const transactionId = tx.id
    const categoryId = s.categoryId && known.has(s.categoryId) ? s.categoryId : null
    // Una regla solo sirve si su patrón está en la contraparte (así casa matchRule).
    const pattern = s.rulePattern?.trim().toLowerCase() ?? ""
    const rulePattern = pattern.length >= 2 && tx.counterparty?.includes(pattern) ? pattern : null
    return [{ transactionId, categoryId, confidence: s.confidence, rulePattern: categoryId ? rulePattern : null, reason: s.reason }]
  })
  return createDataResult({ suggestions, model: result.data.model })
}
