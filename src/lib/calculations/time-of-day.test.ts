import { describe, it, expect } from "vitest"
import type { Trade } from "~/types/trade"
import {
  byHourOfDay,
  bySession,
  sortByHour,
  buildHourBars,
  computeHourWeekdayMatrix,
} from "./time-of-day"

function trade(
  netPnl: number,
  entryTime: string,
  session: Trade["session"] = null,
): Trade {
  return {
    id:          "t",
    userId:      "00000000-0000-0000-0000-000000000000",
    accountId:   "00000000-0000-0000-0000-000000000000",
    tradeNumber: null,
    instrument:  "NQ",
    direction:   "long",
    contracts:   1,
    entryPrice:  1,
    exitPrice:   1,
    entryTime,
    exitTime:    entryTime,
    pnl:         netPnl,
    commission:  0,
    netPnl,
    mae:         null,
    mfe:         null,
    stopPrice:   null,
    playbookId:  null,
    session,
    notes:       null,
    tags:        null,
    followedRules: null,
    mistakes:    null,
    createdAt:   entryTime,
  }
}

describe("byHourOfDay", () => {
  it("labels the hour in UTC as HH:00", () => {
    const label = byHourOfDay("UTC")(trade(100, "2025-03-10T09:32:00.000Z"))
    expect(label).toBe("09:00")
  })

  it("shifts the hour with the timezone", () => {
    // 13:30 UTC → 09:30 in New York (EDT, −4)
    const label = byHourOfDay("America/New_York")(trade(100, "2025-03-10T13:30:00.000Z"))
    expect(label).toBe("09:00")
  })
})

describe("sortByHour", () => {
  it("orders hour labels chronologically", () => {
    const rows = [{ label: "15:00" }, { label: "09:00" }, { label: "11:00" }]
    expect(sortByHour(rows).map(r => r.label)).toEqual(["09:00", "11:00", "15:00"])
  })
})

describe("bySession", () => {
  it("maps known sessions and buckets null as Unspecified", () => {
    expect(bySession(trade(1, "2025-03-10T13:00:00.000Z", "RTH"))).toBe("RTH")
    expect(bySession(trade(1, "2025-03-10T13:00:00.000Z", "overnight"))).toBe("Overnight")
    expect(bySession(trade(1, "2025-03-10T13:00:00.000Z", null))).toBe("Unspecified")
  })
})

describe("buildHourBars", () => {
  it("sums net P&L per hour, chronologically, only for hours with trades", () => {
    const bars = buildHourBars([
      trade(100, "2025-03-10T09:10:00.000Z"),
      trade(-40, "2025-03-10T09:50:00.000Z"),
      trade(25,  "2025-03-10T15:05:00.000Z"),
    ], "UTC")
    expect(bars).toEqual([
      { label: "09", v: 60 },
      { label: "15", v: 25 },
    ])
  })
})

describe("computeHourWeekdayMatrix", () => {
  it("builds weekday rows × hour columns with net P&L and trade counts", () => {
    // 2025-03-10 is a Monday, 2025-03-11 is a Tuesday (both 09:00 UTC)
    const matrix = computeHourWeekdayMatrix([
      trade(100, "2025-03-10T09:00:00.000Z"),
      trade(50,  "2025-03-10T09:30:00.000Z"),
      trade(-20, "2025-03-11T09:00:00.000Z"),
    ], "UTC")

    expect(matrix.hours).toEqual([9])
    expect(matrix.rows.map(r => r.label)).toEqual(["Mon", "Tue"])

    const mon = matrix.rows[0]!
    expect(mon.cells[0]).toEqual({ hour: 9, v: 150, trades: 2 })
    const tue = matrix.rows[1]!
    expect(tue.cells[0]).toEqual({ hour: 9, v: -20, trades: 1 })
  })

  it("returns empty structure for no trades", () => {
    expect(computeHourWeekdayMatrix([], "UTC")).toEqual({ hours: [], rows: [] })
  })
})
