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
    propPhase:      row["prop_phase"]      ?? null,
    drawdownType:   row["drawdown_type"]   ?? null,
    drawdownAmount: row["drawdown_amount"] ?? null,
    drawdownLockAt: row["drawdown_lock_at"]?? null,
    dailyLossLimit: row["daily_loss_limit"]?? null,
    profitTarget:   row["profit_target"]   ?? null,
    minTradingDays: row["min_trading_days"]?? null,
    createdAt:      row["created_at"],
  })
}
