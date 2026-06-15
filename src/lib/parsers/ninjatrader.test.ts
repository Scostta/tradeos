import { describe, it, expect } from "vitest"
import { parseNinjaTraderCsv } from "./ninjatrader"

const HEADER =
  "Trade #,Account,Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit,Commission,MAE,MFE"

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n")
}

describe("parseNinjaTraderCsv — standard v8 export", () => {
  it("parses a valid row and computes net P&L", () => {
    const result = parseNinjaTraderCsv(
      csv("1,Sim101,NQ 03-25,Long,1,19850.00,19875.00,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500.00,8.50,-120.00,620.00"),
    )

    expect(result.format).toBe("NinjaTrader v8")
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)

    const row = result.rows[0]!
    expect(row.instrument).toBe("NQ")          // symbol extracted from "NQ 03-25"
    expect(row.direction).toBe("long")
    expect(row.contracts).toBe(1)
    expect(row.accountName).toBe("Sim101")
    expect(row.pnl).toBe(500)
    expect(row.commission).toBe(8.5)
    expect(row.netPnl).toBeCloseTo(491.5)
    expect(() => new Date(row.entryTime).toISOString()).not.toThrow()
  })

  it("normalizes Short → short", () => {
    const result = parseNinjaTraderCsv(
      csv("1,Sim101,ES 06-25,Short,2,5000,5010,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,100,4,-10,50"),
    )
    expect(result.rows[0]!.direction).toBe("short")
    expect(result.rows[0]!.instrument).toBe("ES")
  })

  it("skips partial trades with no exit time (not an error)", () => {
    const result = parseNinjaTraderCsv(
      csv(
        "1,Sim101,NQ 03-25,Long,1,19850,19875,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500,8.5,-120,620",
        "2,Sim101,NQ 03-25,Long,1,19850,19875,3/10/2025 10:00:00 AM,,0,0,0,0",
      ),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(0)
  })

  it("reports an error for an unknown market position", () => {
    const result = parseNinjaTraderCsv(
      csv("1,Sim101,NQ 03-25,Sideways,1,19850,19875,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500,8.5,-120,620"),
    )
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.reason).toMatch(/market position/i)
  })

  it("detects multiple accounts across rows", () => {
    const result = parseNinjaTraderCsv(
      csv(
        "1,Sim101,NQ 03-25,Long,1,19850,19875,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500,8.5,-120,620",
        "2,Live42,ES 06-25,Short,1,5000,4990,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500,4,-10,50",
      ),
    )
    const accounts = new Set(result.rows.map(r => r.accountName))
    expect(accounts).toEqual(new Set(["Sim101", "Live42"]))
  })
})

describe("parseNinjaTraderCsv — Grid export (semicolon, EU format)", () => {
  it("parses semicolon-delimited rows with comma decimals and 24h dates", () => {
    const header = "Trade number;Account;Instrument;Market pos.;Qty;Entry price;Exit price;Entry time;Exit time;Profit;Commission;MAE;MFE"
    const row    = "1;Live42;ES 06-25;Short;2;5000,00;5010,00;11/05/2026 15:31:05;11/05/2026 15:45:00;137,50 $;4,00 $;-20,00 $;200,00 $"

    const result = parseNinjaTraderCsv([header, row].join("\n"))

    expect(result.format).toBe("NinjaTrader Grid")
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.contracts).toBe(2)
    expect(result.rows[0]!.pnl).toBeCloseTo(137.5)
    expect(result.rows[0]!.netPnl).toBeCloseTo(133.5)
  })
})

describe("parseNinjaTraderCsv — malformed input", () => {
  it("returns an error and 'unknown' format for an unrecognized header", () => {
    const result = parseNinjaTraderCsv("foo,bar,baz\n1,2,3")
    expect(result.format).toBe("unknown")
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
  })

  it("returns an error for empty input", () => {
    const result = parseNinjaTraderCsv("")
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
  })
})
