import { describe, it, expect } from "vitest"
import { computePropFirmStatus } from "./prop-firm"
import type { PropFirmConfig, PropFirmTrade } from "~/types/prop-firm"

const baseConfig: PropFirmConfig = {
  initialBalance: 50000,
  drawdownType:   null,
  drawdownAmount: null,
  drawdownLockAt: null,
  dailyLossLimit: null,
  profitTarget:   null,
  minTradingDays: null,
}

function t(netPnl: number, exitTime = "2026-06-10T15:00:00Z"): PropFirmTrade {
  return { netPnl, exitTime }
}

describe("computePropFirmStatus — gating", () => {
  it("returns null when no rule is configured", () => {
    expect(computePropFirmStatus(baseConfig, [t(100)])).toBeNull()
  })
})

describe("trailing_intraday drawdown", () => {
  const cfg = { ...baseConfig, drawdownType: "trailing_intraday" as const, drawdownAmount: 2500 }

  it("floor trails the running peak balance", () => {
    const s = computePropFirmStatus(cfg, [t(1000), t(500)])!
    expect(s.peakBalance).toBe(51500)
    expect(s.drawdown!.threshold).toBe(49000)   // 51500 - 2500
    expect(s.drawdown!.distance).toBe(2500)
    expect(s.drawdown!.usedPct).toBe(0)
    expect(s.drawdown!.breached).toBe(false)
  })

  it("breaches when balance drops below the trailed floor", () => {
    const s = computePropFirmStatus(cfg, [t(1000), t(500), t(-2600)])!
    expect(s.peakBalance).toBe(51500)          // peak held
    expect(s.currentBalance).toBe(48900)
    expect(s.drawdown!.breached).toBe(true)
    expect(s.alertLevel).toBe("breached")
  })

  it("caps the trailing floor at drawdownLockAt", () => {
    const s = computePropFirmStatus({ ...cfg, drawdownLockAt: 50100 }, [t(5000)])!
    expect(s.peakBalance).toBe(55000)
    expect(s.drawdown!.threshold).toBe(50100)  // capped, not 52500
  })
})

describe("trailing_eod vs trailing_intraday", () => {
  const trades = [
    t(2000, "2026-06-10T15:00:00Z"),
    t(1000, "2026-06-11T15:00:00Z"),
    t(-3000, "2026-06-11T16:00:00Z"),
  ]

  it("EOD trails end-of-day closes (more forgiving than intraday)", () => {
    const eod = computePropFirmStatus({ ...baseConfig, drawdownType: "trailing_eod", drawdownAmount: 2500 }, trades)!
    expect(eod.peakBalance).toBe(52000)        // max EOD close, not the 53000 intraday spike
    expect(eod.drawdown!.threshold).toBe(49500)
    expect(eod.drawdown!.breached).toBe(false)

    const intraday = computePropFirmStatus({ ...baseConfig, drawdownType: "trailing_intraday", drawdownAmount: 2500 }, trades)!
    expect(intraday.peakBalance).toBe(53000)
    expect(intraday.drawdown!.breached).toBe(true)  // 50000 <= 50500
  })
})

describe("static drawdown", () => {
  it("floor is fixed at initial - amount regardless of peak", () => {
    const cfg = { ...baseConfig, drawdownType: "static" as const, drawdownAmount: 2000 }
    const s = computePropFirmStatus(cfg, [t(5000), t(-7500)])!
    expect(s.drawdown!.threshold).toBe(48000)  // 50000 - 2000, peak ignored
    expect(s.currentBalance).toBe(47500)
    expect(s.drawdown!.breached).toBe(true)
  })
})

describe("daily loss limit", () => {
  const now = new Date("2026-06-15T18:00:00Z")
  const cfg = { ...baseConfig, dailyLossLimit: 1000 }

  it("sums only today's realized loss", () => {
    const trades = [t(-500, "2026-06-14T15:00:00Z"), t(-400, "2026-06-15T15:00:00Z")]
    const s = computePropFirmStatus(cfg, trades, now)!
    expect(s.dailyLoss!.used).toBe(400)
    expect(s.dailyLoss!.remaining).toBe(600)
    expect(s.dailyLoss!.breached).toBe(false)
  })

  it("breaches when today's loss reaches the limit", () => {
    const s = computePropFirmStatus(cfg, [t(-1200, "2026-06-15T15:00:00Z")], now)!
    expect(s.dailyLoss!.used).toBe(1200)
    expect(s.dailyLoss!.breached).toBe(true)
    expect(s.alertLevel).toBe("breached")
  })
})

describe("profit target & trading days", () => {
  it("tracks profit progress vs target", () => {
    const s = computePropFirmStatus({ ...baseConfig, profitTarget: 3000 }, [t(1500), t(1500)])!
    expect(s.profit!.progress).toBe(3000)
    expect(s.profit!.reached).toBe(true)
    expect(s.profit!.pct).toBe(1)
  })

  it("tracks profit progress even without an initial balance", () => {
    const s = computePropFirmStatus({ ...baseConfig, initialBalance: null, profitTarget: 3000 }, [t(1500), t(900)])!
    expect(s.profit!.progress).toBe(2400)
    expect(s.profit!.pct).toBeCloseTo(0.8)
    expect(s.netPnl).toBe(2400)
  })

  it("counts distinct trading days", () => {
    const s = computePropFirmStatus({ ...baseConfig, minTradingDays: 5 }, [
      t(10, "2026-06-10T15:00:00Z"),
      t(10, "2026-06-10T16:00:00Z"),
      t(10, "2026-06-11T15:00:00Z"),
      t(10, "2026-06-12T15:00:00Z"),
    ])!
    expect(s.tradingDays!.done).toBe(3)
    expect(s.tradingDays!.remaining).toBe(2)
    expect(s.tradingDays!.met).toBe(false)
  })
})

describe("alert levels", () => {
  const cfg = { ...baseConfig, drawdownType: "static" as const, drawdownAmount: 1000 }
  it("warning at ≥50% of buffer used", () => {
    // floor 49000; balance 50000 - 600 = 49400; distance 400; usedPct 0.6
    const s = computePropFirmStatus(cfg, [t(-600)])!
    expect(s.drawdown!.usedPct).toBeCloseTo(0.6)
    expect(s.alertLevel).toBe("warning")
  })
  it("danger at ≥80% of buffer used", () => {
    // balance 50000 - 850 = 49150; distance 150; usedPct 0.85
    const s = computePropFirmStatus(cfg, [t(-850)])!
    expect(s.drawdown!.usedPct).toBeCloseTo(0.85)
    expect(s.alertLevel).toBe("danger")
  })
})
