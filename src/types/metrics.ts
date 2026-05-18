import { z } from "zod"
import type { Trade } from "./trade"

export const rangeKeySchema = z.enum(["today", "week", "month", "ytd"])
export type RangeKey = z.infer<typeof rangeKeySchema>

export type EquityPoint = {
  date:    string
  equity:  number
  tradeId: string
}

export type DowBucket = {
  key:    "Mon" | "Tue" | "Wed" | "Thu" | "Fri"
  net:    number
  trades: number
}

export type DashboardMetrics = {
  netPnl:       number
  winRate:      number
  profitFactor: number
  maxDrawdown:  number
  avgWin:       number
  avgLoss:      number
  totalTrades:  number
  winners:      number
  losers:       number
}

export type DashboardData = {
  metrics:      DashboardMetrics
  equityCurve:  EquityPoint[]
  pnlByDow:     DowBucket[]
  recentTrades: Trade[]
  hasTrades:    boolean
}
