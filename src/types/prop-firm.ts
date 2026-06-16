import type { DrawdownType, AccountWithStats } from "./account"

export type AlertLevel = "safe" | "warning" | "danger" | "breached"

// Minimal trade shape the status calc needs.
export type PropFirmTrade = {
  netPnl:   number
  exitTime: string
}

// The configurable rules pulled from an account.
export type PropFirmConfig = {
  initialBalance: number | null
  drawdownType:   DrawdownType | null
  drawdownAmount: number | null
  drawdownLockAt: number | null
  dailyLossLimit: number | null
  profitTarget:   number | null
  minTradingDays: number | null
}

export type DrawdownStatus = {
  type:      DrawdownType
  threshold: number   // floor balance — drop to/below this = blown
  current:   number   // current balance
  distance:  number   // current - threshold (room left)
  usedPct:   number   // 0 = full room, 1 = at the floor
  breached:  boolean
}

export type DailyLossStatus = {
  limit:     number
  used:      number   // realized loss today (positive number)
  remaining: number
  usedPct:   number
  breached:  boolean
}

export type ProfitStatus = {
  target:   number
  progress: number   // net P&L vs initial balance
  pct:      number   // 0..1 (clamped)
  reached:  boolean
}

export type TradingDaysStatus = {
  required:  number
  done:      number
  remaining: number
  met:       boolean
}

export type PropFirmStatus = {
  netPnl:         number   // cumulative net P&L on the account (progress)
  currentBalance: number
  peakBalance:    number
  drawdown:       DrawdownStatus | null
  dailyLoss:      DailyLossStatus | null
  profit:         ProfitStatus | null
  tradingDays:    TradingDaysStatus | null
  breached:       boolean
  alertLevel:     AlertLevel
}

export type AccountWithPropStatus = AccountWithStats & {
  propStatus: PropFirmStatus | null
}
