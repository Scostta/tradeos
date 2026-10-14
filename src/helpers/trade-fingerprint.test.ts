import { describe, it, expect } from "vitest"
import { importKeyMatches, tradeFingerprint, withImportKeys } from "./trade-fingerprint"
import { parseNinjaTraderCsv } from "~/lib/parsers/ninjatrader"

const HEADER =
  "Trade number;Instrument;Account;Strategy;Market pos.;Qty;Entry price;Exit price;Entry time;Exit time;Entry name;Exit name;Profit;Cum. net profit;Commission;Clearing Fee;Exchange Fee;IP Fee;NFA Fee;MAE;MFE;ETD;Bars;"

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n")
}

function trade(n: number, entry: string, exit: string, qty = 2, price = "30771,00"): string {
  return `${n};MNQ 12-26;APEX-1;;Long;${qty};${price};30755,25;${entry};${exit};;;-63,00 $;-63,00 $;0,00 $;0,00 $;0,00 $;0,00 $;0,00 $;63,00 $;1,00 $;64,00 $;0;`
}

const base = {
  accountName: "Sim101",
  instrument:  "NQ",
  direction:   "long",
  contracts:   1,
  entryPrice:  19850.25,
  exitPrice:   19875,
  entryTime:   "2025-03-10T13:32:01.000Z",
  exitTime:    "2025-03-10T13:45:22.000Z",
}

describe("tradeFingerprint", () => {
  it("formats prices with 4 decimals and times as epoch seconds (matches the SQL backfill)", () => {
    expect(tradeFingerprint(base)).toBe("NQ|long|1|1741613521|1741614322|19850.2500|19875.0000")
  })

  it("ignores sub-second precision", () => {
    expect(tradeFingerprint({ ...base, entryTime: "2025-03-10T13:32:01.900Z" }))
      .toBe(tradeFingerprint(base))
  })
})

describe("withImportKeys", () => {
  it("numbers identical trades within an account and resets per account", () => {
    const keys = withImportKeys([base, base, { ...base, accountName: "Live42" }])
      .map((r) => r.importKey.split("#")[1])
    expect(keys).toEqual(["1", "2", "1"])
  })

  it("trade numbers that restart in every NinjaTrader export do not collide", () => {
    // Dos exports de días distintos: ambos empiezan en Trade number 1.
    const oct10 = parseNinjaTraderCsv(csv(trade(1, "10/10/2026 15:43:54", "10/10/2026 15:48:41")))
    const oct13 = parseNinjaTraderCsv(csv(trade(1, "13/10/2026 15:43:54", "13/10/2026 15:48:41")))
    expect(oct10.errors).toEqual([])
    expect(oct13.errors).toEqual([])

    const [a] = withImportKeys(oct10.rows)
    const [b] = withImportKeys(oct13.rows)
    expect(a!.tradeNumber).toBe(b!.tradeNumber)
    expect(a!.importKey).not.toBe(b!.importKey)
  })

  it("re-importing the same export yields the same keys", () => {
    const text = csv(
      trade(1, "13/10/2026 16:53:43", "13/10/2026 17:01:08"),
      trade(2, "13/10/2026 16:53:43", "13/10/2026 17:01:08", 1),
    )
    const first  = withImportKeys(parseNinjaTraderCsv(text).rows).map((r) => r.importKey)
    const second = withImportKeys(parseNinjaTraderCsv(text).rows).map((r) => r.importKey)
    expect(first).toEqual(second)
    expect(new Set(first).size).toBe(2)
  })
})

describe("importKeyMatches", () => {
  it("accepts a key built from the row and rejects one from another trade", () => {
    const [row] = withImportKeys([base])
    expect(importKeyMatches(row!)).toBe(true)
    expect(importKeyMatches({ ...row!, exitPrice: 19876 })).toBe(false)
    expect(importKeyMatches({ ...row!, importKey: tradeFingerprint(base) })).toBe(false)
  })
})
