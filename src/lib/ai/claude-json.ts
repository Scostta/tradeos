import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import type { z } from "zod"
import { envServer } from "~/env/server"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

// Llamada a Claude con salida JSON validada, compartida por los módulos que
// usan IA (Insights de Trading, Money, Invest). Cada uno pone su prompt, su
// esquema JSON y su esquema Zod; aquí solo va el transporte.

export const AI_MODEL = "claude-opus-5-5"
// Si Claude Opus 5.5 rechaza por seguridad, la API reintenta la misma petición
// con este modelo dentro de la misma llamada (server-side fallback).
const FALLBACK_MODEL = "claude-opus-4-8"

export type AiError =
  | "AI_NOT_CONFIGURED"
  | "AI_REFUSED"
  | "AI_EMPTY_RESPONSE"
  | "AI_INVALID_RESPONSE"
  | "AI_RATE_LIMITED"
  | "AI_API_ERROR"
  | "AI_UNKNOWN_ERROR"

export function aiConfigured(): boolean {
  return envServer.ANTHROPIC_API_KEY.length > 0
}

type Request<T> = {
  system:     string
  input:      unknown                       // se envía como JSON en el mensaje del usuario
  jsonSchema: Record<string, unknown>       // structured outputs: additionalProperties false + required en todo
  zod:        z.ZodType<T>
  effort:     "low" | "medium" | "high"
  maxTokens?: number
}

/** Nunca lanza: los errores de la API y de parseo vuelven como AiError. */
export async function claudeJson<T>(req: Request<T>): Promise<ResultType<{ data: T; model: string }, AiError>> {
  if (!aiConfigured()) return createErrorResult("AI_NOT_CONFIGURED")
  const client = new Anthropic({ apiKey: envServer.ANTHROPIC_API_KEY })

  try {
    const response = await client.beta.messages.create({
      model:         AI_MODEL,
      max_tokens:    req.maxTokens ?? 16000,
      thinking:      { type: "adaptive" },
      system:        req.system,
      output_config: { effort: req.effort, format: { type: "json_schema", schema: req.jsonSchema } },
      betas:         ["server-side-fallback-2026-06-01"],
      fallbacks:     [{ model: FALLBACK_MODEL }],
      messages:      [{ role: "user", content: JSON.stringify(req.input) }],
    })

    if (response.stop_reason === "refusal") return createErrorResult("AI_REFUSED")
    if (response.stop_reason === "max_tokens") return createErrorResult("AI_INVALID_RESPONSE")

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map(b => b.text)
      .join("")
    if (!text.trim()) return createErrorResult("AI_EMPTY_RESPONSE")

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return createErrorResult("AI_INVALID_RESPONSE")
    }
    const parsed = req.zod.safeParse(json)
    if (!parsed.success) {
      console.error(parsed.error)
      return createErrorResult("AI_INVALID_RESPONSE")
    }
    return createDataResult({ data: parsed.data, model: response.model })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return createErrorResult("AI_RATE_LIMITED")
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message)
      return createErrorResult("AI_API_ERROR")
    }
    console.error(error)
    return createErrorResult("AI_UNKNOWN_ERROR")
  }
}

/** Hash estable de la entrada para no regenerar si las cifras no cambian. */
export async function inputHash(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")
}
