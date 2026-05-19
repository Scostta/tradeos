import { strategySchema } from "~/types/strategy"
import type { Strategy } from "~/types/strategy"

export function mapStrategyFromDb(row: Record<string, unknown>): Strategy {
  return strategySchema.parse({
    id:          row["id"],
    userId:      row["user_id"],
    name:        row["name"],
    description: row["description"],
    rules:       row["rules"],
    active:      row["active"] ?? true,
    createdAt:   row["created_at"],
  })
}
