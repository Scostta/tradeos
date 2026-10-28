import { describe, expect, it } from "vitest"
import { buildSyncTradeRows } from "~/lib/ingest/ninjatrader-sync"
import { withImportKeys } from "~/helpers/trade-fingerprint"
import { ingestPayloadSchema } from "~/types/ingest"

const basePayload = {
  addonVersion: "1.0.0",
  account:      "APEX-1234",
  instrument:   "NQ 12-26",
  trades: [
    {
      direction:  "long",
      contracts:  1,
      entryPrice: 21000.25,
      exitPrice:  21010.5,
      entryTime:  "2026-10-20T13:32:01.450Z",
      exitTime:   "2026-10-20T13:45:22.900Z",
      pnl:        205,
      commission: 4.5,
      mae:        50,
      mfe:        250,
      stopPrice:  20990,
    },
  ],
}

describe("buildSyncTradeRows", () => {
  it("drops trades whose exit is before the entry (history replayed in reverse)", () => {
    const short = basePayload.trades[0]!
    const payload = ingestPayloadSchema.parse({
      ...basePayload,
      trades: [
        short,
        // El mismo trade al revés: la compra de salida como entrada de un long.
        { ...short, direction: "long", entryTime: short.exitTime, exitTime: short.entryTime },
      ],
    })

    const rows = buildSyncTradeRows(payload)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.entryTime).toBe("2026-10-20T13:32:01.450Z")
  })

  it("cleans the instrument, derives net P&L and keeps the stop", () => {
    const rows = buildSyncTradeRows(ingestPayloadSchema.parse(basePayload))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.instrument).toBe("NQ")
    expect(rows[0]!.netPnl).toBeCloseTo(200.5)
    expect(rows[0]!.stopPrice).toBe(20990)
  })

  it("produces the same import key as the CSV importer (ms truncated to seconds)", () => {
    const [row] = buildSyncTradeRows(ingestPayloadSchema.parse(basePayload))

    // Lo que daría el parser del CSV para el mismo trade (sin milisegundos).
    const [csvRow] = withImportKeys([{
      accountName: "APEX-1234",
      instrument:  "NQ",
      direction:   "long",
      contracts:   1,
      entryPrice:  21000.25,
      exitPrice:   21010.5,
      entryTime:   "2026-10-20T13:32:01.000Z",
      exitTime:    "2026-10-20T13:45:22.000Z",
    }])

    expect(row!.importKey).toBe(csvRow!.importKey)
  })

  it("numbers identical fills within the same position (#1, #2)", () => {
    const trade = basePayload.trades[0]!
    const rows = buildSyncTradeRows(
      ingestPayloadSchema.parse({ ...basePayload, trades: [trade, trade] })
    )

    expect(rows.map((r) => r.importKey.split("#")[1])).toEqual(["1", "2"])
  })

  it("normalizes offset timestamps to UTC ISO", () => {
    const trade = { ...basePayload.trades[0]!, entryTime: "2026-10-20T15:32:01+02:00" }
    const [row] = buildSyncTradeRows(ingestPayloadSchema.parse({ ...basePayload, trades: [trade] }))

    expect(row!.entryTime).toBe("2026-10-20T13:32:01.000Z")
  })
})
