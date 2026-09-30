import { describe, it, expect } from "vitest"
import {
  countBreakEven,
  markBreakEven,
  previewRowKey,
  splitImportActions,
  toExclusionKey,
} from "./import-exclusions"
import type { PreviewRow, RowStatus } from "~/types"

function row(
  tradeNumber: number,
  netPnl: number,
  status: RowStatus = "new",
  excluded = status === "skipped"
): PreviewRow {
  return {
    tradeNumber,
    accountName: "Sim101",
    instrument:  "NQ",
    direction:   "long",
    contracts:   1,
    entryPrice:  19850,
    exitPrice:   19855,
    entryTime:   "2025-03-10T13:32:01.000Z",
    exitTime:    "2025-03-10T13:45:22.000Z",
    pnl:         netPnl + 4,
    commission:  4,
    netPnl,
    mae:         null,
    mfe:         null,
    playbookId:  null,
    session:     null,
    notes:       null,
    tags:        null,
    status,
    excluded,
  }
}

describe("previewRowKey / toExclusionKey", () => {
  it("keys by account + trade number so numbers can repeat across accounts", () => {
    expect(previewRowKey({ accountName: "Sim101", tradeNumber: 7 })).toBe("Sim101||7")
    expect(previewRowKey({ accountName: "Live42", tradeNumber: 7 })).not.toBe(
      previewRowKey({ accountName: "Sim101", tradeNumber: 7 })
    )
  })

  it("reduces a row to its natural key", () => {
    expect(toExclusionKey(row(3, 500))).toEqual({
      tradeNumber: 3,
      accountName: "Sim101",
    })
  })
})

describe("markBreakEven", () => {
  it("excludes trades within the threshold in both directions", () => {
    const rows = [row(1, 1.5), row(2, -1.75), row(3, 2), row(4, 500), row(5, -300)]
    const marked = markBreakEven(rows, 2)

    expect(marked.map((r) => r.excluded)).toEqual([true, true, true, false, false])
  })

  it("leaves already-excluded rows alone and does not re-include them", () => {
    const rows = [row(1, 900, "new", true), row(2, 0.5)]
    const marked = markBreakEven(rows, 2)

    expect(marked[0]!.excluded).toBe(true)
    expect(marked[1]!.excluded).toBe(true)
  })

  it("a zero threshold still catches exact scratches", () => {
    const marked = markBreakEven([row(1, 0), row(2, 0.25)], 0)
    expect(marked.map((r) => r.excluded)).toEqual([true, false])
  })

  it("counts only rows still kept", () => {
    const rows = [row(1, 1), row(2, 1, "new", true), row(3, 100)]
    expect(countBreakEven(rows, 2)).toBe(1)
  })
})

describe("splitImportActions", () => {
  it("imports kept new rows and excludes unmarked ones", () => {
    const rows = [row(1, 500), row(2, 0.5, "new", true)]
    const { toImport, toExclude, toRestore } = splitImportActions(rows)

    expect(toImport.map((r) => r.tradeNumber)).toEqual([1])
    expect(toExclude.map((r) => r.tradeNumber)).toEqual([2])
    expect(toRestore).toEqual([])
  })

  it("an unmarked duplicate is excluded (and gets deleted server-side)", () => {
    const { toImport, toExclude } = splitImportActions([row(9, 1, "dup", true)])

    expect(toImport).toEqual([])
    expect(toExclude.map((r) => r.tradeNumber)).toEqual([9])
  })

  it("a kept duplicate is left untouched", () => {
    const actions = splitImportActions([row(9, 500, "dup", false)])

    expect(actions.toImport).toEqual([])
    expect(actions.toExclude).toEqual([])
    expect(actions.toRestore).toEqual([])
  })

  it("re-marking a previously excluded row restores and imports it", () => {
    const { toImport, toExclude, toRestore } = splitImportActions([
      row(4, 1, "skipped", false),
    ])

    expect(toImport.map((r) => r.tradeNumber)).toEqual([4])
    expect(toRestore.map((r) => r.tradeNumber)).toEqual([4])
    expect(toExclude).toEqual([])
  })

  it("a still-excluded row needs no round trip", () => {
    const actions = splitImportActions([row(4, 1, "skipped", true)])

    expect(actions.toImport).toEqual([])
    expect(actions.toExclude).toEqual([])
    expect(actions.toRestore).toEqual([])
  })
})
