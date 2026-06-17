import { zonedDateKey } from "~/helpers/tz"
import type { PropFirmConfig, PropFirmTrade, PropFirmStatus, AlertLevel } from "~/types/prop-firm"

const round2  = (n: number): number => Math.round(n * 100) / 100
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * Compute prop-firm rule status for an account from its closed trades.
 *
 * Drawdown models:
 *  - trailing_intraday — floor trails the running peak balance (approximated
 *    from trade closes; without tick data it can't see unrealized intraday peaks).
 *  - trailing_eod      — floor trails the highest end-of-day balance.
 *  - static            — fixed floor at initialBalance − drawdownAmount.
 *
 * `drawdownLockAt` (optional) caps the trailing floor (e.g. Apex locks at
 * start+$100, Topstep at the start balance). Returns null if no rule is set.
 */
export function computePropFirmStatus(
  config: PropFirmConfig,
  trades: PropFirmTrade[],
  now: Date = new Date(),
  timeZone = "UTC",
): PropFirmStatus | null {
  const hasRule =
    config.drawdownType   != null ||
    config.dailyLossLimit != null ||
    config.profitTarget   != null ||
    config.minTradingDays != null
  if (!hasRule) return null

  const sorted   = [...trades].sort((a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime())
  const initial  = config.initialBalance
  const totalNet = round2(sorted.reduce((s, t) => s + t.netPnl, 0))
  const currentBalance = initial != null ? round2(initial + totalNet) : totalNet

  // ── Peak balance (model-dependent) ──────────────────────────────────────────
  let peakBalance = initial ?? 0
  if (initial != null) {
    if (config.drawdownType === "trailing_eod") {
      const closeByDay = new Map<string, number>()
      let cum = 0
      for (const t of sorted) { cum = round2(cum + t.netPnl); closeByDay.set(zonedDateKey(t.exitTime, timeZone), cum) }
      let p = initial
      for (const cumAtClose of closeByDay.values()) p = Math.max(p, round2(initial + cumAtClose))
      peakBalance = p
    } else {
      let cum = 0
      let p = initial
      for (const t of sorted) { cum = round2(cum + t.netPnl); p = Math.max(p, round2(initial + cum)) }
      peakBalance = p
    }
  }

  // ── Drawdown ────────────────────────────────────────────────────────────────
  let drawdown: PropFirmStatus["drawdown"] = null
  if (config.drawdownType != null && config.drawdownAmount != null && initial != null) {
    const dd = config.drawdownAmount
    let threshold: number
    if (config.drawdownType === "static") {
      threshold = round2(initial - dd)
    } else {
      let base = round2(peakBalance - dd)
      if (config.drawdownLockAt != null) base = Math.min(base, config.drawdownLockAt)
      threshold = Math.max(base, round2(initial - dd))
    }
    const distance = round2(currentBalance - threshold)
    drawdown = {
      type:      config.drawdownType,
      threshold,
      current:   currentBalance,
      distance,
      usedPct:   clamp01(1 - distance / dd),
      breached:  currentBalance <= threshold,
    }
  }

  // ── Daily loss limit ─────────────────────────────────────────────────────────
  let dailyLoss: PropFirmStatus["dailyLoss"] = null
  if (config.dailyLossLimit != null) {
    const todayKey = zonedDateKey(now.toISOString(), timeZone)
    const todayNet = round2(sorted.filter(t => zonedDateKey(t.exitTime, timeZone) === todayKey).reduce((s, t) => s + t.netPnl, 0))
    const used     = Math.max(0, round2(-todayNet))
    const limit    = config.dailyLossLimit
    dailyLoss = {
      limit,
      used,
      remaining: round2(limit - used),
      usedPct:   clamp01(used / limit),
      breached:  used >= limit,
    }
  }

  // ── Profit target ─────────────────────────────────────────────────────────────
  // Progress is cumulative net P&L vs target — does not need an initial balance.
  let profit: PropFirmStatus["profit"] = null
  if (config.profitTarget != null) {
    const target = config.profitTarget
    profit = {
      target,
      progress: totalNet,
      pct:      clamp01(totalNet / target),
      reached:  totalNet >= target,
    }
  }

  // ── Minimum trading days ──────────────────────────────────────────────────────
  let tradingDays: PropFirmStatus["tradingDays"] = null
  if (config.minTradingDays != null) {
    const done = new Set(sorted.map(t => zonedDateKey(t.exitTime, timeZone))).size
    tradingDays = {
      required:  config.minTradingDays,
      done,
      remaining: Math.max(0, config.minTradingDays - done),
      met:       done >= config.minTradingDays,
    }
  }

  const breached = Boolean(drawdown?.breached || dailyLoss?.breached)
  const maxUsed  = Math.max(drawdown?.usedPct ?? 0, dailyLoss?.usedPct ?? 0)
  let alertLevel: AlertLevel = "safe"
  if (breached)            alertLevel = "breached"
  else if (maxUsed >= 0.8) alertLevel = "danger"
  else if (maxUsed >= 0.5) alertLevel = "warning"

  return { netPnl: totalNet, currentBalance, peakBalance, drawdown, dailyLoss, profit, tradingDays, breached, alertLevel }
}
