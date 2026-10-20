// ── API tokens (add-on de NinjaTrader) ────────────────────────────────────────
// El token en claro solo existe en la respuesta de createApiToken(); en BD se
// guarda su sha256 y un prefijo para reconocerlo en /settings.

import { z } from "zod"

export const apiTokenSchema = z.object({
  id:          z.string().uuid(),
  name:        z.string(),
  tokenPrefix: z.string(),
  lastUsedAt:  z.string().datetime({ offset: true }).nullable(),
  revokedAt:   z.string().datetime({ offset: true }).nullable(),
  createdAt:   z.string().datetime({ offset: true }),
})
export type ApiToken = z.infer<typeof apiTokenSchema>

// ── Action inputs ─────────────────────────────────────────────────────────────

export const createApiTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
})
export type CreateApiTokenInput = z.infer<typeof createApiTokenInputSchema>

export const revokeApiTokenInputSchema = z.object({
  id: z.string().uuid(),
})
