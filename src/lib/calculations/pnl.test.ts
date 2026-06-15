import { describe, it, expect } from "vitest"
import { computeGrossPnl, pointValue } from "./pnl"

describe("pointValue", () => {
  it("resolves the clean symbol from a NinjaTrader instrument string", () => {
    expect(pointValue("NQ 03-25")).toBe(20)
    expect(pointValue("es 06-25")).toBe(50)
  })
  it("returns null for unknown instruments", () => {
    expect(pointValue("FOO")).toBeNull()
  })
})

describe("computeGrossPnl", () => {
  it("computes a winning long on NQ ($20/point)", () => {
    // 25 points * $20 * 2 contracts = 1000
    expect(computeGrossPnl({ instrument: "NQ 03-25", direction: "long", entryPrice: 19850, exitPrice: 19875, contracts: 2 })).toBe(1000)
  })
  it("computes a winning short on ES ($50/point)", () => {
    // short: entry - exit = 10 points * $50 = 500
    expect(computeGrossPnl({ instrument: "ES", direction: "short", entryPrice: 5010, exitPrice: 5000, contracts: 1 })).toBe(500)
  })
  it("returns a loss when price moves against the position", () => {
    expect(computeGrossPnl({ instrument: "MNQ", direction: "long", entryPrice: 19875, exitPrice: 19850, contracts: 1 })).toBe(-50)
  })
  it("returns null for an unknown instrument", () => {
    expect(computeGrossPnl({ instrument: "FOO", direction: "long", entryPrice: 1, exitPrice: 2, contracts: 1 })).toBeNull()
  })
  it("returns null for invalid numeric input", () => {
    expect(computeGrossPnl({ instrument: "NQ", direction: "long", entryPrice: NaN, exitPrice: 2, contracts: 1 })).toBeNull()
    expect(computeGrossPnl({ instrument: "NQ", direction: "long", entryPrice: 1, exitPrice: 2, contracts: 0 })).toBeNull()
  })
})
