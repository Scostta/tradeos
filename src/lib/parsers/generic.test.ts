import { describe, it, expect } from "vitest"
import { inspectCsv, guessMapping, parseWithMapping } from "./generic"
import { detectKnownFormat } from "./registry"
import type { ColumnMapping } from "~/types/import"

const CUSTOM = [
  "Symbol,Side,Qty,Entry,Exit,Open Time,Close Time,P/L,Fees",
  'ES,Buy,2,5000.25,5010.50,2025-03-10 09:30:00,2025-03-10 10:15:00,"1,025.00",4.50',
  "NQ,Sell,1,18000,17950,03/11/2025 11:00:00,03/11/2025 11:30:00,-100,2.10",
].join("\n")

const NT_HEADER =
  "Trade #,Account,Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit,Commission,MAE,MFE"

describe("inspectCsv", () => {
  it("extracts headers, delimiter and sample rows", () => {
    const r = inspectCsv(CUSTOM)
    expect(r.delimiter).toBe(",")
    expect(r.headers).toEqual(["Symbol", "Side", "Qty", "Entry", "Exit", "Open Time", "Close Time", "P/L", "Fees"])
    expect(r.sampleRows).toHaveLength(2)
    expect(r.sampleRows[0]![0]).toBe("ES")
  })
})

describe("guessMapping", () => {
  it("auto-maps common header synonyms", () => {
    const m = guessMapping(inspectCsv(CUSTOM).headers)
    expect(m.instrument).toBe("Symbol")
    expect(m.side).toBe("Side")
    expect(m.contracts).toBe("Qty")
    expect(m.entryPrice).toBe("Entry")
    expect(m.exitPrice).toBe("Exit")
    expect(m.entryTime).toBe("Open Time")
    expect(m.exitTime).toBe("Close Time")
    expect(m.pnl).toBe("P/L")
    expect(m.commission).toBe("Fees")
  })
})

describe("parseWithMapping", () => {
  const mapping: ColumnMapping = guessMapping(inspectCsv(CUSTOM).headers)

  it("parses rows with buy/sell → long/short, flexible numbers and dates", () => {
    const r = parseWithMapping(CUSTOM, mapping, { accountFallback: "Topstep" })
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(2)

    const a = r.rows[0]!
    expect(a.instrument).toBe("ES")
    expect(a.direction).toBe("long")
    expect(a.contracts).toBe(2)
    expect(a.accountName).toBe("Topstep")
    expect(a.pnl).toBe(1025)        // "1,025.00"
    expect(a.commission).toBe(4.5)
    expect(a.netPnl).toBeCloseTo(1020.5)

    const b = r.rows[1]!
    expect(b.direction).toBe("short")  // Sell
    expect(b.pnl).toBe(-100)
  })

  it("synthesizes a stable trade number (idempotent re-imports)", () => {
    const first  = parseWithMapping(CUSTOM, mapping, { accountFallback: "Topstep" })
    const second = parseWithMapping(CUSTOM, mapping, { accountFallback: "Topstep" })
    expect(first.rows[0]!.tradeNumber).toBe(second.rows[0]!.tradeNumber)
    expect(first.rows[0]!.tradeNumber).not.toBe(first.rows[1]!.tradeNumber)
    expect(first.rows[0]!.tradeNumber).toBeGreaterThan(0)
  })

  it("errors when account is neither mapped nor given a fallback", () => {
    const r = parseWithMapping(CUSTOM, mapping, {})
    expect(r.rows).toHaveLength(0)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it("errors when a required column is unmapped", () => {
    const partial: ColumnMapping = { ...mapping, entryTime: undefined }
    const r = parseWithMapping(CUSTOM, partial, { accountFallback: "X" })
    expect(r.rows).toHaveLength(0)
    expect(r.errors[0]!.reason).toContain("Entry time")
  })
})

describe("detectKnownFormat", () => {
  it("detects a NinjaTrader CSV", () => {
    const r = detectKnownFormat(`${NT_HEADER}\n1,Sim,NQ 03-25,Long,1,100,110,3/10/2025 9:00:00 AM,3/10/2025 9:30:00 AM,500,8,0,0`)
    expect(r).not.toBeNull()
    expect(r!.format).toBe("NinjaTrader v8")
  })

  it("returns null for an unknown CSV", () => {
    expect(detectKnownFormat(CUSTOM)).toBeNull()
  })
})
