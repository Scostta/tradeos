import { accountSchema } from "~/types/account"
import type { Account } from "~/types/account"

export function mapAccountFromDb(row: Record<string, unknown>): Account {
  return accountSchema.parse({
    id:             row["id"],
    userId:         row["user_id"],
    name:           row["name"],
    broker:         row["broker"],
    accountType:    row["account_type"],
    currency:       row["currency"] ?? "USD",
    initialBalance: row["initial_balance"],
    active:         row["active"] ?? true,
    color:          row["color"] ?? "#3b82f6",
    notes:          row["notes"],
    createdAt:      row["created_at"],
  })
}
