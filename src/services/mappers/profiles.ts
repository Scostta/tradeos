import { profileSchema } from "~/types/profile"
import type { Profile } from "~/types/profile"

export function mapProfileFromDb(row: Record<string, unknown>): Profile {
  return profileSchema.parse({
    userId:          row["user_id"],
    displayName:     row["display_name"]     ?? null,
    timezone:        row["timezone"]         ?? "UTC",
    defaultCurrency: row["default_currency"] ?? "USD",
    createdAt:       row["created_at"],
    updatedAt:       row["updated_at"],
  })
}
