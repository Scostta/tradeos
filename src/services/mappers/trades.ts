import { tradeSchema } from "~/types/trade"
import type { Trade } from "~/types/trade"

export function mapTradeFromDb(row: Record<string, unknown>): Trade {
  return tradeSchema.parse({
    id:          row["id"],
    userId:      row["user_id"],
    accountId:   row["account_id"],
    tradeNumber: row["trade_number"],
    instrument:  row["instrument"],
    direction:   row["direction"],
    contracts:   row["contracts"],
    entryPrice:  row["entry_price"],
    exitPrice:   row["exit_price"],
    entryTime:   row["entry_time"],
    exitTime:    row["exit_time"],
    pnl:         row["pnl"],
    commission:  row["commission"] ?? 0,
    netPnl:      row["net_pnl"],
    mae:         row["mae"],
    mfe:         row["mfe"],
    stopPrice:   row["stop_price"],
    playbookId:  row["playbook_id"],
    session:     row["session"],
    notes:       row["notes"],
    tags:        row["tags"],
    followedRules: row["followed_rules"] ?? null,
    createdAt:   row["created_at"],
  })
}
