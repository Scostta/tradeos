import { playbookSchema } from "~/types/playbook"
import type { Playbook } from "~/types/playbook"

export function mapPlaybookFromDb(row: Record<string, unknown>): Playbook {
  return playbookSchema.parse({
    id:          row["id"],
    userId:      row["user_id"],
    name:        row["name"],
    description: row["description"],
    rules:       row["rules"],
    active:      row["active"] ?? true,
    createdAt:   row["created_at"],
  })
}
