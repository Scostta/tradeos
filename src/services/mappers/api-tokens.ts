import { apiTokenSchema } from "~/types/api-token"
import type { ApiToken } from "~/types/api-token"

export function mapApiTokenFromDb(row: Record<string, unknown>): ApiToken {
  return apiTokenSchema.parse({
    id:          row["id"],
    name:        row["name"],
    tokenPrefix: row["token_prefix"],
    lastUsedAt:  row["last_used_at"] ?? null,
    revokedAt:   row["revoked_at"]   ?? null,
    createdAt:   row["created_at"],
  })
}
